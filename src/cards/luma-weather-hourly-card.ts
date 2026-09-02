import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { localized } from "../localize";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LovelaceCard } from "../types";

interface Forecast { datetime?:string; condition?:string; temperature?:number; precipitation?:number; precipitation_probability?:number; wind_speed?:number; wind_gust_speed?:number }
interface Config { type:string; weather_entity:string; hours?:number }
const icons:Record<string,string>={"clear-night":"mdi:weather-night",cloudy:"mdi:weather-cloudy",fog:"mdi:weather-fog",hail:"mdi:weather-hail",lightning:"mdi:weather-lightning","lightning-rainy":"mdi:weather-lightning-rainy",partlycloudy:"mdi:weather-partly-cloudy",pouring:"mdi:weather-pouring",rainy:"mdi:weather-rainy",snowy:"mdi:weather-snowy","snowy-rainy":"mdi:weather-snowy-rainy",sunny:"mdi:weather-sunny",windy:"mdi:weather-windy"};

@customElement("luma-weather-hourly-card")
export class LumaWeatherHourlyCard extends LitElement implements LovelaceCard {
  @property({attribute:false}) private _hass?:HomeAssistant;
  @state() private config?:Config; @state() private items:Forecast[]=[]; @state() private loading=true;
  private fetched="";
  set hass(v:HomeAssistant|undefined){this._hass=v;this.requestUpdate();void this.load()} get hass(){return this._hass}
  static styles=[lumaTokens,css`
    ha-card{padding:17px;border:1px solid var(--luma-border);border-radius:22px;background:radial-gradient(circle at 8% 0,color-mix(in srgb,var(--primary-color) 10%,transparent),transparent 33%),var(--luma-surface);box-shadow:var(--luma-shadow);overflow:hidden}
    .scroller{overflow-x:auto;scrollbar-width:none}.scroller::-webkit-scrollbar{display:none}.hours{display:grid;grid-template-columns:repeat(var(--count),minmax(72px,1fr));min-width:calc(var(--count) * 72px);gap:5px}
    .hour{position:relative;display:grid;grid-template-rows:18px 29px 24px 42px 20px;justify-items:center;align-items:center;min-width:0;padding:8px 5px;border-radius:15px;background:color-mix(in srgb,var(--primary-text-color) 4%,transparent)}
    .hour.now{background:color-mix(in srgb,var(--primary-color) 12%,var(--luma-surface));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--primary-color) 18%,transparent)}time{font-size:9px;font-weight:700;color:var(--luma-muted)}ha-icon{--mdc-icon-size:23px;color:var(--primary-color)}.temp{font-size:14px;font-weight:780}.rain{align-self:end;width:8px;min-height:2px;height:calc(var(--rain) * .34px);max-height:34px;border-radius:999px 999px 3px 3px;background:linear-gradient(#61b8ef,#268dd1)}.rain-label{font-size:8px;color:var(--info-color,var(--primary-color))}.empty{display:grid;place-items:center;min-height:120px;color:var(--luma-muted);font-size:12px}
    .summary{display:flex;gap:14px;margin:13px 4px 0;padding-top:11px;border-top:1px solid var(--luma-border);color:var(--luma-muted);font-size:10px}.summary b{color:var(--luma-text)}
    @media(max-width:599px){ha-card{padding:13px}.hours{grid-template-columns:repeat(var(--count),68px);min-width:calc(var(--count) * 68px)}}
  `];
  setConfig(c:Config){if(!c?.weather_entity)throw Error("weather_entity required");this.config={hours:24,...c};this.fetched="";void this.load()} getCardSize(){return 4}
  private async load(){if(!this._hass||!this.config||this.fetched===this.config.weather_entity)return;this.fetched=this.config.weather_entity;this.loading=true;try{const r=await this._hass.callWS?.<Record<string,unknown>>({type:"call_service",domain:"weather",service:"get_forecasts",service_data:{type:"hourly"},target:{entity_id:this.config.weather_entity},return_response:true});const response=(r?.response||r)as Record<string,unknown>,entry=(response?.[this.config.weather_entity]||{})as Record<string,unknown>;this.items=((entry.forecast||[])as Forecast[]).slice(0,this.config.hours)}catch{this.items=[]}this.loading=false}
  render(){if(!this.config)return nothing;if(this.loading)return html`<ha-card><div class="empty">${localized(this.hass,"Loading hourly forecast…","Órás előrejelzés betöltése…")}</div></ha-card>`;if(!this.items.length)return html`<ha-card><div class="empty">${localized(this.hass,"No hourly forecast","Nincs órás előrejelzés")}</div></ha-card>`;const lang=this.hass?.locale?.language||"en",temps=this.items.map(x=>Number(x.temperature)).filter(Number.isFinite),maxRain=Math.max(...this.items.map(x=>Number(x.precipitation_probability)||0)),maxWind=Math.max(...this.items.map(x=>Number(x.wind_gust_speed??x.wind_speed)||0));return html`<ha-card><div class="scroller"><div class="hours" style=${`--count:${this.items.length}`}>${this.items.map((x,i)=>{const date=x.datetime?new Date(x.datetime):undefined,rain=Math.max(0,Number(x.precipitation_probability)||0);return html`<div class=${`hour ${i===0?"now":""}`}><time>${i===0?localized(this.hass,"Now","Most"):date?new Intl.DateTimeFormat(lang,{hour:"2-digit",minute:"2-digit"}).format(date):"—"}</time><ha-icon icon=${icons[x.condition||""]||"mdi:weather-cloudy"}></ha-icon><span class="temp">${x.temperature??"—"}°</span><span class="rain" style=${`--rain:${rain}`}></span><span class="rain-label">${rain}%</span></div>`})}</div></div><div class="summary"><span>${localized(this.hass,"Range","Tartomány")}: <b>${Math.min(...temps)}–${Math.max(...temps)}°</b></span><span>${localized(this.hass,"Peak rain chance","Legnagyobb esély")}: <b>${maxRain}%</b></span><span>${localized(this.hass,"Peak gust","Max. széllökés")}: <b>${maxWind} km/h</b></span></div></ha-card>`}
}
