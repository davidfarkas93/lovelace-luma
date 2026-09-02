import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { runAction } from "../helpers";
import { localized } from "../localize";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LovelaceCard } from "../types";

interface Config {
  type: string; name: string; icon?: string; color?: string;
  enabled_entity: string; automation_entity?: string; start_entity: string;
  day_entities: string[]; interval_mode_entity?: string;
  interval_entity?: string; anchor_entity?: string;
}

@customElement("luma-irrigation-schedule-card")
export class LumaIrrigationScheduleCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: Config;
  static styles = [lumaTokens, css`
    ha-card{padding:16px;border:1px solid color-mix(in srgb,var(--tone) 17%,transparent);border-radius:20px;background:linear-gradient(145deg,color-mix(in srgb,var(--tone) 8%,var(--luma-surface)),var(--luma-surface) 70%);box-shadow:var(--luma-shadow)}
    button{cursor:pointer;font:inherit}.head{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:11px}
    .power{display:grid;place-items:center;width:42px;height:42px;padding:0;border:1px solid color-mix(in srgb,var(--tone) 22%,transparent);border-radius:14px;color:var(--tone);background:color-mix(in srgb,var(--tone) 14%,transparent)}
    .power.off{color:var(--luma-muted);background:transparent;border-color:var(--luma-border)}.power ha-icon{--mdc-icon-size:21px}
    .name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:16px;font-weight:750}.status{display:flex;align-items:center;gap:5px;margin-top:3px;color:var(--luma-muted);font-size:10px;font-weight:650}
    .status::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--tone)}.status.off::before{background:var(--luma-muted)}.status.warning{color:var(--warning-color)}.status.warning::before{background:var(--warning-color)}
    .time{min-width:68px;padding:7px 9px;border:1px solid color-mix(in srgb,var(--tone) 20%,transparent);border-radius:11px;color:var(--tone);background:color-mix(in srgb,var(--tone) 8%,transparent);text-align:center}
    .time-label{display:block;margin-bottom:1px;color:var(--luma-muted);font-size:8px;font-weight:750;letter-spacing:.05em;text-transform:uppercase}.time-value{font-size:16px;font-weight:780}
    .mode-switch{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:14px;padding:4px;border:1px solid var(--luma-border);border-radius:13px;background:color-mix(in srgb,var(--luma-muted) 5%,transparent)}
    .mode-option{display:flex;align-items:center;justify-content:center;gap:6px;min-width:0;min-height:34px;padding:6px 8px;border:0;border-radius:9px;color:var(--luma-muted);background:transparent;font-size:11px;font-weight:720}
    .mode-option.selected{color:var(--tone);background:color-mix(in srgb,var(--tone) 15%,var(--luma-surface));box-shadow:0 3px 10px rgba(0,0,0,.04)}.mode-option ha-icon{--mdc-icon-size:15px}.body{transition:opacity .18s ease}.body.disabled{opacity:.48}
    .days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px;margin-top:12px}.day{display:grid;place-items:center;min-width:0;height:35px;padding:0;border:1px solid color-mix(in srgb,var(--tone) 13%,transparent);border-radius:10px;color:var(--luma-muted);background:transparent;font-size:11px;font-weight:760}
    .day.on{color:var(--tone);background:color-mix(in srgb,var(--tone) 15%,transparent);border-color:color-mix(in srgb,var(--tone) 28%,transparent)}
    .interval{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;margin-top:12px}.interval-control,.anchor{min-height:43px;padding:8px 11px;border:1px solid color-mix(in srgb,var(--tone) 16%,transparent);border-radius:12px;background:color-mix(in srgb,var(--tone) 8%,transparent)}
    .interval-control{color:var(--tone);text-align:left}.anchor{color:var(--luma-muted);background:transparent;font-size:10px;font-weight:700}.control-label{display:block;color:var(--luma-muted);font-size:8px;font-weight:750;letter-spacing:.05em;text-transform:uppercase}.control-value{display:block;margin-top:2px;font-size:13px;font-weight:780}
    .next{display:flex;align-items:center;gap:7px;min-height:20px;margin-top:11px;padding-top:10px;border-top:1px solid var(--luma-border);color:var(--luma-muted);font-size:10px}.next ha-icon{--mdc-icon-size:14px;color:var(--tone)}.next strong{color:var(--luma-text);font-weight:730}
    @media(max-width:380px){ha-card{padding:14px}.mode-option{gap:4px;padding-inline:5px;font-size:10px}.days{gap:3px}.day{height:33px;border-radius:9px}}
  `];
  setConfig(c: Config) { if (!c?.enabled_entity || !c?.start_entity || c.day_entities?.length !== 7) throw Error("enabled_entity, start_entity and seven day_entities required"); this.config = c; }
  getCardSize(){ return 3; }
  private toggle(id:string){ void runAction(this,this.hass!,{action:"toggle",entity:id},id); }
  private selectMode(interval:boolean){ const id=this.config?.interval_mode_entity;if(!id||!this.hass)return;void this.hass.callService("input_boolean",interval?"turn_on":"turn_off",{entity_id:id}); }
  private moreInfo(id?:string){ if(id)void runAction(this,this.hass!,{action:"more-info"},id); }
  private candidate(raw:string){const [h,m]=raw.split(":").map(Number);if(![h,m].every(Number.isFinite))return;const d=new Date();d.setHours(h,m,0,0);return d}
  private dateLabel(d:Date){return d.toLocaleDateString(this.hass?.locale?.language||"en",{weekday:"short",month:"short",day:"numeric"})+" · "+d.toLocaleTimeString(this.hass?.locale?.language||"en",{hour:"2-digit",minute:"2-digit",hour12:false})}
  private nextWeekly(raw:string,selected:boolean[]){const d=this.candidate(raw);if(!d||!selected.some(Boolean))return localized(this.hass!,"No days selected","Nincs kiválasztott nap");for(let i=0;i<8;i++){const idx=(d.getDay()+6)%7;if(selected[idx]&&d>new Date())return this.dateLabel(d);d.setDate(d.getDate()+1)}return"—"}
  private nextInterval(anchor:string,interval:number,raw:string){const [y,m,day]=anchor.split("-").map(Number),d=this.candidate(raw);if(!d||![y,m,day].every(Number.isFinite))return"—";const start=Date.UTC(y,m-1,day);for(let i=0;i<=Math.max(62,interval+1);i++){const elapsed=Math.round((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-start)/86400000);if(elapsed>=0&&elapsed%interval===0&&d>new Date())return this.dateLabel(d);d.setDate(d.getDate()+1)}return"—"}
  render(){
    if(!this.hass||!this.config)return nothing;const c=this.config,s=this.hass.states,on=s[c.enabled_entity]?.state==="on",automationOn=!c.automation_entity||s[c.automation_entity]?.state==="on",raw=s[c.start_entity]?.state||"—",time=raw.length>=5?raw.slice(0,5):raw,intervalMode=!!c.interval_mode_entity&&s[c.interval_mode_entity]?.state==="on",interval=Math.max(1,Number(c.interval_entity?s[c.interval_entity]?.state:2)||2),anchor=c.anchor_entity?s[c.anchor_entity]?.state||"":"",selected=c.day_entities.map(id=>s[id]?.state==="on"),labels=["H","K","Sze","Cs","P","Szo","V"],next=intervalMode?this.nextInterval(anchor,interval,raw):this.nextWeekly(raw,selected),status=!automationOn?localized(this.hass,"Automation disabled","Automatika letiltva"):on?localized(this.hass,"Schedule active","Ütemezés aktív"):localized(this.hass,"Schedule paused","Ütemezés kikapcsolva");
    return html`<ha-card style=${`--tone:${c.color||"var(--primary-color)"}`}><div class="head"><button class=${`power ${on?"":"off"}`} @click=${()=>this.toggle(c.enabled_entity)}><ha-icon icon=${on?(c.icon||"mdi:calendar-check"):"mdi:calendar-blank-outline"}></ha-icon></button><div><div class="name">${c.name}</div><div class=${`status ${!automationOn?"warning":on?"":"off"}`} @click=${()=>!automationOn&&this.moreInfo(c.automation_entity)}>${status}</div></div><button class="time" @click=${()=>this.moreInfo(c.start_entity)}><span class="time-label">${localized(this.hass,"Starts","Indítás")}</span><span class="time-value">${time}</span></button></div>
      ${c.interval_mode_entity?html`<div class="mode-switch"><button class=${`mode-option ${intervalMode?"":"selected"}`} @click=${()=>this.selectMode(false)}><ha-icon icon="mdi:calendar-week"></ha-icon>${localized(this.hass,"Selected days","Kiválasztott napok")}</button><button class=${`mode-option ${intervalMode?"selected":""}`} @click=${()=>this.selectMode(true)}><ha-icon icon="mdi:calendar-range"></ha-icon>${localized(this.hass,"Every N days","N naponta")}</button></div>`:nothing}
      <div class=${`body ${on&&automationOn?"":"disabled"}`}>${intervalMode&&c.interval_entity&&c.anchor_entity?html`<div class="interval"><button class="interval-control" @click=${()=>this.moreInfo(c.interval_entity)}><span class="control-label">${localized(this.hass,"Frequency","Gyakoriság")}</span><span class="control-value">${localized(this.hass,`Every ${interval} days`,`${interval} naponta`)}</span></button><button class="anchor" @click=${()=>this.moreInfo(c.anchor_entity)}>${localized(this.hass,"Start date","Kezdőnap")}<br><strong>${anchor||"—"}</strong></button></div>`:html`<div class="days">${c.day_entities.map((id,i)=>html`<button class=${`day ${selected[i]?"on":""}`} @click=${()=>this.toggle(id)}>${labels[i]}</button>`)}</div>`}<div class="next"><ha-icon icon="mdi:calendar-arrow-right"></ha-icon><span>${localized(this.hass,"Next run","Következő futás")}: <strong>${on&&automationOn?next:"—"}</strong></span></div></div></ha-card>`;
  }
}
