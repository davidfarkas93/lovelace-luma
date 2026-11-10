export type ReportState='waiting'|'running'|'missed'|'stalled'|'failed'|'not_run'|'insufficient_data'|'attention_needed'|'no_anomaly_found'|'unavailable';
export interface ReportEvidence {ref:string;name:string;source?:string;category?:string;message?:string;present_at_period_start?:boolean;initial?:boolean;close_reason?:string|null}
export interface EnergyMetric {
 key:'solar'|'grid_import'|'grid_export'|'ev';name:string;source:string;value:number|null;unit:'kWh';status:string;
 statistics:{hours:number;expected_hours:number;reason:string|null};history:{status:string;boundary_states_known:boolean;unavailable_seconds:number};
 baseline:{status:string;days:number;requested_days:number;median:number|null};delta_kwh:number|null;delta_percent:number|null;deviation:string|null;
}
export interface EnergyProfile {deviation_percent:number;deviation_kwh:number}
export interface HeatingProfile {short_burn_seconds:number;minimum_short_cycles:number;mode_edge_seconds:number;rapid_pause_seconds?:number;rapid_start_interval_seconds?:number;warm_margin_celsius?:number;warm_window_seconds?:number;warm_short_burns_expected?:boolean;sources:{flame:string;heating:string;dhw:string;connectivity:string}}
export interface HeatingCycle {started_at:string|null;ended_at:string|null;observed_from:string;observed_until:string;complete:boolean;duration_seconds:number|null;mode:'heating'|'dhw'|'mixed'|'unclassified';reason:string;carried_into_day:boolean;previous_pause_seconds?:number|null;start_interval_seconds?:number|null;heating_feedback_continuous?:boolean|null;thermal_context?:'unknown'|'not_established'|'warm_operation';rapid_restart?:boolean;temperatures_at_start?:Partial<Record<'flow'|'return'|'target',{celsius:number;recorded_at:string}|null>>}
export interface HeatingCycles {analysis_version?:number;rapid_restart_sequences?:number;rapid_restart_burns?:number;warm_short_heating?:number;short_context_unknown?:number;short_other?:number;complete:number;heating:number;dhw:number;mixed:number;unclassified:number;censored:number;heating_median_seconds:number|null;heating_mean_seconds:number|null;heating_min_seconds:number|null;heating_max_seconds:number|null;short_heating:number|null;short_cycle_pattern:boolean;samples:HeatingCycle[];truncated:boolean}
export interface ReportFacts {
 scope?:string;metrics?:EnergyMetric[];profile?:EnergyProfile|HeatingProfile;
 burner?:{observed_ignitions:number|null;observed_seconds:number|null;counts_are_lower_bounds:boolean;carried_into_day:boolean};cycles?:HeatingCycles;unobserved_seconds?:number;mode_coverage_seconds?:number;
 observation_gaps?:{count:number;longest_seconds:number;intervals:{start:string;end:string;seconds:number}[];truncated:boolean};
 day:string;assessment:string;data_quality:string;coverage_seconds:number;window_seconds:number;coverage_percent:number;
 counts:Record<string,Record<string,number>>;availability?:{sources_with_gaps:number|null;whole_day_details:boolean};
 ai_evidence?:ReportEvidence[];limitations?:string[];
}
export interface ReportAttempt {id:string;day:string;started:number;finished:number|null;status:'running'|'failed'|'completed';ai_status:string;error?:string|null;facts:ReportFacts|null;narrative:{summary:string;hypothesis:string;suggested_check:string;evidence_refs:string[]}|null}
export interface DailyReport {schema_version:1;policy_id:string;energy_profile?:string|null;heating_profile?:string|null;timezone:string;expected_day:string;generated_at:number;due_at:number;state:ReportState;attempt:ReportAttempt|null;last_success:ReportAttempt|null;last_attempt?:{day:string;started:number}|null}
const states=new Set<ReportState>(['waiting','running','missed','stalled','failed','not_run','insufficient_data','attention_needed','no_anomaly_found']);
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
