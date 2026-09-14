import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { entityName, runAction } from '../helpers';
import { localized } from '../localize';
import { lumaTokens } from '../styles';
import { storageModel, storageNumber, storageValue, storageOperation, type StorageConfig, type StorageSource } from '../storage';
import type { HomeAssistant, LovelaceCard } from '../types';

@customElement('luma-storage-card')
export class LumaStorageCard extends LitElement implements LovelaceCard {
  @property({attribute:false}) hass?:HomeAssistant;
  @state() private config?:StorageConfig;
  static styles=[lumaTokens,css`
    :host{min-width:0;height:100%}
    .card.compact{min-height:180px;padding:15px;gap:12px}.compact footer{padding-top:9px}.compact .usage{gap:8px}
    .operation{display:grid;gap:9px;margin:auto 0}.operation-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px}.operation-state{font-size:21px;font-weight:700;overflow-wrap:anywhere}.operation-progress{font-size:13px;font-weight:650}.operation .label{margin-bottom:2px}
    .card{height:100%;min-height:200px;padding:18px;border:1px solid var(--luma-border);border-radius:var(--luma-radius-card);background:linear-gradient(140deg,color-mix(in srgb,var(--tone) 6%,var(--luma-surface)),var(--luma-surface) 80%);box-shadow:var(--luma-shadow);display:flex;flex-direction:column;gap:16px}
    header{display:flex;gap:12px;align-items:center;min-width:0}.icon{display:grid;place-items:center;flex:0 0 38px;height:38px;border-radius:12px;background:color-mix(in srgb,var(--tone) 12%,transparent);color:var(--tone)}ha-icon{--mdc-icon-size:20px}
    .title{min-width:0;flex:1}.name{font-size:15px;font-weight:var(--luma-weight-title);overflow-wrap:anywhere}.subtitle{font-size:11px;color:var(--luma-muted);margin-top:3px;overflow-wrap:anywhere}
    button{font:inherit;color:inherit;border:0;background:none;text-align:left;padding:0;cursor:pointer;min-width:0;border-radius:8px}button:hover{background:color-mix(in srgb,var(--primary-text-color) 4%,transparent)}button:focus-visible{outline:2px solid var(--primary-color);outline-offset:4px}
    .usage{display:grid;gap:10px;width:100%}.value-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px}.value{font-size:28px;font-weight:720;letter-spacing:-.04em;line-height:1.1}.unit{font-size:15px;font-weight:560;margin-left:4px;letter-spacing:0}.label{font-size:11px;color:var(--luma-muted)}
    .track{height:8px;border-radius:8px;overflow:hidden;background:color-mix(in srgb,var(--primary-text-color) 7%,transparent)}.fill{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,color-mix(in srgb,var(--tone) 65%,var(--luma-surface)),var(--tone));transition:width .35s ease}.track.unknown{opacity:.45}
    .capacity{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:-5px}.capacity button{display:grid;gap:4px;align-content:start}.capacity strong{font-size:12px;font-weight:620;overflow-wrap:anywhere}
    footer{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:auto;padding-top:12px;border-top:1px solid var(--luma-border)}.health,.temperature{display:inline-flex;align-items:center;gap:5px;min-height:30px;font-size:11px;font-weight:650}.health{padding:5px 9px;border-radius:10px;color:var(--health-tone);background:color-mix(in srgb,var(--health-tone) 10%,transparent)}footer ha-icon{--mdc-icon-size:16px}.temperature{color:var(--luma-muted)}.detail{font-size:12px;line-height:1.5;overflow-wrap:anywhere;color:var(--error-color)}.parity{font-size:13px;line-height:1.5;color:var(--luma-muted);margin:auto 0}
  `];
  setConfig(config:StorageConfig){
    if(!config.entity&&!config.health_entity)throw Error('Luma storage requires entity or health_entity.');
    for(const threshold of [config.warning_above,config.critical_above])if(threshold!==undefined&&(!Number.isFinite(threshold)||threshold<0||threshold>100))throw Error('Storage thresholds must be between 0 and 100.');
    if((config.warning_above??85)>(config.critical_above??95))throw Error('Storage warning threshold cannot exceed critical threshold.');
    this.config={...config};
  }
  getCardSize(){return 3}
  getGridOptions(){return {columns:12,rows:'auto'}}
  private text(en:string,hu:string){return localized(this.hass,en,hu)}
  private info(entity?:string){if(entity&&this.hass)void runAction(this,this.hass,{action:'more-info',entity},entity)}
  private format(source:StorageSource){
    const raw=storageValue(this.hass,source,this.config?.entity||this.config?.health_entity);
    if(raw===undefined)return '—';
    const number=storageNumber(raw);
    const value=number===undefined?String(raw):new Intl.NumberFormat(this.hass?.locale?.language||'en',{maximumFractionDigits:1}).format(number);
    const entity=this.hass?.states[source.entity||this.config?.entity||this.config?.health_entity||''];
    const unit=source.unit??(!source.attribute?entity?.attributes.unit_of_measurement:undefined);
    return `${value}${unit?` ${unit}`:''}`;
  }
  render(){
    if(!this.config||!this.hass)return nothing;
    const c=this.config,m=storageModel(this.hass,c),primary=c.entity||c.health_entity,operation=storageOperation(this.hass,c);
    const name=c.name||entityName(this.hass.states[primary!],primary);
    const healthTone=m.healthStatus==='healthy'?'var(--success-color)':m.healthStatus==='problem'?'var(--error-color)':'var(--secondary-text-color)';
    const healthText=m.healthStatus==='healthy'?this.text('SMART healthy','SMART rendben'):m.healthStatus==='problem'?this.text('SMART warning','SMART probléma'):this.text('SMART unknown','SMART ismeretlen');
    const detail=c.health_detail?storageValue(this.hass,c.health_detail,primary):undefined;
    const capacity=[['Used','Használt',c.used],['Free','Szabad',c.free],['Total','Összes',c.total]] as const;
    return html`<ha-card class=${`card ${c.compact?'compact':''}`} style=${`--tone:var(--${m.tone}-color);--health-tone:${healthTone}`}>
      <header><span class="icon"><ha-icon icon=${c.icon||'mdi:harddisk'}></ha-icon></span><div class="title"><div class="name">${name}</div>${c.subtitle?html`<div class="subtitle">${c.subtitle}</div>`:nothing}</div></header>
      ${c.entity?html`<button class="usage" aria-label=${`${name} · ${this.text('Storage usage details','Tárhelyhasználat részletei')}`} @click=${()=>this.info(c.entity)}>
        <span class="value-row"><span class="value">${m.usage===undefined?'—':new Intl.NumberFormat(this.hass.locale?.language||'en',{maximumFractionDigits:1}).format(m.usage)}${m.usage!==undefined?html`<span class="unit">%</span>`:nothing}</span><span class="label">${m.usage===undefined?this.text('Unavailable','Nem elérhető'):this.text('Used','Foglalt')}</span></span>
        <span class=${`track ${m.usage===undefined?'unknown':''}`}><span class="fill" style=${`width:${m.usage??0}%`}></span></span>
      </button>`:c.operation?nothing:html`<div class="parity">${c.usage_note||this.text('Health monitoring · no usage sensor configured','Állapotfigyelés · nincs tárhelyhasználat-szenzor megadva')}</div>`}
      ${c.operation?html`<div class="operation"><span class="label">${c.operation.label||this.text('Operation','Művelet')}</span><div class="operation-head"><button class="operation-state" @click=${()=>this.info(c.operation?.state.entity||primary)}>${operation.label||this.text('Unavailable','Nem elérhető')}</button>${operation.progress!==undefined?html`<button class="operation-progress" aria-label=${this.text('Progress details','Előrehaladás részletei')} @click=${()=>this.info(c.operation?.progress?.entity||c.operation?.state.entity||primary)}>${Math.round(operation.progress)}%</button>`:nothing}</div>${operation.progress!==undefined?html`<div class="track" role="progressbar" aria-label=${c.operation.label||this.text('Operation','Művelet')} aria-valuemin="0" aria-valuemax="100" aria-valuenow=${operation.progress}><span class="fill" style=${`width:${operation.progress}%`}></span></div>`:nothing}</div>`:nothing}
      ${capacity.some(([, ,source])=>source)?html`<div class="capacity">${capacity.map(([en,hu,source])=>source?html`<button @click=${()=>this.info(source.entity||primary)}><span class="label">${this.text(en,hu)}</span><strong>${this.format(source)}</strong></button>`:nothing)}</div>`:nothing}
      ${m.healthStatus==='problem'&&detail!==undefined?html`<div class="detail">${String(detail)}</div>`:nothing}
      ${c.health_entity||c.temperature?html`<footer>${c.health_entity?html`<button class="health" aria-label=${`${name} · ${healthText}`} @click=${()=>this.info(c.health_entity)}><ha-icon icon=${m.healthStatus==='healthy'?'mdi:shield-check-outline':m.healthStatus==='problem'?'mdi:shield-alert-outline':'mdi:help-circle-outline'}></ha-icon>${healthText}</button>`:nothing}${c.temperature?html`<button class="temperature" aria-label=${`${name} · ${this.text('Temperature','Hőmérséklet')}`} @click=${()=>this.info(c.temperature?.entity||primary)}><ha-icon icon="mdi:thermometer"></ha-icon>${this.format(c.temperature)}</button>`:nothing}</footer>`:nothing}
    </ha-card>`;
  }
}
