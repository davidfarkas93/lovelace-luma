import type {Meta,StoryObj} from '@storybook/web-components-vite';
import {html} from 'lit';
import {ref} from 'lit/directives/ref.js';
import '../src/index';
import {createMockHass} from '../storybook/mock-hass';
import type {DailyReport,ReportState,ReportFacts,EnergyMetric,HeatingCycle} from '../src/daily-report';
import type {LovelaceCard} from '../src/types';
const scenario=(state:ReportState='attention_needed',options:{offline?:boolean;forbidden?:boolean;stale?:boolean;energy?:boolean;heating?:boolean}={})=>{
 const now=Date.now()/1000;
 const facts:ReportFacts={day:'2026-11-09',assessment:state,data_quality:state==='insufficient_data'?'insufficient_data':'complete',coverage_seconds:state==='insufficient_data'?1200:86400,window_seconds:86400,coverage_percent:state==='insufficient_data'?1.4:100,
  counts:{issues:{sources_present:1,carried_over:1,recurrences:0},updates:{sources_present:2},events:{}},availability:{whole_day_details:state!=='insufficient_data',sources_with_gaps:state==='insufficient_data'?null:0},
  ai_evidence:[{ref:'episode_1',name:'Boiler',source:'binary_sensor.boiler_fault',message:'The fault flag remained active during the observed interval.',present_at_period_start:true}]};
 const completed={id:'report',day:'2026-11-09',started:now-40,finished:now-30,status:'completed' as const,ai_status:'success',facts,
  narrative:{summary:'A kazán korábbról áthúzódó jelzése a megfigyelt időszakban fennmaradt. Érdemes átnézni a hibanaplóját.',hypothesis:'Az összefüggés oka a rendelkezésre álló adatokból nem igazolható.',suggested_check:'Nézd át a kazán hibanaplóját és a kapcsolódó érzékelő előzményeit.',evidence_refs:['episode_1']}};
 const previous={...completed,id:'previous',day:'2026-11-08',started:now-86400,finished:now-86390,narrative:{...completed.narrative,summary:'KORÁBBI: az akkori ellenőrzés nem talált új, igazolt eltérést.'}};
 const data:DailyReport={schema_version:1,policy_id:'demo',timezone:'Europe/Budapest',expected_day:'2026-11-09',generated_at:options.stale?now-60:now,due_at:now-60,state,
  attempt:['missed','waiting'].includes(state)?null:state==='failed'?{...completed,status:'failed',ai_status:'failed',narrative:null,error:'ai_failed'}:state==='running'||state==='stalled'?{...completed,status:'running',finished:null,narrative:null}:completed,
  last_success:['failed','missed','stalled','waiting','running'].includes(state)?previous:completed};
 if(options.energy){
  facts.scope='energy_statistics';facts.counts={};facts.profile={deviation_percent:50,deviation_kwh:3};
  facts.metrics=(['solar','grid_import','grid_export','ev'] as const).map((key,i)=>({key,name:['Napelemtermelés','Hálózati import','Hálózati export','Autótöltés'][i],source:'sensor.'+key,value:state==='insufficient_data'&&key==='ev'?null:[4.63,11.82,2.01,0][i],unit:'kWh',status:state==='insufficient_data'&&key==='ev'?'unknown_history_boundaries':'complete',statistics:{hours:24,expected_hours:24,reason:null},history:{status:'known_boundaries',boundary_states_known:true,unavailable_seconds:1.34},baseline:{status:'complete',days:14,requested_days:14,median:[17,13,6,8][i]},delta_kwh:[-12.37,-1.18,-3.99,-8][i],delta_percent:[-72.8,-9.1,-66.5,-100][i],deviation:key==='solar'?'below_recent_days':null})) satisfies EnergyMetric[];
  facts.ai_evidence=[{ref:'solar',name:'Napelemtermelés',source:'sensor.solar',category:'energy'}];
  completed.narrative={summary:'A Napelemtermelés a korábbi napok mediánja alatt maradt; az Autótöltés rögzített energiája nem nőtt.',hypothesis:'',suggested_check:'Napelemtermelés: hasonlítsd össze a nap órás görbéjét a korábbi napokéval; az eltérés oka a napi összesítésből nem állapítható meg.',evidence_refs:['solar','ev']};
  data.policy_id='energy:demo';data.energy_profile='demo';
 }
 if(options.heating){
  const partial=state==='insufficient_data',empty=state==='not_run',idle=state==='no_anomaly_found';
  facts.scope='heating_cycles';facts.counts={};facts.coverage_percent=empty?0:partial?99.975:100;facts.coverage_seconds=empty?0:partial?86378.35:86400;facts.unobserved_seconds=86400-facts.coverage_seconds;facts.mode_coverage_seconds=facts.coverage_seconds;
  facts.profile={short_burn_seconds:180,minimum_short_cycles:3,mode_edge_seconds:2,sources:{flame:'binary_sensor.flame',heating:'binary_sensor.heating',dhw:'binary_sensor.dhw',connectivity:'binary_sensor.connectivity'}};
  facts.burner={observed_ignitions:empty?null:idle?0:6,observed_seconds:empty?null:idle?0:1155,counts_are_lower_bounds:partial||empty,carried_into_day:false};
  const samples:HeatingCycle[]=[330,60,60,60,45,600].map((duration,i)=>{const begin=new Date(Date.UTC(2026,10,9,1,i*12)).toISOString(),end=new Date(Date.parse(begin)+duration*1000).toISOString();return {started_at:begin,ended_at:end,observed_from:begin,observed_until:end,complete:true,duration_seconds:duration,mode:i===4?'dhw':i===5?'mixed':'heating',reason:'off',carried_into_day:false};});
  facts.cycles={complete:idle||empty?0:6,heating:idle||empty?0:4,dhw:idle||empty?0:1,mixed:idle||empty?0:1,unclassified:0,censored:0,heating_median_seconds:idle||empty?null:60,heating_mean_seconds:idle||empty?null:127.5,heating_min_seconds:idle||empty?null:60,heating_max_seconds:idle||empty?null:330,short_heating:idle||empty?null:3,short_cycle_pattern:!idle&&!empty,samples:idle||empty?[]:samples,truncated:false};
  facts.ai_evidence=[{ref:'short_burns',name:'Rövid fűtési égések',source:'binary_sensor.flame',category:'heating'}];
  completed.narrative={summary:(partial?'A fűtési visszajelzések megfigyelése hiányos volt. ':'')+'Ismétlődő rövid fűtési égések voltak a teljesen megfigyelt ciklusok között.',hypothesis:'',suggested_check:'Fűtési égések: nézd át a rövid égések időpontjait és a hozzájuk tartozó égő-, fűtési és melegvíz-visszajelzéseket.',evidence_refs:['short_burns']};
  if(idle)completed.narrative={summary:'Az ismert megfigyelési szakaszokban nem volt égőműködés.',hypothesis:'',suggested_check:'',evidence_refs:[]};
  if(empty)completed.narrative={summary:'Erre a napra nincs megbízható égőmegfigyelés.',hypothesis:'',suggested_check:'',evidence_refs:[]};
  data.policy_id='heating:demo';data.heating_profile='demo';
 }
 window.lumaAttentionPolicies={...window.lumaAttentionPolicies,report_demo:{version:1,revision:'demo',rules:[],backend:{policy_id:'demo'}}};
 const hass=createMockHass({});
 hass.callService=async()=>{throw Error('Report card must not call services');};
 hass.callWS=async command=>{if(command.type!=='home_insights/report')throw Error('Unexpected command');if(options.forbidden)throw {code:'unauthorized'};if(options.offline)throw Error('Offline');return structuredClone(data) as never;};
 return html`<div style="width:1000px;max-width:calc(100vw - 48px)"><luma-daily-report-card .hass=${hass} ${ref(node=>{if(node)(node as HTMLElement & LovelaceCard).setConfig({type:'custom:luma-daily-report-card',...(options.heating?{heating_profile:'demo',title:'Tegnapi kazánüzem'}:options.energy?{energy_profile:'demo',title:'Tegnapi energiamérleg'}:{policy:'report_demo',household_path:'#household-context'})});})}></luma-daily-report-card></div>`;
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
export const Energy:Story={render:()=>scenario('attention_needed',{energy:true})};
export const EnergyPartial:Story={render:()=>scenario('insufficient_data',{energy:true})};
export const EnergyFailed:Story={render:()=>scenario('failed',{energy:true})};

export const Heating:Story={render:()=>scenario('attention_needed',{heating:true})};
export const HeatingPartial:Story={render:()=>scenario('insufficient_data',{heating:true})};
export const HeatingIdle:Story={render:()=>scenario('no_anomaly_found',{heating:true})};
export const HeatingEmpty:Story={render:()=>scenario('not_run',{heating:true})};
export const HeatingFailed:Story={render:()=>scenario('failed',{heating:true})};
