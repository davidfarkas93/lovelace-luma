import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function compile(file, require) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'), {
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,useDefineForClassFields:false},
  });
  const exports={}; vm.runInNewContext(outputText,{exports,require,URL,Date,console,clearTimeout,
    window:{setTimeout,clearTimeout}}); return exports;
}
const helpers=compile('../src/helpers.ts',()=>{throw Error('Unexpected import');});
const model=compile('../src/services.ts',()=>helpers);
const noop=()=>()=>{};
const {LumaServiceGridCard}=compile('../src/cards/luma-service-grid-card.ts',name=>{
  if(name==='lit')return{LitElement:class {},css:()=>'',html:()=>'',nothing:null};
  if(name==='lit/decorators.js')return{customElement:()=>cls=>cls,property:noop,query:noop,state:noop};
  if(name==='lit/directives/repeat.js')return{repeat:()=>''};
  if(name==='../helpers')return helpers;
  if(name==='../services')return model;
  if(name==='../localize')return{localize:(_h,key)=>key,localized:(_h,en)=>en};
  if(name==='../styles')return{lumaTokens:''};
  throw Error(name);
});
const config={type:'custom:luma-service-grid-card',
  stacks:{integration:'test',entity_pattern:'sensor.*_stack_state'},
  containers:{integration:'test',domain:'switch',exclude:['switch.*_stack']},
  monitors:{integration:'kuma',entity_pattern:'sensor.*_status'},
  bindings:[{entity:'sensor.app_stack_state',monitor:'sensor.public_status',name:'App'}],
  operations:[{name:'Deploy',selector:{domain:'button'},service:'button.press',confirm:'Deploy?'}],
  metrics:{latency:{from:'_status',to:'_latency'}},
};
const calls=[];
const hass={states:{},entities:{},devices:{d:{name:'App'}},callService:async(...args)=>calls.push(args)};
function add(id,state,platform='test',device_id='d',attributes={}) {
  hass.states[id]={entity_id:id,state,attributes};hass.entities[id]={platform,device_id};
}
add('sensor.app_stack_state','RUNNING');add('switch.app_stack','on');
for(let i=0;i<4;i++)add(`switch.app_${i}`,'on');
add('button.app_deploy','unknown');add('sensor.public_status','up','kuma','m');add('sensor.public_latency','13','kuma','m');
add('sensor.backup_status','up','kuma','b');
add('switch.orphan','unavailable','test','orphan',{restored:true});
let items=model.discoverServices(hass,config), app=items.find(x=>x.stack);
assert.equal(items.length,2); // Bound monitor is not rendered a second time.
assert.equal(app.containers.length,4);assert.equal(model.serviceHealth(app).running,4);
assert.equal(app.operations.length,1);assert.equal(model.serviceHealth(app).tone,'success');
hass.states['sensor.app_stack_state'].attributes.restored=true;
hass.states['sensor.app_stack_state'].state='unavailable';
assert.equal(model.discoverServices(hass,config).filter(x=>x.stack).length,1);
assert.equal(model.serviceHealth(model.discoverServices(hass,config).find(x=>x.stack)).tone,'warning');
delete hass.states['sensor.app_stack_state'].attributes.restored;
hass.states['sensor.app_stack_state'].state='RUNNING';
hass.states['switch.app_2'].state='off';
assert.equal(model.serviceHealth(app).running,3);assert.equal(model.serviceHealth(app).tone,'warning');
hass.states['sensor.public_status'].state='down';assert.equal(model.serviceHealth(app).tone,'error');
hass.states['switch.app_2'].state='on';hass.states['sensor.public_status'].state='unknown';
assert.equal(model.serviceHealth(app).tone,'muted');
delete hass.states['sensor.public_status'];
app=model.discoverServices(hass,config).find(x=>x.stack);
assert.equal(model.serviceHealth(app).monitorState,'unknown');
app=model.discoverServices(hass,{...config,bindings:[]}).find(x=>x.stack);
assert.equal(model.serviceHealth(app).monitorState,'unmonitored');
assert.equal(model.serviceNumber({state:'unknown'}),undefined);
assert.equal(model.serviceNumber({state:''}),undefined);
assert.equal(model.serviceNumber({state:'0'}),0);
assert.equal(model.serviceUrl('javascript:alert(1)'),undefined);
assert.equal(model.serviceUrl('https://example.com'),'https://example.com/');
// Device-less entries must not share every other device-less entity.
add('sensor.lonely_stack_state','RUNNING','test',null);add('switch.lonely','on','test',null);
assert.equal(model.discoverServices(hass,config).find(x=>x.entity==='sensor.lonely_stack_state').containers.length,0);
// Cards have stable entity keys; the control must never execute on the first click.
const card=new LumaServiceGridCard();card.hass=hass;card.setConfig(config);
const op={entity:'switch.app_0',service:'switch.turn_off',name:'Stop',confirm:'Stop?',allowed:true};
await card.execute(op);assert.equal(calls.length,0);assert.ok(card.pending);
await card.execute(op);assert.equal(calls.length,1);assert.equal(calls[0][0],'switch');assert.equal(calls[0][1],'turn_off');assert.equal(calls[0][3].entity_id,'switch.app_0');
await card.execute(op);card.close();await card.execute(op);assert.equal(calls.length,1);
hass.states[op.entity].state='off';await card.execute(op);assert.equal(calls.length,1); // Changed state invalidates old confirmation.
card.clearPending();hass.states[op.entity].state='unavailable';await card.execute(op);assert.equal(calls.length,1);
hass.states[op.entity].state='on';await card.execute({...op,allowed:false});assert.equal(calls.length,1);
await card.execute(op);card.pending.expires=0;await card.execute(op);assert.equal(calls.length,1);
card.clearPending();hass.callService=async()=>{throw Error('Test error');};
await card.execute(op);await card.execute(op);assert.match(card.error,/Test error/);assert.equal(card.busy,undefined);
card.clearPending();
console.log('Services discovery, health, URL safety and confirmed-action checks passed.');
