import {LitElement,css,html,nothing,type PropertyValues} from 'lit';
import {customElement,property,state} from 'lit/decorators.js';
import '../components/luma-climate-control';
import {runAction} from '../helpers';
import {comfortActivity,comfortAssessment,comfortDefaults,type ComfortThresholds,type ComfortMetricStatus} from '../comfort';
import {thermostatSummary} from '../climate';
import {localized} from '../localize';
import {lumaTokens,lumaSurfaceStyles,lumaInteractionStyles,lumaStatusStyles} from '../styles';
import {entityAvailable,entityMeasurement,formatNumber,missingLabel} from '../presentation';
import type {HomeAssistant,LumaAction,LovelaceCard} from '../types';

interface ClimateMode {mode:string;name?:string;icon?:string}
interface ComfortRoom {name:string;icon?:string;temperature_entity:string;humidity_entity?:string;climate_entity?:string}
interface Config extends ComfortThresholds {
  display?:'summary'|'details';rooms?:ComfortRoom[];context_entities?:{entity:string;name:string;icon?:string;decimals?:number}[];details_action?:LumaAction;
  type:string;name?:string;icon?:string;temperature_entity:string;humidity_entity:string;
  temperature_label?:string;humidity_label?:string;pm25_label?:string;
  pm25_entity?:string;outdoor_temperature_entity?:string;heating_entity?:string;air_conditioner_entity?:string;
  climate?:{entity:string;name?:string;modes?:ClimateMode[]};tap_action?:LumaAction;
}
const reasonLabels={cold:['Cool indoors','Hűvös van bent'],hot:['Warm indoors','Meleg van bent'],dry:['Low humidity','Alacsony páratartalom'],humid:['High humidity','Magas páratartalom'],particles:['Elevated PM2.5','Emelkedett PM2.5']} as const;
@customElement('luma-comfort-card')
export class LumaComfortCard extends LitElement implements LovelaceCard {
  @property({attribute:false}) hass?:HomeAssistant;
  @state() private config?:Config;
  static styles=[lumaTokens,lumaInteractionStyles,lumaSurfaceStyles,lumaStatusStyles,css`
    :host{container-type:inline-size;min-width:0}
    .card{padding:14px;display:grid;gap:8px}
    .header{width:100%;padding:0;border:0;background:transparent;text-align:left;color:inherit;border-radius:14px;display:flex;align-items:center;gap:10px;min-width:0}
    .icon{display:grid;place-items:center;width:44px;height:44px;flex-shrink:0;border-radius:14px;color:var(--tone);background:color-mix(in srgb,var(--tone) 14%,transparent)}
    .icon ha-icon{--mdc-icon-size:23px}.name{font-size:14px;flex:1;min-width:0;overflow-wrap:anywhere}
    .details-cue{--mdc-icon-size:17px;flex-shrink:0;color:var(--luma-muted);opacity:.65}button.header:hover .details-cue{opacity:1}button.header{min-height:44px}
    .metrics{display:grid;grid-template-columns:var(--metric-columns);gap:8px;margin:0;color:var(--primary-text-color)}
    .metric{min-width:0;text-align:left;background:transparent;border:0;border-radius:10px;padding:8px;min-height:44px;color:inherit;display:flex;flex-direction:column;gap:2px;justify-content:flex-start}
    .metric:hover{background:var(--luma-hover-surface)}.metric-label{font-size:10px;color:var(--luma-muted);line-height:1.35;overflow-wrap:anywhere}
    .metric-value{display:inline-flex;align-items:baseline;flex-wrap:nowrap;gap:4px;align-self:flex-start;max-width:100%;border-radius:7px;padding:4px 6px;margin-top:auto;font-size:16px;font-weight:560;line-height:1.2;letter-spacing:0;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
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
    .detail-climate{border-top:1px solid var(--luma-border);padding-top:12px;min-width:0}
    .detail{display:grid;gap:16px;color:var(--primary-text-color);font-size:12px}
    .section{display:grid;gap:6px;min-width:0}.section-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 8px;min-height:28px}
    h3{font-size:13px;font-weight:650;margin:0}.explanation{font-size:11px;line-height:1.5;color:var(--luma-muted);margin:0;padding:0 8px}
    .assessment{gap:4px;padding-bottom:12px;border-bottom:1px solid var(--luma-border)}
    .assessment .metrics{margin-top:0}.assessment .metric-label{font-size:11px}.assessment .metric{gap:4px}.assessment .section-heading{min-height:22px}.assessment h3{font-size:11px;font-weight:500;color:var(--luma-muted)}.assessment .status{font-size:11px;font-weight:600}.assessment .metric-value{font-size:15px}.assessment .metric-note{padding:0 6px}.metric-note{font-size:10px;line-height:1.4;color:var(--luma-muted)}
    .room-row,.context-row,.detail-link{display:flex;gap:10px;align-items:center;min-width:0;width:100%;min-height:52px;padding:8px;border:0;border-radius:12px;background:transparent;color:inherit;text-align:left}
    .room-row:hover,.context-row:hover,.detail-link:hover{background:var(--luma-hover-surface)}
    .room-icon{width:34px;height:34px;display:grid;place-items:center;border-radius:11px;background:color-mix(in srgb,var(--tone) 9%,transparent);flex-shrink:0}.room-icon ha-icon{--mdc-icon-size:19px;color:var(--tone)}
    .room-copy{display:grid;gap:4px;flex:1;min-width:0}.room-name{font-weight:600;overflow-wrap:anywhere}.room-copy .status{font-size:11px;font-weight:500}.room-values{display:grid;gap:4px;text-align:right;flex-shrink:0;font-variant-numeric:tabular-nums}.room-reading{font-size:15px;font-weight:560}.room-secondary{font-size:10px;color:var(--luma-muted)}
    .context-measurements{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
    .context-row{min-height:64px;display:grid;grid-template-columns:20px minmax(0,1fr);gap:4px 8px;padding:10px;background:color-mix(in srgb,var(--primary-text-color) 3%,transparent);border-radius:var(--luma-radius-control)}
    .context-row ha-icon{--mdc-icon-size:18px;color:var(--luma-muted);grid-row:1 / 3;align-self:center}.context-label{font-size:11px;color:var(--luma-muted);overflow-wrap:anywhere}.context-value{font-size:14px;font-weight:560;font-variant-numeric:tabular-nums}.context-value .unit{margin-left:4px}.context-section .explanation{font-size:10px}
    @container(max-width:300px){.context-measurements{grid-template-columns:1fr}}
    .detail-link{min-height:44px;color:var(--primary-text-color);justify-content:space-between;font-size:12px}.detail-link ha-icon{--mdc-icon-size:18px;color:var(--luma-muted)}
    @container(max-width:360px){.card{padding:12px;gap:8px}.header{gap:8px}.icon{width:44px;height:44px}.name{font-size:14px}.status{font-size:11px}.metric-value{font-size:16px;gap:3px;padding:4px 5px}.metrics{gap:6px}.metric{padding:6px}.unit{font-size:10px}.trend{font-size:11px;margin-left:0}}
    @container(max-width:270px){.header{flex-wrap:wrap}.status{order:3}.metrics{grid-template-columns:1fr}.metric{min-height:44px}.climate-header{flex-wrap:wrap}.climate-state{margin-left:0}.settings{margin-left:0}}
  `];
  setConfig(c:Config){
    if(!c?.temperature_entity||!c?.humidity_entity)throw Error('Luma comfort requires temperature and humidity entities.');
    if(c.climate&&!c.climate.entity?.startsWith('climate.'))throw Error('Luma comfort climate.entity must be a climate entity.');
    this.config=c;
  }
  getCardSize(){return this.config?.climate?3:2}
  protected shouldUpdate(changed:PropertyValues<this>){
    if([...changed.keys()].some(k=>k!=='hass'))return true;
    const old=changed.get('hass') as HomeAssistant|undefined;
    return !old||old.callService!==this.hass?.callService||old.locale!==this.hass?.locale||old.config!==this.hass?.config||this.ids.some(id=>old.states[id]!==this.hass?.states[id]);
  }
  private get ids(){const c=this.config;return c?[c.temperature_entity,c.humidity_entity,c.pm25_entity,c.outdoor_temperature_entity,c.heating_entity,c.air_conditioner_entity,c.climate?.entity,...(c.rooms||[]).flatMap(r=>[r.temperature_entity,r.humidity_entity,r.climate_entity]),...(c.context_entities||[]).map(e=>e.entity)].filter(Boolean)as string[]:[]}
  private value(id?:string){return entityMeasurement(id?this.hass?.states[id]:undefined)}
  private info(entity:string){runAction(this,this.hass!,{action:'more-info'},entity)}
  private metric(id:string,label:string,decimals:number,fallbackUnit:string,status:ComfortMetricStatus,note?:string){
    const value=this.value(id),e=this.hass!.states[id],unit=e?.attributes.unit_of_measurement||fallbackUnit;
    const reason=status.reason?localized(this.hass,reasonLabels[status.reason][0],reasonLabels[status.reason][1]):'';
    const flag=status.severity==='warning'||status.severity==='error';
    return html`<button class="metric" data-severity=${status.severity} title=${reason} @click=${()=>this.info(id)} aria-label=${`${label}: ${value===null?missingLabel(this.hass,e):`${formatNumber(this.hass,value,decimals)} ${unit}`}${reason?` · ${reason}`:''}`}><span class="metric-label">${label}</span><span class=${`metric-value ${value===null?'missing':''} ${flag?'flagged':''}`}>${value===null?localized(this.hass,'No data','Nincs adat'):html`<span class="reading">${formatNumber(this.hass,value,decimals)}</span><span class="unit">${unit}</span>${flag?html`<span class="trend" aria-hidden="true">${status.direction==='low'?'↓':'↑'}</span>`:nothing}`}</span>${note?html`<span class="metric-note">${note}</span>`:nothing}</button>`;
  }
  private renderClimate(){
    const c=this.config!.climate;
    if(!c)return nothing;
    const e=this.hass!.states[c.entity];
    if(this.config!.display!=='details'&&entityAvailable(e)&&e.state==='off')return nothing;
    return html`<luma-climate-control .hass=${this.hass} .config=${c} .compact=${this.config!.display==='details'} .alwaysVisible=${this.config!.display==='details'}></luma-climate-control>`;
  }
  private renderDetails(result:ReturnType<typeof comfortAssessment>,tone:string,label:string){
    const c=this.config!,limits={...comfortDefaults,...c};
    const range=(min:number,max:number,unit:string)=>`${formatNumber(this.hass,min)}–${formatNumber(this.hass,max)} ${unit}`;
    return html`<div class="detail" style=${`--tone:${tone}`}>
      <section class="section assessment" aria-label=${localized(this.hass,'Comfort assessment','Komfortértékelés')}>
        <div class="section-heading"><h3>${localized(this.hass,'Comfort range','Komforttartomány')}</h3><span class="status"><span class="dot" aria-hidden="true"></span>${label}</span></div>
        ${result.incomplete?html`<p class="explanation">${localized(this.hass,'Some measurements are missing.','Egyes mérések hiányoznak.')}</p>`:nothing}
        <div class="metrics" style=${`--metric-columns:${c.pm25_entity?'repeat(3,minmax(0,1fr))':'repeat(2,minmax(0,1fr))'}`}>
          ${this.metric(c.temperature_entity,c.temperature_label||localized(this.hass,'Indoor average','Benti átlag'),1,'°C',result.metrics.temperature,range(limits.comfortable_temperature_min,limits.comfortable_temperature_max,'°C'))}
          ${this.metric(c.humidity_entity,c.humidity_label||localized(this.hass,'Average humidity','Átlagos pára'),0,'%',result.metrics.humidity,range(limits.comfortable_humidity_min,limits.comfortable_humidity_max,'%'))}
          ${c.pm25_entity?this.metric(c.pm25_entity,c.pm25_label||'PM2.5',0,'µg/m³',result.metrics.pm25,`≤ ${formatNumber(this.hass,limits.pm25_elevated)} µg/m³`):nothing}
        </div>
      </section>
      ${c.rooms?.length?html`<section class="section"><div class="section-heading"><h3>${localized(this.hass,'Rooms','Szobák')}</h3></div>${c.rooms.map(room=>{
        const summary=room.climate_entity?thermostatSummary(this.hass!.states[room.climate_entity]):undefined;
        const t=this.value(room.temperature_entity),h=this.value(room.humidity_entity),unit=String(this.hass!.states[room.temperature_entity]?.attributes.unit_of_measurement||'°C');
        return html`<button class="room-row" style=${`--tone:${summary?.active?'var(--luma-state-warning)':'var(--luma-state-neutral)'}`} @click=${()=>this.info(room.climate_entity||room.temperature_entity)}>
          <span class="room-icon"><ha-icon icon=${room.icon||'mdi:home-thermometer-outline'}></ha-icon></span>
          <span class="room-copy"><span class="room-name">${room.name}</span>${summary?html`<span class="status"><span class="dot" aria-hidden="true"></span>${localized(this.hass,summary.en,summary.hu)}${summary.target!==undefined?html` · ${localized(this.hass,'target','cél')} ${formatNumber(this.hass,summary.target)} ${this.hass!.config?.unit_system?.temperature||'°C'}`:nothing}</span>`:nothing}</span>
          <span class="room-values"><span class="room-reading">${t===null?localized(this.hass,'No data','Nincs adat'):html`${formatNumber(this.hass,t,1)} <span class="unit">${unit}</span>`}</span>${room.humidity_entity?html`<span class="room-secondary">${h===null?localized(this.hass,'No humidity data','Nincs páraadat'):`${formatNumber(this.hass,h)} %`}</span>`:nothing}</span>
        </button>`;
      })}</section>`:nothing}
      ${c.climate?html`<div class="detail-climate">${this.renderClimate()}</div>`:nothing}
      ${c.context_entities?.length?html`<section class="section context-section"><div class="section-heading"><h3>${localized(this.hass,'Other measurements','További mérések')}</h3></div><div class="context-measurements">${c.context_entities.map(item=>{
        const e=this.hass!.states[item.entity],value=this.value(item.entity);
        return html`<button class="context-row" @click=${()=>this.info(item.entity)}><ha-icon icon=${item.icon||String(e?.attributes.icon||'mdi:chart-line')}></ha-icon><span class="context-label">${item.name}</span><span class="context-value">${value===null?missingLabel(this.hass,e):html`${formatNumber(this.hass,value,item.decimals??1)}${e?.attributes.unit_of_measurement?html`<span class="unit">${e.attributes.unit_of_measurement}</span>`:nothing}`}</span></button>`;
      })}</div><p class="explanation">${localized(this.hass,'Not included in the comfort assessment.','A komfortértékelésen kívüli adatok.')}</p></section>`:nothing}
      ${c.details_action?html`<button class="detail-link" @click=${()=>runAction(this,this.hass!,c.details_action)}>${localized(this.hass,'Heating settings and history','Fűtésbeállítások és előzmények')}<ha-icon icon="mdi:chevron-right"></ha-icon></button>`:nothing}
    </div>`;
  }
  render(){
    if(!this.hass||!this.config)return nothing;
    const c=this.config,t=this.value(c.temperature_entity),h=this.value(c.humidity_entity),pm=this.value(c.pm25_entity),out=this.value(c.outdoor_temperature_entity);
    const result=comfortAssessment({temperature:t,humidity:h,pm25:pm,pm25Configured:!!c.pm25_entity},c);
    const tone=result.status==='comfortable'?'var(--luma-state-success)':result.status==='error'?'var(--luma-state-error)':result.status==='warning'?'var(--luma-state-warning)':'var(--luma-state-neutral)';
    const label=result.status==='comfortable'?localized(this.hass,'Comfortable','Kellemes'):result.status==='error'?localized(this.hass,'Needs attention','Figyelmet kér'):result.status==='warning'?localized(this.hass,'Uncomfortable','Nem komfortos'):localized(this.hass,'Incomplete data','Hiányos adatok');
    if(c.display==='details')return this.renderDetails(result,tone,label);
    const activity=comfortActivity(this.hass,{...c,air_conditioner_entity:c.climate?undefined:c.air_conditioner_entity});
    const navigable=c.tap_action&&c.tap_action.action!=='none';
    const header=html`<span class="icon"><ha-icon icon=${c.icon||'mdi:home-thermometer-outline'}></ha-icon></span><span class="name">${c.name||localized(this.hass,'Comfort','Komfort')}</span><span class="status"><span class="dot" aria-hidden="true"></span>${label}</span>${navigable?html`<ha-icon class="details-cue" icon="mdi:chevron-right"></ha-icon>`:nothing}`;
    return html`<ha-card class="card" style=${`--tone:${tone}`}>
      ${navigable?html`<button class="header" aria-label=${`${c.name||localized(this.hass,'Comfort','Komfort')} · ${label} · ${localized(this.hass,'Details and controls','Részletek és vezérlés')}`} @click=${()=>runAction(this,this.hass!,c.tap_action)}>${header}</button>`:html`<div class="header">${header}</div>`}
      <div class="metrics" style=${`--metric-columns:${c.pm25_entity?'minmax(0,1fr) minmax(0,1fr) minmax(0,1.35fr)':'repeat(2,minmax(0,1fr))'}`}>
        ${this.metric(c.temperature_entity,c.temperature_label||localized(this.hass,'Indoor','Bent'),1,'°C',result.metrics.temperature)}
        ${this.metric(c.humidity_entity,c.humidity_label||localized(this.hass,'Humidity','Páratartalom'),0,'%',result.metrics.humidity)}
        ${c.pm25_entity?this.metric(c.pm25_entity,c.pm25_label||'PM2.5',0,'µg/m³',result.metrics.pm25):nothing}
      </div>
      ${c.outdoor_temperature_entity||activity.length?html`<div class="context">${c.outdoor_temperature_entity?html`<span class="outside"><ha-icon icon="mdi:thermometer"></ha-icon>${localized(this.hass,'Outside','Kint')}: ${out===null?localized(this.hass,'No data','Nincs adat'):`${formatNumber(this.hass,out,1)} ${this.hass.states[c.outdoor_temperature_entity]?.attributes.unit_of_measurement||'°C'}`}</span>`:nothing}${activity.map(a=>html`<span class="operation" style=${`--activity-color:${a.color}`}><ha-icon icon=${a.icon}></ha-icon>${localized(this.hass,a.en,a.hu)}</span>`)}</div>`:nothing}
      ${this.renderClimate()}
    </ha-card>`;
  }
}
