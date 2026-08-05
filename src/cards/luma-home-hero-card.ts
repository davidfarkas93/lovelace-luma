import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { entityState, itemIsVisible, runAction } from "../helpers";
import { lumaTokens } from "../styles";
import type {
  HassEntity,
  HomeAssistant,
  LumaAction,
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
  notifications_entity?: string;
  acknowledgements_entity?: string;
  irrigation_entity?: string;
  irrigation_path?: string;
  waste_entity?: string;
  waste_ack_entity?: string;
  waste_path?: string;
  waste_days?: number;
  wind_threshold?: number;
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

  static styles = [lumaTokens, css`
    .hero { position:relative; isolation:isolate; min-height:176px; padding:25px; overflow:hidden;
      border:1px solid color-mix(in srgb,var(--luma-accent) 20%,transparent); border-radius:var(--luma-radius-hero);
      background:linear-gradient(135deg,color-mix(in srgb,var(--luma-accent) 16%,var(--luma-surface)),color-mix(in srgb,var(--luma-accent) 3%,var(--luma-surface)) 68%);
      box-shadow:0 18px 50px rgba(0,0,0,.08); }
    .content { position:relative; z-index:2; }
    .top { display:grid; grid-template-columns:58px minmax(0,1fr) auto; grid-template-areas:"icon title badge" "icon subtitle badge"; align-items:center; gap:0 17px; }
    .weather-icon { grid-area:icon; display:grid; place-items:center; width:58px; height:58px; border-radius:19px; color:var(--luma-accent); background:color-mix(in srgb,var(--luma-accent) 15%,transparent); }
    .weather-icon ha-icon { --mdc-icon-size:31px; }
    h2 { grid-area:title; align-self:end; margin:0; font-size:clamp(20px,4vw,27px); line-height:1.12; font-weight:730; }
    .subtitle { grid-area:subtitle; align-self:start; margin-top:5px; color:var(--luma-muted); font-size:13px; line-height:1.35; }
    button { font:inherit; }
    .alarm,.attention { display:inline-flex; align-items:center; gap:6px; border:0; border-radius:999px; font-size:11px; font-weight:720; }
    .alarm { grid-area:badge; padding:7px 11px; color:var(--alarm-color); background:color-mix(in srgb,var(--alarm-color) 13%,transparent); }
    .alarm ha-icon,.attention ha-icon { --mdc-icon-size:16px; }
    .chips { display:flex; justify-content:flex-end; flex-wrap:wrap; gap:7px; margin-top:16px; }
    .attention { min-height:34px; padding:7px 11px; color:var(--attention-color); background:color-mix(in srgb,var(--attention-color) 11%,transparent); }
    .panel { display:grid; gap:7px; margin-top:12px; padding:10px; border-radius:16px; background:color-mix(in srgb,var(--primary-text-color) 3%,transparent); }
    .issue { display:grid; grid-template-columns:18px minmax(0,1fr) auto; align-items:center; gap:8px; min-height:38px; padding:6px 8px; border-radius:12px; color:var(--issue-color); background:color-mix(in srgb,var(--issue-color) 8%,transparent); }
    .issue ha-icon { --mdc-icon-size:17px; }
    .issue-text { min-width:0; color:var(--primary-text-color); font-size:12px; font-weight:620; }
    .issue-actions { display:flex; gap:5px; }
    .issue-actions button { min-height:27px; padding:4px 8px; border:0; border-radius:999px; color:var(--issue-color); background:color-mix(in srgb,var(--issue-color) 12%,transparent); font-size:9px; font-weight:780; }
    .banners { display:grid; gap:8px; margin-top:13px; }
    .banner { display:grid; grid-template-columns:22px auto minmax(0,1fr) auto; align-items:center; gap:8px; width:100%; min-height:42px; padding:8px 11px; border:1px solid color-mix(in srgb,var(--item-color) 17%,transparent); border-radius:14px; color:var(--item-color); background:color-mix(in srgb,var(--item-color) 10%,transparent); text-align:left; }
    .banner ha-icon { --mdc-icon-size:18px; } .banner-label { font-size:11px; font-weight:720; } .banner-state { overflow:hidden; color:var(--primary-text-color); font-size:11px; font-weight:620; text-overflow:ellipsis; white-space:nowrap; }
    .banner-action { padding:5px 8px; border:0; border-radius:999px; color:var(--item-color); background:color-mix(in srgb,var(--item-color) 14%,transparent); font-size:9px; font-weight:800; letter-spacing:.05em; }
    .sky { position:absolute; inset:0; z-index:0; pointer-events:none; opacity:.34; }
    .sun,.moon { position:absolute; right:8%; top:-22px; width:104px; height:104px; border-radius:50%; }
    .sun { background:radial-gradient(circle,#ffd86b 0 32%,rgba(255,216,107,.28) 34% 51%,transparent 53%); animation:breathe 8s ease-in-out infinite; }
    .moon { background:radial-gradient(circle at 38% 38%,#eef2ff 0 38%,rgba(180,193,244,.22) 40% 58%,transparent 60%); }
    .cloud { position:absolute; right:6%; top:22px; width:125px; height:34px; border-radius:99px; background:color-mix(in srgb,var(--primary-text-color) 12%,transparent); }
    .cloud::before,.cloud::after { content:""; position:absolute; bottom:0; border-radius:50%; background:inherit; } .cloud::before{left:18px;width:54px;height:54px}.cloud::after{right:18px;width:42px;height:42px}
    .wind { position:absolute; right:8%; bottom:-15px; width:105px; height:145px; transform:translateZ(0); opacity:.32; }
    .mast { position:absolute; left:51px; top:53px; width:3px; height:94px; border-radius:3px; background:currentColor; transform:translateZ(0); }
    .rotor { position:absolute; left:13px; top:8px; width:80px; height:80px; transform-origin:50% 50%; animation:spin var(--wind-duration,8s) linear infinite; will-change:transform; }
    .blade { position:absolute; left:37px; top:0; width:7px; height:38px; border-radius:99px 99px 8px 8px; background:currentColor; transform-origin:50% 40px; } .blade:nth-child(2){transform:rotate(120deg)} .blade:nth-child(3){transform:rotate(240deg)}
    .hub { position:absolute; left:34px; top:34px; width:13px; height:13px; border-radius:50%; background:currentColor; }
    @keyframes spin { to { transform:rotate(360deg) translateZ(0); } } @keyframes breathe { 50% { transform:scale(1.05); opacity:.82; } }
    @media(max-width:599px){ .hero{min-height:164px;padding:18px}.top{grid-template-columns:46px minmax(0,1fr) auto;gap:0 12px}.weather-icon{width:46px;height:46px;border-radius:15px}.weather-icon ha-icon{--mdc-icon-size:25px}.subtitle{font-size:12px}.chips{justify-content:flex-start;margin-top:12px}.wind{right:2%;bottom:auto;top:-12px;opacity:.2}.banner{grid-template-columns:20px minmax(0,1fr) auto}.banner-label{display:none}.issue{grid-template-columns:18px minmax(0,1fr)}.issue-actions{grid-column:2;justify-content:flex-start} }
  `];

  setConfig(config: LumaHomeHeroConfig): void {
    if (!config?.weather_entity) throw new Error("Luma home hero requires weather_entity.");
    this.config = { incidents: [], banners: [], waste_days: 2, wind_threshold: 8, ...config };
  }
  getCardSize(): number { return 4; }

  protected shouldUpdate(changed: PropertyValues<this>): boolean {
    if (!changed.has("hass")) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this.hass) return true;
    return this.watchedIds.some(id => old.states[id] !== this.hass!.states[id]);
  }

  private get watchedIds(): string[] {
    if (!this.hass || !this.config) return [];
    const fixed = [this.config.weather_entity,this.config.alarm_entity,this.config.notifications_entity,this.config.acknowledgements_entity,this.config.irrigation_entity,this.config.waste_entity,this.config.waste_ack_entity];
    const patterns = (this.config.incidents || []).filter(r=>r.entity_pattern);
    const dynamic = Object.keys(this.hass.states).filter(id=>patterns.some(r=>glob(r.entity_pattern!,id)));
    const related = dynamic.map(id=>{const r=patterns.find(x=>glob(x.entity_pattern!,id));return r?.related_suffix?id.replace(r.related_suffix.from,r.related_suffix.to):id;});
    return [...new Set([...fixed.filter(Boolean) as string[],...dynamic,...related,...(this.config.banners||[]).map(b=>b.entity)])];
  }

  private greeting(): string {
    const h=new Date().getHours(), name=this.config?.name ? `, ${this.config.name}` : "";
    return `${h>=18?"Jó estét":h>=12?"Szép délutánt":h>=5?"Jó reggelt":"Szia"}${name}!`;
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
    const issues=this.incidents(),critical=issues.some(x=>x.tone==="error"),attentionColor=critical?"var(--error-color)":issues.length?"var(--warning-color)":"var(--success-color)";
    const subtitle=[weatherLabels[state]||state,a.temperature!=null?`${a.temperature} ${a.temperature_unit||"°C"}`:"",wind?`szél ${wind} ${a.wind_speed_unit||"km/h"}`:"",issues.length?`${issues.length} figyelmeztetés`:"minden rendszer rendben"].filter(Boolean).join(" • ");
    const alarm=this.config.alarm_entity?this.hass.states[this.config.alarm_entity]:undefined,armed=alarm&&!['disarmed','unknown','unavailable'].includes(alarm.state),alarmColor=armed?"var(--warning-color)":"var(--success-color)";
    const banners=[...(this.config.banners||[])];
    if(this.config.irrigation_entity)banners.push({entity:this.config.irrigation_entity,label:"Aktív öntözés",name:"MEGNYITÁS",icon:"mdi:sprinkler-variant",color:"var(--info-color, var(--primary-color))",state_not:["Nincs","none","unknown","unavailable",""],tap_action:{action:"navigate",navigation_path:this.config.irrigation_path||"/dashboard-irrigation/irrigation"}});
    if(this.config.waste_entity&&this.hass.states[this.config.waste_ack_entity||""]?.state!=="on")banners.push({entity:this.config.waste_entity,label:"Hulladék",name:"MEGNYITÁS",icon:"mdi:trash-can-outline",color:"var(--warning-color)",below:(this.config.waste_days||2)+.01,tap_action:{action:"navigate",navigation_path:this.config.waste_path||"/lovelace/waste"},secondary_label:"KÉSZ",secondary_action:this.config.waste_ack_entity?{action:"perform-action",perform_action:"input_boolean.turn_on",target:{entity_id:this.config.waste_ack_entity}}:undefined});
    return html`<ha-card class=${`hero ${this.config.tap_action?"interactive":""}`} style="--luma-accent:var(--primary-color)" @click=${()=>runAction(this,this.hass!,this.config?.tap_action||{action:"navigate",navigation_path:"/lovelace/weather"},this.config?.weather_entity)}>${this.renderWeatherFx(state,wind)}<div class="content"><div class="top"><div class="weather-icon"><ha-icon icon=${weatherIcons[state]||"mdi:home-heart"}></ha-icon></div><h2>${this.greeting()}</h2><div class="subtitle">${subtitle}</div>${alarm?html`<button class="alarm interactive" style=${`--alarm-color:${alarmColor}`} @click=${(e:Event)=>{e.stopPropagation();void runAction(this,this.hass!,{action:"more-info"},this.config?.alarm_entity)}}><ha-icon icon="mdi:shield-home-outline"></ha-icon><span>${entityState(this.hass,alarm)}</span></button>`:nothing}</div><div class="chips"><button class="attention interactive" style=${`--attention-color:${attentionColor}`} @click=${(e:Event)=>{e.stopPropagation();this.detailsOpen=!this.detailsOpen}}><ha-icon icon=${critical?"mdi:alert-octagon":issues.length?"mdi:alert-circle-outline":"mdi:check-circle-outline"}></ha-icon><span>${issues.length?`${issues.length} jelzés`:"Rendben"}</span></button></div>${this.detailsOpen&&issues.length?html`<div class="panel">${issues.map(issue=>html`<div class="issue" style=${`--issue-color:${issue.tone==="error"?"var(--error-color)":"var(--warning-color)"}`}><ha-icon icon=${issue.tone==="error"?"mdi:alert-octagon-outline":"mdi:alert-outline"}></ha-icon><span class="issue-text" @click=${()=>issue.path&&runAction(this,this.hass!,{action:"navigate",navigation_path:issue.path})}>${issue.message}</span>${issue.dismissible&&issue.tone!=="error"?html`<span class="issue-actions"><button @click=${(e:Event)=>this.dismiss(issue,7,e)}>7 nap</button><button @click=${(e:Event)=>this.dismiss(issue,30,e)}>30 nap</button></span>`:nothing}</div>`)}</div>`:nothing}${banners.some(b=>itemIsVisible(this.hass!,b))?html`<div class="banners">${banners.map(b=>this.renderBanner(b))}</div>`:nothing}</div></ha-card>`;
  }
}
