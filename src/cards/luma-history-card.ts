import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { localized } from "../localize";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LovelaceCard } from "../types";
import { activityIntervals, mergeActivityIntervals, bucketCenter, bucketStart, chartWindow, historyGroups, historyNumber, historySegments, historyTimestamp, recordTime, recordValue, shiftBucket, tooltipLeft, type ActivityInterval, type ActivityPoint, type HistoryPoint, type HistoryWindow } from "../history";

interface Series { entity: string; name?: string; color?: string; attribute?: string; dashed?: boolean }
interface StateBand { entity?: string; entities?: string[]; name: string; attribute?: string; active_states: string[]; color?: string }
interface Range {
  label: string;
  hours_to_show?: number;
  days_to_show?: number;
  period?: "hour" | "day" | "week" | "month";
  statistic?: "mean" | "min" | "max" | "state" | "sum" | "change";
  chart_type?: "line" | "bar";
}
interface Config {
  type: string;
  hours_to_show?: number;
  days_to_show?: number;
  period?: "hour" | "day" | "week" | "month";
  statistic?: "mean" | "min" | "max" | "state" | "sum" | "change";
  chart_type?: "line" | "bar";
  series: Series[];
  unit?: string;
  decimals?: number;
  title?: string;
  ranges?: Range[];
  default_range?: number;
  state_bands?: StateBand[];
  include_zero?: boolean;
}
type Point = HistoryPoint;
interface Tip { time: number; values: Array<{ name: string; color: string; value?: number }> }


@customElement("luma-history-card")
export class LumaHistoryCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: Config;
  @state() private data = new Map<string, Point[]>();
  @state() private loading = true;
  @state() private error = "";
  @state() private tip?: Tip;
  @state() private activeRange = 0;
  private refreshTimer?: number;
  private requestKey = "";
  private loadSequence = 0;
  private window?: HistoryWindow;
  private bands = new Map<string, ActivityInterval[]>();
  private resizeObserver?: ResizeObserver;
  private frame?: number;

  static styles = [lumaTokens, css`
    ha-card{position:relative;min-height:300px;padding:18px 18px 13px;border:1px solid color-mix(in srgb,var(--primary-color) 14%,transparent);border-radius:22px;background:linear-gradient(145deg,color-mix(in srgb,var(--primary-color) 5%,var(--luma-surface)),var(--luma-surface) 68%);box-shadow:0 14px 38px rgba(0,0,0,.055);overflow:hidden}
    .top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;margin-bottom:7px}.title{font-size:13px;font-weight:720}.head-right{display:flex;flex:1 1 240px;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:9px;min-width:0}.ranges{display:flex;flex-shrink:0;max-width:100%;overflow-x:auto;padding:2px;border-radius:999px;background:color-mix(in srgb,var(--primary-color) 7%,transparent)}.range{appearance:none;border:0;border-radius:999px;min-height:28px;padding:5px 9px;background:transparent;color:var(--luma-muted);font:650 9px/1 sans-serif;cursor:pointer;transition:background .18s ease,color .18s ease,box-shadow .18s ease}.range.active{background:var(--luma-surface);color:var(--primary-color);box-shadow:0 2px 8px rgba(0,0,0,.08)}.legend{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:7px}.legend-item{display:flex;align-items:center;gap:5px;color:var(--luma-muted);font-size:9px}.swatch{width:7px;height:7px;border-radius:50%;background:var(--series-color)}.legend-item strong{color:var(--primary-text-color);font-size:10px}
    .chart{position:relative;width:100%;touch-action:pan-y}.chart canvas{display:block;width:100%;height:225px}
    .tooltip{position:absolute;z-index:2;top:9px;left:8px;min-width:min(118px,calc(100% - 16px));max-width:calc(100% - 16px);overflow-wrap:anywhere;padding:8px 9px;border:1px solid var(--luma-border);border-radius:12px;background:color-mix(in srgb,var(--luma-surface) 94%,transparent);box-shadow:0 10px 28px rgba(0,0,0,.12);font-size:9px;pointer-events:none;backdrop-filter:blur(14px)}.tip-time{margin-bottom:5px;color:var(--luma-muted)}.tip-row{display:flex;justify-content:space-between;gap:12px}.tip-row strong{white-space:nowrap}.tip-row span:first-child{color:var(--series-color)}.empty{display:grid;place-items:center;min-height:220px;color:var(--luma-muted);font-size:11px}
    @media(max-width:600px){ha-card{min-height:240px;padding:14px 10px 10px}.top{align-items:flex-start;flex-wrap:wrap}.head-right{width:100%;justify-content:space-between}.legend{gap:5px}.chart canvas{height:190px}.tooltip{transform:none;left:8px}}
  `];

  setConfig(config: Config) {
    if (!config?.series?.length) throw Error("series required");
    for (const band of config.state_bands || []) {
      if (!(band.entity || band.entities?.length) || !band.active_states?.length) throw Error('state_bands require entity or entities and active_states');
    }
    if (config.series.some(series => series.attribute) && (config.period || config.statistic || config.chart_type === 'bar' || config.ranges?.some(range => range.period || range.statistic || range.chart_type === 'bar'))) throw Error('Attribute series require raw history, not recorder statistics');
    this.config = { hours_to_show: 24, decimals: 0, ...config };
    this.activeRange = config.default_range ?? 0;
    if (!Number.isInteger(this.activeRange) || this.activeRange < 0 || (this.activeRange > 0 && this.activeRange >= (config.ranges?.length || 0))) throw Error("default_range must select an existing range");
    this.requestKey = "";
    void this.load();
  }
  getCardSize() { return 5; }
  connectedCallback() { super.connectedCallback(); if(this.hasUpdated){this.resizeObserver?.observe(this);this.requestUpdate();} this.refreshTimer = window.setInterval(() => void this.load(true), 300000); }
  disconnectedCallback() { super.disconnectedCallback(); clearInterval(this.refreshTimer); this.resizeObserver?.disconnect(); cancelAnimationFrame(this.frame || 0); this.loadSequence++; this.requestKey = ""; }
  protected firstUpdated() { this.resizeObserver = new ResizeObserver(() => this.scheduleDraw()); this.resizeObserver.observe(this); }
  private scheduleDraw() { cancelAnimationFrame(this.frame || 0); this.frame = requestAnimationFrame(() => { this.draw(); this.positionTooltip(); }); }
  private positionTooltip() {
    const chart = this.renderRoot.querySelector<HTMLElement>('.chart');
    const tooltip = this.renderRoot.querySelector<HTMLElement>('.tooltip');
    if (!chart || !tooltip || !this.tip) return;
    const bounds = this.bounds(), width = chart.clientWidth;
    const time = this.settings().chart_type === 'bar' ? bucketCenter(this.tip.time, this.settings().period || 'day') : this.tip.time;
    const anchor = 38 + (time - bounds.start) / (bounds.end - bounds.start) * (width - 46);
    tooltip.style.left = `${tooltipLeft(anchor, tooltip.getBoundingClientRect().width, width)}px`;
  }
  updated() {
    if (this.hass && this.config) {
      const key = this.requestIdentity();
      if (key !== this.requestKey) void this.load();
    }
    this.scheduleDraw();
  }

  private settings(): Config & Partial<Range> {
    return { ...this.config!, ...(this.config?.ranges?.[this.activeRange] || {}) };
  }

  private requestIdentity() {
    const settings = this.settings();
    return `${settings.series.map((item) => `${item.entity}:${item.attribute || ""}`).join("|")}|${settings.hours_to_show}|${settings.days_to_show}|${settings.period}|${settings.statistic}|${settings.chart_type}|${JSON.stringify(settings.state_bands || [])}`;
  }

  private selectRange(index: number) {
    if (index === this.activeRange) return;
    this.activeRange = index;
    this.data = new Map();
    this.tip = undefined;
    this.requestKey = "";
    void this.load();
  }

  private async load(silent = false) {
    if (!this.hass?.callWS || !this.config) return;
    const settings = this.settings(), key = this.requestIdentity(), sequence = ++this.loadSequence;
    this.requestKey = key;
    if (!silent) this.loading = true;
    try {
      const now = Date.now(), hours = settings.days_to_show ? settings.days_to_show * 24 : (settings.hours_to_show || 24);
      const statistics = Boolean(settings.period || settings.statistic || settings.chart_type === 'bar');
      const period = settings.period || 'day';
      const window = chartWindow(now, hours, settings.chart_type === 'bar' ? period : undefined);
      const bands = settings.state_bands || [];
      const historyIds = [...new Set([...(statistics ? [] : settings.series.map(item => item.entity)), ...bands.flatMap(item => item.entities || (item.entity ? [item.entity] : []))])];
      const [raw, history] = await Promise.all([
        statistics ? this.hass.callWS<unknown>({
          type: 'recorder/statistics_during_period', start_time: new Date(window.start).toISOString(), end_time: new Date(now).toISOString(),
          statistic_ids: settings.series.map(item => item.entity), period, types: [settings.statistic || 'change'],
        }) : Promise.resolve(undefined),
        historyIds.length ? this.hass.callWS<unknown>({
          type: 'history/history_during_period', start_time: new Date(window.start).toISOString(), end_time: new Date(now).toISOString(),
          entity_ids: historyIds, minimal_response: false,
          no_attributes: !settings.series.some(item => item.attribute) && !bands.some(item => item.attribute), significant_changes_only: false,
        }) : Promise.resolve(undefined),
      ]);
      if (sequence !== this.loadSequence) return;
      const next = new Map<string, Point[]>();
      const groups = new Map(historyGroups(statistics ? raw : history).map(group => [group.id, group.records]));
      for (const series of settings.series) {
        const records = groups.get(series.entity) || [];
        const points: Point[] = records.map(record => ({
          time: statistics ? historyTimestamp(record.start) : recordTime(record),
          value: historyNumber(statistics ? record[settings.statistic || 'change'] : recordValue(record, series.attribute)),
        })).filter(point => Number.isFinite(point.time)).sort((a,b) => a.time-b.time);
        // A recorder seed can predate the window. Keep it for continuous lines;
        // statistics outside the requested buckets must never be clamped onto a bar.
        const visible = statistics ? points.filter(point => point.time >= window.start && point.time < window.end) : points;
        next.set(this.seriesKey(series), visible);
      }
      const bandGroups = new Map(historyGroups(history).map(group => [group.id, group.records]));
      const nextBands = new Map<string, ActivityInterval[]>();
      bands.forEach((band, index) => {
        const ids = band.entities || (band.entity ? [band.entity] : []);
        const intervals = ids.flatMap(id => {
          const points: ActivityPoint[] = (bandGroups.get(id) || []).map(record => {
            const value = recordValue(record, band.attribute);
            return { time: recordTime(record), active: value == null ? undefined : band.active_states.includes(String(value)) };
          });
          return activityIntervals(points, { start: window.start, end: Math.min(window.end, now) });
        });
        nextBands.set(String(index), mergeActivityIntervals(intervals));
      });
      this.window = window; this.data = next; this.bands = nextBands; this.tip = undefined; this.error = '';
    } catch (error) {
      if (sequence !== this.loadSequence) return;
      this.error = error instanceof Error ? error.message : localized(this.hass,'The chart could not be loaded','A grafikon nem tölthető be');
    } finally {
      if (sequence === this.loadSequence) this.loading = false;
    }
  }

  private seriesKey(series: Series) { return `${series.entity}:${series.attribute || ''}`; }
  private points(series: Series) { return this.data.get(this.seriesKey(series)) || []; }
  private color(series: Series, index: number) { return series.color || ["#f5b942", "#7aaad6", "#65b982", "#8b7bd8"][index % 4]; }
  private bounds() {
    const settings = this.settings();
    const hours = settings.days_to_show ? settings.days_to_show * 24 : (settings.hours_to_show || 24);
    const window = this.window || chartWindow(Date.now(), hours, settings.chart_type === 'bar' ? settings.period || 'day' : undefined);
    const values = [...this.data.values()].flat().filter(point => point.time <= window.end && point.value != null).map(point => point.value!);
    const includeZero = settings.chart_type === 'bar' || settings.include_zero !== false;
    const rawMin = values.reduce((min, value) => Math.min(min, value), includeZero ? 0 : Infinity);
    const rawMax = values.reduce((max, value) => Math.max(max, value), includeZero ? 0 : -Infinity);
    if (!values.length) return { ...window, min: 0, max: 1 };
    const span = rawMax - rawMin || Math.max(Math.abs(rawMax) * .05, 1);
    const min = includeZero && rawMin >= 0 ? 0 : rawMin - span * .08;
    const max = includeZero && rawMax === 0 && rawMin === 0 ? 1 : rawMax + span * .08;
    return { ...window, min, max: max > min ? max : min + 1 };
  }
  private draw() {
    const canvas = this.renderRoot.querySelector("canvas");
    if (!canvas || !this.config) return;
    const settings = this.settings();
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 46 || rect.height === 0) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    const width = rect.width, height = rect.height, left = 38, right = 8, top = 12, bottom = 24;
    const plotWidth = width - left - right, plotHeight = height - top - bottom, bounds = this.bounds();
    const style = getComputedStyle(this), muted = style.getPropertyValue("--secondary-text-color").trim() || "#7a7d86";
    context.font = "9px sans-serif";
    context.fillStyle = muted;
    context.strokeStyle = "rgba(110,115,130,.14)";
    context.lineWidth = 1;
    for (let index = 0; index <= 4; index++) {
      const fraction = index / 4, y = top + fraction * plotHeight;
      context.beginPath(); context.moveTo(left, y); context.lineTo(width - right, y); context.stroke();
      const step = (bounds.max - bounds.min) / 4;
      const precision = step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step)) + 1);
      context.textAlign = 'right'; context.fillText((bounds.max - (bounds.max - bounds.min) * fraction).toLocaleString(this.hass?.locale?.language, { maximumFractionDigits: precision }), left - 6, y + 3);
    }
    const timeLabel = (time: number) => {
      const options: Intl.DateTimeFormatOptions = settings.period === 'month' ? { month: 'short', year: '2-digit' } : { month: 'short', day: 'numeric' };
      return settings.period === 'day' || settings.period === 'week' || settings.period === 'month'
        ? new Date(time).toLocaleDateString(this.hass?.locale?.language, options)
        : new Date(time).toLocaleTimeString(this.hass?.locale?.language, { hour: '2-digit', minute: '2-digit', hour12: false });
    };
    const labels = Array.from({length:5}, (_,index) => {
      const fraction = index / 4;
      const time = bounds.start + fraction * (bounds.end - bounds.start - 1);
      const text = timeLabel(time), textWidth = context.measureText(text).width;
      const x = Math.max(left, Math.min(width - right - textWidth, left + fraction * plotWidth - textWidth / 2));
      return { text, x, end: x + textWidth };
    });
    let lastEnd = -Infinity;
    context.textAlign = 'left';
    labels.forEach((label,index) => {
      if (label.x < lastEnd + 12 || (index > 0 && index < 4 && label.end > labels[4].x - 12)) return;
      context.fillText(label.text, label.x, height - 5); lastEnd = label.end;
    });
    // Clip series and activity areas to the plot, including old recorder seeds.
    context.save(); context.beginPath(); context.rect(left, top, plotWidth, plotHeight); context.clip();
    (settings.state_bands || []).forEach((band, index) => {
      context.fillStyle = band.color || '#e9a15b'; context.globalAlpha = .13;
      for (const interval of this.bands.get(String(index)) || []) {
        const x = left + (interval.start - bounds.start) / (bounds.end - bounds.start) * plotWidth;
        context.fillRect(x, top, (interval.end - interval.start) / (bounds.end - bounds.start) * plotWidth, plotHeight);
      }
      context.globalAlpha = 1;
    });
    this.config.series.forEach((series, index) => {
      const points = this.points(series);
      if (!points.length) return;
      const position = (point: Required<Point>) => ({ x: left + (point.time - bounds.start) / (bounds.end - bounds.start) * plotWidth, y: top + (bounds.max - point.value) / (bounds.max - bounds.min) * plotHeight });
      if (settings.chart_type === 'bar') {
        const period = settings.period || 'day';
        const base = top + bounds.max / (bounds.max - bounds.min) * plotHeight;
        context.fillStyle = this.color(series, index);
        points.forEach(point => {
          if (point.value == null || point.time < bounds.start || point.time >= bounds.end) return;
          const start = bucketStart(point.time, period), end = shiftBucket(start, period, 1);
          const slotWidth = (end - start) / (bounds.end - bounds.start) * plotWidth;
          const groupWidth = slotWidth * .72, barWidth = Math.min(30, groupWidth / settings.series.length);
          const center = left + (bucketCenter(point.time, period) - bounds.start) / (bounds.end - bounds.start) * plotWidth;
          const x = center + (index - (settings.series.length - 1) / 2) * barWidth;
          const y = position(point as Required<Point>).y;
          if (point.value === 0) { context.fillRect(x - barWidth / 2, base - 1, barWidth, 1); return; }
          context.beginPath(); context.roundRect(x - barWidth / 2, Math.min(y, base), Math.max(1, barWidth - 1), Math.abs(base - y), Math.min(4, barWidth / 3, Math.abs(base-y)/2)); context.fill();
        });
        return;
      }
      for (const segment of historySegments(points, bounds)) {
        const coordinates = segment.map(position);
        // With explicit activity bands, the line remains clear of a second area fill.
        if (!settings.state_bands?.length) {
          const gradient = context.createLinearGradient(0, top, 0, top + plotHeight);
          gradient.addColorStop(0, this.color(series, index)); gradient.addColorStop(1, this.color(series, index));
          context.beginPath(); coordinates.forEach((point, i) => i ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
          context.lineTo(coordinates.at(-1)!.x, top + plotHeight); context.lineTo(coordinates[0].x, top + plotHeight); context.closePath(); context.fillStyle = gradient; context.globalAlpha = .06; context.fill(); context.globalAlpha = 1;
        }
        context.beginPath(); coordinates.forEach((point, i) => i ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
        context.strokeStyle = this.color(series, index); context.lineWidth = 2.5; context.lineJoin = 'round'; context.lineCap = 'round'; context.setLineDash(series.dashed ? [5, 4] : []); context.stroke(); context.setLineDash([]);
      }
    });
    context.restore();
    if (this.tip) {
      const tipTime = settings.chart_type === 'bar' ? bucketCenter(this.tip.time, settings.period || 'day') : this.tip.time;
      const x = left + (tipTime - bounds.start) / (bounds.end - bounds.start) * plotWidth;
      context.setLineDash([3, 3]); context.strokeStyle = "rgba(80,85,100,.35)"; context.lineWidth = 1;
      context.beginPath(); context.moveTo(x, top); context.lineTo(x, top + plotHeight); context.stroke(); context.setLineDash([]);
    }
  }
  private pointAt(points: Point[], time: number, period?: Range['period']) {
    if (period) return points.find(point => bucketStart(point.time, period) === bucketStart(time, period));
    // Recorder states persist until the next change. Never bridge unknown gaps.
    return points.filter(point => point.time <= time).at(-1);
  }
  private move(event: PointerEvent) {
    if (!this.config) return;
    const settings = this.settings(), rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left - 38) / Math.max(1, rect.width - 46)));
    const bounds = this.bounds(), time = bounds.start + ratio * (bounds.end - bounds.start - 1);
    const period = settings.chart_type === 'bar' ? settings.period || 'day' : settings.period;
    const selected = settings.series.map((series, index) => ({ series, index, point: this.pointAt(this.points(series), time, period) }));
    this.tip = { time: period ? bucketStart(time, period) : time, values: selected.map(({ series, index, point }) => ({ name: series.name || series.entity, color: this.color(series, index), value: point?.value })) };
  }

  render() {
    if (!this.config) return nothing;
    const settings = this.settings();
    if (this.loading && !this.data.size) return html`<ha-card><div class="empty">${localized(this.hass,"Loading history…","Előzmények betöltése…")}</div></ha-card>`;
    const hasValues = [...this.data.values()].some(points => points.some(point => point.value != null));
    const unit = settings.unit || this.hass?.states[settings.series[0].entity]?.attributes?.unit_of_measurement || "";
    const format = (value: number | undefined) => value === undefined ? "—" : `${value.toFixed(this.config?.decimals || 0)}${unit ? ` ${unit}` : ""}`;
    return html`<ha-card>
      <div class="top"><div class="title">${settings.title || localized(this.hass,"History","Előzmények")}</div><div class="head-right">${this.config.ranges?.length ? html`<div class="ranges">${this.config.ranges.map((range,index)=>html`<button class=${`range ${index===this.activeRange?"active":""}`} @click=${()=>this.selectRange(index)}>${range.label}</button>`)}</div>` : nothing}<div class="legend">${settings.series.map((series, index) => { const points = this.points(series); return html`<span class="legend-item" style=${`--series-color:${this.color(series,index)}`}><i class="swatch"></i>${series.name || series.entity}<strong>${format(points.at(-1)?.value)}</strong></span>`; })}</div></div></div>
      ${settings.state_bands?.length ? html`<div class="legend" style="justify-content:flex-start;margin:8px 0">${settings.state_bands.map(band => html`<span class="legend-item" style=${`--series-color:${band.color || '#e9a15b'}`}><i class="swatch"></i>${band.name}</span>`)}</div>` : nothing}
      ${!hasValues ? html`<div class="empty">${this.error || localized(this.hass,'No numeric history in this time range','Nincs számszerű előzmény ebben az időszakban')}</div>` : nothing}
      <div class="chart" style=${hasValues ? '' : 'display:none'} @pointermove=${this.move} @pointerleave=${() => this.tip = undefined}>
        <canvas role="img" aria-label=${settings.title || localized(this.hass,"History","Előzmények")}></canvas>
        ${this.tip ? html`<div class="tooltip"><div class="tip-time">${settings.period === "day" || settings.period === "week" || settings.period === "month" ? new Date(this.tip.time).toLocaleDateString(this.hass?.locale?.language||undefined,settings.period === "month"?{year:"numeric",month:"long"}:{month:"short",day:"numeric"}) : new Date(this.tip.time).toLocaleString(this.hass?.locale?.language||undefined,{hour:"2-digit",minute:"2-digit",hour12:false})}</div>${this.tip.values.map((item)=>html`<div class="tip-row" style=${`--series-color:${item.color}`}><span>${item.name}</span><strong>${format(item.value)}</strong></div>`)}</div>` : nothing}
      </div>
    </ha-card>`;
  }
}
