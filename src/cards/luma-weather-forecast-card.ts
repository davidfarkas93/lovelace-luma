import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { isHungarian, localized } from "../localize";
import { lumaTokens } from "../styles";
import { weatherVisual, precipitationChance, dailyTemperatureBands, weatherNumber, type WeatherForecast as Forecast } from "../weather";
import "../components/luma-bottom-sheet";
import type { HomeAssistant, LovelaceCard } from "../types";

interface Config { type: string; weather_entity: string; fallback_entity?: string; days?: number; locale?: string }

@customElement("luma-weather-forecast-card")
export class LumaWeatherForecastCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) private _hass?: HomeAssistant;
  @state() private config?: Config;
  @state() private forecast: Forecast[] = [];
  @state() private hourly: Forecast[] = [];
  @state() private loading = true;
  @state() private selected?: Forecast;
  @state() private detailsOpen=false;
  private fetchedFor = "";

  set hass(value: HomeAssistant | undefined) { this._hass = value; this.requestUpdate(); void this.load(); }
  get hass() { return this._hass; }

  static styles = [lumaTokens, css`
    :host { display:block; min-width:0; container-type:inline-size; }
    ha-card { padding:12px; border:1px solid var(--luma-border); border-radius:var(--luma-radius-card); background:linear-gradient(145deg,color-mix(in srgb,var(--primary-color) 3%,var(--luma-surface)),var(--luma-surface) 65%); box-shadow:var(--luma-shadow); }
    .days { display:grid; }
    .day { display:grid; grid-template-columns:76px minmax(136px,1fr) minmax(140px,280px) 58px 16px; grid-template-areas:"date sky temps rain arrow"; align-items:center; gap:12px; min-width:0; width:100%; min-height:78px; padding:12px; border:0; border-bottom:1px solid var(--luma-border); border-radius:0; color:inherit; background:transparent; font:inherit; text-align:left; cursor:pointer; transition:background .18s ease; }
    .day:last-child { border-bottom-color:transparent; }
    .day.today { border-radius:var(--luma-radius-control); background:color-mix(in srgb,var(--primary-color) 5%,transparent); box-shadow:inset 3px 0 0 color-mix(in srgb,var(--primary-color) 45%,transparent); }
    .day:hover { background:color-mix(in srgb,var(--primary-color) 6%,transparent); }
    .date { grid-area:date; display:grid; gap:4px; min-width:0; }
    .date-label { font-size:13px; font-weight:var(--luma-weight-strong); text-transform:capitalize; }
    .today .date-label { color:var(--primary-color); }
    .calendar-date { color:var(--luma-muted); font-size:11px; font-variant-numeric:tabular-nums; }
    .sky { grid-area:sky; display:flex; align-items:center; gap:10px; min-width:0; }
    .weather-icon { display:grid; place-items:center; flex:0 0 38px; width:38px; height:38px; border-radius:var(--luma-radius-control); color:var(--weather-tone); background:color-mix(in srgb,var(--weather-tone) 10%,transparent); }
    .icon { --mdc-icon-size:25px; }
    .condition { color:var(--primary-text-color); font-size:12px; line-height:1.4; overflow-wrap:anywhere; }
    .temps { grid-area:temps; display:grid; grid-template-columns:34px minmax(32px,1fr) 38px; align-items:center; gap:10px; min-width:0; font-variant-numeric:tabular-nums; }
    .low { color:var(--luma-muted); text-align:right; font-size:14px; font-weight:var(--luma-weight-medium); }
    .high { text-align:right; font-size:19px; font-weight:var(--luma-weight-title); }
    .track { position:relative; height:6px; border-radius:99px; background:color-mix(in srgb,var(--primary-text-color) 6%,transparent); }
    .track.no-data { background:transparent; }
    .band { position:absolute; top:0; bottom:0; left:min(var(--range-start),calc(100% - 6px)); width:calc(var(--range-end) - var(--range-start)); min-width:6px; max-width:100%; border-radius:inherit; background:linear-gradient(90deg,#65a9c4,#d7b14e); }
    .rain { grid-area:rain; display:flex; align-items:center; justify-content:flex-end; gap:4px; color:var(--luma-muted); font-size:12px; font-variant-numeric:tabular-nums; white-space:nowrap; }
    .rain ha-icon { --mdc-icon-size:15px; }
    .rain.likely { color:var(--info-color,#3184bf); font-weight:var(--luma-weight-strong); }
    .arrow { grid-area:arrow; color:var(--luma-muted); --mdc-icon-size:16px; opacity:.65; }
    .day:hover .arrow { color:var(--primary-color); opacity:1; }
    .range-key { display:flex; align-items:center; gap:6px; padding:10px 12px 2px; color:var(--luma-muted); font-size:10px; line-height:1.5; }
    .range-key ha-icon { --mdc-icon-size:15px; }
    .loading { display:grid; place-items:center; min-height:104px; color:var(--luma-muted); font-size:12px; }
    .facts { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
    .fact { display:grid; grid-template-columns:28px minmax(0,1fr); align-items:center; gap:8px; padding:10px; border-radius:15px; background:color-mix(in srgb,var(--primary-color) 7%,var(--luma-surface)); }
    .fact ha-icon { --mdc-icon-size:18px; color:var(--primary-color); }
    .fact b { display:block; font-size:12px; }
    .fact small { color:var(--luma-muted); font-size:9px; }
    .hourly-title { margin:20px 2px 9px; font-size:11px; font-weight:730; letter-spacing:.04em; text-transform:uppercase; }
    .hourly { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:7px; }
    .hour { display:grid; justify-items:center; gap:5px; min-width:0; padding:10px 5px; border-radius:15px; background:color-mix(in srgb,var(--primary-text-color) 2%,var(--luma-surface)); }
    .hour time { color:var(--luma-muted); font-size:9px; }
    .hour ha-icon { color:var(--weather-tone,var(--primary-color)); --mdc-icon-size:20px; }
    .hour-temp { font-size:11px; font-weight:720; }
    .hour-rain { color:var(--info-color,var(--primary-color)); font-size:8px; }
    @container(max-width:640px) {
      ha-card { padding:8px; }
      .day { grid-template-columns:58px minmax(0,1fr) 46px 14px; grid-template-areas:"date sky rain arrow" "date temps temps arrow"; gap:7px 9px; min-height:88px; padding:12px 10px; }
      .sky { gap:8px; }
      .weather-icon { flex-basis:30px; width:30px; height:30px; border-radius:10px; }
      .day .icon { --mdc-icon-size:21px; }
      .temps { grid-template-columns:28px minmax(32px,1fr) 34px; gap:8px; }
      .high { font-size:18px; }
      .low { font-size:13px; }
      .rain { font-size:11px; }
      .date-label { font-size:12px; }
      .calendar-date { font-size:10px; }
    }
    @media(max-width:599px) {
      .facts { grid-template-columns:1fr 1fr; }
      .hourly { grid-template-columns:repeat(4,minmax(0,1fr)); overflow-x:auto; }
    }
  `];

  setConfig(config: Config) {
    if (!config?.weather_entity) throw Error("weather_entity required");
    this.config = { days: 7, ...config };
    this.fetchedFor = "";
    void this.load();
  }
  getCardSize() { return 4; }

  private async getForecast(type: "daily" | "hourly") {
    if (!this._hass || !this.config) return [];
    try {
      const result = await this._hass.callWS?.<Record<string, unknown>>({
        type:"call_service", domain:"weather", service:"get_forecasts", service_data:{ type },
        target:{ entity_id:this.config.weather_entity }, return_response:true,
      });
      const response = (result?.response || result) as Record<string, unknown>;
      const entry = (response?.[this.config.weather_entity] || {}) as Record<string, unknown>;
      return (entry.forecast || []) as Forecast[];
    } catch { return []; }
  }

  private async load() {
    if (!this._hass || !this.config || this.fetchedFor === this.config.weather_entity) return;
    this.fetchedFor = this.config.weather_entity;
    this.loading = true;
    const [daily, hourly] = await Promise.all([this.getForecast("daily"), this.getForecast("hourly")]);
    let items = daily;
    if (!items.length && this.config.fallback_entity) {
      const raw = this._hass.states[this.config.fallback_entity]?.attributes.forecast_data;
      items = Array.isArray(raw) ? raw as Forecast[] : raw && typeof raw === "object" ? [raw as Forecast] : [];
    }
    this.forecast = items.slice(0, this.config.days);
    this.hourly = hourly;
    this.loading = false;
  }

  private fact(icon: string, label: string, value: unknown, unit = "") {
    return value == null ? nothing : html`<div class="fact"><ha-icon icon=${icon}></ha-icon><span><b>${value}${unit}</b><small>${label}</small></span></div>`;
  }
  private dayHours(day?: Forecast) {
    if (!day?.datetime) return [];
    const selected = new Date(day.datetime).toLocaleDateString("sv-SE");
    return this.hourly.filter(item => item.datetime && new Date(item.datetime).toLocaleDateString("sv-SE") === selected).filter((_, index) => index % 3 === 0).slice(0, 8);
  }
  private windDirection(value?: number) {
    if (value == null) return undefined;
    return (isHungarian(this.hass)?["É", "ÉK", "K", "DK", "D", "DNy", "Ny", "ÉNy"]:["N", "NE", "E", "SE", "S", "SW", "W", "NW"])[Math.round(value / 45) % 8];
  }

  render() {
    if (!this.config) return nothing;
    if (this.loading) return html`<ha-card><div class="loading">${localized(this.hass,"Loading forecast…","Előrejelzés betöltése…")}</div></ha-card>`;
    if (!this.forecast.length) return html`<ha-card><div class="loading">${localized(this.hass,"No forecast available","Nincs elérhető előrejelzés")}</div></ha-card>`;
    const lang = this.config.locale || this.hass?.locale?.language || "en";
    const selected = this.selected;
    const weatherAttrs = this.hass?.states[this.config.weather_entity]?.attributes || {};
    const hours = this.dayHours(selected);
    const bands = dailyTemperatureBands(this.forecast);
    return html`<ha-card><div class="days" style=${`--days:${this.forecast.length}`}>${this.forecast.map((item, index) => {
      const dayDate = item.datetime && Number.isFinite(Date.parse(item.datetime)) ? new Date(item.datetime) : undefined;
      const date = dayDate ? new Intl.DateTimeFormat(lang, { weekday:"short" }).format(dayDate) : "—";
      const calendarDate = dayDate ? new Intl.DateTimeFormat(lang, { month:"short", day:"numeric" }).format(dayDate) : "—";
      const chance = precipitationChance(item);
      const visual = weatherVisual(item.condition,isHungarian(this.hass));
      const today = new Date().toLocaleDateString("sv-SE");
      const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate()+1);
      const tomorrow = tomorrowDate.toLocaleDateString("sv-SE");
      const dayKey = dayDate ? dayDate.toLocaleDateString("sv-SE") : "";
      const dateLabel = dayKey === today ? localized(this.hass,"Today","Ma") : dayKey === tomorrow ? localized(this.hass,"Tomorrow","Holnap") : date;
      const band = bands[index];
      const low = weatherNumber(item.templow), high = weatherNumber(item.temperature);
      const format = (value: number | undefined) => value == null ? "—" : new Intl.NumberFormat(lang, { maximumFractionDigits: 0 }).format(value);
      const unit = String(weatherAttrs.temperature_unit || "°C");
      const label = `${dateLabel} · ${calendarDate} · ${visual.label} · ${localized(this.hass,"Minimum","Minimum")}: ${format(low)} ${unit} · ${localized(this.hass,"Maximum","Maximum")}: ${format(high)} ${unit}${chance == null ? "" : ` · ${localized(this.hass,"Chance of precipitation","Csapadék esélye")}: ${chance}%`}`;
      return html`<button type="button" class=${`day interactive ${dayKey === today ? "today" : ""}`} aria-current=${dayKey === today ? "date" : nothing} aria-label=${label} style=${`--weather-tone:${visual.tone}`} @click=${() => {this.selected = item;this.detailsOpen=true;}}>
        <span class="date"><span class="date-label">${dateLabel}</span><time class="calendar-date" datetime=${dayDate?.toISOString() || nothing}>${calendarDate}</time></span>
        <span class="sky"><span class="weather-icon"><ha-icon class="icon" icon=${visual.icon}></ha-icon></span><span class="condition">${visual.label}</span></span>
        <span class="temps"><span class="low">${low == null ? "—" : `${format(low)}°`}</span><span class=${`track ${band ? "" : "no-data"}`} aria-hidden="true">${band ? html`<span class="band" style=${`--range-start:${band.start}%;--range-end:${band.end}%`}></span>` : nothing}</span><span class="high">${high == null ? "—" : `${format(high)}°`}</span></span>
        <span class=${`rain ${chance != null && chance >= 30 ? "likely" : ""}`} title=${localized(this.hass,"Chance of precipitation","Csapadék esélye")}><ha-icon icon="mdi:water-outline"></ha-icon><span>${chance == null ? "—" : `${chance}%`}</span></span>
        <ha-icon class="arrow" icon="mdi:chevron-right" aria-hidden="true"></ha-icon>
      </button>`;
    })}</div><div class="range-key"><ha-icon icon="mdi:thermometer"></ha-icon><span>${localized(this.hass,"Daily low and high · shared weekly scale","Napi minimum és maximum · közös heti skála")}</span></div></ha-card>
    <luma-bottom-sheet .open=${this.detailsOpen}
      .heading=${selected?.datetime && Number.isFinite(Date.parse(selected.datetime)) ? new Intl.DateTimeFormat(lang,{weekday:"long",month:"long",day:"numeric"}).format(new Date(selected.datetime)) : localized(this.hass,"Details","Részletek")}
      .subtitle=${weatherVisual(selected?.condition,isHungarian(this.hass)).label}
      .icon=${weatherVisual(selected?.condition).icon} .maxWidth=${560}
      .closeLabel=${localized(this.hass,"Close","Bezárás")} @sheet-dismiss=${()=>this.detailsOpen=false}
      @sheet-closed=${()=>{if(!this.detailsOpen)this.selected=undefined}}>
      ${selected ? html`<div>
      <div class="facts">${this.fact("mdi:thermometer-high",localized(this.hass,"Maximum","Maximum"),selected.temperature,"°")}${this.fact("mdi:thermometer-low",localized(this.hass,"Minimum","Minimum"),selected.templow,"°")}${this.fact("mdi:thermometer-lines",localized(this.hass,"Feels like","Hőérzet"),selected.apparent_temperature,"°")}${this.fact("mdi:weather-pouring",localized(this.hass,"Chance of rain","Csapadék esélye"),selected.precipitation_probability,"%")}${this.fact("mdi:water",localized(this.hass,"Precipitation","Csapadék"),selected.precipitation,` ${weatherAttrs.precipitation_unit || "mm"}`)}${this.fact("mdi:water-percent",localized(this.hass,"Humidity","Páratartalom"),selected.humidity,"%")}${this.fact("mdi:weather-windy",localized(this.hass,"Wind","Szél"),selected.wind_speed,` ${weatherAttrs.wind_speed_unit || "km/h"}`)}${this.fact("mdi:windsock",localized(this.hass,"Wind direction","Szélirány"),this.windDirection(selected.wind_bearing))}${this.fact("mdi:weather-tornado",localized(this.hass,"Wind gust","Széllökés"),selected.wind_gust_speed,` ${weatherAttrs.wind_speed_unit || "km/h"}`)}${this.fact("mdi:gauge",localized(this.hass,"Pressure","Légnyomás"),selected.pressure,` ${weatherAttrs.pressure_unit || "hPa"}`)}${this.fact("mdi:weather-sunny-alert",localized(this.hass,"UV index","UV-index"),selected.uv_index)}${this.fact("mdi:eye-outline",localized(this.hass,"Visibility","Látótávolság"),selected.visibility,` ${weatherAttrs.visibility_unit || "km"}`)}</div>
      ${hours.length ? html`<div class="hourly-title">${localized(this.hass,"Hourly outlook","Napközbeni alakulás")}</div><div class="hourly">${hours.map(hour => html`<div class="hour"><time>${new Intl.DateTimeFormat(lang,{hour:"2-digit",minute:"2-digit"}).format(new Date(hour.datetime!))}</time><ha-icon style=${`--weather-tone:${weatherVisual(hour.condition).tone}`} icon=${weatherVisual(hour.condition).icon}></ha-icon><span class="hour-temp">${hour.temperature ?? "—"}°</span>${hour.precipitation_probability != null ? html`<span class="hour-rain">${hour.precipitation_probability}%</span>` : nothing}</div>`)}</div>` : nothing}
    </div>` : nothing}</luma-bottom-sheet>`;
  }
}
