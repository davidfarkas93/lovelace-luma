import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { localized } from "../localize";
import { lumaTokens } from "../styles";
import type { HassEntity, HomeAssistant, LovelaceCard } from "../types";

interface Period {
  label: string;
  icon?: string;
  total_entity: string;
  pv_entity: string;
  grid_entity: string;
  share_entity?: string;
  sessions_entity?: string;
  cost_entity?: string;
  cost_label?: string;
  cost_unit?: string;
}

interface Config {
  type: string;
  title?: string;
  subtitle?: string;
  unit?: string;
  decimals?: number;
  periods: Period[];
}

@customElement("luma-period-stats-card")
export class LumaPeriodStatsCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: Config;
  @state() private page = 0;
  private dragStart?: number;

  static styles = [lumaTokens, css`
    ha-card{padding:17px;border:1px solid color-mix(in srgb,var(--primary-color) 13%,transparent);border-radius:22px;background:linear-gradient(145deg,color-mix(in srgb,var(--primary-color) 5%,var(--luma-surface)),var(--luma-surface) 70%);box-shadow:var(--luma-shadow);touch-action:pan-y;user-select:none}
    .head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:15px}.copy{min-width:0}.title{font-size:14px;font-weight:var(--luma-weight-title)}.subtitle{margin-top:2px;color:var(--luma-muted);font-size:10px}.tabs{display:flex;flex:0 0 auto;padding:3px;border-radius:999px;background:color-mix(in srgb,var(--primary-color) 7%,transparent)}.tab{display:flex;align-items:center;gap:5px;min-height:28px;padding:6px 10px;border:0;border-radius:999px;background:transparent;color:var(--luma-muted);font:680 10px/1 sans-serif;cursor:pointer;transition:.18s ease}.tab ha-icon{--mdc-icon-size:14px}.tab:hover{color:var(--primary-color)}.tab.active{background:var(--luma-surface);color:var(--primary-color);box-shadow:0 3px 10px rgba(0,0,0,.08)}
    .summary{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:14px;align-items:stretch}.main{display:grid;grid-template-columns:46px minmax(0,1fr);grid-template-areas:"icon period" "icon total" "rail rail";align-items:center;gap:2px 11px;padding:14px;border-radius:18px;background:color-mix(in srgb,var(--primary-color) 5%,transparent)}.period-icon{grid-area:icon;display:grid;place-items:center;width:46px;height:46px;border-radius:15px;background:color-mix(in srgb,var(--primary-color) 11%,transparent);color:var(--primary-color)}.period-icon ha-icon{--mdc-icon-size:23px}.period{grid-area:period;color:var(--luma-muted);font-size:10px;font-weight:720;text-transform:uppercase;letter-spacing:.04em}.total{grid-area:total;font-size:25px;font-weight:760;line-height:1.05}.rail{grid-area:rail;display:flex;height:6px;margin-top:12px;border-radius:999px;overflow:hidden;background:color-mix(in srgb,var(--primary-text-color) 7%,transparent)}.pv{background:#58b984}.grid{background:#f4a62a}.unknown{background:color-mix(in srgb,var(--primary-text-color) 10%,transparent)}
    .details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.metric{display:grid;grid-template-columns:30px minmax(0,1fr);grid-template-areas:"i l" "i v";align-items:center;gap:1px 8px;min-height:58px;padding:9px;border-radius:15px;background:color-mix(in srgb,var(--tone) 7%,transparent)}.metric .i{grid-area:i;display:grid;place-items:center;width:30px;height:30px;border-radius:10px;background:color-mix(in srgb,var(--tone) 14%,transparent);color:var(--tone)}.metric ha-icon{--mdc-icon-size:17px}.metric .label{grid-area:l;color:var(--luma-muted);font-size:9px}.metric .value{grid-area:v;overflow:hidden;font-size:14px;font-weight:720;text-overflow:ellipsis;white-space:nowrap}
    .hint{display:none;margin-top:9px;color:var(--luma-muted);font-size:9px;text-align:center}
    @media(max-width:650px){ha-card{padding:13px}.head{display:grid;margin-bottom:12px}.tabs{width:100%}.tab{flex:1;justify-content:center}.summary{grid-template-columns:1fr}.main{padding:12px}.hint{display:block}}
  `];

  setConfig(config: Config) {
    if (!config?.periods?.length) throw Error("periods required");
    this.config = { unit: "kWh", decimals: 2, ...config };
    this.page = Math.min(this.page, config.periods.length - 1);
  }

  getCardSize() { return 3; }

  private entity(id?: string): HassEntity | undefined { return id ? this.hass?.states[id] : undefined; }
  private numeric(id?: string) {
    const value = Number(this.entity(id)?.state);
    return Number.isFinite(value) ? value : undefined;
  }
  private value(id?: string, decimals = this.config?.decimals ?? 2, unit = this.config?.unit || "") {
    const value = this.numeric(id);
    return value === undefined ? "—" : `${value.toFixed(decimals)}${unit ? ` ${unit}` : ""}`;
  }
  private select(page: number) {
    if (!this.config) return;
    this.page = (page + this.config.periods.length) % this.config.periods.length;
  }
  private pointerDown(event: PointerEvent) { this.dragStart = event.clientX; }
  private pointerUp(event: PointerEvent) {
    if (this.dragStart === undefined) return;
    const delta = event.clientX - this.dragStart;
    this.dragStart = undefined;
    if (Math.abs(delta) > 45) this.select(this.page + (delta < 0 ? 1 : -1));
  }

  render() {
    if (!this.hass || !this.config) return nothing;
    const period = this.config.periods[this.page];
    const total = this.numeric(period.total_entity) || 0;
    const pv = this.numeric(period.pv_entity) || 0;
    const grid = this.numeric(period.grid_entity) || 0;
    const known = Math.max(total, pv + grid, 0);
    const pvPct = known > 0 ? Math.max(0, pv / known * 100) : 0;
    const gridPct = known > 0 ? Math.max(0, grid / known * 100) : 0;
    const unknownPct = Math.max(0, 100 - pvPct - gridPct);
    const share = this.numeric(period.share_entity);
    const sessions = this.numeric(period.sessions_entity);
    const cost = this.numeric(period.cost_entity);
    return html`
      <ha-card @pointerdown=${this.pointerDown} @pointerup=${this.pointerUp}>
        <div class="head">
          <div class="copy"><div class="title">${this.config.title || localized(this.hass,"Charging statistics","Töltési statisztika")}</div>${this.config.subtitle ? html`<div class="subtitle">${this.config.subtitle}</div>` : nothing}</div>
          <div class="tabs" role="tablist">${this.config.periods.map((item,index)=>html`<button class=${`tab ${index===this.page?"active":""}`} role="tab" aria-selected=${index===this.page} @click=${()=>this.select(index)}><ha-icon icon=${item.icon||"mdi:calendar-outline"}></ha-icon>${item.label}</button>`)}</div>
        </div>
        <div class="summary">
          <div class="main">
            <span class="period-icon"><ha-icon icon=${period.icon||"mdi:chart-donut"}></ha-icon></span>
            <span class="period">${period.label}</span>
            <span class="total">${this.value(period.total_entity)}</span>
            <span class="rail"><span class="pv" style=${`width:${pvPct}%`}></span><span class="grid" style=${`width:${gridPct}%`}></span><span class="unknown" style=${`width:${unknownPct}%`}></span></span>
          </div>
          <div class="details">
            ${this.metric("mdi:solar-power",localized(this.hass,"Solar","Napenergia"),this.value(period.pv_entity),"#58b984")}
            ${this.metric("mdi:transmission-tower-import",localized(this.hass,"Grid","Hálózat"),this.value(period.grid_entity),"#f4a62a")}
            ${this.metric("mdi:chart-donut",localized(this.hass,"Solar share","PV arány"),share===undefined?"—":`${share.toFixed(1)} %`,"#58b984")}
            ${cost===undefined
              ? this.metric("mdi:counter",localized(this.hass,"Sessions","Sessionök"),sessions===undefined?"—":String(Math.round(sessions)),"var(--primary-color)")
              : this.metric("mdi:cash",period.cost_label||localized(this.hass,"Estimated cost","Becsült költség"),`${cost.toFixed(0)} ${period.cost_unit||"Ft"}`,"var(--warning-color)")}
          </div>
        </div>
        <div class="hint">${localized(this.hass,"Swipe to change period","Lapozz az időszakok között")}</div>
      </ha-card>`;
  }

  private metric(icon:string,label:string,value:string,tone:string) {
    return html`<div class="metric" style=${`--tone:${tone}`}><span class="i"><ha-icon icon=${icon}></ha-icon></span><span class="label">${label}</span><span class="value">${value}</span></div>`;
  }
}

