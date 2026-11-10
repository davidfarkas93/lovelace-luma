import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import ts from 'typescript';
const {outputText}=ts.transpileModule(readFileSync(new URL('../src/daily-report.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}});
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
console.log('Daily report: policy/date/freshness contract, failed/missed/interrupted runs and previous-success separation passed.');
