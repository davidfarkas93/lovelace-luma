import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { localized } from "../localize";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LovelaceCard } from "../types";

interface LogbookEvent { entity_id?:string; name?:string; message?:string; state?:string; when?:number|string; icon?:string }
interface Config { type:string; entity?:string; entities?:string[]; hours_to_show?:number; max_items?:number; collapse?:number; no_event?:string; icon?:string; title?:string }

@customElement("luma-logbook-card")
export class LumaLogbookCard extends LitElement implements LovelaceCard {
  @property({attribute:false}) hass?:HomeAssistant;
  @state() private config?:Config;
  @state() private events:LogbookEvent[]=[];
  @state() private loading=true;
  @state() private expanded=false;
  private loaded=false;
  private refreshTimer?:number;

  static styles=[lumaTokens,css`
    ha-card{padding:14px 16px;border:1px solid color-mix(in srgb,var(--primary-color) 14%,transparent);border-radius:22px;background:linear-gradient(145deg,color-mix(in srgb,var(--primary-color) 5%,var(--luma-surface)),var(--luma-surface) 72%);box-shadow:var(--luma-shadow)}
    .title{display:flex;align-items:center;gap:9px;padding:2px 2px 12px;font-size:14px;font-weight:720}.title ha-icon{--mdc-icon-size:19px;color:var(--primary-color)}
    .day{padding:11px 0 6px;border-bottom:1px solid var(--luma-border);font-size:11px;font-weight:760;letter-spacing:.045em;text-transform:uppercase}.event{display:grid;grid-template-columns:32px minmax(0,1fr) auto;align-items:center;gap:10px;min-height:51px;border-bottom:1px solid color-mix(in srgb,var(--primary-text-color) 5%,transparent)}.event:last-of-type{border-bottom:0}
    .event-icon{display:grid;place-items:center;width:30px;height:30px;border-radius:10px;color:var(--primary-color);background:color-mix(in srgb,var(--primary-color) 9%,transparent)}.event-icon ha-icon{--mdc-icon-size:16px}.message{min-width:0;font-size:13px;font-weight:620;line-height:1.3}.time{color:var(--luma-muted);font-size:10px;white-space:nowrap}.empty{padding:24px 8px;text-align:center;color:var(--luma-muted);font-size:12px}
    .more{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;margin-top:9px;padding:9px;border:0;border-radius:999px;color:var(--primary-color);background:color-mix(in srgb,var(--primary-color) 8%,transparent);font:inherit;font-size:11px;font-weight:720;cursor:pointer}.more ha-icon{--mdc-icon-size:16px}
    @media(max-width:599px){ha-card{padding:12px 14px}.event{grid-template-columns:30px minmax(0,1fr);grid-template-areas:"icon message" "icon time";gap:1px 9px;padding:7px 0}.event-icon{grid-area:icon}.message{grid-area:message}.time{grid-area:time}}
  `];

  setConfig(c:Config){if(!c?.entity&&!c?.entities?.length)throw Error("entity or entities required");this.config={hours_to_show:168,max_items:20,collapse:5,icon:"mdi:water-check-outline",...c};this.loaded=false}
  getCardSize(){return 4}
  connectedCallback(){super.connectedCallback();this.refreshTimer=window.setInterval(()=>void this.load(),60000)}
  disconnectedCallback(){super.disconnectedCallback();if(this.refreshTimer)clearInterval(this.refreshTimer)}
  protected updated(){if(this.hass&&!this.loaded){this.loaded=true;void this.load()}}
  private async load(){if(!this.hass?.callWS||!this.config)return;this.loading=true;const end=new Date(),start=new Date(end.getTime()-(this.config.hours_to_show||168)*3600000),ids=this.config.entities||[this.config.entity!];try{const result=await this.hass.callWS<LogbookEvent[]>({type:"logbook/get_events",start_time:start.toISOString(),end_time:end.toISOString(),entity_ids:ids});this.events=(Array.isArray(result)?result:[]).slice().reverse().slice(0,this.config.max_items)}catch{this.events=[]}finally{this.loading=false}}
  private date(e:LogbookEvent){const raw=e.when;const d=typeof raw==="number"?new Date(raw*(raw<1e12?1000:1)):new Date(raw||0);return Number.isNaN(d.getTime())?new Date(0):d}
  private relative(d:Date){const m=Math.max(0,Math.floor((Date.now()-d.getTime())/60000));if(m<1)return localized(this.hass,"just now","épp most");if(m<60)return localized(this.hass,`${m} min ago`,`${m} perce`);const h=Math.floor(m/60);if(h<24)return localized(this.hass,`${h} h ago`,`${h} órája`);return localized(this.hass,`${Math.floor(h/24)} d ago`,`${Math.floor(h/24)} napja`)}
  render(){if(!this.config)return nothing;const limit=this.expanded?this.events.length:(this.config.collapse||5),shown=this.events.slice(0,limit),groups=new Map<string,LogbookEvent[]>();for(const e of shown){const key=this.date(e).toLocaleDateString(this.hass?.locale?.language||"en",{year:"numeric",month:"long",day:"numeric"});groups.set(key,[...(groups.get(key)||[]),e])}return html`<ha-card>${this.config.title?html`<div class="title"><ha-icon icon=${this.config.icon}></ha-icon>${this.config.title}</div>`:nothing}${this.loading&&!this.events.length?html`<div class="empty">${localized(this.hass,"Loading history…","Előzmények betöltése…")}</div>`:!shown.length?html`<div class="empty">${this.config.no_event||localized(this.hass,"No events in the selected period.","Nincs esemény a kiválasztott időszakban.")}</div>`:[...groups].map(([day,events])=>html`<div class="day">${day}</div>${events.map(e=>html`<div class="event"><span class="event-icon"><ha-icon icon=${e.icon||this.config!.icon}></ha-icon></span><span class="message">${e.message||e.name||e.state||localized(this.hass,"Irrigation event","Öntözési esemény")}</span><span class="time">${this.relative(this.date(e))}</span></div>`)}`)}${this.events.length>(this.config.collapse||5)?html`<button class="more" @click=${()=>this.expanded=!this.expanded}><ha-icon icon=${this.expanded?"mdi:chevron-up":"mdi:chevron-down"}></ha-icon>${this.expanded?localized(this.hass,"Show less","Kevesebb"):localized(this.hass,"More events","További események")}</button>`:nothing}</ha-card>`}
}
