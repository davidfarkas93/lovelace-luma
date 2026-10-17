import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { runAction } from "../helpers";
import { isHungarian, localized } from "../localize";
import { lumaTokens } from "../styles";
import { precipitationOutlook, weatherNumber, weatherVisual, type WeatherForecast } from "../weather";
import type { HomeAssistant, LovelaceCard } from "../types";

interface Config { type:string; weather_entity:string; temperature_entity?:string; humidity_entity?:string; name?:string; back_path?:string; sunrise_entity?:string; sunset_entity?:string }

@customElement("luma-weather-hero-card")
export class LumaWeatherHeroCard extends LitElement implements LovelaceCard {
  @property({attribute:false}) private _hass?:HomeAssistant;
  @state() private config?:Config;
  @state() private daily:WeatherForecast[]=[];
  @state() private hourly:WeatherForecast[]=[];
  private fetched="";
  set hass(value:HomeAssistant|undefined) { this._hass=value; this.requestUpdate(); void this.loadForecast(); }
  get hass() { return this._hass; }
  static styles=[lumaTokens,css`
    ha-card { display:grid; grid-template-columns:auto minmax(0,1fr) auto; grid-template-areas:"back copy weather" "outlook outlook outlook" "chips chips chips"; align-items:center; gap:18px; padding:24px; border:1px solid var(--luma-border); border-radius:var(--luma-radius-hero); background:radial-gradient(circle at 95% 0,color-mix(in srgb,var(--tone) 10%,transparent),transparent 40%),var(--luma-surface); box-shadow:var(--luma-shadow); }
    .back { grid-area:back; display:grid; place-items:center; width:48px; height:48px; border:0; border-radius:var(--luma-radius-control); color:var(--primary-text-color); background:color-mix(in srgb,var(--primary-text-color) 5%,transparent); cursor:pointer; }.back ha-icon { --mdc-icon-size:24px; }
    .copy { grid-area:copy; min-width:0; }.name { font-size:24px; font-weight:var(--luma-weight-title); }.condition { margin-top:4px; font-size:14px; color:var(--luma-muted); }
    .weather { grid-area:weather; display:flex; align-items:center; gap:12px; }.weather ha-icon { --mdc-icon-size:48px; color:var(--tone); }.temperature { font-size:38px; font-weight:760; letter-spacing:-.04em; }.unit { color:var(--luma-muted); font-size:18px; }
    .daily-range { margin-top:3px; color:var(--luma-muted); font-size:12px; font-variant-numeric:tabular-nums; }
    .outlook { grid-area:outlook; display:grid; grid-template-columns:1fr; gap:10px; }.insight { min-width:0; display:flex; align-items:flex-start; gap:10px; padding:13px; border-radius:var(--luma-radius-control); background:color-mix(in srgb,var(--primary-text-color) 3%,transparent); }.insight ha-icon { flex:none; --mdc-icon-size:22px; color:var(--insight-tone,var(--luma-muted)); }.insight b { display:block; font-size:14px; line-height:1.45; font-weight:700; }.insight small { display:block; margin-top:3px; color:var(--luma-muted); font-size:11px; line-height:1.5; }
    .chips { grid-area:chips; display:flex; flex-wrap:wrap; gap:7px 16px; padding-top:12px; border-top:1px solid var(--luma-border); }.chip { display:inline-flex; align-items:center; gap:5px; color:var(--luma-muted); font-size:11px; }.chip ha-icon { --mdc-icon-size:15px; }
    @media(max-width:599px) { ha-card { grid-template-columns:40px minmax(0,1fr); grid-template-areas:"back copy" "weather weather" "outlook outlook" "chips chips"; padding:18px; gap:14px; }.back { width:40px; height:40px; }.name { font-size:22px; }.weather { padding-left:2px; }.outlook { grid-template-columns:1fr; gap:7px; }.insight { padding:10px 12px; }.insight b { font-size:13px; }.temperature { font-size:36px; } }
  `];
  setConfig(config:Config) { if(!config?.weather_entity) throw Error("weather_entity required"); this.config=config; this.fetched=""; void this.loadForecast(); }
  getCardSize() { return 4; }
  private async forecast(type:"daily"|"hourly") {
    if(!this.hass||!this.config) return [];
    try {
      const result=await this.hass.callWS?.<Record<string,unknown>>({type:"call_service",domain:"weather",service:"get_forecasts",service_data:{type},target:{entity_id:this.config.weather_entity},return_response:true});
      const response=(result?.response||result) as Record<string,unknown>;
      return (((response?.[this.config.weather_entity]||{}) as Record<string,unknown>).forecast||[]) as WeatherForecast[];
    } catch { return []; }
  }
  private async loadForecast() {
    if(!this.hass||!this.config||this.fetched===this.config.weather_entity) return;
    this.fetched=this.config.weather_entity;
    const [daily,hourly]=await Promise.all([this.forecast("daily"),this.forecast("hourly")]);
    this.daily=daily; this.hourly=hourly.slice(0,12);
  }
  render() {
    if(!this.hass||!this.config) return nothing;
    const c=this.config, entity=this.hass.states[c.weather_entity], available=entity && !["unknown","unavailable"].includes(entity.state);
    const a=available ? entity.attributes : {}, visual=weatherVisual(available?entity.state:undefined,isHungarian(this.hass));
    const num=(id:string|undefined,attr:string) => weatherNumber(id?this.hass!.states[id]?.state:undefined) ?? weatherNumber(a[attr]);
    const temp=num(c.temperature_entity,"temperature"), humidity=num(c.humidity_entity,"humidity");
    const lang=this.hass.locale?.language||"en", unit=String(a.temperature_unit||"°C");
    const outlook=precipitationOutlook(available?this.hourly:[]);
    const first=outlook.first?.datetime?new Date(outlook.first.datetime):undefined;
    const rainWhen=first&&Number.isFinite(first.getTime())?new Intl.DateTimeFormat(lang,{hour:"2-digit",minute:"2-digit"}).format(first):undefined;
    const todayKey=new Date().toLocaleDateString("sv-SE");
    const today=available?this.daily.find(day=>day.datetime&&new Date(day.datetime).toLocaleDateString("sv-SE")===todayKey):undefined;
    const todayLow=weatherNumber(today?.templow), todayHigh=weatherNumber(today?.temperature);
    const format=(value:number)=>new Intl.NumberFormat(lang,{maximumFractionDigits:0}).format(value);
    const rainTitle=outlook.kind==="dry"?localized(this.hass,"Precipitation unlikely","Csapadék nem valószínű"):outlook.kind==="unknown"?localized(this.hass,"Precipitation data unavailable","Nincs teljes csapadékadat"):outlook.kind==="likely"?localized(this.hass,"Precipitation likely","Valószínű csapadék"):localized(this.hass,"Precipitation possible","Csapadék lehetséges");
    const insight=(icon:string,title:string,detail:string,tone:string)=>html`<div class="insight" style=${`--insight-tone:${tone}`}><ha-icon icon=${icon}></ha-icon><span><b>${title}</b><small>${detail}</small></span></div>`;
    const chip=(icon:string,value:string)=>html`<span class="chip"><ha-icon icon=${icon}></ha-icon>${value}</span>`;
    return html`<ha-card style=${`--tone:${visual.tone}`}>
      <button class="back interactive" aria-label=${localized(this.hass,"Back","Vissza")} @click=${()=>c.back_path&&runAction(this,this.hass!,{action:"navigate",navigation_path:c.back_path})}><ha-icon icon=${c.back_path?"mdi:arrow-left":visual.icon}></ha-icon></button>
      <div class="copy"><div class="name">${c.name||localized(this.hass,"Weather","Időjárás")}</div><div class="condition">${localized(this.hass,"Now","Most")} · ${visual.label}</div></div>
      <div class="weather"><ha-icon icon=${visual.icon}></ha-icon><span><span class="temperature">${temp==null?"—":new Intl.NumberFormat(lang,{maximumFractionDigits:1}).format(temp)}<span class="unit"> ${unit}</span></span>${todayLow!=null&&todayHigh!=null?html`<div class="daily-range">${localized(this.hass,"Today","Ma")} · ${localized(this.hass,"min","min.")} ${format(todayLow)}° · ${localized(this.hass,"max","max.")} ${format(todayHigh)}°</div>`:nothing}</span></div>
      <div class="outlook">
        ${insight(outlook.kind==="dry"?"mdi:weather-partly-cloudy":outlook.kind==="unknown"?"mdi:help-circle-outline":"mdi:weather-rainy",rainTitle,`${localized(this.hass,"Next 12 hours","Következő 12 óra")}${rainWhen?` · ${localized(this.hass,"from","ettől:")} ${rainWhen}`:""}${outlook.peak!=null?` · ${localized(this.hass,"up to","legfeljebb")} ${outlook.peak}%`:""}`,outlook.first?"#3184bf":"var(--luma-muted)")}
      </div>
      <div class="chips">${humidity!=null?chip("mdi:water-percent",`${localized(this.hass,"Humidity","Páratartalom")} ${Math.round(humidity)}%`):nothing}${weatherNumber(a.wind_speed)!=null?chip("mdi:weather-windy",`${localized(this.hass,"Wind","Szél")} ${a.wind_speed} ${a.wind_speed_unit||"km/h"}`):nothing}${weatherNumber(a.apparent_temperature)!=null?chip("mdi:thermometer-lines",`${localized(this.hass,"Feels like","Hőérzet")} ${a.apparent_temperature}°`):nothing}${weatherNumber(a.pressure)!=null?chip("mdi:gauge",`${a.pressure} ${a.pressure_unit||"hPa"}`):nothing}</div>
    </ha-card>`;
  }
}
