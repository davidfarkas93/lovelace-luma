import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { isHungarian, localized } from "../localize";
import { lumaTokens } from "../styles";
import { precipitationChance, precipitationOutlook, temperatureRange, weatherNumber, weatherVisual, type WeatherForecast } from "../weather";
import type { HomeAssistant, LovelaceCard } from "../types";

interface Config { type: string; weather_entity: string; hours?: number }

@customElement("luma-weather-hourly-card")
export class LumaWeatherHourlyCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) private _hass?: HomeAssistant;
  @state() private config?: Config;
  @state() private items: WeatherForecast[] = [];
  @state() private loading = true;
  private fetched = "";
  set hass(value: HomeAssistant | undefined) { this._hass = value; this.requestUpdate(); void this.load(); }
  get hass() { return this._hass; }

  static styles = [lumaTokens, css`
    ha-card { padding:18px; border:1px solid var(--luma-border); border-radius:var(--luma-radius-card); background:var(--luma-surface); box-shadow:var(--luma-shadow); }
    .scroller { overflow-x:auto; scrollbar-width:thin; overscroll-behavior-inline:contain; padding-bottom:6px; }
    .timeline { width:max(100%,calc(var(--count) * 66px)); }
    .hours { display:grid; grid-template-columns:repeat(var(--count),minmax(0,1fr)); gap:5px; }
    .hour { display:grid; grid-template-rows:18px 30px 28px 19px; align-items:center; justify-items:center; padding:10px 4px; border-radius:var(--luma-radius-control); background:color-mix(in srgb,var(--primary-text-color) 3%,transparent); }
    .hour.now { background:color-mix(in srgb,var(--primary-color) 7%,var(--luma-surface)); box-shadow:inset 0 0 0 1px var(--luma-border); }
    time { font-size:11px; font-weight:700; }.hour ha-icon { --mdc-icon-size:28px; color:var(--weather-tone); }
    .temp { font-size:19px; font-weight:760; }
    .rain { display:flex; align-items:center; gap:3px; color:var(--luma-muted); font-size:10px; }.rain.likely { color:var(--primary-text-color); font-weight:750; }.rain.likely ha-icon { color:#3184bf; }.rain ha-icon { --mdc-icon-size:13px; color:inherit; }
    .summary { display:flex; flex-wrap:wrap; gap:8px 20px; margin-top:14px; padding-top:13px; border-top:1px solid var(--luma-border); color:var(--luma-muted); font-size:11px; line-height:1.6; }.summary b { color:var(--primary-text-color); }
    .empty { padding:25px 5px; color:var(--luma-muted); font-size:13px; }
    @media(max-width:599px) { ha-card { padding:14px; }.summary { display:grid; gap:3px; } }
  `];

  setConfig(config: Config) { if (!config?.weather_entity) throw Error("weather_entity required"); this.config = { hours:24, ...config }; this.fetched = ""; void this.load(); }
  getCardSize() { return 4; }
  private async load() {
    if (!this.hass || !this.config || this.fetched === this.config.weather_entity) return;
    this.fetched = this.config.weather_entity; this.loading = true;
    try {
      const result = await this.hass.callWS?.<Record<string, unknown>>({ type:"call_service", domain:"weather", service:"get_forecasts", service_data:{ type:"hourly" }, target:{ entity_id:this.config.weather_entity }, return_response:true });
      const response = (result?.response || result) as Record<string, unknown>;
      this.items = (((response?.[this.config.weather_entity] || {}) as Record<string, unknown>).forecast as WeatherForecast[] || []).slice(0,this.config.hours);
    } catch { this.items = []; }
    this.loading = false;
  }
  render() {
    if (!this.config) return nothing;
    if (this.loading || !this.items.length) return html`<ha-card><div class="empty">${this.loading ? localized(this.hass,"Loading hourly forecast…","Órás előrejelzés betöltése…") : localized(this.hass,"Hourly forecast unavailable","Az órás előrejelzés nem érhető el")}</div></ha-card>`;
    const hu = isHungarian(this.hass), lang = this.hass?.locale?.language || "en";
    const unit = String(this.hass?.states[this.config.weather_entity]?.attributes.temperature_unit || "°C");
    const windUnit = String(this.hass?.states[this.config.weather_entity]?.attributes.wind_speed_unit || "km/h");
    const range = temperatureRange(this.items), outlook = precipitationOutlook(this.items);
    const gusts = this.items.map(x => weatherNumber(x.wind_gust_speed ?? x.wind_speed)).filter((n): n is number => n != null);
    return html`<ha-card>
      <div class="scroller"><div class="timeline" style=${`--count:${this.items.length}`}><div class="hours">${this.items.map((item,i) => {
        const visual = weatherVisual(item.condition,hu), chance = precipitationChance(item);
        const date = item.datetime ? new Date(item.datetime) : undefined;
        const time = date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(lang,{hour:"2-digit",minute:"2-digit"}).format(date) : "—";
        return html`<div class=${`hour ${i === 0 ? "now" : ""}`} style=${`--weather-tone:${visual.tone}`}><time>${time}</time><ha-icon icon=${visual.icon} title=${visual.label}></ha-icon><span class="temp">${weatherNumber(item.temperature) ?? "—"}°</span><span class=${`rain ${chance != null && chance >= 30 ? "likely" : ""}`}><ha-icon icon="mdi:water-outline"></ha-icon>${chance == null ? "—" : `${chance}%`}</span></div>`;
      })}</div></div></div>
      <div class="summary">${range ? html`<span>${localized(this.hass,"Temperature","Hőmérséklet")}: <b>${range.min}–${range.max} ${unit}</b></span>` : nothing}<span>${outlook.kind === "dry" ? localized(this.hass,"Precipitation unlikely","Csapadék nem valószínű") : outlook.kind === "unknown" ? localized(this.hass,"Precipitation data incomplete","Hiányos csapadékadatok") : localized(this.hass,"Precipitation possible","Csapadék lehetséges")}${outlook.peak != null ? html` · <b>${localized(this.hass,"up to","legfeljebb")} ${outlook.peak}%</b>` : nothing}</span>${gusts.length ? html`<span>${localized(this.hass,"Peak wind / gust","Max. szél / széllökés")}: <b>${Math.max(...gusts)} ${windUnit}</b></span>` : nothing}</div>
    </ha-card>`;
  }
}
