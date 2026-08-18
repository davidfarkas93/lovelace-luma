import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { activeEntities, entityState, itemIsVisible, runAction } from "../helpers";
import { lumaTokens } from "../styles";
import type {
  HassEntity,
  HomeAssistant,
  LumaAction,
  LumaActiveConfig,
  LumaBannerConfig,
  LumaIncidentRule,
  LumaIncidentTone,
  LovelaceCard,
} from "../types";

interface LumaHomeHeroConfig {
  type: string;
  name?: string;
  weather_entity: string;
  alarm_entity?: string;
  alarm_action?: LumaAction;
  alarm_popover?: boolean;
  alarm_modes?: Array<{ mode:"away"|"night"|"home"|"disarm"; name:string; icon?:string }>;
  notifications_entity?: string;
  acknowledgements_entity?: string;
  irrigation_entity?: string;
  irrigation_zone_entities?: Array<string | { entity: string; name?: string }>;
  irrigation_path?: string;
  waste_entity?: string;
  waste_ack_entity?: string;
  waste_path?: string;
  waste_days?: number;
  waste_items?: Array<{entity:string;name:string}>;
  wind_threshold?: number;
  active_action?: LumaAction;
  active_exclude?: string[];
  active?: LumaActiveConfig;
  incidents?: LumaIncidentRule[];
  banners?: LumaBannerConfig[];
  tap_action?: LumaAction;
}

interface Incident {
  key: string;
  message: string;
  tone: LumaIncidentTone;
  path?: string;
  dismissible: boolean;
}

const weatherLabels: Record<string, string> = {
  sunny: "Napos", "clear-night": "Derült éjszaka", cloudy: "Felhős",
  partlycloudy: "Részben felhős", rainy: "Esős", pouring: "Szakadó eső",
  lightning: "Zivatar", "lightning-rainy": "Zivatar és eső", snowy: "Havazás",
  fog: "Ködös", windy: "Szeles",
};

const weatherIcons: Record<string, string> = {
  sunny: "mdi:weather-sunny", "clear-night": "mdi:weather-night", cloudy: "mdi:weather-cloudy",
  partlycloudy: "mdi:weather-partly-cloudy", rainy: "mdi:weather-rainy", pouring: "mdi:weather-pouring",
  lightning: "mdi:weather-lightning", "lightning-rainy": "mdi:weather-lightning-rainy",
  snowy: "mdi:weather-snowy", fog: "mdi:weather-fog", windy: "mdi:weather-windy",
};

const glob = (pattern: string, value: string): boolean => {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(value);
};

const listed = (expected: string | string[] | undefined, actual: string): boolean =>
  expected === undefined
    ? false
    : (Array.isArray(expected) ? expected : [expected])
        .map((value) => value.toLocaleLowerCase())
        .includes(actual.toLocaleLowerCase());

const matchesRule = (entity: HassEntity | undefined, rule: LumaIncidentRule): boolean => {
  if (!entity) return false;
  if (rule.state !== undefined && !listed(rule.state, entity.state)) return false;
  if (rule.state_not !== undefined && listed(rule.state_not, entity.state)) return false;
  const numeric = Number(entity.state);
  if (rule.above !== undefined && (!Number.isFinite(numeric) || numeric <= rule.above)) return false;
  if (rule.below !== undefined && (!Number.isFinite(numeric) || numeric >= rule.below)) return false;
  if (rule.for_minutes && Date.now() - new Date(entity.last_changed).getTime() < rule.for_minutes * 60_000) return false;
  return true;
};

@customElement("luma-home-hero-card")
export class LumaHomeHeroCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: LumaHomeHeroConfig;
  @state() private detailsOpen = false;
  @state() private alarmPopoverOpen = false;
  @state() private alarmPending?: "away"|"night"|"home"|"disarm";
  private alarmTimer?:number;
  private readonly repositionAlarm=()=>this.positionAlarmPopover();

  static styles = [lumaTokens, css`
    .hero { position:relative; isolation:isolate; padding:26px; overflow:hidden;
      border:1px solid color-mix(in srgb,var(--luma-accent) 20%,transparent); border-radius:var(--luma-radius-hero);
      background:linear-gradient(135deg,color-mix(in srgb,var(--luma-accent) 16%,var(--luma-surface)),color-mix(in srgb,var(--luma-accent) 3%,var(--luma-surface)) 68%);
      box-shadow:0 18px 50px rgba(0,0,0,.08); transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease; }
    .hero.interactive:hover { transform:translateY(-2px); border-color:color-mix(in srgb,var(--luma-accent) 30%,transparent); box-shadow:0 23px 58px rgba(0,0,0,.11); }
    .content { position:relative; z-index:2; }
    .top { display:grid; grid-template-columns:58px minmax(0,1fr) minmax(280px,420px); grid-template-areas:"icon title status" "icon subtitle status"; align-items:center; gap:0 17px; }
    .weather-icon { grid-area:icon; display:grid; place-items:center; width:58px; height:58px; border-radius:19px; color:var(--luma-accent); background:color-mix(in srgb,var(--luma-accent) 15%,transparent); }
    .weather-icon ha-icon { --mdc-icon-size:31px; }
    h2 { grid-area:title; align-self:end; margin:0; font-size:clamp(20px,4vw,27px); line-height:1.12; font-weight:730; }
    .subtitle { grid-area:subtitle; align-self:start; margin-top:5px; color:var(--luma-muted); font-size:13px; line-height:1.35; }
    button { font:inherit; }
    .status { grid-area:status; display:flex; align-items:center; justify-content:flex-end; flex-wrap:wrap; gap:7px; min-width:0; }
    .alarm,.attention,.active { display:inline-flex; align-items:center; justify-content:center; gap:6px; min-height:34px; padding:7px 11px; border:0; border-radius:999px; font-size:11px; font-weight:680; line-height:1; transition:transform .16s ease,background .16s ease; }
    .alarm:hover,.attention:hover,.active:hover { transform:translateY(-1px); filter:saturate(1.08); }
    .alarm { color:var(--alarm-color); background:color-mix(in srgb,var(--alarm-color) 12%,transparent); }
    .alarm ha-icon,.attention ha-icon,.active ha-icon { --mdc-icon-size:16px; }
    .attention { color:var(--attention-color); background:color-mix(in srgb,var(--attention-color) 12%,transparent); }
    .active { position:relative; overflow:visible; color:var(--active-color); background:color-mix(in srgb,var(--active-color) 12%,transparent); }
    .active-badge { position:absolute; top:-4px; right:-4px; display:grid; place-items:center; min-width:14px; height:14px; padding:0 4px; border-radius:999px; color:#1e1e24; background:var(--warning-color); font-size:9px; font-weight:800; line-height:14px; }
    .alarm-scrim{position:fixed;inset:0;z-index:998;padding:0;border:0;background:transparent;cursor:default}.alarm-popover{position:fixed;z-index:999;display:grid;gap:13px;width:min(370px,calc(100vw - 24px));padding:15px;box-sizing:border-box;border:1px solid color-mix(in srgb,var(--alarm-tone) 20%,transparent);border-radius:22px;background:color-mix(in srgb,var(--luma-surface) 94%,transparent);box-shadow:0 24px 70px rgba(0,0,0,.22),0 4px 16px color-mix(in srgb,var(--alarm-tone) 10%,transparent);backdrop-filter:blur(22px) saturate(1.25);animation:alarm-appear .18s cubic-bezier(.2,.8,.2,1);transform-origin:top center}.alarm-popover-head{display:grid;grid-template-columns:38px minmax(0,1fr) 34px;align-items:center;gap:10px}.alarm-popover-icon{display:grid;place-items:center;width:38px;height:38px;border-radius:13px;color:var(--alarm-tone);background:color-mix(in srgb,var(--alarm-tone) 15%,transparent)}.alarm-popover-icon ha-icon{--mdc-icon-size:20px}.alarm-popover-title{font-size:var(--luma-text-md);font-weight:var(--luma-weight-title)}.alarm-popover-state{margin-top:2px;color:var(--alarm-tone);font-size:var(--luma-text-xs);font-weight:680}.alarm-close{display:grid;place-items:center;width:34px;height:34px;padding:0;border:0;border-radius:50%;color:var(--luma-muted);background:color-mix(in srgb,var(--primary-text-color) 5%,transparent)}.alarm-close ha-icon{--mdc-icon-size:18px}.alarm-actions{display:grid;grid-template-columns:repeat(var(--alarm-count),minmax(0,1fr));gap:5px;padding:5px;border-radius:999px;background:color-mix(in srgb,var(--primary-text-color) 4.5%,transparent)}.alarm-mode{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:0;min-height:42px;padding:0 10px;border:0;border-radius:999px;color:var(--mode-tone);background:transparent;font:inherit;font-size:10px;font-weight:700}.alarm-mode:hover:not(:disabled){background:color-mix(in srgb,var(--mode-tone) 10%,transparent)}.alarm-mode.confirm{color:var(--warning-color);background:color-mix(in srgb,var(--warning-color) 16%,transparent)}.alarm-mode.active{background:color-mix(in srgb,var(--mode-tone) 14%,transparent)}.alarm-mode:disabled{opacity:.45}.alarm-mode.active:disabled{opacity:1}.alarm-mode ha-icon{--mdc-icon-size:17px}.alarm-mode span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.alarm-details{border:0;background:transparent;color:var(--luma-muted);font:inherit;font-size:11px;font-weight:650}.alarm-close,.alarm-mode,.alarm-details{cursor:pointer}@keyframes alarm-appear{from{opacity:0;transform:translateY(-5px) scale(.97)}to{opacity:1;transform:none}}
    .panel { display:grid; gap:7px; margin-top:12px; padding:10px; border-radius:16px; background:color-mix(in srgb,var(--primary-text-color) 3%,transparent); }
    .issue { display:grid; grid-template-columns:18px minmax(0,1fr) auto; align-items:center; gap:8px; min-height:38px; padding:6px 8px; border-radius:12px; color:var(--issue-color); background:color-mix(in srgb,var(--issue-color) 8%,transparent); }
    .issue ha-icon { --mdc-icon-size:17px; }
    .issue-text { min-width:0; color:var(--primary-text-color); font-size:12px; font-weight:620; }
    .issue-actions { display:flex; gap:5px; }
    .issue-actions button { min-height:27px; padding:4px 8px; border:0; border-radius:999px; color:var(--issue-color); background:color-mix(in srgb,var(--issue-color) 12%,transparent); font-size:9px; font-weight:780; }
    .banners { display:grid; gap:8px; margin-top:13px; }
    .banner { display:grid; grid-template-columns:22px auto minmax(0,1fr) auto; align-items:center; gap:8px; width:100%; min-height:42px; padding:8px 11px; border:1px solid color-mix(in srgb,var(--item-color) 17%,transparent); border-radius:14px; color:var(--item-color); background:color-mix(in srgb,var(--item-color) 10%,transparent); text-align:left; transition:background .18s ease,border-color .18s ease,transform .18s ease; }
    .banner:hover { transform:translateY(-1px); border-color:color-mix(in srgb,var(--item-color) 25%,transparent); background:color-mix(in srgb,var(--item-color) 15%,transparent); }
    .banner ha-icon { --mdc-icon-size:18px; } .banner-label { font-size:11px; font-weight:720; } .banner-state { overflow:hidden; color:var(--primary-text-color); font-size:11px; font-weight:620; text-overflow:ellipsis; white-space:nowrap; }
    .banner-action { padding:5px 8px; border:0; border-radius:999px; color:var(--item-color); background:color-mix(in srgb,var(--item-color) 14%,transparent); font-size:9px; font-weight:800; letter-spacing:.05em; }
    .sky { position:absolute; inset:0; z-index:0; pointer-events:none; opacity:.58; }
    .sun,.moon { position:absolute; right:23%; top:-45px; width:160px; height:160px; border-radius:50%; }
    .sun { background:radial-gradient(circle,#e9ad35 0 31%,color-mix(in srgb,#ffd36a 34%,transparent) 33% 53%,transparent 55%); animation:breathe 6s ease-in-out infinite; }
    .moon { width:120px;height:120px;top:-24px;right:24%;background:transparent;box-shadow:-25px 18px 0 color-mix(in srgb,#aab6ff 32%,transparent); }
    .cloud { position:absolute; right:20%; top:30px; width:125px; height:40px; border-radius:99px; background:color-mix(in srgb,var(--primary-text-color) 13%,transparent); animation:drift 9s ease-in-out infinite; }
    .cloud::before,.cloud::after { content:""; position:absolute; bottom:0; border-radius:50%; background:inherit; } .cloud::before{left:18px;width:54px;height:54px}.cloud::after{right:18px;width:42px;height:42px}
    .wind { position:absolute; right:43%; bottom:-8px; width:105px; height:145px; transform:translateZ(0); opacity:.29; }
    .mast { position:absolute; left:51px; top:53px; width:3px; height:94px; border-radius:3px; background:currentColor; transform:translateZ(0); }
    .rotor { position:absolute; left:13px; top:8px; width:80px; height:80px; transform-origin:50% 50%; animation:spin var(--wind-duration,8s) linear infinite; will-change:transform; }
    .blade { position:absolute; left:37px; top:0; width:7px; height:38px; border-radius:99px 99px 8px 8px; background:currentColor; transform-origin:50% 40px; } .blade:nth-child(2){transform:rotate(120deg)} .blade:nth-child(3){transform:rotate(240deg)}
    .hub { position:absolute; left:34px; top:34px; width:13px; height:13px; border-radius:50%; background:currentColor; }
    @keyframes spin { to { transform:rotate(360deg) translateZ(0); } } @keyframes breathe { 50% { transform:scale(1.12); opacity:.48; } } @keyframes drift { 0%,100%{transform:translateX(-8px)}50%{transform:translateX(10px)} }
    @media(max-width:900px){.top{grid-template-columns:58px minmax(0,1fr);grid-template-areas:"icon title" "icon subtitle" "status status";gap:0 14px}.status{justify-content:flex-start;margin-top:12px}}
    @media(max-width:599px){ .hero{padding:18px}.top{grid-template-columns:46px minmax(0,1fr);grid-template-areas:"icon title" "icon subtitle" "status status";gap:0 12px}.weather-icon{width:46px;height:46px;border-radius:15px}.weather-icon ha-icon{--mdc-icon-size:25px}.subtitle{font-size:12px}.status{justify-content:flex-start;margin-top:10px}.alarm,.attention,.active{min-height:34px;padding:7px 11px;font-size:11px}.sun,.cloud,.moon{right:-25px;opacity:.4}.wind{right:-6px;bottom:auto;top:-18px;opacity:.17}.banner{grid-template-columns:20px minmax(0,1fr) auto}.banner-label{display:none}.issue{grid-template-columns:18px minmax(0,1fr)}.issue-actions{grid-column:2;justify-content:flex-start}.alarm-popover{padding:13px}.alarm-actions{border-radius:17px;grid-template-columns:1fr}.alarm-mode{justify-content:flex-start;padding:0 13px} }
    @media(prefers-reduced-motion:reduce){.alarm-popover{animation:none}}
  `];

  setConfig(config: LumaHomeHeroConfig): void {
    if (!config?.weather_entity) throw new Error("Luma home hero requires weather_entity.");
    this.config = { incidents: [], banners: [], waste_days: 2, wind_threshold: 8, alarm_popover: true, alarm_modes:[{mode:"away",name:"Távol",icon:"mdi:shield-lock"},{mode:"night",name:"Éjszaka",icon:"mdi:shield-moon"},{mode:"disarm",name:"Kikapcsolás",icon:"mdi:shield-off-outline"}], ...config };
  }
  getCardSize(): number { return 4; }

  disconnectedCallback(){super.disconnectedCallback();this.detachAlarmListeners()}

  private toggleAlarmPopover(){this.alarmPopoverOpen=!this.alarmPopoverOpen;this.alarmPending=undefined;if(this.alarmPopoverOpen){window.addEventListener("resize",this.repositionAlarm);window.addEventListener("scroll",this.repositionAlarm,true);void this.updateComplete.then(()=>this.positionAlarmPopover())}else this.detachAlarmListeners()}
  private detachAlarmListeners(){window.removeEventListener("resize",this.repositionAlarm);window.removeEventListener("scroll",this.repositionAlarm,true)}
  private positionAlarmPopover(){if(!this.alarmPopoverOpen)return;const anchor=this.renderRoot.querySelector<HTMLElement>(".alarm"),popover=this.renderRoot.querySelector<HTMLElement>(".alarm-popover");if(!anchor||!popover)return;const rect=anchor.getBoundingClientRect(),gap=8,pad=12,width=Math.min(370,window.innerWidth-pad*2),left=Math.min(Math.max(rect.left,pad),window.innerWidth-width-pad),below=rect.bottom+gap,top=below+popover.offsetHeight<=window.innerHeight-pad?below:Math.max(pad,rect.top-popover.offsetHeight-gap);Object.assign(popover.style,{left:`${left}px`,top:`${top}px`,width:`${width}px`})}
  private activateAlarm(mode:"away"|"night"|"home"|"disarm",disabled:boolean){if(!this.hass||!this.config?.alarm_entity||disabled)return;if(this.alarmPending!==mode){this.alarmPending=mode;clearTimeout(this.alarmTimer);this.alarmTimer=window.setTimeout(()=>this.alarmPending=undefined,3400);return}this.alarmPending=undefined;this.alarmPopoverOpen=false;this.detachAlarmListeners();void this.hass.callService("alarm_control_panel",mode==="disarm"?"alarm_disarm":`alarm_arm_${mode}`,undefined,{entity_id:this.config.alarm_entity})}

  protected shouldUpdate(changed: PropertyValues<this>): boolean {
    if (!changed.has("hass")) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this.hass) return true;
    return this.watchedIds.some(id => old.states[id] !== this.hass!.states[id]);
  }

  private get watchedIds(): string[] {
    if (!this.hass || !this.config) return [];
    const fixed = [this.config.weather_entity,this.config.alarm_entity,this.config.notifications_entity,this.config.acknowledgements_entity,this.config.irrigation_entity,...(this.config.irrigation_zone_entities||[]).map(item=>typeof item==="string"?item:item.entity),this.config.waste_entity,this.config.waste_ack_entity,...(this.config.waste_items||[]).map(item=>item.entity)];
    const patterns = (this.config.incidents || []).filter(r=>r.entity_pattern);
    const dynamic = Object.keys(this.hass.states).filter(id=>patterns.some(r=>glob(r.entity_pattern!,id)));
    const related = dynamic.map(id=>{const r=patterns.find(x=>glob(x.entity_pattern!,id));return r?.related_suffix?id.replace(r.related_suffix.from,r.related_suffix.to):id;});
    const active = Object.keys(this.hass.states).filter(id=>["light","media_player","climate"].includes(id.split(".")[0]));
    return [...new Set([...fixed.filter(Boolean) as string[],...dynamic,...related,...active,...(this.config.banners||[]).map(b=>b.entity)])];
  }

  private greeting(): string {
    const h=new Date().getHours(), user=this.config?.name||this.hass?.user?.name||"",first=user.trim().split(/\s+/)[0],name=first ? `, ${first}` : "";
    return `${h>=18?"Jó estét":h>=12?"Szép délutánt":h>=5?"Jó reggelt":"Szia"}${name}!`;
  }
  private wasteSummary():string {
    if(!this.hass||!this.config)return "";
    const items=(this.config.waste_items||[]).map(item=>({name:item.name,days:Number(this.hass!.states[item.entity]?.attributes.daysTo)})).filter(item=>Number.isFinite(item.days)).sort((a,b)=>a.days-b.days);
    if(!items.length)return "";
    const days=items[0].days,names=items.filter(item=>item.days===days).map(item=>item.name).join(" + "),when=days===0?"Ma":days===1?"Holnap":`${days} nap múlva`;
    return `${when} · ${names}`;
  }

  private activeCount(): number {
    return this.hass ? activeEntities(this.hass,this.config?.active,this.config?.active_exclude).length : 0;
  }

  private irrigationSummary(): string {
    if(!this.hass||!this.config)return "";
    const program=this.config.irrigation_entity?this.hass.states[this.config.irrigation_entity]?.state||"":"";
    if(program&&!listed(["Nincs","none","unknown","unavailable",""],program))return program;
    const active=(this.config.irrigation_zone_entities||[]).filter(item=>this.hass!.states[typeof item==="string"?item:item.entity]?.state==="on");
    return active.map(item=>typeof item==="string"?String(this.hass!.states[item]?.attributes.friendly_name||item):item.name||String(this.hass!.states[item.entity]?.attributes.friendly_name||item.entity)).join(" + ");
  }

  private accent(state:string,temperature:number,issues:Incident[]):string {
    if(issues.some(issue=>issue.tone==="error"))return "var(--error-color)";
    if(issues.length)return "var(--warning-color)";
    if(["lightning","lightning-rainy","pouring"].includes(state))return "var(--error-color)";
    if(["rainy","snowy","snowy-rainy","fog"].includes(state))return "var(--info-color, var(--primary-color))";
    if(Number.isFinite(temperature)&&temperature>=35)return "#e27d35";
    if(state==="sunny")return "#e6a126";
    if(state==="clear-night"||new Date().getHours()<6||new Date().getHours()>=20)return "#6d78c5";
    return "var(--primary-color)";
  }

  private ackMap(): Record<string,number> {
    const raw=this.config?.acknowledgements_entity ? this.hass?.states[this.config.acknowledgements_entity]?.state || "" : "";
    const result:Record<string,number>={};
    for(const item of raw.split(",")){const p=item.lastIndexOf(":");if(p>0)result[item.slice(0,p)]=Number(item.slice(p+1))||0;}
    return result;
  }

  private incidentKey(message:string,path=""):string {
    return `${path}|${message}`.toLowerCase().replace(/\d+/g,"#").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9|#]/g,"").slice(0,64);
  }

  private incidents(): Incident[] {
    if(!this.hass||!this.config)return [];
    const found:Incident[]=[];
    for(const rule of this.config.incidents||[]){
      let ids:string[]=[];
      if(rule.entity)ids=[rule.entity];
      else if(rule.entity_pattern)ids=Object.keys(this.hass.states).filter(id=>glob(rule.entity_pattern!,id));
      else if(rule.device_classes)ids=Object.keys(this.hass.states).filter(id=>rule.device_classes!.includes(String(this.hass!.states[id].attributes.device_class||"")));
      const matches=ids.filter(source=>{const evaluated=rule.related_suffix?source.replace(rule.related_suffix.from,rule.related_suffix.to):source;return matchesRule(this.hass!.states[evaluated],rule);});
      if(!matches.length)continue;
      if(rule.aggregate){const message=rule.message.replace("{count}",String(matches.length));found.push({key:this.incidentKey(message,rule.navigation_path),message,tone:rule.tone||"warning",path:rule.navigation_path,dismissible:rule.dismissible!==false});}
      else for(const id of matches){const entity=this.hass.states[id];const message=rule.message.replace("{name}",String(entity?.attributes.friendly_name||id)).replace("{count}","1");found.push({key:this.incidentKey(message,rule.navigation_path),message,tone:rule.tone||"warning",path:rule.navigation_path,dismissible:rule.dismissible!==false});}
    }
    const ack=this.ackMap(),now=Date.now()/1000;
    return found.filter(x=>x.tone==="error"||!(ack[x.key]>now)).sort((a,b)=>(b.tone==="error"?1:0)-(a.tone==="error"?1:0));
  }

  private async dismiss(issue:Incident,days:number,event:Event):Promise<void>{
    event.stopPropagation(); if(!this.hass||!this.config?.acknowledgements_entity)return;
    const ack=this.ackMap();ack[issue.key]=Math.floor(Date.now()/1000+days*86400);
    const value=Object.entries(ack).filter(([,expiry])=>expiry>Date.now()/1000).map(([key,expiry])=>`${key}:${expiry}`).join(",");
    await this.hass.callService("input_text","set_value",{value},{entity_id:this.config.acknowledgements_entity});
  }

  private renderWeatherFx(state:string,wind:number){
    const h=new Date().getHours();
    const sky=["cloudy","partlycloudy","fog","rainy","pouring","lightning-rainy"].includes(state)?html`<div class="cloud"></div>`:(state==="clear-night"||h<6||h>=20)?html`<div class="moon"></div>`:html`<div class="sun"></div>`;
    const turbine=wind>=(this.config?.wind_threshold||8)?html`<div class="wind" style=${`--wind-duration:${Math.max(2.8,14-wind*.45)}s`}><div class="mast"></div><div class="rotor"><i class="blade"></i><i class="blade"></i><i class="blade"></i><i class="hub"></i></div></div>`:nothing;
    return html`<div class="sky">${sky}${turbine}</div>`;
  }

  private renderBanner(item:LumaBannerConfig){
    if(!this.hass||!itemIsVisible(this.hass,item))return nothing;const entity=this.hass.states[item.entity],color=item.color||"var(--luma-accent)";
    return html`<div class="banner interactive" role="button" tabindex="0" style=${`--item-color:${color}`} @click=${(e:Event)=>{e.stopPropagation();void runAction(this,this.hass!,item.tap_action,item.entity)}}><ha-icon icon=${item.icon||"mdi:information-outline"}></ha-icon><span class="banner-label">${item.label||item.name}</span><span class="banner-state">${item.state_label||entityState(this.hass,entity,item.state_map)}</span><button class="banner-action" @click=${(e:Event)=>{e.stopPropagation();void runAction(this,this.hass!,item.secondary_action||item.tap_action,item.entity)}}>${item.secondary_label||item.name||"MEGNYITÁS"}</button></div>`;
  }

  render(){
    if(!this.hass||!this.config)return nothing;
    const weather=this.hass.states[this.config.weather_entity],state=weather?.state||"unknown",a=weather?.attributes||{},wind=Number(a.wind_speed)||0;
    const issues=this.incidents(),critical=issues.some(x=>x.tone==="error"),attentionColor=critical?"var(--error-color)":issues.length?"var(--warning-color)":"var(--success-color)",active=this.activeCount(),accent=this.accent(state,Number(a.temperature),issues);
    const subtitle=[weatherLabels[state]||state,a.temperature!=null?`${a.temperature} ${a.temperature_unit||"°C"}`:"",wind?`szél ${wind} ${a.wind_speed_unit||"km/h"}`:"",issues.length?`${issues.length} figyelmeztetés`:"minden rendszer rendben"].filter(Boolean).join(" • ");
    const alarm=this.config.alarm_entity?this.hass.states[this.config.alarm_entity]:undefined,armed=alarm&&!['disarmed','unknown','unavailable'].includes(alarm.state),alarmColor=armed?"var(--warning-color)":"var(--success-color)";
    const banners=[...(this.config.banners||[])];
    const irrigation=this.irrigationSummary();
    if(irrigation)banners.push({entity:this.config.irrigation_entity||String(typeof this.config.irrigation_zone_entities?.[0]==="string"?this.config.irrigation_zone_entities[0]:this.config.irrigation_zone_entities?.[0]?.entity||""),label:"Aktív öntözés",state_label:irrigation,name:"MEGNYITÁS",icon:"mdi:sprinkler-variant",color:"var(--info-color, var(--primary-color))",tap_action:{action:"navigate",navigation_path:this.config.irrigation_path||"/dashboard-irrigation/irrigation"}});
    if(this.config.waste_entity&&this.hass.states[this.config.waste_ack_entity||""]?.state!=="on")banners.push({entity:this.config.waste_entity,label:"Hulladék",state_label:this.wasteSummary()||undefined,name:"MEGNYITÁS",icon:"mdi:trash-can-outline",color:"var(--warning-color)",below:(this.config.waste_days||2)+.01,tap_action:{action:"navigate",navigation_path:this.config.waste_path||"/lovelace/waste"},secondary_label:"KÉSZ",secondary_action:this.config.waste_ack_entity?{action:"perform-action",perform_action:"input_boolean.turn_on",target:{entity_id:this.config.waste_ack_entity}}:undefined});
    const alarmModes=this.config.alarm_modes||[],alarmUnavailable=!alarm||["unknown","unavailable"].includes(alarm.state),alarmStateMap:Record<string,string>={away:"armed_away",night:"armed_night",home:"armed_home",disarm:"disarmed"},alarmModeIcons:Record<string,string>={away:"mdi:shield-lock",night:"mdi:shield-moon",home:"mdi:shield-home",disarm:"mdi:shield-off-outline"};
    return html`<ha-card class=${`hero ${this.config.tap_action?"interactive":""}`} style=${`--luma-accent:${accent}`} @click=${()=>runAction(this,this.hass!,this.config?.tap_action||{action:"navigate",navigation_path:"/lovelace/weather"},this.config?.weather_entity)}>${this.renderWeatherFx(state,wind)}<div class="content"><div class="top"><div class="weather-icon"><ha-icon icon=${weatherIcons[state]||"mdi:home-heart"}></ha-icon></div><h2>${this.greeting()}</h2><div class="subtitle">${subtitle}</div><div class="status"><button class="active interactive" style="--active-color:var(--primary-color)" @click=${(e:Event)=>{e.stopPropagation();void runAction(this,this.hass!,this.config?.active_action)}}><ha-icon icon="mdi:lightning-bolt-outline"></ha-icon><span>Aktív</span>${active>0?html`<span class="active-badge">${active}</span>`:nothing}</button>${alarm?html`<button class="alarm interactive" aria-haspopup=${this.config.alarm_popover?"dialog":"false"} aria-expanded=${this.alarmPopoverOpen} style=${`--alarm-color:${alarmColor}`} @click=${(e:Event)=>{e.stopPropagation();this.config?.alarm_popover?this.toggleAlarmPopover():void runAction(this,this.hass!,this.config?.alarm_action||{action:"more-info"},this.config?.alarm_entity)}}><ha-icon icon="mdi:shield-home-outline"></ha-icon><span>${entityState(this.hass,alarm)}</span></button>`:nothing}<button class="attention interactive" style=${`--attention-color:${attentionColor}`} @click=${(e:Event)=>{e.stopPropagation();this.detailsOpen=!this.detailsOpen}}><ha-icon icon=${critical?"mdi:alert-octagon":issues.length?"mdi:alert-circle-outline":"mdi:check-circle-outline"}></ha-icon><span>${issues.length?`${issues.length} jelzés`:"Rendben"}</span></button></div></div>${this.detailsOpen&&issues.length?html`<div class="panel">${issues.map(issue=>html`<div class="issue" style=${`--issue-color:${issue.tone==="error"?"var(--error-color)":"var(--warning-color)"}`}><ha-icon icon=${issue.tone==="error"?"mdi:alert-octagon-outline":"mdi:alert-outline"}></ha-icon><span class="issue-text" @click=${()=>issue.path&&runAction(this,this.hass!,{action:"navigate",navigation_path:issue.path})}>${issue.message}</span>${issue.dismissible&&issue.tone!=="error"?html`<span class="issue-actions"><button @click=${(e:Event)=>this.dismiss(issue,7,e)}>7 nap</button><button @click=${(e:Event)=>this.dismiss(issue,30,e)}>30 nap</button></span>`:nothing}</div>`)}</div>`:nothing}${banners.some(b=>itemIsVisible(this.hass!,b))?html`<div class="banners">${banners.map(b=>this.renderBanner(b))}</div>`:nothing}</div></ha-card>${this.alarmPopoverOpen&&alarm?html`<button class="alarm-scrim" aria-label="Bezárás" @click=${()=>this.toggleAlarmPopover()}></button><section class="alarm-popover" style=${`--alarm-tone:${alarmColor}`} role="dialog" aria-label="Riasztó vezérlés"><div class="alarm-popover-head"><span class="alarm-popover-icon"><ha-icon icon="mdi:shield-home-outline"></ha-icon></span><div><div class="alarm-popover-title">Riasztó</div><div class="alarm-popover-state">${entityState(this.hass,alarm)}</div></div><button class="alarm-close" aria-label="Bezárás" @click=${()=>this.toggleAlarmPopover()}><ha-icon icon="mdi:close"></ha-icon></button></div><div class="alarm-actions" style=${`--alarm-count:${alarmModes.length}`}>${alarmModes.map(mode=>{const active=alarm.state===alarmStateMap[mode.mode],transitioning=["arming","pending"].includes(alarm.state),disabled=active||alarmUnavailable||((alarm.state==="triggered"||transitioning)&&mode.mode!=="disarm"),confirming=this.alarmPending===mode.mode,tone=mode.mode==="disarm"?"var(--error-color)":mode.mode==="night"?"var(--info-color,var(--primary-color))":"var(--success-color)";return html`<button class=${`alarm-mode ${active?"active":""} ${confirming?"confirm":""}`} style=${`--mode-tone:${tone}`} ?disabled=${disabled} @click=${()=>this.activateAlarm(mode.mode,disabled)}><ha-icon icon=${confirming?"mdi:check":mode.icon||alarmModeIcons[mode.mode]}></ha-icon><span>${confirming?"Megerősítés":mode.name}</span></button>`})}</div><button class="alarm-details" @click=${()=>{this.toggleAlarmPopover();void runAction(this,this.hass!,this.config?.alarm_action||{action:"more-info"},this.config?.alarm_entity)}}>Részletes beállítások</button></section>`:nothing}`;
  }
}
