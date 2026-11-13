import type {Meta,StoryObj} from '@storybook/web-components-vite';
import {html} from 'lit';
import {ref} from 'lit/directives/ref.js';
import '../src/index';
import {createMockHass} from '../storybook/mock-hass';
import type {DailyReport,ReportState,ReportFacts,EnergyMetric,HeatingCycle,ReportAttempt} from '../src/daily-report';
import type {LovelaceCard} from '../src/types';
const scenario=(state:ReportState='attention_needed',options:{operationsContext?:boolean;focused?:boolean;hero?:boolean;offline?:boolean;forbidden?:boolean;stale?:boolean;energy?:boolean;heating?:boolean;warm?:boolean;detailsOpen?:boolean;long?:boolean;nas?:boolean;overnight?:boolean;rejected?:boolean}={})=>{
 const now=Date.now()/1000;
 const facts:ReportFacts={day:'2026-11-09',assessment:state,data_quality:state==='insufficient_data'?'insufficient_data':'complete',coverage_seconds:state==='insufficient_data'?1200:86400,window_seconds:86400,coverage_percent:state==='insufficient_data'?1.4:100,
  counts:{issues:{sources_present:1,carried_over:1,recurrences:0},updates:{sources_present:2},events:{}},availability:{whole_day_details:state!=='insufficient_data',sources_with_gaps:state==='insufficient_data'?null:0},
  ai_evidence:[{ref:'episode_1',name:'Boiler',source:'binary_sensor.boiler_fault',message:'The fault flag remained active during the observed interval.',present_at_period_start:true}]};
 const completed={id:'report',day:'2026-11-09',started:now-40,finished:now-30,status:'completed' as const,ai_status:'success',facts,
  narrative:{summary:'A kazán korábbról áthúzódó jelzése a megfigyelt időszakban fennmaradt. Érdemes átnézni a hibanaplóját.',hypothesis:'Az összefüggés oka a rendelkezésre álló adatokból nem igazolható.',suggested_check:'Nézd át a kazán hibanaplóját és a kapcsolódó érzékelő előzményeit.',evidence_refs:['episode_1']} as NonNullable<ReportAttempt['narrative']>};
 const previous={...completed,id:'previous',day:'2026-11-08',started:now-86400,finished:now-86390,narrative:{...completed.narrative,summary:'KORÁBBI: az akkori ellenőrzés nem talált új, igazolt eltérést.'}};
 const data:DailyReport={schema_version:1,policy_id:'demo',timezone:'Europe/Budapest',expected_day:'2026-11-09',generated_at:options.stale?now-60:now,due_at:now-60,state,
  attempt:['missed','waiting'].includes(state)?null:state==='failed'?{...completed,status:'failed',ai_status:'failed',narrative:null,error:'ai_failed'}:state==='running'||state==='stalled'?{...completed,status:'running',finished:null,narrative:null}:completed,
  last_success:['failed','missed','stalled','waiting','running'].includes(state)?previous:completed};
 if(options.operationsContext){
  facts.data_quality='insufficient_data';facts.coverage_percent=99.9;facts.coverage_seconds=86310;
  facts.observation_scope={observer_unobserved_seconds:60,source_incomplete_seconds:30,complete_day_verdict_possible:false,findings_are_observed_only:true,automation_trace_audit:'not_collected'};
  facts.report_overview={sources_requiring_review:1,sources_observed_cleared:2,sources_snoozed_at_end:1,notification_sources_handled:1,previously_observed_sources:1};
  facts.ai_evidence![0].history={previously_observed:true,first_observed_at:'2026-11-08T16:00:00Z',actual_fault_start_known:false};
  completed.narrative.headline='Kazán: a korábbról ismert jelzés nap végén is aktív volt.';
  completed.narrative.observation_note='A jelzésfigyelő egyes időszakokban nem rögzített; egyes források állapota átmenetileg nem volt ellenőrizhető. A rögzített események értékelhetők, de a kimaradt szakaszokról nincs elég adat.';
 }
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
  facts.profile={short_burn_seconds:180,minimum_short_cycles:3,mode_edge_seconds:2,rapid_pause_seconds:120,rapid_start_interval_seconds:300,warm_margin_celsius:5,warm_window_seconds:600,warm_short_burns_expected:!!options.warm,sources:{flame:'binary_sensor.flame',heating:'binary_sensor.heating',dhw:'binary_sensor.dhw',connectivity:'binary_sensor.connectivity'}};
  facts.burner={observed_ignitions:empty?null:idle?0:6,observed_seconds:empty?null:idle?0:1155,counts_are_lower_bounds:partial||empty,carried_into_day:false};
  const samples:HeatingCycle[]=[330,60,60,60,45,600].map((duration,i)=>{const begin=new Date(Date.UTC(2026,10,9,1,options.warm?i*15:[0,12,14,16,25,40][i])).toISOString(),end=new Date(Date.parse(begin)+duration*1000).toISOString();return {started_at:begin,ended_at:end,observed_from:begin,observed_until:end,previous_pause_seconds:i?options.warm?600:60:null,start_interval_seconds:i?options.warm?900:120:null,thermal_context:options.warm?'warm_operation':'unknown',rapid_restart:!options.warm&&i>0&&i<4,temperatures_at_start:{return:{celsius:31,recorded_at:new Date(Date.parse(begin)-200000).toISOString()},flow:{celsius:33,recorded_at:begin},target:{celsius:35,recorded_at:new Date(Date.parse(begin)-3600000).toISOString()}},complete:true,duration_seconds:duration,mode:i===4?'dhw':i===5?'mixed':'heating',reason:'off',carried_into_day:false};});
  facts.cycles={analysis_version:2,rapid_restart_sequences:idle||empty||options.warm?0:1,rapid_restart_burns:idle||empty||options.warm?0:3,warm_short_heating:options.warm?3:0,short_context_unknown:options.warm?0:3,short_other:0,complete:idle||empty?0:6,heating:idle||empty?0:4,dhw:idle||empty?0:1,mixed:idle||empty?0:1,unclassified:0,censored:partial?2:0,heating_median_seconds:idle||empty?null:60,heating_mean_seconds:idle||empty?null:127.5,heating_min_seconds:idle||empty?null:60,heating_max_seconds:idle||empty?null:330,short_heating:idle||empty?null:3,short_cycle_pattern:!idle&&!empty&&!options.warm,samples:idle||empty?[]:samples,truncated:false};
  facts.ai_evidence=[{ref:'short_burns',name:'Rövid fűtési égések',source:'binary_sensor.flame',category:'heating'}];
  completed.narrative={summary:(partial?'A fűtési visszajelzések megfigyelése hiányos volt. ':'')+'Egymást követő rövid fűtési égések gyors újraindulási sorozatot alkottak; ezt érdemes ellenőrizni.',hypothesis:'',suggested_check:'Fűtési égések: nézd át a rövid égések időpontjait és a hozzájuk tartozó égő-, fűtési és melegvíz-visszajelzéseket.',evidence_refs:['short_burns']};
  if(idle)completed.narrative={summary:'Az ismert megfigyelési szakaszokban nem volt égőműködés.',hypothesis:'',suggested_check:'',evidence_refs:[]};
  if(empty)completed.narrative={summary:'Erre a napra nincs megbízható égőmegfigyelés.',hypothesis:'',suggested_check:'',evidence_refs:[]};
  if(options.warm){facts.assessment='no_anomaly_found';facts.data_quality='minor_gaps';facts.coverage_percent=99.878;facts.coverage_seconds=86294.71;facts.unobserved_seconds=105.29;facts.observation_gaps={count:2,longest_seconds:60,intervals:[{start:'2026-11-09T21:50:00Z',end:'2026-11-09T21:51:00Z',seconds:60},{start:'2026-11-09T22:39:00Z',end:'2026-11-09T22:39:45.290Z',seconds:45.29}],truncated:false};facts.burner.counts_are_lower_bounds=true;data.state='no_anomaly_found';completed.narrative={summary:'Voltak rövid fűtési égések, de a megfigyelt égések között nem alakult ki gyors újraindulási sorozat. A rövid égések egy része már meleg rendszerben történt; ez összeegyeztethető a nálad megszokott hőntartással, önmagában nem hibajel.',hypothesis:'',suggested_check:'',evidence_refs:['heating_burns','warm_operation']};}
  data.policy_id='heating:demo';data.heating_profile='demo';
 }
 if(options.nas){
  const partial=state==='insufficient_data',empty=state==='not_run',finding=state==='attention_needed';
  facts.scope='nas_health';facts.counts={};facts.profile={minimum_hot_seconds:600};facts.coverage_seconds=empty?0:partial?82800:86400;facts.coverage_percent=100*facts.coverage_seconds/86400;facts.unobserved_seconds=86400-facts.coverage_seconds;facts.counts_are_lower_bounds=partial||empty;
  const signal=(source:string,active:number,known=empty?0:86400)=>({source,known_seconds:known,active_seconds:active,inactive_seconds:known-active,observed_starts:active?1:0});
  facts.signals={array_running:signal('binary_sensor.array',empty?0:86400),parity_problem:signal('binary_sensor.parity_problem',finding?1200:0),parity_running:signal('binary_sensor.parity_running',empty?0:3600),ups_status:signal('sensor.ups_status',finding?180:0,partial?0:empty?0:86400)};
  facts.disks=[{id:'disk1',name:'Disk one',source:'sensor.disk_temperature',health_source:'binary_sensor.disk_health',warn_celsius:50,maximum_celsius:empty?null:38,maximum_recorded_at:empty?null:'2026-11-09T12:00:00Z',known_seconds:empty?0:86400,standby_seconds:0,health_known_seconds:empty?0:86400,health_problem_seconds:0,hot_seconds:0,longest_hot_seconds:0,sustained_hot:false}];
  facts.ups_warning_flags=finding?['LB']:[];facts.parity_max_reported_errors=empty?null:finding?3:0;
  facts.ai_evidence=[{ref:'storage_observed',name:'Tároló-visszajelzések',source:'binary_sensor.parity_problem',category:'nas'}];
  completed.narrative={summary:empty?'Erre a napra nincs megfigyelt rendszeradat; a nap állapota nem értékelhető.':(partial?'A NAS megfigyelése hiányos volt. ':'')+(finding?'A tároló vagy a parity hibajelzője aktív volt a megfigyelt időszakban; ezt érdemes ellenőrizni.':'A NAS vizsgált állapotai a megfigyelt szakaszokban nem mutattak ellenőrzési küszöböt elérő eltérést.'),hypothesis:'',suggested_check:'',evidence_refs:['storage_observed']};
  data.policy_id='nas:demo';data.nas_profile='demo';
 }
 if(options.overnight){
  facts.notifications={start:'2026-11-09T23:00:00Z',end:'2026-11-10T23:00:00Z',sources:['event.nas'],events:[],attention:false,truncated:false,invalid_events:0};
  facts.since_midnight={...facts.notifications,start:'2026-11-10T23:00:00Z',end:'2026-11-11T11:00:00Z',attention:true,events:[
   {source:'event.nas',id:'error',at:'2026-11-11T01:01:00Z',observed_at:'2026-11-11T01:01:05Z',code:'parity_disk_error',label:'Parity-lemez hibajelzése',subject:'Parity disk in error state (disk dsbl)',importance:'ALERT',attention:true},
   {source:'event.nas',id:'recovered',at:'2026-11-11T09:09:00Z',observed_at:'2026-11-11T09:09:05Z',code:'array_recovered',label:'Array: rendben visszajelzés',subject:'array turned good',importance:'INFO',attention:false},
   {source:'event.nas',id:'sync',at:'2026-11-11T10:37:00Z',observed_at:'2026-11-11T10:37:05Z',code:'parity_sync',label:'Parity-szinkronizálás',subject:'Parity-Sync started',importance:'WARNING',attention:false}]};
  completed.narrative={...completed.narrative,summary_since_midnight:'Parity-lemez hibajelzése érkezett, később parity-szinkronizálás indult; a helyreállt paritásvédelem ebből még nem igazolt.'};
 }
 if(options.rejected&&data.attempt){data.attempt.error='invalid_ai_output';data.attempt.diagnostics={schema_version:1,stage:'ai_output_validation',reason:'unknown_evidence',detail:'Unknown evidence reference',candidate_json:JSON.stringify({summary:'<b>Elutasított szöveg</b>',evidence_ids:'invented_reference'}),candidate_truncated:false,allowed_evidence_refs:['episode_1']};}
 if(options.long)completed.narrative.summary='A korábbi napokról áthúzódó jelzés a megfigyelt időszakban továbbra is fennmaradt, de a rendelkezésre álló forrásokból a kiváltó okot és a háztartás működésére gyakorolt tényleges következményét nem lehet biztosan megállapítani. A részletekben minden rögzített megfigyelés külön visszanézhető.';
 if(options.focused){(completed.narrative as typeof completed.narrative & {headline?:string})={...completed.narrative,headline:'Parity-lemez hibajelzése után a szinkronizálás nulla jelzett hibával befejeződött.',summary:'Az array a nap egy részében leállított állapotot jelzett. Parity-lemez hibajelzése után a szinkronizálás nulla jelzett hibával befejeződött.'};}
 window.lumaAttentionPolicies={...window.lumaAttentionPolicies,report_demo:{version:1,revision:'demo',rules:[],backend:{policy_id:'demo'}}};
 const hass=createMockHass({"sensor.solar_live":{state:"2.4",attributes:{unit_of_measurement:"kWh"}},"sensor.consumption_live":{state:"10.78",attributes:{unit_of_measurement:"kWh"}}});
 hass.callService=async()=>{throw Error('Report card must not call services');};
 hass.callWS=async command=>{if(command.type!=='home_insights/report')throw Error('Unexpected command');if(options.forbidden)throw {code:'unauthorized'};if(options.offline)throw Error('Offline');return structuredClone(data) as never;};
 const report={...(options.nas?{nas_profile:'demo',title:'Tegnapi NAS-áttekintés'}:options.heating?{heating_profile:'demo',title:'Tegnapi kazánüzem'}:options.energy?{energy_profile:'demo',title:'Tegnapi energiamérleg'}:{policy:'report_demo',title:'Reggeli visszatekintés',household_path:'#household-context'})};
 return html`<div style="width:1000px;max-width:calc(100vw - 48px)">${options.hero?html`<luma-hero-card .hass=${hass} ${ref(node=>{if(node)(node as HTMLElement & LovelaceCard).setConfig({type:'custom:luma-hero-card',name:options.energy?'Energia':options.heating?'Fűtés és hűtés':options.nas?'Storage & Power':'Üzemeltetés',subtitle:'Élő állapot és vezérlők',chips_inline:!!options.energy,chips:options.energy?[{entity:'sensor.solar_live',name:'Mai termelés',show_state:true},{entity:'sensor.consumption_live',name:'Mai fogyasztás',show_state:true}]:[],icon:options.energy?'mdi:lightning-bolt':options.heating?'mdi:home-thermometer-outline':options.nas?'mdi:database':'mdi:wrench-cog',tap_action:{action:'navigate',navigation_path:'#overview'},report});})}></luma-hero-card>`:html`<luma-daily-report-card .hass=${hass} ${ref(node=>{if(node){(node as HTMLElement & LovelaceCard).setConfig({type:'custom:luma-daily-report-card',...report});if(options.detailsOpen)requestAnimationFrame(()=>node.shadowRoot?.querySelector<HTMLButtonElement>('.preview-button')?.click());}})}></luma-daily-report-card>`}</div>`;
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

export const HeatingWarm:Story={render:()=>scenario('attention_needed',{heating:true,warm:true})};

export const HeatingDetails:Story={render:()=>scenario('attention_needed',{heating:true,warm:true,detailsOpen:true})};
export const LongSummary:Story={render:()=>scenario('attention_needed',{long:true})};

export const Nas:Story={render:()=>scenario('no_anomaly_found',{nas:true})};
export const NasFindings:Story={render:()=>scenario('attention_needed',{nas:true})};
export const NasPartial:Story={render:()=>scenario('insufficient_data',{nas:true})};
export const NasEmpty:Story={render:()=>scenario('not_run',{nas:true})};
export const NasFailed:Story={render:()=>scenario('failed',{nas:true})};
export const RejectedAiResponse:Story={render:()=>scenario('failed',{rejected:true})};

export const NasOvernight:Story={render:()=>scenario('no_anomaly_found',{nas:true,overnight:true})};

export const HeroEnergy:Story={render:()=>scenario('attention_needed',{energy:true,hero:true})};
export const HeroHeating:Story={render:()=>scenario('no_anomaly_found',{heating:true,warm:true,hero:true})};
export const HeroNas:Story={render:()=>scenario('no_anomaly_found',{nas:true,overnight:true,hero:true})};
export const HeroOperations:Story={render:()=>scenario('attention_needed',{hero:true})};
export const HeroFailed:Story={render:()=>scenario('failed',{hero:true})};
export const HeroMissed:Story={render:()=>scenario('missed',{hero:true})};
export const HeroPartial:Story={render:()=>scenario('insufficient_data',{heating:true,hero:true})};
export const HeroRestricted:Story={render:()=>scenario('failed',{hero:true,forbidden:true})};

export const HeroNasFocused:Story={render:()=>scenario('attention_needed',{hero:true,nas:true,focused:true})};

export const OperationsContext:Story={render:()=>scenario('attention_needed',{operationsContext:true,hero:true})};
export const HandledSignals:Story={render:()=>scenario('no_action_needed')};
