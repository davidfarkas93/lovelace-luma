import type { HomeAssistant } from './types';

export interface HouseholdRule {
  id:string; title:string; explanation:string;
  effect:'context'|'expected_unavailable';
  targets:string[]; target_states:string[];
  when:Array<{entity:string;states:string[];max_age_minutes?:number}>;
  enabled:boolean; status:'approved'|'draft'; evidence?:string; limitation?:string;
  expires_at?:string|null; approved_at?:string|null; updated_at?:string;
}
export interface HouseholdEvaluation {
  id:string; title:string; explanation:string; effect:HouseholdRule['effect'];
  status:'applies'|'does_not_apply'|'insufficient_data'|'disabled'|'draft'|'expired';
  matched_entities:string[];
  observations:Array<{entity:string;state:string;changed_at:number}>;
  valid_until?:number;
  limitation?:string;
}
export interface HouseholdSnapshot {
  schema_version:1; revision:number; evaluated_at:number; status:'ready'|'invalid'|'unavailable';
  evaluations:HouseholdEvaluation[]; expected_unavailable:string[];
}
export interface HouseholdConfig {entity:string;evaluate_script:string;manage_script?:string;path?:string}
export function householdRules(hass:HomeAssistant, config?:HouseholdConfig):HouseholdRule[] {
  const source=config && hass.states[config.entity];
  return source && !['unknown','unavailable'].includes(source.state) && source.attributes.schema_version===1 && Array.isArray(source.attributes.rules) ? source.attributes.rules : [];
}
/** A server decision is usable only for the same registry and source observations.
 * Browser code never reimplements the household conditions. */
export function currentHouseholdEvaluations(hass:HomeAssistant,config:HouseholdConfig,snapshot?:HouseholdSnapshot,now=Date.now()):HouseholdEvaluation[] {
  const source=hass.states[config.entity];
  if(!source || ['unknown','unavailable'].includes(source.state) || snapshot?.schema_version!==1 || snapshot.status!=='ready' || snapshot.revision!==source.attributes.revision || !Number.isFinite(snapshot.evaluated_at) || now/1000-snapshot.evaluated_at>90 || snapshot.evaluated_at>now/1000+10)return [];
  const rules=householdRules(hass,config);
  return snapshot.evaluations.filter(e=>{
    const rule=rules.find(rule=>rule.id===e.id);
    return e.status==='applies' && (e.valid_until===undefined || e.valid_until>now/1000) && rule?.status==='approved' && rule.enabled && (!rule.expires_at || Date.parse(rule.expires_at)>now) && e.observations.length>0 && e.observations.every(o=>{
      const current=hass.states[o.entity];
      return current && !current.attributes.restored && current.state===o.state && Math.abs(Date.parse(current.last_changed)/1000-o.changed_at)<.01;
    });
  });
}
export async function callHouseholdScript(hass:HomeAssistant,script:string,data:Record<string,unknown>={}) {
  if(!/^script\.[a-z0-9_]+$/.test(script)||!hass.callWS)throw Error('Household script unavailable');
  const result=await hass.callWS<{response?:Record<string,unknown>}>({type:'call_service',domain:'script',service:script.slice(7),service_data:data,return_response:true});
  if(!result?.response || typeof result.response!=='object')throw Error('Invalid household response');
  return result.response;
}
