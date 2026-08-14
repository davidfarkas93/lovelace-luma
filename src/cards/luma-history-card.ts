import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LovelaceCard } from "../types";

interface Series { entity: string; name?: string; color?: string }
interface Config { type: string; hours_to_show?: number; series: Series[]; unit?: string; decimals?: number; title?: string }
interface Point { time: number; value: number }
interface Tip { time: number; values: Array<{ name: string; color: string; value?: number }> }
type HistoryRecord = Record<string, unknown>;

@customElement("luma-history-card")
export class LumaHistoryCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: Config;
  @state() private data = new Map<string, Point[]>();
  @state() private loading = true;
  @state() private error = "";
  @state() private tip?: Tip;
  private refreshTimer?: number;
  private requestKey = "";

  static styles = [lumaTokens, css`
    ha-card{position:relative;min-height:300px;padding:18px 18px 13px;border:1px solid color-mix(in srgb,var(--primary-color) 14%,transparent);border-radius:22px;background:linear-gradient(145deg,color-mix(in srgb,var(--primary-color) 5%,var(--luma-surface)),var(--luma-surface) 68%);box-shadow:0 14px 38px rgba(0,0,0,.055);overflow:hidden}
    .top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:7px}.title{font-size:13px;font-weight:720}.legend{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:7px}.legend-item{display:flex;align-items:center;gap:5px;color:var(--luma-muted);font-size:9px}.swatch{width:7px;height:7px;border-radius:50%;background:var(--series-color)}.legend-item strong{color:var(--primary-text-color);font-size:10px}
    .chart{position:relative;width:100%;touch-action:none}.chart canvas{display:block;width:100%;height:225px}
    .tooltip{position:absolute;z-index:2;top:9px;left:var(--tip-x);min-width:118px;padding:8px 9px;border:1px solid var(--luma-border);border-radius:12px;background:color-mix(in srgb,var(--luma-surface) 94%,transparent);box-shadow:0 10px 28px rgba(0,0,0,.12);font-size:9px;pointer-events:none;transform:translateX(-50%);backdrop-filter:blur(14px)}.tip-time{margin-bottom:5px;color:var(--luma-muted)}.tip-row{display:flex;justify-content:space-between;gap:12px}.tip-row span:first-child{color:var(--series-color)}.empty{display:grid;place-items:center;min-height:220px;color:var(--luma-muted);font-size:11px}
    @media(max-width:600px){ha-card{min-height:240px;padding:14px 10px 10px}.top{align-items:flex-start}.legend{gap:5px}.chart canvas{height:190px}.tooltip{transform:none;left:8px}}
  `];

  setConfig(config: Config) {
    if (!config?.series?.length) throw Error("series required");
    this.config = { hours_to_show: 24, decimals: 0, ...config };
    this.requestKey = "";
    void this.load();
  }
  getCardSize() { return 5; }
  connectedCallback() { super.connectedCallback(); this.refreshTimer = window.setInterval(() => void this.load(true), 300000); }
  disconnectedCallback() { super.disconnectedCallback(); clearInterval(this.refreshTimer); }
  updated() {
    if (this.hass && this.config) {
      const key = this.config.series.map((item) => item.entity).join("|");
      if (key !== this.requestKey) void this.load();
    }
    requestAnimationFrame(() => this.draw());
  }

  private timestamp(record: HistoryRecord) {
    const stamp = record.last_changed ?? record.last_updated ?? record.lc ?? record.lu;
    if (typeof stamp === "number") return stamp * 1000;
    if (typeof stamp === "string" && /^\d+(\.\d+)?$/.test(stamp)) return Number(stamp) * 1000;
    return new Date(String(stamp ?? "")).getTime();
  }

  private historyGroups(raw: unknown): Array<{ id: string; records: unknown }> {
    if (Array.isArray(raw)) {
      return raw.map((records) => ({
        id: String(Array.isArray(records) ? records[0]?.entity_id ?? records[0]?.entityId ?? "" : ""),
        records,
      }));
    }
    if (raw && typeof raw === "object") {
      return Object.entries(raw as Record<string, unknown>).map(([id, records]) => ({ id, records }));
    }
    return [];
  }

  private async load(silent = false) {
    if (!this.hass?.callWS || !this.config) return;
    const key = this.config.series.map((item) => item.entity).join("|");
    this.requestKey = key;
    if (!silent) this.loading = true;
    try {
      const end = new Date();
      const start = new Date(end.getTime() - (this.config.hours_to_show || 24) * 3600000);
      const raw = await this.hass.callWS<unknown>({
        type: "history/history_during_period",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        entity_ids: this.config.series.map((item) => item.entity),
        minimal_response: false,
        no_attributes: true,
        significant_changes_only: false,
      });
      const next = new Map<string, Point[]>();
      for (const { id, records } of this.historyGroups(raw)) {
        if (!id || !Array.isArray(records)) continue;
        const points = records
          .map((item: unknown) => {
            const record = item as HistoryRecord;
            return { time: this.timestamp(record), value: Number(record.state ?? record.s) };
          })
          .filter((point: Point) => Number.isFinite(point.time) && Number.isFinite(point.value))
          .sort((a, b) => a.time - b.time);
        if (points.length) next.set(id, points);
      }
      this.data = next;
      this.error = "";
    } catch (error) {
      this.error = error instanceof Error ? error.message : "A grafikon nem tölthető be";
    } finally {
      this.loading = false;
    }
  }

  private color(series: Series, index: number) { return series.color || ["#f5b942", "#7aaad6", "#65b982", "#8b7bd8"][index % 4]; }
  private bounds() {
    const end = Date.now();
    const start = end - (this.config?.hours_to_show || 24) * 3600000;
    const values = [...this.data.values()].flat().map((point) => point.value);
    return { start, end, max: Math.max(1, ...values) * 1.08 };
  }
  private draw() {
    const canvas = this.renderRoot.querySelector("canvas");
    if (!canvas || !this.config) return;
    const rect = canvas.getBoundingClientRect();
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
      context.textAlign = "right"; context.fillText(String(Math.round(bounds.max * (1 - fraction))), left - 6, y + 3);
      const time = bounds.start + fraction * (bounds.end - bounds.start);
      context.textAlign = index === 0 ? "left" : index === 4 ? "right" : "center";
      context.fillText(new Date(time).toLocaleTimeString(this.hass?.locale?.language || undefined, { hour: "2-digit", minute: "2-digit", hour12: false }), left + fraction * plotWidth, height - 5);
    }
    this.config.series.forEach((series, index) => {
      const points = this.data.get(series.entity) || [];
      if (!points.length) return;
      const coordinates = points.map((point) => ({ x: left + (point.time - bounds.start) / (bounds.end - bounds.start) * plotWidth, y: top + (1 - point.value / bounds.max) * plotHeight }));
      const gradient = context.createLinearGradient(0, top, 0, top + plotHeight);
      gradient.addColorStop(0, `${this.color(series, index)}44`); gradient.addColorStop(1, `${this.color(series, index)}00`);
      context.beginPath(); coordinates.forEach((point, i) => i ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
      context.lineTo(coordinates.at(-1)!.x, top + plotHeight); context.lineTo(coordinates[0].x, top + plotHeight); context.closePath(); context.fillStyle = gradient; context.fill();
      context.beginPath(); coordinates.forEach((point, i) => i ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
      context.strokeStyle = this.color(series, index); context.lineWidth = 2.5; context.lineJoin = "round"; context.lineCap = "round"; context.stroke();
    });
    if (this.tip) {
      const x = left + (this.tip.time - bounds.start) / (bounds.end - bounds.start) * plotWidth;
      context.setLineDash([3, 3]); context.strokeStyle = "rgba(80,85,100,.35)"; context.lineWidth = 1;
      context.beginPath(); context.moveTo(x, top); context.lineTo(x, top + plotHeight); context.stroke(); context.setLineDash([]);
    }
  }
  private nearest(points: Point[], time: number) {
    return points.reduce<Point | undefined>((best, point) => !best || Math.abs(point.time - time) < Math.abs(best.time - time) ? point : best, undefined);
  }
  private move(event: PointerEvent) {
    if (!this.config) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const bounds = this.bounds();
    const time = bounds.start + ratio * (bounds.end - bounds.start);
    this.tip = { time, values: this.config.series.map((series, index) => ({ name: series.name || series.entity, color: this.color(series, index), value: this.nearest(this.data.get(series.entity) || [], time)?.value })) };
    this.style.setProperty("--tip-x", `${ratio * 100}%`);
  }

  render() {
    if (!this.config) return nothing;
    if (this.loading && !this.data.size) return html`<ha-card><div class="empty">Előzmények betöltése…</div></ha-card>`;
    if (this.error && !this.data.size) return html`<ha-card><div class="empty">${this.error}</div></ha-card>`;
    const bounds = this.bounds();
    const unit = this.config.unit || this.hass?.states[this.config.series[0].entity]?.attributes?.unit_of_measurement || "";
    const format = (value: number | undefined) => value === undefined ? "—" : `${value.toFixed(this.config?.decimals || 0)}${unit ? ` ${unit}` : ""}`;
    return html`<ha-card>
      <div class="top"><div class="title">${this.config.title || "Előzmények"}</div><div class="legend">${this.config.series.map((series, index) => { const points = this.data.get(series.entity) || []; return html`<span class="legend-item" style=${`--series-color:${this.color(series,index)}`}><i class="swatch"></i>${series.name || series.entity}<strong>${format(points.at(-1)?.value)}</strong></span>`; })}</div></div>
      <div class="chart" @pointermove=${this.move} @pointerleave=${() => this.tip = undefined}>
        <canvas></canvas>
        ${this.tip ? html`<div class="tooltip"><div class="tip-time">${new Date(this.tip.time).toLocaleString(this.hass?.locale?.language||undefined,{hour:"2-digit",minute:"2-digit",hour12:false})}</div>${this.tip.values.map((item)=>html`<div class="tip-row" style=${`--series-color:${item.color}`}><span>${item.name}</span><strong>${format(item.value)}</strong></div>`)}</div>` : nothing}
      </div>
    </ha-card>`;
  }
}
