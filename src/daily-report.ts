export type ReportState='waiting'|'running'|'missed'|'stalled'|'failed'|'not_run'|'insufficient_data'|'attention_needed'|'no_action_needed'|'no_anomaly_found'|'unavailable';
export interface ReportEvidence {history?:{previously_observed:boolean;first_observed_at:string;actual_fault_start_known:boolean};delivery_handling?:{status:string;at:string;source_repair_confirmed:boolean};group?:{observations:number;open_at_end:boolean;observed_clearance:boolean;snoozed_at_end:boolean};ref:string;name:string;source?:string;category?:string;message?:string;present_at_period_start?:boolean;initial?:boolean;close_reason?:string|null}
export interface EnergyMetric {
 key:'solar'|'grid_import'|'grid_export'|'ev';name:string;source:string;value:number|null;unit:'kWh';status:string;
 statistics:{hours:number;expected_hours:number;reason:string|null};history:{status:string;boundary_states_known:boolean;unavailable_seconds:number};
 baseline:{status:string;days:number;requested_days:number;median:number|null};delta_kwh:number|null;delta_percent:number|null;deviation:string|null;
}
export interface EnergyPlanning {
 day:string;timezone:string;saved_at:number;status:string;reason:string;forecast_kwh:number|null;remaining_kwh:number|null;peak_kw:number|null;peak_at:number|null;forecast_updated_at:number|null;minimum_charging_kw:number|null;valid_until:number|null;allow_grid_assist:boolean;surplus_known:boolean;charging_need_known:boolean;sources:Record<string,string>;thresholds:{minimum_remaining_kwh:number;minimum_peak_kw:number};
}
export interface TodayAdvice {day:string;saved_at:number;valid_until:number|null;status:string;headline:string;summary:string;limitation:string;evidence_refs:string[]}
export interface EnergyProfile {deviation_percent:number;deviation_kwh:number}
export interface HeatingProfile {short_burn_seconds:number;minimum_short_cycles:number;mode_edge_seconds:number;rapid_pause_seconds?:number;rapid_start_interval_seconds?:number;warm_margin_celsius?:number;warm_window_seconds?:number;warm_short_burns_expected?:boolean;sources:{flame:string;heating:string;dhw:string;connectivity:string}}
export interface HeatingCycle {started_at:string|null;ended_at:string|null;observed_from:string;observed_until:string;complete:boolean;duration_seconds:number|null;mode:'heating'|'dhw'|'mixed'|'unclassified';reason:string;carried_into_day:boolean;previous_pause_seconds?:number|null;start_interval_seconds?:number|null;heating_feedback_continuous?:boolean|null;thermal_context?:'unknown'|'not_established'|'warm_operation';rapid_restart?:boolean;temperatures_at_start?:Partial<Record<'flow'|'return'|'target',{celsius:number;recorded_at:string}|null>>}
export interface HeatingCycles {analysis_version?:number;rapid_restart_sequences?:number;rapid_restart_burns?:number;warm_short_heating?:number;short_context_unknown?:number;short_other?:number;complete:number;heating:number;dhw:number;mixed:number;unclassified:number;censored:number;heating_median_seconds:number|null;heating_mean_seconds:number|null;heating_min_seconds:number|null;heating_max_seconds:number|null;short_heating:number|null;short_cycle_pattern:boolean;samples:HeatingCycle[];truncated:boolean}
export interface NasTimeline {start:string;end:string;sources:string[];events:{source:string;id:string;at:string;observed_at:string;code:string;label:string;subject:string;importance:string;attention:boolean}[];attention:boolean;truncated:boolean;invalid_events:number}
export interface NasProfile {minimum_hot_seconds:number}
export interface NasSignal {source:string;known_seconds:number;active_seconds:number;inactive_seconds:number;observed_starts:number}
export interface NasDisk {id:string;name:string;source:string;health_source:string;warn_celsius:number;maximum_celsius:number|null;maximum_recorded_at:string|null;known_seconds:number;standby_seconds:number;health_known_seconds:number;health_problem_seconds:number;hot_seconds:number;longest_hot_seconds:number;sustained_hot:boolean}
export interface ReportDiagnostics {schema_version:number;stage:string;reason:string;detail:string;candidate_json:string;candidate_truncated:boolean;allowed_evidence_refs:string[]}
export interface ReportFacts {
 today_planning?:EnergyPlanning;
 report_overview?:{sources_requiring_review:number;sources_observed_cleared:number;sources_snoozed_at_end:number;notification_sources_handled:number;previously_observed_sources:number};
 observation_scope?:{observer_unobserved_seconds:number;source_incomplete_seconds:number;complete_day_verdict_possible:boolean;findings_are_observed_only:boolean;automation_trace_audit:string};
 solar_forecast?:{source:string;status:string;value_kwh:number|null;cutoff_at:string;recorded_at:string|null;comparison_basis:string};notifications?:NasTimeline;since_midnight?:NasTimeline;scope?:string;metrics?:EnergyMetric[];profile?:EnergyProfile|HeatingProfile|NasProfile;
 burner?:{observed_ignitions:number|null;observed_seconds:number|null;counts_are_lower_bounds:boolean;carried_into_day:boolean};cycles?:HeatingCycles;unobserved_seconds?:number;mode_coverage_seconds?:number;
 observation_gaps?:{count:number;longest_seconds:number;intervals:{start:string;end:string;seconds:number}[];truncated:boolean};
 signals?:Record<'array_running'|'parity_problem'|'parity_running'|'ups_status',NasSignal>;disks?:NasDisk[];problem_sources?:{source:string;known_seconds:number;active_seconds:number}[];ups_warning_flags?:string[];ups_observed_flags?:string[];ups_battery_periods?:{start:string;end:string;seconds:number}[];ups_battery_periods_truncated?:boolean;parity_max_reported_errors?:number|null;counts_are_lower_bounds?:boolean;
 day:string;assessment:string;data_quality:string;coverage_seconds:number;window_seconds:number;coverage_percent:number;
 counts:Record<string,Record<string,number>>;availability?:{sources_with_gaps:number|null;whole_day_details:boolean};
 ai_evidence?:ReportEvidence[];limitations?:string[];
}
export interface ReportAttempt {id:string;day:string;started:number;finished:number|null;status:'running'|'failed'|'completed';ai_status:string;error?:string|null;diagnostics?:ReportDiagnostics|null;facts:ReportFacts|null;narrative:{today?:TodayAdvice;observation_note?:string;headline?:string;summary_since_midnight?:string;summary:string;hypothesis:string;suggested_check:string;evidence_refs:string[]}|null}
export interface DailyReport {schema_version:1;policy_id:string;energy_profile?:string|null;heating_profile?:string|null;nas_profile?:string|null;timezone:string;expected_day:string;generated_at:number;due_at:number;state:ReportState;attempt:ReportAttempt|null;last_success:ReportAttempt|null;last_attempt?:{day:string;started:number}|null}
const states=new Set<ReportState>(['waiting','running','missed','stalled','failed','not_run','insufficient_data','attention_needed','no_action_needed','no_anomaly_found']);
/** Keep a complete sentence, including its qualifier; details retain the full narrative. */
export function reportSummaryPreview(summary:string,language='en',partialQualifierVisible=false):string{
 let text=summary.trim();
 // These are backend-owned disclaimers, shown separately as an explicit badge.
 // Never drop an arbitrary first sentence or remove the only available message.
 if(partialQualifierVisible){
  for(const prefix of ['A NAS megfigyelése hiányos volt.','A fűtési visszajelzések megfigyelése hiányos volt.','A napi energiaadatok vagy az összehasonlítás hiányosak.','Az előző nap csak részben volt megfigyelve.']){
   if(text.startsWith(prefix)&&text.slice(prefix.length).trim())text=text.slice(prefix.length).trim();
  }
 }
 if(typeof Intl.Segmenter!=='function')return text;
 return [...new Intl.Segmenter(language,{granularity:'sentence'}).segment(text)][0]?.segment.trim()||text;
}
/** A separate backend focus survives detail ordering; legacy reports keep their observed-scope qualifier. */
export function reportHeadline(narrative:NonNullable<ReportAttempt['narrative']>,language='en'):string{
 const headline=narrative.headline?.trim();
 return headline&&headline.length<=500?headline:reportSummaryPreview(narrative.summary,language,true);
}
export function validDailyReport(data:DailyReport,policy:string,now=Date.now()):boolean{
 return data?.schema_version===1&&data.policy_id===policy&&states.has(data.state)&&Number.isFinite(data.generated_at)&&now-data.generated_at*1000<=45000&&data.generated_at*1000<=now+10000&&/^\d{4}-\d{2}-\d{2}$/.test(data.expected_day)&&(!data.attempt||data.attempt.day===data.expected_day);
}
export function dailyReportView(data:DailyReport|undefined,error=false,now=Date.now()){
 const unavailable=error||!data||now-data.generated_at*1000>45000;
 const state:ReportState=unavailable?'unavailable':data.state;
 const current=!unavailable&&data?.attempt?.day===data?.expected_day?data.attempt:null;
 const report=current?.status==='completed'?current:null;
 const previous=data?.last_success?.id!==report?.id?data?.last_success:null;
 return {state,current,report,previous,tone:['failed','missed','stalled','unavailable'].includes(state)?'error':state==='no_anomaly_found'?current?.facts?.data_quality==='minor_gaps'?'primary':'success':['attention_needed','insufficient_data','not_run'].includes(state)?'warning':'primary'};
}

/** A dated forecast snapshot is actionable only inside its explicit validity window. */
export function currentTodayAdvice(advice:TodayAdvice|undefined,zone:string,now=Date.now()):TodayAdvice|undefined{
 if(!advice||advice.status!=='opportunity'||!advice.headline?.trim()||advice.headline.length>500||!Number.isFinite(advice.saved_at)||!Number.isFinite(advice.valid_until)||advice.saved_at*1000>now+10000||advice.valid_until!*1000<=now||advice.valid_until!<=advice.saved_at||advice.valid_until!-advice.saved_at>12*3600)return;
 try{
  const date=(at:number)=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(at));return ['year','month','day'].map(k=>parts.find(p=>p.type===k)?.value).join('-');};
  if(advice.day!==date(now)||advice.day!==date(advice.saved_at*1000))return;
 }catch{return;}
 return advice;
}
