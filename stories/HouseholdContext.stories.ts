import type {Meta,StoryObj} from '@storybook/web-components-vite';
import {html} from 'lit';
import {ref} from 'lit/directives/ref.js';
import '../src/index';
import {createMockHass} from '../storybook/mock-hass';
import type {HouseholdRule} from '../src/household-context';
import type {LovelaceCard} from '../src/types';
const rules:HouseholdRule[]=[
 {id:'washer_context',title:'Washer offline while switched off',explanation:'This washer normally loses its cloud connection when switched off.',effect:'context',targets:['sensor.washer'],target_states:['unknown','unavailable'],when:[{entity:'input_boolean.washer_program',states:['off']}],enabled:true,status:'approved',limitation:'An inactive program flag does not establish power-off. This explanation never suppresses an outage.',approved_at:'2026-11-01T12:00:00Z'},
 {id:'unsupported_flash',title:'Boot flash has no SMART measurement',explanation:'The boot flash does not support SMART health reporting. Missing SMART data does not establish a disk fault.',effect:'expected_unavailable',targets:['binary_sensor.flash_health'],target_states:['unknown','unavailable'],when:[],enabled:true,status:'approved',evidence:'unsupported_capability',approved_at:'2026-11-01T12:00:00Z'},
 {id:'draft',title:'Seasonal appliance note',explanation:'A draft must be approved before it can affect a report.',effect:'context',targets:['sensor.washer'],target_states:['unavailable'],when:[],enabled:true,status:'draft'},
];
window.lumaAttentionPolicies={...window.lumaAttentionPolicies,household_demo:{version:1,revision:'household-demo',rules:[],problems:{enabled:true},household:{entity:'sensor.household_context',evaluate_script:'script.household_evaluate',manage_script:'script.household_manage'}}};
function renderScenario(options:{unavailable?:boolean;conflict?:boolean;failure?:boolean}={}) {
 let card:(HTMLElement & LovelaceCard & {testCalls:unknown[]})|undefined;
 const hass=createMockHass({'sensor.washer':{state:'unavailable',attributes:{friendly_name:'Washer'}},'input_boolean.washer_program':{state:'off',attributes:{friendly_name:'Washer program active'}},'binary_sensor.flash_health':{state:'unknown',attributes:{friendly_name:'Boot flash health',device_class:'problem'}},'sensor.household_context':{state:options.unavailable?'unavailable':'1',attributes:{friendly_name:'Household knowledge',schema_version:1,revision:1,rules:JSON.parse(JSON.stringify(rules)),history:[]}}});
 const original=hass.callWS!;
 hass.callWS=async message=>{
  if(message.type!=='call_service')return original(message);
  const source=hass.states['sensor.household_context'];
  if(message.service==='household_evaluate')return {response:{schema_version:1,revision:source.attributes.revision,evaluated_at:Date.now()/1000,status:options.unavailable?'unavailable':'ready',expected_unavailable:['binary_sensor.flash_health'],evaluations:(source.attributes.rules as HouseholdRule[]).map(rule=>({id:rule.id,title:rule.title,explanation:rule.explanation,effect:rule.effect,status:rule.status==='draft'?'draft':'applies',matched_entities:rule.targets,observations:[...rule.targets,...rule.when.map(c=>c.entity)].map(entity=>({entity,state:hass.states[entity].state,changed_at:Date.parse(hass.states[entity].last_changed)/1000}))}))}} as never;
  card?.testCalls.push(message.service_data);
  if(options.failure)throw Error('Unavailable');
  if(options.conflict)return {response:{ok:false,error:'revision_conflict'}} as never;
  const data=message.service_data as {operation:string;record:HouseholdRule;rule_id:string;enabled:boolean;approve:boolean};
  const current=source.attributes.rules as HouseholdRule[];
  const before=current.find(r=>r.id===data.rule_id);
  const after=data.operation==='set_enabled'?{...before!,enabled:data.enabled}:{...data.record,status:data.approve?'approved':'draft',approved_at:data.approve?new Date().toISOString():null};
  source.attributes.rules=[...current.filter(r=>r.id!==after.id),after];
  source.attributes.revision=Number(source.attributes.revision)+1;source.state=String(source.attributes.revision);
  source.attributes.history=[{revision:source.attributes.revision,at:new Date().toISOString(),rule_id:after.id,operation:data.operation,before,after}];
  if(card)card.hass={...hass};
  return {response:{ok:true,revision:source.attributes.revision}} as never;
 };
 return html`<div style="width:1000px;max-width:calc(100vw - 48px)"><luma-household-context-card .hass=${hass} ${ref(node=>{card=node as typeof card;if(card){card.setConfig({type:'custom:luma-household-context-card',policy:'household_demo'});card.testCalls=[];}})}></luma-household-context-card></div>`;
}
const meta:Meta={title:'Attention/Household knowledge',render:()=>renderScenario(),parameters:{controls:{disable:true}}};
export default meta;
type Story=StoryObj;
export const Catalogue:Story={};
export const Unavailable:Story={render:()=>renderScenario({unavailable:true})};
export const Conflict:Story={render:()=>renderScenario({conflict:true})};
export const SaveFailure:Story={render:()=>renderScenario({failure:true})};
