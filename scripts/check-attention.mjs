import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
let clock=Date.parse('2026-11-01T12:00:00Z');
class ClockDate extends Date {static now(){return clock}}
const compile=(file,require,extras={})=>{
 const {outputText}=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 const exports={};vm.runInNewContext(outputText,{exports,require,Date:ClockDate,console,...extras});return exports;
};
const matcher=compile('../src/incidents.ts',()=>{});
const localize=compile('../src/localize.ts',()=>{});
const household=compile('../src/household-context.ts',()=>{});
const model=compile('../src/attention.ts',name=>name==='./localize'?localize:name==='./household-context'?household:matcher);
const entity=(id,state,attributes={})=>({entity_id:id,state,attributes,last_changed:new Date(clock-600000).toISOString(),last_updated:new Date(clock).toISOString()});
const hass={states:{},entities:{},locale:{language:'hu'},callService:async()=>{throw Error('Unexpected service call')}};
function add(id,state,platform,attributes={}){hass.states[id]=entity(id,state,attributes);hass.entities[id]={platform};return hass.states[id]}
add('input_text.ack','', 'input_text');
add('sensor.host_alerts','ServerMem','komodo');
add('sensor.clear_alerts','','komodo');
add('binary_sensor.boiler_fault','on','mqtt',{device_class:'problem'});
add('binary_sensor.rain','on','esphome',{device_class:'moisture'});
add('sensor.temp','44','test');
add('sensor.watched','on','test');
add('update.shelly_new','on','shelly',{installed_version:'1',latest_version:'2'});
add('update.unknown_vendor','on','future_integration',{installed_version:'1',latest_version:'2'});
add('update.missing','unavailable','esphome');
add('update.restored','on','old',{restored:true});
add('update.disabled','on','old');hass.entities['update.disabled'].disabled_by='user';
add('update.hidden','on','shelly');hass.entities['update.hidden'].hidden_by='user';
add('update.installing','off','hacs',{in_progress:0,latest_version:'3'});
const policy={version:1,revision:'test',acknowledgements_entity:'input_text.ack',ignore_labels:['ignore'],problems:{enabled:true},updates:{enabled:true,groups:[{id:'firmware',name:'Firmware',platforms:['shelly','esphome']}]},rules:[
 {id:'komodo',entity_pattern:'sensor.*_alerts',platform:'komodo',state_not:['','0','none','unknown','unavailable'],message:'{count} Komodo',aggregate:true},
 {id:'temp-warning',entity:'sensor.temp',above:42,below:45,message:'Warm',identity:'condition'},
 {id:'temp-critical',entity:'sensor.temp',above:44.999,message:'Hot',tone:'error'},
 {id:'grace',entity:'sensor.watched',state:'on',for_minutes:15,message:'Persistent'},
 {id:'not-present',entity:'sensor.not_present',above:5,message:'Missing source'},
],adapters:{notifications:true,repairs:true,integrations:true,events:['event.notifications']}};
assert.equal(model.attentionPolicyErrors(policy).length,0);
assert.ok(model.attentionPolicyErrors({...policy,rules:[policy.rules[0],policy.rules[0]]}).length>0);
let rows=model.attentionSnapshot(hass,policy,{},clock),get=id=>rows.find(x=>x.source===id);
assert.equal(get('update.shelly_new').status,'active');assert.equal(get('update.unknown_vendor').category,'other_updates');
assert.equal(get('update.missing').status,'unavailable');assert.equal(get('update.restored').status,'excluded');
assert.equal(get('update.disabled').status,'excluded');assert.equal(get('update.hidden').status,'active','UI hiding must not silently opt out of monitoring');
assert.equal(get('update.installing').status,'installing','0% is in progress');
assert.equal(model.updateCanInstall(entity('update.test','on',{supported_features:23,latest_version:'2.0'})),true);
for(const attributes of [{supported_features:16,latest_version:'2.0'},{supported_features:1,latest_version:'2.0',in_progress:0},{supported_features:1,latest_version:'2.0',restored:true},{supported_features:1}])assert.equal(model.updateCanInstall(entity('update.test','on',attributes)),false,'only a known, install-capable target may offer installation');
assert.equal(model.updateCanInstall(entity('update.test','unavailable',{supported_features:1,latest_version:'2.0'})),false);

assert.equal(get('binary_sensor.boiler_fault').status,'active');assert.equal(get('binary_sensor.rain'),undefined,'rain is not an automatically discovered fault');
assert.equal(get('sensor.not_present').status,'unavailable');assert.equal(get('sensor.watched').status,'pending');
assert.equal(get('sensor.clear_alerts').status,'inactive','an explicitly clear empty alert string is not missing telemetry');
const gapRows=['backup','photos'].flatMap(source=>['warning','critical'].map(rule=>({...get('sensor.not_present'),id:`${rule}:${source}`,source,rule,message:'Certificate expires soon'})));
gapRows.push(get('update.missing'));
const gapView=model.attentionCoverageRows(gapRows,hass);
assert.equal(gapView.filter(x=>x.status==='unavailable').length,3,'five failed rule evaluations must show three unavailable sources');
assert.deepEqual([...gapView[0].affectedRules],['warning','critical'],'merged sources retain every affected rule');
assert.equal(gapView[0].message,'Nincs megbízható állapotadat','missing telemetry must not assert a critical certificate expiry');
assert.equal(gapView.find(x=>x.kind==='update').message,get('update.missing').message,'update category labels must survive unavailable grouping');
assert.equal(gapRows[0].affectedRules,undefined,'presentation grouping must not mutate the rule snapshot');
assert.equal(model.attentionCoverageRows([get('update.shelly_new'),get('update.shelly_new')],hass).length,2,'active alerts retain their existing grouping semantics');
clock+=6*60000;rows=model.attentionSnapshot(hass,policy,{},clock);assert.equal(get('sensor.watched').status,'active','deadline progresses without a source change');
let grouped=model.groupAttention(rows,policy,hass,clock),old=grouped.find(x=>x.source==='sensor.host_alerts');
hass.states['input_text.ack'].state=`${old.key}:${Math.round(clock/1000+86400)}`;
grouped=model.groupAttention(model.attentionSnapshot(hass,policy,{},clock),policy,hass,clock);
assert.ok(grouped.find(x=>x.source==='sensor.host_alerts').snoozedUntil);
hass.states['sensor.host_alerts']=entity('sensor.host_alerts','DiskFull');
grouped=model.groupAttention(model.attentionSnapshot(hass,policy,{},clock),policy,hass,clock);
assert.equal(grouped.find(x=>x.source==='sensor.host_alerts').snoozedUntil,undefined,'changed error on the same entity wakes the alert');
const updateBefore=grouped.find(x=>x.source==='update.shelly_new');hass.states['input_text.ack'].state=`${updateBefore.key}:${clock/1000+86400}`;
hass.states['update.shelly_new'].attributes.latest_version='4';
grouped=model.groupAttention(model.attentionSnapshot(hass,policy,{},clock),policy,hass,clock);
assert.equal(grouped.find(x=>x.source==='update.shelly_new').snoozedUntil,undefined,'new firmware version wakes a group');
hass.states['sensor.temp'].state='46';rows=model.attentionSnapshot(hass,policy,{},clock);
assert.equal(rows.find(x=>x.rule==='temp-warning').status,'inactive');assert.equal(rows.find(x=>x.rule==='temp-critical').tone,'error');
let ext={notifications:[{notification_id:'robot-warning',title:'Robot',message:'Camera warning',created_at:'2026-11-01T10:00:00Z'}],repairs:{issues:[{domain:'test',issue_id:'needs-repair',severity:'error'}]},integrations:[{entry_id:'1',domain:'bluetooth',title:'Adapter',state:'setup_retry'},{entry_id:'2',domain:'test',title:'Disabled',state:'setup_error',disabled_by:'user'},{entry_id:'3',domain:'test',title:'Not loaded',state:'not_loaded'}]};
rows=model.attentionSnapshot(hass,policy,ext,clock);
assert.equal(rows.filter(x=>x.kind==='notification').length,1);assert.equal(rows.filter(x=>x.kind==='repair').length,1);assert.equal(rows.filter(x=>x.kind==='integration').length,1);
assert.equal(rows.find(x=>x.kind==='notification').notificationId,'robot-warning');
assert.equal(rows.find(x=>x.kind==='notification').dismissible,false,'native notifications must not offer a Luma-only snooze');
assert.equal(rows.find(x=>x.source==='event.notifications').status,'unavailable');
rows=model.attentionSnapshot(hass,{...policy,adapters:{}},ext,clock);assert.equal(rows.filter(x=>['notification','repair','integration'].includes(x.kind)).length,0,'adapters must be explicitly enabled per policy');
const max=model.attentionAckValue('', 'a123',clock/1000+100,clock/1000,255);assert.match(max,/^a123:/);
assert.equal(model.attentionAckValue(max,'a123',null,clock/1000),'');
assert.ok(model.attentionAckValue(Array.from({length:30},(_,i)=>`akey${i}:${clock/1000+100}`).join(','),'new',clock/1000+200,clock/1000,255).length<=255);
clock+=2*86400000;grouped=model.groupAttention(model.attentionSnapshot(hass,policy,{},clock),policy,hass,clock);assert.ok(grouped.every(x=>!x.snoozedUntil),'expiry reevaluates without an entity transition');
const storage=new Map();const listeners={};let interval;
const win={lumaAttentionPolicies:{test:policy},setInterval:fn=>{interval=fn;return 1},addEventListener:(name,fn)=>{listeners[name]=fn},removeEventListener:()=>{}};
const runtime=compile('../src/attention-runtime.ts',()=>model,{window:win,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},clearInterval:()=>{}});
hass.callWS=async ({type})=>type==='config/entity_registry/list' ? Object.entries(hass.entities).map(([entity_id,row])=>({entity_id,...row})) : type==='repairs/list_issues' ? {issues:[]} : [];
const settle=async()=>{for(let i=0;i<30;i++)await Promise.resolve()};
const prime=async(runtime,source)=>{const watcher=new runtime.AttentionSubscription(()=>{});watcher.update(source,'test');watcher.connect();await settle();watcher.disconnect()};
await prime(runtime,hass);
const before=runtime.policyRows('test',hass).find(x=>x.rule==='temp-critical').key;
const secondRuntime=compile('../src/attention-runtime.ts',()=>model,{window:win,localStorage:{getItem:()=>null,setItem:()=>{}},clearInterval:()=>{}});
clock+=1000;
await prime(secondRuntime,hass);
assert.equal(secondRuntime.policyRows('test',hass).find(x=>x.rule==='temp-critical').key,before,'first observation identity is shared across browsers');
hass.states['sensor.temp']=entity('sensor.temp','40');clock+=16000;runtime.policyRows('test',{...hass});
hass.states['sensor.temp']=entity('sensor.temp','46');clock+=16000;const after=runtime.policyRows('test',{...hass}).find(x=>x.rule==='temp-critical').key;
assert.notEqual(before,after,'an observed threshold recovery starts a new episode');
assert.equal(runtime.policyRows('missing',hass)[0].reason,'policy_unavailable');
let ticks=0;const sub=new runtime.AttentionSubscription(()=>ticks++);sub.connect();interval();assert.equal(ticks,1);sub.disconnect();
const contextPolicy={...policy,rules:[{...policy.rules[0],aggregate:false,message:'{name}: {value}',state_labels:{ServerDisk:'High disk usage',ServerMem:'High memory usage'},context:[
 {label:'Mount',value:'/var/lib/docker',source:'sensor.host_alerts',states:['ServerDisk']},
 {label:'Used',entity_pattern:'sensor.*_disk_usage',states:['ServerDisk'],decimals:1},
 {label:'Free',entity_pattern:'sensor.*_disk_free',states:['ServerDisk']},
]}]};
hass.states['sensor.host_alerts']=entity('sensor.host_alerts','ServerDisk, FutureAlert');hass.entities['sensor.host_alerts'].device_id='host-a';
add('sensor.other_disk_usage','99','komodo');hass.entities['sensor.other_disk_usage'].device_id='host-b';
add('sensor.host_disk_usage','83.94','komodo',{unit_of_measurement:'%'});hass.entities['sensor.host_disk_usage'].device_id='host-a';
let detail=model.attentionSnapshot(hass,contextPolicy,{},clock).find(x=>x.source==='sensor.host_alerts');
assert.match(detail.message,/High disk usage · FutureAlert/,'known codes are explained and unknown codes remain visible');
assert.equal(detail.context[1].entity,'sensor.host_disk_usage','context never borrows another server metric');
assert.equal(detail.context[1].value,'83,9 %');assert.equal(detail.context[2].value,'Nincs adat');
assert.equal(detail.sourceState,'ServerDisk, FutureAlert');
const noRegistry=model.attentionSnapshot({...hass,entities:{}},contextPolicy,{},clock).find(x=>x.source==='sensor.host_alerts');
assert.equal(noRegistry,undefined,'platform discovery needs registry metadata');
assert.ok(model.attentionPolicyErrors({...contextPolicy,rules:[{...contextPolicy.rules[0],context:[{label:'Bad',entity:'a',value:'b'}]}]}).length);
let notices=[{notification_id:'robot-warning',title:'Robot',message:'Camera warning'},{notification_id:'keep',title:'Keep',message:'Unrelated'}];
const oldNotices=[...notices],calls=[];let resolveOld,reads=0;
const nativeHass={...hass,callService:async(...args)=>{calls.push(args);notices=notices.filter(n=>n.notification_id!==args[2].notification_id)},callWS:async({type})=>{
 if(type==='persistent_notification/get'){reads++;return reads===1?new Promise(resolve=>resolveOld=resolve):[...notices]}
 return type==='repairs/list_issues'?{issues:[]}:[];
}};
const nativeRuntime=compile('../src/attention-runtime.ts',()=>model,{window:win,localStorage:{getItem:()=>null,setItem:()=>{}},clearInterval:()=>{}});
const watcher=new nativeRuntime.AttentionSubscription(()=>{});watcher.update(nativeHass,'test');watcher.connect();
assert.equal(reads,1);
await nativeRuntime.dismissAttentionNotification(nativeHass,'robot-warning');
assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),['persistent_notification','dismiss',{notification_id:'robot-warning'}]);
resolveOld(oldNotices);for(let i=0;i<8;i++)await Promise.resolve();
let nativeRows=nativeRuntime.policyRows('test',nativeHass).filter(x=>x.kind==='notification');
assert.deepEqual([...nativeRows.map(x=>x.notificationId)],['keep'],'a stale in-flight read must not resurrect a dismissed notice');
await assert.rejects(nativeRuntime.dismissAttentionNotification({...nativeHass,callService:async()=>{throw Error('Denied')}},'keep'));
assert.equal(nativeRuntime.policyRows('test',nativeHass).filter(x=>x.kind==='notification').length,1,'failed dismissal leaves the notice visible');
await assert.rejects(nativeRuntime.dismissAttentionNotification(nativeHass,''));watcher.disconnect();
// Registry readiness: the actual three ignored certificate pattern must never
// turn an unhydrated frontend into three source failures.
const certHass={...hass,states:{},entities:{}};
for(const name of ['backup','photos','internal']){const id=`sensor.${name}_certificate`;certHass.states[id]=entity(id,'unknown');certHass.entities[id]={labels:['ignore']};}
const certPolicy={version:1,revision:'readiness',ignore_labels:['ignore'],rules:Object.keys(certHass.states).map((entity,i)=>({id:`cert-${i}`,entity,below:7,message:'Expired'}))};
for(const entities of [undefined,{}]){
 const pending=model.attentionSnapshot({...certHass,entities},certPolicy,{},clock);
 assert.equal(pending.filter(row=>row.status==='unavailable').length,0);
 assert.equal(pending.filter(row=>row.status==='loading').length,1);
 assert.equal(model.attentionOverview(pending,hass).loading,true);
}
rows=model.attentionSnapshot({...certHass,entities:{}},certPolicy,{registry:certHass.entities,readiness:{registry:'ready'}},clock);
assert.ok(rows.every(row=>row.status==='excluded'),'late registry labels must be applied before claiming gaps');
rows=model.attentionSnapshot(certHass,certPolicy,{readiness:{registry:'error'}},clock);
assert.equal(rows.length,1);assert.equal(rows[0].reason,'metadata_unavailable');
rows=model.attentionSnapshot({...certHass,entities:{}},certPolicy,{registry:{},readiness:{registry:'ready'}},clock);
assert.equal(rows.length,3,'a successful empty response differs from a registry that never loaded');
rows=model.attentionSnapshot(hass,policy,{readiness:{registry:'ready',repairs:'loading'}},clock);
assert.equal(rows.find(row=>row.source==='adapter:repairs').status,'loading');
assert.equal(model.attentionOverview(rows,hass).loading,true);
rows=model.attentionSnapshot(hass,policy,{registry:hass.entities,readiness:{registry:'error'}},clock);
assert.ok(rows.some(row=>row.source==='binary_sensor.boiler_fault'&&row.status==='active'),'a failed metadata refresh cannot hide a known safety fault');
assert.ok(rows.some(row=>row.source==='registry'&&row.status==='unavailable'),'cached metadata still exposes incomplete coverage');
// Human Repairs: supported translations and placeholders, not source codes.
const repairExternal={repairs:{issues:[{domain:'marketplace',issue_id:'restart',translation_key:'restart_required',translation_placeholders:{name:'Komodo Integration'}}]},repairTranslations:{'component.marketplace.issues.restart_required.title':'Restart required: {name}','component.marketplace.issues.restart_required.description':'Restart to finish installing {name}.'}};
const repair=model.attentionSnapshot(hass,policy,repairExternal,clock).find(row=>row.kind==='repair');
assert.equal(repair.name,'Restart required: Komodo Integration');assert.match(repair.message,/installing Komodo Integration/);assert.equal(repair.sourceState,'restart_required');
// Explicit task correlation preserves independent notifications and task state.
const taskPolicy={version:1,revision:'tasks',rules:[{id:'plant-task',entity:'input_boolean.plants',state:'on',message:'Check plants',notification_ids:['plants-due'],completion:{label:'Watered',confirmation:'Record watering?',action:{action:'perform-action',perform_action:'input_button.press',target:{entity_id:'input_button.watered'}}}}],adapters:{notifications:true}};
const taskHass={...hass,states:{...hass.states,'input_boolean.plants':entity('input_boolean.plants','on')}};
const taskExt={notifications:[{notification_id:'plants-due',title:'Plants need water',message:'Due after 14 days in winter at this temperature.'},{notification_id:'other-task',title:'Plants need water',message:'An independent task with the same text.'}]};
rows=model.attentionSnapshot(taskHass,taskPolicy,taskExt,clock);
assert.equal(model.activeAttention(rows).length,2);assert.equal(rows.find(row=>row.rule==='plant-task').relatedNotifications.length,1);assert.match(rows.find(row=>row.rule==='plant-task').context[0].value,/winter/);
rows=model.attentionSnapshot(taskHass,taskPolicy,{notifications:taskExt.notifications.slice(1)},clock);
assert.equal(rows.find(row=>row.rule==='plant-task').status,'active','removing a channel never resolves the task');
rows=model.attentionSnapshot({...taskHass,states:{...taskHass.states,'input_boolean.plants':entity('input_boolean.plants','off')}},taskPolicy,taskExt,clock);
assert.equal(rows.find(row=>row.notificationId==='plants-due').status,'active','a stale channel is not silently hidden behind an inactive task');
assert.ok(model.attentionPolicyErrors({...taskPolicy,rules:[...taskPolicy.rules,{...taskPolicy.rules[0],id:'duplicate-channel'}]}).length);
// One update retains its actual name/version. Multiple members stay discoverable.
const updatePolicy={version:1,revision:'updates',rules:[],updates:{enabled:true,groups:[{id:'software',name:'Applications',platforms:['marketplace']}]}};
const updateHass={...hass,states:{'update.first':entity('update.first','on',{friendly_name:'Weather.com',installed_version:'1.4.1',latest_version:'2.0.0'})},entities:{'update.first':{platform:'marketplace'}}};
let updateRows=model.groupAttention(model.attentionSnapshot(updateHass,updatePolicy,{},clock),updatePolicy,updateHass,clock);
assert.equal(model.attentionSummaries(updateRows)[0].name,'Weather.com');assert.equal(model.attentionSummaries(updateRows)[0].message,'1.4.1 → 2.0.0');
updateHass.states['update.second']=entity('update.second','on',{friendly_name:'Camera',latest_version:'8.2'});updateHass.entities['update.second']={platform:'marketplace'};
updateRows=model.groupAttention(model.attentionSnapshot(updateHass,updatePolicy,{},clock),updatePolicy,updateHass,clock);
assert.equal(model.attentionSummaries(updateRows).length,1);assert.equal(model.attentionOverview(updateRows,hass).updates,2);assert.equal(model.attentionOverview(updateRows,hass).issues,0);
assert.match(model.attentionSummaries(updateRows)[0].message,/2 összetevő/);
// A delayed registry and delayed/failed adapters must remain incomplete.
let deliverRegistry,deliverRepairs;
const delayedHass={...hass,entities:{},callWS:async({type})=>type==='config/entity_registry/list'?new Promise(resolve=>deliverRegistry=resolve):type==='repairs/list_issues'?new Promise(resolve=>deliverRepairs=resolve):[]};
const delayedRuntime=compile('../src/attention-runtime.ts',()=>model,{window:win,localStorage:{getItem:()=>null,setItem:()=>{}},clearInterval:()=>{}});
const delayedWatcher=new delayedRuntime.AttentionSubscription(()=>{});delayedWatcher.update(delayedHass,'test');delayedWatcher.connect();
assert.equal(delayedRuntime.policyRows('test',delayedHass)[0].status,'loading');
deliverRegistry(Object.entries(hass.entities).map(([entity_id,row])=>({entity_id,...row})));await settle();
assert.ok(delayedRuntime.policyRows('test',delayedHass).some(row=>row.source==='adapter:repairs'&&row.status==='loading'));
deliverRepairs({issues:[]});await settle();assert.ok(!delayedRuntime.policyRows('test',delayedHass).some(row=>row.status==='loading'));delayedWatcher.disconnect();
const failedHass={...hass,callWS:async()=>{throw Error('denied')}};
await prime(delayedRuntime,failedHass);assert.equal(delayedRuntime.policyRows('test',failedHass)[0].status,'unavailable');
const appliance=compile('../src/appliance.ts',()=>{});
const timestamp=entity('sensor.finish','2026-11-09T16:21:00Z',{device_class:'timestamp'});
const twelve=appliance.applianceFinishTime(timestamp,{locale:{language:'en-US',time_format:'12'}});
const twentyFour=appliance.applianceFinishTime(timestamp,{locale:{language:'hu',time_format:'24'}});
assert.match(twelve,/AM|PM/);assert.ok(twelve.includes('\u00a0'),'12-hour suffix must stay attached on mobile');
assert.doesNotMatch(twentyFour,/AM|PM/);assert.equal(appliance.applianceDuration(1800,{locale:{language:'en'}}),'30 min');assert.equal(appliance.applianceDuration(1800,{locale:{language:'hu'}}),'30 p');
console.log('Attention: discovery, metadata, fault semantics, grace, per-source/version identity, recurrence, snooze expiry, adapter gating, missing policy and storage bounds passed.');

// A configured backend owns conditions. No client-side fallback, including on failure.
const binding={policy_id:'shared',health_entity:'sensor.journal'};
const serverPolicy={version:1,revision:'server.1',rules:[]};
const backendWin={...win,lumaAttentionPolicies:{shared:{...serverPolicy,backend:binding,rules:[{id:'must-not-run',entity:'sensor.client',state:'on',message:'Client evaluator ran'}]}}};
let failBackend=false;const backendCalls=[];
const backHass={states:{'sensor.client':entity('sensor.client','on'),'sensor.journal':entity('sensor.journal','recording',{event_count:1})},entities:{},locale:{language:'hu'},connection:{},callService:async()=>{},callWS:async command=>{
 backendCalls.push(command);assert.equal(command.type,'home_insights/attention');if(failBackend)throw Error('Offline');
 return {schema_version:1,policy_id:'shared',policy_hash:'testhash',policy_revision:'server.1',generated_at:clock,rows:[{id:'server:source',key:'server-key',rule:'server',source:'sensor.source',name:'Server result',message:'Observed',scope:'home',category:'home',kind:'incident',status:'active',reason:'condition_met',tone:'warning',dismissible:true}],policy:serverPolicy};
}};
const backRuntime=compile('../src/attention-runtime.ts',name=>name==='./localize'?localize:name==='./household-context'?household:model,{window:backendWin,localStorage:{getItem:()=>null,setItem:()=>{}},clearInterval:()=>{}});
assert.equal(backRuntime.policyRows('shared',backHass)[0].status,'loading');
await backRuntime.refreshAttentionBackend(backHass,'shared');
assert.equal(backRuntime.policyRows('shared',backHass)[0].name,'Server result');
assert.ok(backendCalls.length===1);
failBackend=true;await backRuntime.refreshAttentionBackend(backHass,'shared',true);
let backRows=backRuntime.policyRows('shared',backHass);
assert.ok(backRows.some(r=>r.reason==='backend_unavailable'));
assert.ok(backRows.every(r=>r.rule!=='must-not-run'));
clock+=46000;backRows=backRuntime.policyRows('shared',backHass);
assert.equal(backRows.length,1,'expired cached alerts must not masquerade as fresh observations');
assert.equal(backRows[0].reason,'backend_unavailable');
assert.equal(backRuntime.policyRows('shared',{...backHass,connection:{}})[0].status,'loading','a new account/connection cannot reuse a prior private snapshot');
console.log('Attention backend: authority, fail-closed errors, freshness, locale and connection isolation passed.');
