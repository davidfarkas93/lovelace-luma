import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { applianceDuration, applianceSeconds } from "../appliance";
import { entityName, runAction } from "../helpers";
import { localized } from "../localize";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LovelaceCard } from "../types";

interface Schedule { name:string; enabled_entity:string; start_entity:string; day_entities:string[]; mode_entity?:string; interval_entity?:string; anchor_entity?:string }
interface Config {
  type:string; name?:string; controller_entity:string; rain_entity:string;
  suspended_entity:string; program_entity:string; active_program_entity?:string;
  progress_entity?:string; remaining_entity?:string; next_zone_entity?:string;
  message_entity?:string; zones:string[]; schedules?:Schedule[]; schedule_path?:string;
}

@customElement("luma-irrigation-hero-card")
export class LumaIrrigationHeroCard extends LitElement implements LovelaceCard {
  @property({attribute:false}) hass?:HomeAssistant;
  @state() private config?:Config;

  static styles=[lumaTokens,css`
    ha-card{position:relative;padding:24px;border:1px solid color-mix(in srgb,var(--tone) 24%,transparent);border-radius:var(--luma-radius-hero);background:linear-gradient(135deg,color-mix(in srgb,var(--tone) 13%,var(--luma-surface)),var(--luma-surface) 68%);box-shadow:var(--luma-shadow)}
    .top{display:flex;align-items:center;gap:15px}.icon{display:grid;place-items:center;width:58px;height:58px;flex:0 0 auto;border-radius:19px;color:var(--tone);background:color-mix(in srgb,var(--tone) 15%,transparent)}.icon ha-icon{--mdc-icon-size:30px}.copy{min-width:0}.name{font-size:26px;font-weight:760;letter-spacing:-.035em}.sub{margin-top:4px;color:var(--luma-muted);font-size:13px}
    .progress{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px 12px;margin-top:17px;padding:11px 13px;border-radius:16px;background:color-mix(in srgb,var(--tone) 7%,transparent)}.progress-copy{min-width:0;font-size:11px;font-weight:720;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.remaining{color:var(--tone);font-size:11px;font-weight:760}.track{grid-column:1/-1;height:9px;overflow:hidden;border-radius:999px;background:color-mix(in srgb,var(--primary-text-color) 8%,transparent)}.fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,color-mix(in srgb,var(--tone) 72%,white),var(--tone));box-shadow:0 0 13px color-mix(in srgb,var(--tone) 35%,transparent);transition:width .6s ease}
    .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:15px}.chip{display:inline-flex;align-items:center;padding:7px 11px;border-radius:999px;color:var(--tone);background:color-mix(in srgb,var(--tone) 11%,transparent);font-family:inherit;font-size:11px;line-height:1.2;font-weight:700}.next{gap:7px;border:0;cursor:pointer}.next ha-icon{--mdc-icon-size:15px}
    @media(max-width:599px){ha-card{padding:18px}.name{font-size:22px}.icon{width:50px;height:50px;border-radius:16px}.progress{margin-top:14px}.chips{margin-top:12px}.next{flex:1 1 100%;justify-content:center}}
  `];

  setConfig(c:Config){if(!c?.controller_entity||!c.zones)throw Error("controller_entity and zones required");this.config={schedule_path:"/dashboard-irrigation/schedules",schedules:[],...c}}
  getCardSize(){return 3}

  private nextSchedule(){
    if(!this.hass||!this.config)return undefined;
    const now=new Date(),currentDay=(now.getDay()+6)%7;
    const candidates:{name:string;date:Date}[]=[];
    for(const schedule of this.config.schedules||[]){
      if(this.hass.states[schedule.enabled_entity]?.state!=="on")continue;
      const raw=this.hass.states[schedule.start_entity]?.state||"";
      const [hour,minute]=raw.split(":").map(Number);
      if(!Number.isFinite(hour)||!Number.isFinite(minute))continue;
      if(schedule.mode_entity&&this.hass.states[schedule.mode_entity]?.state==="Minden N. nap"&&schedule.interval_entity&&schedule.anchor_entity){
        const anchor=this.hass.states[schedule.anchor_entity]?.state||"",interval=Math.max(1,Number(this.hass.states[schedule.interval_entity]?.state)||1),parts=anchor.split("-").map(Number);
        if(parts.length===3&&parts.every(Number.isFinite)){
          const anchorDay=Date.UTC(parts[0],parts[1]-1,parts[2]),date=new Date(now);date.setHours(hour,minute,0,0);
          for(let i=0;i<=Math.max(31,interval+1);i++){
            const candidateDay=Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()),elapsed=Math.round((candidateDay-anchorDay)/86400000);
            if(elapsed>=0&&elapsed%interval===0&&date>now){candidates.push({name:schedule.name,date:new Date(date)});break}
            date.setDate(date.getDate()+1);
          }
        }
        continue;
      }
      schedule.day_entities.forEach((id,index)=>{
        if(this.hass!.states[id]?.state!=="on")return;
        let offset=(index-currentDay+7)%7;
        const date=new Date(now);date.setHours(hour,minute,0,0);date.setDate(now.getDate()+offset);
        if(date<=now){offset+=7;date.setDate(date.getDate()+7)}
        candidates.push({name:schedule.name,date});
      });
    }
    return candidates.sort((a,b)=>a.date.getTime()-b.date.getTime())[0];
  }

  private scheduleLabel(item:{name:string;date:Date}){
    const now=new Date(),start=new Date(now);start.setHours(0,0,0,0);const day=Math.round((new Date(item.date).setHours(0,0,0,0)-start.getTime())/86400000);
    const when=day===0?localized(this.hass,"today","ma"):day===1?localized(this.hass,"tomorrow","holnap"):item.date.toLocaleDateString(this.hass?.locale?.language||"en",{weekday:"short"});
    return `${when} ${item.date.toLocaleTimeString(this.hass?.locale?.language||"en",{hour:"2-digit",minute:"2-digit",hour12:false})} · ${item.name}`;
  }

  render(){
    if(!this.hass||!this.config)return nothing;
    const s=this.hass.states,c=this.config,online=s[c.controller_entity]?.state==="on",rain=s[c.rain_entity]?.state==="on",paused=s[c.suspended_entity]?.state==="on",message=c.message_entity&&s[c.message_entity]?.state==="on",active=c.zones.filter(x=>s[x]?.state==="on"),state=s[c.program_entity]?.state||"Nincs adat",program=c.active_program_entity?s[c.active_program_entity]?.state||"Nincs":"Nincs",programActive=!['','nincs','none','unknown','unavailable'].includes(program.toLocaleLowerCase()),running=active.length>0||programActive,progress=Math.max(0,Math.min(100,Number(c.progress_entity?s[c.progress_entity]?.state:NaN))),remaining=applianceSeconds(c.remaining_entity?s[c.remaining_entity]:undefined),nextZone=c.next_zone_entity?s[c.next_zone_entity]?.state:"",next=this.nextSchedule();
    const bad=!online||message,tone=bad?"var(--error-color)":paused||rain?"var(--warning-color)":running?"var(--success-color)":"var(--primary-color)",icon=!online?"mdi:lan-disconnect":running?"mdi:sprinkler":paused?"mdi:pause-circle-outline":rain?"mdi:weather-rainy":"mdi:sprinkler-variant";
    const activeName=active.length===1?entityName(s[active[0]],active[0]).replace(/^irrigation-controller\s*/i,""):active.length?localized(this.hass,`${active.length} active zones`,`${active.length} aktív zóna`):"",runLabel=programActive?[program,activeName||nextZone].filter(x=>x&&!['Nincs','-1'].includes(x)).join(" · "):activeName||state,subtitle=!online?localized(this.hass,"Controller unavailable","A vezérlő nem elérhető"):running?runLabel:paused?localized(this.hass,"Automatic start suspended","Az automatikus indítás felfüggesztve"):rain?localized(this.hass,"Paused due to rain","Eső miatti tiltás"):state;
    return html`<ha-card style=${`--tone:${tone}`}><div class="top"><span class="icon"><ha-icon icon=${icon}></ha-icon></span><span class="copy"><div class="name">${c.name||localized(this.hass,"Irrigation center","Öntözési központ")}</div><div class="sub">${subtitle}</div></span></div>${running&&Number.isFinite(progress)?html`<div class="progress"><span class="progress-copy">${runLabel||localized(this.hass,"Irrigation in progress","Öntözés folyamatban")}</span><span class="remaining">${remaining!=null&&remaining>0?`${applianceDuration(remaining)} ${localized(this.hass,"left","hátra")}`:`${Math.round(progress)}%`}</span><div class="track"><div class="fill" style=${`width:${progress}%`}></div></div></div>`:nothing}<div class="chips"><span class="chip">${online?localized(this.hass,"Controller online","Vezérlő online"):"Offline"}</span><span class="chip">${rain?localized(this.hass,"Rain detected","Eső érzékelve"):localized(this.hass,"Dry","Száraz")}</span>${running?html`<span class="chip">${programActive?program:localized(this.hass,`${active.length} zones running`,`${active.length} zóna fut`)}</span>`:nothing}${paused?html`<span class="chip">${localized(this.hass,"Suspended","Felfüggesztve")}</span>`:nothing}${next?html`<button class="chip next" @click=${()=>runAction(this,this.hass!,{action:"navigate",navigation_path:c.schedule_path!})}><ha-icon icon="mdi:calendar-clock"></ha-icon>${localized(this.hass,"Next","Következő")}: ${this.scheduleLabel(next)}</button>`:html`<span class="chip">${localized(this.hass,"No scheduled run","Nincs ütemezett futás")}</span>`}</div></ha-card>`;
  }
}
