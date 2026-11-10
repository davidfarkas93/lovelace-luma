import type {Meta,StoryObj} from '@storybook/web-components-vite';
import {html} from 'lit';
import {ref} from 'lit/directives/ref.js';
import '../src/index';
import {createMockHass} from '../storybook/mock-hass';
import type {DailyReport,ReportState} from '../src/daily-report';
import type {LovelaceCard} from '../src/types';
const scenario=(state:ReportState='attention_needed',options:{offline?:boolean;forbidden?:boolean;stale?:boolean}={})=>{
 const now=Date.now()/1000;
 const facts={day:'2026-11-09',assessment:state,data_quality:state==='insufficient_data'?'insufficient_data':'complete',coverage_seconds:state==='insufficient_data'?1200:86400,window_seconds:86400,coverage_percent:state==='insufficient_data'?1.4:100,
  counts:{issues:{sources_present:1,carried_over:1,recurrences:0},updates:{sources_present:2},events:{}},availability:{whole_day_details:state!=='insufficient_data',sources_with_gaps:state==='insufficient_data'?null:0},
  ai_evidence:[{ref:'episode_1',name:'Boiler',source:'binary_sensor.boiler_fault',message:'The fault flag remained active during the observed interval.',present_at_period_start:true}]};
 const completed={id:'report',day:'2026-11-09',started:now-40,finished:now-30,status:'completed' as const,ai_status:'success',facts,
  narrative:{summary:'A kazán korábbról áthúzódó jelzése a megfigyelt időszakban fennmaradt. Érdemes átnézni a hibanaplóját.',hypothesis:'Az összefüggés oka a rendelkezésre álló adatokból nem igazolható.',suggested_check:'Nézd át a kazán hibanaplóját és a kapcsolódó érzékelő előzményeit.',evidence_refs:['episode_1']}};
 const previous={...completed,id:'previous',day:'2026-11-08',started:now-86400,finished:now-86390,narrative:{...completed.narrative,summary:'KORÁBBI: az akkori ellenőrzés nem talált új, igazolt eltérést.'}};
 const data:DailyReport={schema_version:1,policy_id:'demo',timezone:'Europe/Budapest',expected_day:'2026-11-09',generated_at:options.stale?now-60:now,due_at:now-60,state,
  attempt:['missed','waiting'].includes(state)?null:state==='failed'?{...completed,status:'failed',ai_status:'failed',narrative:null,error:'ai_failed'}:state==='running'||state==='stalled'?{...completed,status:'running',finished:null,narrative:null}:completed,
  last_success:['failed','missed','stalled','waiting','running'].includes(state)?previous:completed};
 window.lumaAttentionPolicies={...window.lumaAttentionPolicies,report_demo:{version:1,revision:'demo',rules:[],backend:{policy_id:'demo'}}};
 const hass=createMockHass({});
 hass.callService=async()=>{throw Error('Report card must not call services');};
 hass.callWS=async command=>{if(command.type!=='home_insights/report')throw Error('Unexpected command');if(options.forbidden)throw {code:'unauthorized'};if(options.offline)throw Error('Offline');return structuredClone(data) as never;};
 return html`<div style="width:1000px;max-width:calc(100vw - 48px)"><luma-daily-report-card .hass=${hass} ${ref(node=>{if(node)(node as HTMLElement & LovelaceCard).setConfig({type:'custom:luma-daily-report-card',policy:'report_demo',household_path:'#household-context'});})}></luma-daily-report-card></div>`;
};
const meta:Meta={title:'Cards/Daily report',render:()=>scenario(),parameters:{controls:{disable:true}}};
export default meta;type Story=StoryObj;
export const Complete:Story={};
export const Partial:Story={render:()=>scenario('insufficient_data')};
export const Failed:Story={render:()=>scenario('failed')};
export const Missed:Story={render:()=>scenario('missed')};
export const Running:Story={render:()=>scenario('running')};
export const Interrupted:Story={render:()=>scenario('stalled')};
export const Waiting:Story={render:()=>scenario('waiting')};
export const NoObservation:Story={render:()=>scenario('not_run')};
export const Clear:Story={render:()=>scenario('no_anomaly_found')};
export const Unavailable:Story={render:()=>scenario('failed',{offline:true})};
export const Restricted:Story={render:()=>scenario('failed',{forbidden:true})};
export const Stale:Story={render:()=>scenario('attention_needed',{stale:true})};
