import type { HomeAssistant } from './types';

/** A state or attribute supplied by dashboard configuration, never a device-specific ID. */
export interface StorageSource { entity?:string; attribute?:string; unit?:string }
export interface StorageConfig {
  type:string; entity?:string; name?:string; subtitle?:string; icon?:string; usage_note?:string;
  health_entity?:string; healthy_states?:string[]; problem_states?:string[];
  health_detail?:StorageSource; temperature?:StorageSource;
  used?:StorageSource; total?:StorageSource; free?:StorageSource;
  warning_above?:number; critical_above?:number;
}
export function storageValue(hass:HomeAssistant|undefined, source:StorageSource|undefined, fallback?:string):unknown {
  if(!source)return undefined;
  const entity=hass?.states[source.entity||fallback||''];
  if(!entity||['unknown','unavailable'].includes(entity.state)||entity.attributes.restored)return undefined;
  const raw=source.attribute?entity.attributes[source.attribute]:entity.state;
  return raw===null||raw===undefined||raw===''||raw==='unknown'||raw==='unavailable'?undefined:raw;
}
export function storageNumber(raw:unknown):number|undefined {
  if(typeof raw!=='number'&&typeof raw!=='string'||typeof raw==='string'&&!raw.trim())return undefined;
  const number=Number(raw);return Number.isFinite(number)?number:undefined;
}
export function storageModel(hass:HomeAssistant|undefined, config:StorageConfig) {
  const raw=storageNumber(storageValue(hass,config.entity?{entity:config.entity}:undefined));
  const usage=raw!==undefined&&raw>=0&&raw<=100?raw:undefined;
  const health=hass?.states[config.health_entity||''];
  const healthState=!health||health.attributes.restored?'unknown':health.state;
  const healthStatus=!config.health_entity?'none':(config.healthy_states||['off']).includes(healthState)?'healthy':(config.problem_states||['on']).includes(healthState)?'problem':'unknown';
  const tone=healthStatus==='problem'||usage!==undefined&&usage>=(config.critical_above??95)?'error':usage!==undefined&&usage>=(config.warning_above??85)?'warning':'primary';
  return {usage,healthStatus,tone};
}
