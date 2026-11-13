import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import ts from 'typescript';
const {outputText}=ts.transpileModule(readFileSync(new URL('../src/daily-report.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
const exports={};vm.runInNewContext(outputText,{exports,Date,Set});
const now=Date.now(),attempt={id:'latest',day:'2026-11-09',status:'completed',narrative:{summary:'Current'}};
const data={schema_version:1,policy_id:'home',expected_day:'2026-11-09',generated_at:now/1000,state:'no_anomaly_found',attempt,last_success:attempt};
assert.ok(exports.validDailyReport(data,'home',now));assert.equal(exports.dailyReportView(data,false,now).tone,'success');
assert.equal(exports.validDailyReport({...data,generated_at:now/1000-46},'home',now),false);
assert.equal(exports.validDailyReport(data,'other',now),false);
assert.equal(exports.validDailyReport({...data,attempt:{...attempt,day:'2026-11-08'}},'home',now),false);
for(const state of ['failed','missed','stalled']){const view=exports.dailyReportView({...data,state,attempt:state==='failed'?{...attempt,status:'failed',narrative:null}:null},false,now);assert.equal(view.report,null);assert.equal(view.previous.id,'latest');assert.equal(view.tone,'error');}
assert.equal(exports.dailyReportView(data,true,now).report,null,'transport failure cannot show an old success as current');
assert.equal(exports.dailyReportView({...data,generated_at:now/1000-46},false,now).state,'unavailable');
assert.ok(exports.validDailyReport({...data,policy_id:'energy:demo',energy_profile:'demo'},'energy:demo',now));
assert.equal(exports.validDailyReport({...data,policy_id:'energy:demo'},'home',now),false,'energy and attention snapshots cannot share a report scope');
assert.ok(exports.validDailyReport({...data,policy_id:'heating:demo',heating_profile:'demo'},'heating:demo',now));
assert.equal(exports.validDailyReport({...data,policy_id:'heating:demo'},'energy:demo',now),false);
assert.equal(exports.dailyReportView({...data,attempt:{...attempt,facts:{data_quality:'minor_gaps'}}},false,now).tone,'primary','brief gaps stay visible without a whole-day success or warning tint');
assert.equal(exports.reportSummaryPreview('A termelés 4.63 kWh volt. A különbség oka nem ismert.','hu'),'A termelés 4.63 kWh volt.','a decimal point must not cut off a measured statement');
assert.equal(exports.reportSummaryPreview('A megfigyelt égésekben nem látszott gyors újraindulás. Meleg előzmény is volt.','hu'),'A megfigyelt égésekben nem látszott gyors újraindulás.','the observed-scope qualifier remains in the preview');
assert.equal(exports.reportSummaryPreview('A fűtési visszajelzések megfigyelése hiányos volt. A megfigyelt égésekben nem volt gyors újraindulás.','hu',true),'A megfigyelt égésekben nem volt gyors újraindulás.','a separate partial-data qualifier leaves room for the actual daily finding');
assert.equal(exports.reportSummaryPreview('A fűtési visszajelzések megfigyelése hiányos volt. A megfigyelt égésekben nem volt gyors újraindulás.','hu'),'A fűtési visszajelzések megfigyelése hiányos volt.','the qualifier cannot disappear unless explicitly shown elsewhere');
assert.equal(exports.reportSummaryPreview('A fűtési visszajelzések megfigyelése hiányos volt.','hu',true),'A fűtési visszajelzések megfigyelése hiányos volt.');
console.log('Daily report: policy/date/freshness contract, failed/missed/interrupted runs and previous-success separation passed.');

assert.ok(exports.validDailyReport({...data,policy_id:'nas:demo',nas_profile:'demo'},'nas:demo',now));
assert.equal(exports.validDailyReport({...data,policy_id:'nas:demo'},'heating:demo',now),false);
assert.equal(exports.reportSummaryPreview('A NAS megfigyelése hiányos volt. Az UPS jelzést adott.','hu',true),'Az UPS jelzést adott.');
assert.equal(exports.reportHeadline({summary:'Az array röviden leállt.',headline:'A parity ellenőrzés befejeződött.'},'hu'),'A parity ellenőrzés befejeződött.','the report focus is independent of detail ordering');
assert.equal(exports.reportHeadline({summary:'A NAS megfigyelése hiányos volt. A megfigyelt időszakban az UPS jelzést adott.'},'hu'),'A megfigyelt időszakban az UPS jelzést adott.','legacy reports retain the observed-scope qualifier');
assert.equal(exports.reportHeadline({summary:'A megfigyelt időszakban nem volt gyors újraindulás.',headline:'x'.repeat(501)},'hu'),'A megfigyelt időszakban nem volt gyors újraindulás.','an oversized focus falls back to a bounded sentence');

assert.ok(exports.validDailyReport({...data,state:'no_action_needed'},'home',now));
assert.equal(exports.dailyReportView({...data,state:'no_action_needed'},false,now).tone,'primary','handled signals are not an all-clear or an active fault');
