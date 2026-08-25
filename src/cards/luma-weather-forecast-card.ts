import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { isHungarian, localized, localizedMap } from "../localize";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LovelaceCard } from "../types";

interface Forecast {
  datetime?: string; condition?: string; temperature?: number; templow?: number;
  apparent_temperature?: number; precipitation?: number; precipitation_probability?: number;
  humidity?: number; wind_speed?: number; wind_gust_speed?: number; wind_bearing?: number;
  pressure?: number; uv_index?: number; dew_point?: number; visibility?: number;
}
interface Config { type: string; weather_entity: string; fallback_entity?: string; days?: number; locale?: string }

const icons: Record<string, string> = {
  "clear-night":"mdi:weather-night", cloudy:"mdi:weather-cloudy", fog:"mdi:weather-fog", hail:"mdi:weather-hail",
  lightning:"mdi:weather-lightning", "lightning-rainy":"mdi:weather-lightning-rainy", partlycloudy:"mdi:weather-partly-cloudy",
  pouring:"mdi:weather-pouring", rainy:"mdi:weather-rainy", snowy:"mdi:weather-snowy", "snowy-rainy":"mdi:weather-snowy-rainy",
  sunny:"mdi:weather-sunny", windy:"mdi:weather-windy",
};
const labelsHu: Record<string, string> = {
  "clear-night":"Derült éjszaka", cloudy:"Felhős", fog:"Ködös", hail:"Jégeső", lightning:"Zivatar",
  "lightning-rainy":"Zivatar esővel", partlycloudy:"Részben felhős", pouring:"Heves eső", rainy:"Esős",
  snowy:"Havas", "snowy-rainy":"Havas eső", sunny:"Napos", windy:"Szeles",
};
const labelsEn: Record<string, string> = {
  "clear-night":"Clear night", cloudy:"Cloudy", fog:"Fog", hail:"Hail", lightning:"Thunderstorms",
  "lightning-rainy":"Thunderstorms with rain", partlycloudy:"Partly cloudy", pouring:"Heavy rain", rainy:"Rainy",
  snowy:"Snowy", "snowy-rainy":"Sleet", sunny:"Sunny", windy:"Windy",
};

@customElement("luma-weather-forecast-card")
export class LumaWeatherForecastCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) private _hass?: HomeAssistant;
  @state() private config?: Config;
  @state() private forecast: Forecast[] = [];
  @state() private hourly: Forecast[] = [];
  @state() private loading = true;
  @state() private selected?: Forecast;
  private fetchedFor = "";

  set hass(value: HomeAssistant | undefined) { this._hass = value; this.requestUpdate(); void this.load(); }
  get hass() { return this._hass; }

  static styles = [lumaTokens, css`
    ha-card { padding:16px; border:1px solid var(--luma-border); border-radius:22px; background:radial-gradient(circle at 88% 6%,color-mix(in srgb,var(--info-color,var(--primary-color)) 13%,transparent),transparent 31%),linear-gradient(145deg,color-mix(in srgb,var(--info-color,var(--primary-color)) 8%,var(--luma-surface)),var(--luma-surface)); box-shadow:var(--luma-shadow); }
    .days { display:grid; grid-template-columns:repeat(var(--days),minmax(0,1fr)); gap:8px; }
    .day { display:grid; justify-items:center; gap:7px; min-width:0; padding:13px 8px; border:1px solid transparent; border-radius:16px; color:inherit; background:color-mix(in srgb,var(--primary-text-color) 5%,var(--luma-surface)); font:inherit; transition:.18s ease; }
    .day:hover { transform:translateY(-2px); border-color:color-mix(in srgb,var(--primary-color) 18%,transparent); background:color-mix(in srgb,var(--primary-color) 9%,var(--luma-surface)); }
    .date { font-size:10px; font-weight:720; text-transform:capitalize; }
    .icon { color:var(--primary-color); --mdc-icon-size:27px; }
    .temps { font-size:12px; font-weight:720; }
    .low { margin-left:4px; color:var(--luma-muted); font-weight:560; }
    .rain { color:var(--info-color,var(--primary-color)); font-size:9px; }
    .loading { display:grid; place-items:center; min-height:104px; color:var(--luma-muted); font-size:12px; }
    .scrim { position:fixed; inset:0; z-index:1000; display:grid; place-items:center; padding:20px; background:rgba(15,18,28,.5); backdrop-filter:blur(8px); }
    .sheet { box-sizing:border-box; width:min(560px,calc(100vw - 32px)); max-height:calc(100dvh - 40px); padding:20px; border:1px solid color-mix(in srgb,var(--primary-text-color) 11%,transparent); border-radius:28px; color:var(--primary-text-color); background:radial-gradient(circle at 8% 0,color-mix(in srgb,var(--primary-color) 11%,transparent),transparent 33%),var(--md-sys-color-surface-container-high,var(--luma-surface)); box-shadow:0 28px 80px rgba(0,0,0,.32); overflow:auto; }
    .sheet-top { display:grid; grid-template-columns:52px minmax(0,1fr) 38px; align-items:center; gap:12px; }
    .sheet-icon { display:grid; place-items:center; width:52px; height:52px; border-radius:17px; color:var(--primary-color); background:color-mix(in srgb,var(--primary-color) 13%,transparent); }
    .sheet-icon ha-icon { --mdc-icon-size:28px; }
    .sheet-title { font-size:18px; font-weight:740; text-transform:capitalize; }
    .sheet-sub { margin-top:3px; color:var(--luma-muted); font-size:11px; }
    .close { display:grid; place-items:center; width:38px; height:38px; border:0; border-radius:13px; color:var(--luma-muted); background:color-mix(in srgb,var(--primary-text-color) 7%,var(--luma-surface)); }
    .facts { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-top:17px; }
    .fact { display:grid; grid-template-columns:28px minmax(0,1fr); align-items:center; gap:8px; padding:10px; border-radius:15px; background:color-mix(in srgb,var(--primary-color) 7%,var(--luma-surface)); }
    .fact ha-icon { --mdc-icon-size:18px; color:var(--primary-color); }
    .fact b { display:block; font-size:12px; }
    .fact small { color:var(--luma-muted); font-size:9px; }
    .hourly-title { margin:20px 2px 9px; font-size:11px; font-weight:730; letter-spacing:.04em; text-transform:uppercase; }
    .hourly { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:7px; }
    .hour { display:grid; justify-items:center; gap:5px; min-width:0; padding:10px 5px; border-radius:15px; background:color-mix(in srgb,var(--primary-text-color) 5%,var(--luma-surface)); }
    .hour time { color:var(--luma-muted); font-size:9px; }
    .hour ha-icon { color:var(--primary-color); --mdc-icon-size:20px; }
    .hour-temp { font-size:11px; font-weight:720; }
    .hour-rain { color:var(--info-color,var(--primary-color)); font-size:8px; }
    @media(max-width:599px) {
      ha-card { padding:11px; }
      .days { display:grid; grid-template-columns:1fr; gap:6px; }
      .day { grid-template-columns:52px 34px minmax(0,1fr) auto; justify-items:start; align-items:center; gap:8px; padding:10px 12px; text-align:left; }
      .day .icon { --mdc-icon-size:25px; }
      .temps { font-size:13px; }
      .rain { justify-self:end; text-align:right; }
      .scrim { place-items:end center; padding:0; }
      .sheet { width:100%; max-height:calc(100dvh - 12px); padding:20px 16px calc(20px + env(safe-area-inset-bottom)); border-right:0; border-bottom:0; border-left:0; border-radius:28px 28px 0 0; }
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
    return html`<ha-card><div class="days" style=${`--days:${this.forecast.length}`}>${this.forecast.map(item => {
      const date = item.datetime ? new Intl.DateTimeFormat(lang, { weekday:"short" }).format(new Date(item.datetime)) : "—";
      const rain = item.precipitation_probability ?? item.precipitation;
      const rainUnit = item.precipitation_probability != null ? "%" : ` ${weatherAttrs.precipitation_unit || "mm"}`;
      return html`<button class="day" @click=${() => this.selected = item}><span class="date">${date}</span><ha-icon class="icon" icon=${icons[item.condition || ""] || "mdi:weather-cloudy"}></ha-icon><span class="temps">${item.temperature ?? "—"}°<span class="low">${item.templow != null ? item.templow + "°" : ""}</span></span>${rain != null ? html`<span class="rain">${rain}${rainUnit} ${localized(this.hass,"precipitation","csapadék")}</span>` : nothing}</button>`;
    })}</div></ha-card>${selected ? html`<div class="scrim" @click=${() => this.selected = undefined}><section class="sheet" @click=${(event: Event) => event.stopPropagation()}>
      <div class="sheet-top"><span class="sheet-icon"><ha-icon icon=${icons[selected.condition || ""] || "mdi:weather-cloudy"}></ha-icon></span><span><div class="sheet-title">${selected.datetime ? new Intl.DateTimeFormat(lang,{weekday:"long",month:"long",day:"numeric"}).format(new Date(selected.datetime)) : localized(this.hass,"Details","Részletek")}</div><div class="sheet-sub">${localizedMap(this.hass,labelsEn,labelsHu,selected.condition || "") || localized(this.hass,"Weather forecast","Időjárási előrejelzés")}</div></span><button class="close" @click=${() => this.selected = undefined}><ha-icon icon="mdi:close"></ha-icon></button></div>
      <div class="facts">${this.fact("mdi:thermometer-high",localized(this.hass,"Maximum","Maximum"),selected.temperature,"°")}${this.fact("mdi:thermometer-low",localized(this.hass,"Minimum","Minimum"),selected.templow,"°")}${this.fact("mdi:thermometer-lines",localized(this.hass,"Feels like","Hőérzet"),selected.apparent_temperature,"°")}${this.fact("mdi:weather-pouring",localized(this.hass,"Chance of rain","Csapadék esélye"),selected.precipitation_probability,"%")}${this.fact("mdi:water",localized(this.hass,"Precipitation","Csapadék"),selected.precipitation,` ${weatherAttrs.precipitation_unit || "mm"}`)}${this.fact("mdi:water-percent",localized(this.hass,"Humidity","Páratartalom"),selected.humidity,"%")}${this.fact("mdi:weather-windy",localized(this.hass,"Wind","Szél"),selected.wind_speed,` ${weatherAttrs.wind_speed_unit || "km/h"}`)}${this.fact("mdi:windsock",localized(this.hass,"Wind direction","Szélirány"),this.windDirection(selected.wind_bearing))}${this.fact("mdi:weather-tornado",localized(this.hass,"Wind gust","Széllökés"),selected.wind_gust_speed,` ${weatherAttrs.wind_speed_unit || "km/h"}`)}${this.fact("mdi:gauge",localized(this.hass,"Pressure","Légnyomás"),selected.pressure,` ${weatherAttrs.pressure_unit || "hPa"}`)}${this.fact("mdi:weather-sunny-alert",localized(this.hass,"UV index","UV-index"),selected.uv_index)}${this.fact("mdi:eye-outline",localized(this.hass,"Visibility","Látótávolság"),selected.visibility,` ${weatherAttrs.visibility_unit || "km"}`)}</div>
      ${hours.length ? html`<div class="hourly-title">${localized(this.hass,"Hourly outlook","Napközbeni alakulás")}</div><div class="hourly">${hours.map(hour => html`<div class="hour"><time>${new Intl.DateTimeFormat(lang,{hour:"2-digit",minute:"2-digit"}).format(new Date(hour.datetime!))}</time><ha-icon icon=${icons[hour.condition || ""] || "mdi:weather-cloudy"}></ha-icon><span class="hour-temp">${hour.temperature ?? "—"}°</span>${hour.precipitation_probability != null ? html`<span class="hour-rain">${hour.precipitation_probability}%</span>` : nothing}</div>`)}</div>` : nothing}
    </section></div>` : nothing}`;
  }
}
