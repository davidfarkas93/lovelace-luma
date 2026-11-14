import {LitElement,css,html,nothing,type PropertyValues} from 'lit';
import {customElement,property,state} from 'lit/decorators.js';
import {runAction} from '../helpers';
import {comfortActivity,comfortAssessment,type ComfortThresholds,type ComfortMetricStatus} from '../comfort';
import {localized} from '../localize';
import {lumaTokens,lumaSurfaceStyles,lumaInteractionStyles,lumaStatusStyles} from '../styles';
import {entityAvailable,entityMeasurement,finiteMeasurement,formatNumber,missingLabel} from '../presentation';
import type {HomeAssistant,LumaAction,LovelaceCard} from '../types';

interface ClimateMode {mode:string;name?:string;icon?:string}
interface Config extends ComfortThresholds {
  type:string;name?:string;icon?:string;temperature_entity:string;humidity_entity:string;
  temperature_label?:string;humidity_label?:string;pm25_label?:string;
  pm25_entity?:string;outdoor_temperature_entity?:string;heating_entity?:string;air_conditioner_entity?:string;
  climate?:{entity:string;name?:string;modes?:ClimateMode[]};tap_action?:LumaAction;
}
const modeLabels:Record<string,[string,string]>={off:['Off','Ki'],cool:['Cooling','Hűtés'],heat:['Heating','Fűtés'],auto:['Auto','Automata'],heat_cool:['Heat/cool','Fűtés/hűtés'],dry:['Dry','Párátlanítás'],fan_only:['Fan','Ventilátor']};
const modeIcons:Record<string,string>={off:'mdi:power',cool:'mdi:snowflake',heat:'mdi:fire',auto:'mdi:autorenew',heat_cool:'mdi:autorenew',dry:'mdi:water-percent',fan_only:'mdi:fan'};
const reasonLabels={cold:['Cool indoors','Hűvös van bent'],hot:['Warm indoors','Meleg van bent'],dry:['Low humidity','Alacsony páratartalom'],humid:['High humidity','Magas páratartalom'],particles:['Elevated PM2.5','Emelkedett PM2.5']} as const;
@customElement('luma-comfort-card')
export class LumaComfortCard extends LitElement implements LovelaceCard {
  @property({attribute:false}) hass?:HomeAssistant;
  @state() private config?:Config;
  @state() private busy=false;
  @state() private error=false;
  static styles=[lumaTokens,lumaInteractionStyles,lumaSurfaceStyles,lumaStatusStyles,css`
    :host{container-type:inline-size;min-width:0}
    .card{padding:14px;display:grid;gap:8px}
    .header{width:100%;padding:0;border:0;background:transparent;text-align:left;color:inherit;border-radius:14px;display:flex;align-items:center;gap:10px;min-width:0}
    .icon{display:grid;place-items:center;width:44px;height:44px;flex-shrink:0;border-radius:14px;color:var(--tone);background:color-mix(in srgb,var(--tone) 14%,transparent)}
    .icon ha-icon{--mdc-icon-size:23px}.name{font-size:14px;flex:1;min-width:0;overflow-wrap:anywhere}
    .details-cue{--mdc-icon-size:17px;flex-shrink:0;color:var(--luma-muted);opacity:.65}button.header:hover .details-cue{opacity:1}button.header{min-height:44px}
    .metrics{display:grid;grid-template-columns:repeat(var(--metrics-count),minmax(0,1fr));gap:8px;margin:0;color:var(--primary-text-color)}
    .metric{min-width:0;text-align:left;background:transparent;border:0;border-radius:10px;padding:2px 4px;min-height:44px;color:inherit;display:flex;flex-direction:column;gap:2px;justify-content:flex-start}
    .metric:hover{background:var(--luma-hover-surface)}.metric-label{font-size:10px;color:var(--luma-muted);line-height:1.35;overflow-wrap:anywhere}
    .metric-value{display:inline-flex;align-items:baseline;flex-wrap:nowrap;gap:4px;align-self:flex-start;max-width:100%;border-radius:7px;padding:2px 4px;margin-top:auto;font-size:16px;font-weight:560;line-height:1.2;letter-spacing:0;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
    .unit{font-size:11px;font-weight:500;letter-spacing:0;color:var(--luma-muted)}.missing{font-size:12px;font-weight:500;letter-spacing:0;color:var(--luma-muted)}
    .metric-value.flagged{background:color-mix(in srgb,var(--metric-tone) 9%,transparent)}
    .metric-value.flagged .unit{color:inherit}
    .reading{min-width:0;overflow-wrap:anywhere}.unit{white-space:nowrap;flex-shrink:0}
    .metric[data-severity="warning"]{--metric-tone:var(--luma-state-warning)}
    .metric[data-severity="error"]{--metric-tone:var(--luma-state-error)}
    .trend{align-self:center;flex-shrink:0;font-size:12px;font-weight:600;line-height:1;margin-left:1px}
    .context{display:flex;gap:6px 12px;align-items:center;flex-wrap:wrap;font-size:11px;color:var(--luma-muted);margin-top:0}
    .outside{display:inline-flex;gap:5px;align-items:center}.outside ha-icon{--mdc-icon-size:16px}
    .operation{display:inline-flex;gap:5px;align-items:center;padding:2px 6px;border-radius:8px;font-size:11px}.operation ha-icon{--mdc-icon-size:15px}
    .climate{border-top:1px solid var(--luma-border);padding-top:8px;display:grid;gap:6px;min-width:0}
    .climate-header{display:flex;gap:8px;align-items:center;min-width:0}.climate-header>ha-icon{--mdc-icon-size:19px;color:var(--luma-muted)}
    .climate-name{font-size:12px;font-weight:600}.climate-state{font-size:11px;color:var(--luma-muted);margin-left:auto;text-align:right;overflow-wrap:anywhere}
    .actions{display:flex;gap:6px;flex-wrap:wrap}.action{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;min-width:44px;padding:8px 12px;font-size:11px;line-height:1.3}
    .action ha-icon{--mdc-icon-size:16px}.action[aria-pressed=true]{background:color-mix(in srgb,var(--mode-tone) 16%,transparent)}
    .action[aria-pressed=true] ha-icon{color:var(--mode-tone)}.settings{margin-left:auto}.error{font-size:12px;line-height:1.4}
    @container(max-width:360px){.card{padding:12px;gap:8px}.header{gap:8px}.icon{width:44px;height:44px}.name{font-size:14px}.status{font-size:11px}.metric-value{font-size:16px;gap:3px;padding:2px 3px}.metrics{gap:6px}.metric{padding:0 2px}.unit{font-size:10px}.trend{font-size:11px;margin-left:0}}
    @container(max-width:270px){.header{flex-wrap:wrap}.status{order:3}.metrics{grid-template-columns:1fr}.metric{min-height:44px}.climate-header{flex-wrap:wrap}.climate-state{margin-left:0}.settings{margin-left:0}}
  `];
  setConfig(c:Config){
    if(!c?.temperature_entity||!c?.humidity_entity)throw Error('Luma comfort requires temperature and humidity entities.');
    if(c.climate&&!c.climate.entity?.startsWith('climate.'))throw Error('Luma comfort climate.entity must be a climate entity.');
    this.config=c;this.error=false;
  }
  getCardSize(){return this.config?.climate?3:2}
  protected shouldUpdate(changed:PropertyValues<this>){
    if([...changed.keys()].some(k=>k!=='hass'))return true;
    const old=changed.get('hass') as HomeAssistant|undefined;
    return !old||old.locale!==this.hass?.locale||old.config!==this.hass?.config||this.ids.some(id=>old.states[id]!==this.hass?.states[id]);
  }
  private get ids(){const c=this.config;return c?[c.temperature_entity,c.humidity_entity,c.pm25_entity,c.outdoor_temperature_entity,c.heating_entity,c.air_conditioner_entity,c.climate?.entity].filter(Boolean)as string[]:[]}
  private value(id?:string){return entityMeasurement(id?this.hass?.states[id]:undefined)}
  private info(entity:string){runAction(this,this.hass!,{action:'more-info'},entity)}
  private modes(){
    const c=this.config?.climate,e=c?this.hass?.states[c.entity]:undefined;
    const supported=Array.isArray(e?.attributes.hvac_modes)?e.attributes.hvac_modes as string[]:[];
    return (c?.modes||[{mode:'off'},{mode:'cool'}]).filter(m=>supported.includes(m.mode));
  }
  private async changeMode(mode:string){
    const c=this.config?.climate;
    if(!c||!this.hass||this.busy||!entityAvailable(this.hass.states[c.entity])||!this.modes().some(m=>m.mode===mode))return;
    this.busy=true;this.error=false;
    try{await this.hass.callService('climate','set_hvac_mode',{hvac_mode:mode},{entity_id:c.entity});}
    catch{this.error=true;}finally{this.busy=false;}
  }
  private metric(id:string,label:string,decimals:number,fallbackUnit:string,status:ComfortMetricStatus){
    const value=this.value(id),e=this.hass!.states[id],unit=e?.attributes.unit_of_measurement||fallbackUnit;
    const reason=status.reason?localized(this.hass,reasonLabels[status.reason][0],reasonLabels[status.reason][1]):'';
    const flag=status.severity==='warning'||status.severity==='error';
    return html`<button class="metric" data-severity=${status.severity} title=${reason} @click=${()=>this.info(id)} aria-label=${`${label}: ${value===null?missingLabel(this.hass,e):`${formatNumber(this.hass,value,decimals)} ${unit}`}${reason?` · ${reason}`:''}`}><span class="metric-label">${label}</span><span class=${`metric-value ${value===null?'missing':''} ${flag?'flagged':''}`}>${value===null?localized(this.hass,'No data','Nincs adat'):html`<span class="reading">${formatNumber(this.hass,value,decimals)}</span><span class="unit">${unit}</span>${flag?html`<span class="trend" aria-hidden="true">${status.direction==='low'?'↓':'↑'}</span>`:nothing}`}</span></button>`;
  }
  private renderClimate(){
    const c=this.config!.climate;if(!c)return nothing;
    const e=this.hass!.states[c.entity],available=entityAvailable(e),mode=e?.state||'unavailable',target=available&&mode!=='off'?finiteMeasurement(e.attributes.temperature):null;
    if(available&&mode==='off')return nothing;
    const unit=String(e?.attributes.temperature_unit||this.hass!.config?.unit_system?.temperature||'°C');
    const actionLabels:Record<string,[string,string]>={cooling:['Cooling now','Épp hűt'],heating:['Heating now','Épp fűt'],drying:['Drying now','Épp párátlanít'],idle:['Idle','Készenlét'],fan:['Fan running','Ventilátor működik'],defrosting:['Defrosting','Leolvasztás']};
    const action=String(e?.attributes.hvac_action||''),pair=modeLabels[mode];
    const status=!available?missingLabel(this.hass,e):mode==='off'?localized(this.hass,'Off','Kikapcsolva'):actionLabels[action]?localized(this.hass,...actionLabels[action]):pair?`${localized(this.hass,...pair)} ${localized(this.hass,'mode','mód')}`:mode;
    return html`<section class="climate" aria-label=${c.name||localized(this.hass,'Air conditioning','Klíma')} aria-busy=${this.busy}>
      <div class="climate-header"><ha-icon icon="mdi:air-conditioner"></ha-icon><span class="climate-name">${c.name||localized(this.hass,'Air conditioning','Klíma')}</span><span class="climate-state" role="status">${this.busy?localized(this.hass,'Sending…','Küldés…'):status}${target===null?nothing:html` · ${localized(this.hass,'target','cél')} ${formatNumber(this.hass,target)} ${unit}`}</span></div>
      <div class="actions">${(available?this.modes():[]).map(m=>html`<button class="action" aria-pressed=${available&&mode===m.mode} ?disabled=${!available||this.busy} style=${`--mode-tone:${m.mode==='off'?'var(--secondary-text-color)':m.mode==='heat'?'var(--warning-color)':'var(--info-color, var(--primary-color))'}`} @click=${()=>this.changeMode(m.mode)}><ha-icon icon=${m.icon||modeIcons[m.mode]||'mdi:thermostat'}></ha-icon><span>${m.name||(modeLabels[m.mode]?localized(this.hass,...modeLabels[m.mode]):m.mode)}</span></button>`)}
      <button class="action settings" @click=${()=>this.info(c.entity)}><ha-icon icon="mdi:tune-variant"></ha-icon>${localized(this.hass,'Settings','Beállítások')}</button></div>
      ${this.error?html`<div class="error" role="alert">${localized(this.hass,'Command failed. Try again.','A parancs sikertelen. Próbáld újra.')}</div>`:nothing}
    </section>`;
  }
  render(){
    if(!this.hass||!this.config)return nothing;
    const c=this.config,t=this.value(c.temperature_entity),h=this.value(c.humidity_entity),pm=this.value(c.pm25_entity),out=this.value(c.outdoor_temperature_entity);
    const result=comfortAssessment({temperature:t,humidity:h,pm25:pm,pm25Configured:!!c.pm25_entity},c);
    const tone=result.status==='comfortable'?'var(--luma-state-success)':result.status==='error'?'var(--luma-state-error)':result.status==='warning'?'var(--luma-state-warning)':'var(--luma-state-neutral)';
    const label=result.status==='comfortable'?localized(this.hass,'Comfortable','Kellemes'):result.status==='error'?localized(this.hass,'Needs attention','Figyelmet kér'):result.status==='warning'?localized(this.hass,'Uncomfortable','Nem komfortos'):localized(this.hass,'Incomplete data','Hiányos adatok');
    const activity=comfortActivity(this.hass,{...c,air_conditioner_entity:c.climate?undefined:c.air_conditioner_entity});
    const navigable=c.tap_action&&c.tap_action.action!=='none';
    const header=html`<span class="icon"><ha-icon icon=${c.icon||'mdi:home-thermometer-outline'}></ha-icon></span><span class="name">${c.name||localized(this.hass,'Comfort','Komfort')}</span><span class="status"><span class="dot" aria-hidden="true"></span>${label}</span>${navigable?html`<ha-icon class="details-cue" icon="mdi:chevron-right"></ha-icon>`:nothing}`;
    return html`<ha-card class="card" style=${`--tone:${tone}`}>
      ${navigable?html`<button class="header" aria-label=${`${c.name||localized(this.hass,'Comfort','Komfort')} · ${label} · ${localized(this.hass,'Details and controls','Részletek és vezérlés')}`} @click=${()=>runAction(this,this.hass!,c.tap_action)}>${header}</button>`:html`<div class="header">${header}</div>`}
      <div class="metrics" style=${`--metrics-count:${c.pm25_entity?3:2}`}>
        ${this.metric(c.temperature_entity,c.temperature_label||localized(this.hass,'Indoor','Bent'),1,'°C',result.metrics.temperature)}
        ${this.metric(c.humidity_entity,c.humidity_label||localized(this.hass,'Humidity','Páratartalom'),0,'%',result.metrics.humidity)}
        ${c.pm25_entity?this.metric(c.pm25_entity,c.pm25_label||'PM2.5',0,'µg/m³',result.metrics.pm25):nothing}
      </div>
      ${c.outdoor_temperature_entity||activity.length?html`<div class="context">${c.outdoor_temperature_entity?html`<span class="outside"><ha-icon icon="mdi:thermometer"></ha-icon>${localized(this.hass,'Outside','Kint')}: ${out===null?localized(this.hass,'No data','Nincs adat'):`${formatNumber(this.hass,out,1)} ${this.hass.states[c.outdoor_temperature_entity]?.attributes.unit_of_measurement||'°C'}`}</span>`:nothing}${activity.map(a=>html`<span class="operation" style=${`--activity-color:${a.color}`}><ha-icon icon=${a.icon}></ha-icon>${localized(this.hass,a.en,a.hu)}</span>`)}</div>`:nothing}
      ${this.renderClimate()}
    </ha-card>`;
  }
}
