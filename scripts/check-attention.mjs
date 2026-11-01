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
const model=compile('../src/attention.ts',name=>name==='./localize'?localize:matcher);
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
assert.equal(rows.find(x=>x.source==='event.notifications').status,'unavailable');
rows=model.attentionSnapshot(hass,{...policy,adapters:{}},ext,clock);assert.equal(rows.filter(x=>['notification','repair','integration'].includes(x.kind)).length,0,'adapters must be explicitly enabled per policy');
const max=model.attentionAckValue('', 'a123',clock/1000+100,clock/1000,255);assert.match(max,/^a123:/);
assert.equal(model.attentionAckValue(max,'a123',null,clock/1000),'');
assert.ok(model.attentionAckValue(Array.from({length:30},(_,i)=>`akey${i}:${clock/1000+100}`).join(','),'new',clock/1000+200,clock/1000,255).length<=255);
clock+=2*86400000;grouped=model.groupAttention(model.attentionSnapshot(hass,policy,{},clock),policy,hass,clock);assert.ok(grouped.every(x=>!x.snoozedUntil),'expiry reevaluates without an entity transition');
const storage=new Map();const listeners={};let interval;
const win={lumaAttentionPolicies:{test:policy},setInterval:fn=>{interval=fn;return 1},addEventListener:(name,fn)=>{listeners[name]=fn},removeEventListener:()=>{}};
const runtime=compile('../src/attention-runtime.ts',()=>model,{window:win,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},clearInterval:()=>{}});
const before=runtime.policyRows('test',hass).find(x=>x.rule==='temp-critical').key;
const secondRuntime=compile('../src/attention-runtime.ts',()=>model,{window:win,localStorage:{getItem:()=>null,setItem:()=>{}},clearInterval:()=>{}});
clock+=1000;
assert.equal(secondRuntime.policyRows('test',hass).find(x=>x.rule==='temp-critical').key,before,'first observation identity is shared across browsers');
hass.states['sensor.temp']=entity('sensor.temp','40');clock+=16000;runtime.policyRows('test',{...hass});
hass.states['sensor.temp']=entity('sensor.temp','46');clock+=16000;const after=runtime.policyRows('test',{...hass}).find(x=>x.rule==='temp-critical').key;
assert.notEqual(before,after,'an observed threshold recovery starts a new episode');
assert.equal(runtime.policyRows('missing',hass)[0].reason,'policy_unavailable');
let ticks=0;const sub=new runtime.AttentionSubscription(()=>ticks++);sub.connect();interval();assert.equal(ticks,1);sub.disconnect();
console.log('Attention: discovery, metadata, fault semantics, grace, per-source/version identity, recurrence, snooze expiry, adapter gating, missing policy and storage bounds passed.');
