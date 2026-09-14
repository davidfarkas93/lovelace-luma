import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/storage.ts',import.meta.url),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText,{exports});
const {storageValue,storageNumber,storageModel,storageOperation}=exports;
const hass={states:{'sensor.disk':{state:'73.4',attributes:{used:'2.9 TB',temp:0}},'binary_sensor.health':{state:'off',attributes:{}}}};
const config={entity:'sensor.disk',health_entity:'binary_sensor.health'};
assert.equal(storageModel(hass,config).usage,73.4);
assert.equal(storageModel(hass,config).healthStatus,'healthy');
assert.equal(storageValue(hass,{attribute:'used'},'sensor.disk'),'2.9 TB');
assert.equal(storageValue(hass,{attribute:'temp'},'sensor.disk'),0);
for(const raw of [null,undefined,'',' ','unknown','unavailable',true,'4 TB',Infinity])assert.equal(storageNumber(raw),undefined);
assert.equal(storageNumber('0'),0);
hass.states['sensor.disk'].state='96';assert.equal(storageModel(hass,config).tone,'error');
hass.states['sensor.disk'].state='87';assert.equal(storageModel(hass,config).tone,'warning');
hass.states['sensor.disk'].state='0';assert.equal(storageModel(hass,config).usage,0);
for(const raw of ['unavailable','-1','101']){hass.states['sensor.disk'].state=raw;assert.equal(storageModel(hass,config).usage,undefined);}
hass.states['sensor.disk'].state='unavailable';assert.equal(storageValue(hass,{attribute:'used'},'sensor.disk'),undefined);
hass.states['sensor.disk'].state='50';hass.states['sensor.disk'].attributes.restored=true;assert.equal(storageModel(hass,config).usage,undefined);
hass.states['binary_sensor.health'].state='on';assert.equal(storageModel(hass,config).healthStatus,'problem');assert.equal(storageModel(hass,config).tone,'error');
hass.states['binary_sensor.health'].state='unavailable';assert.equal(storageModel(hass,config).healthStatus,'unknown');
delete hass.states['binary_sensor.health'];assert.equal(storageModel(hass,config).healthStatus,'unknown');
assert.equal(storageModel(hass,{entity:'sensor.disk'}).healthStatus,'none');
assert.equal(storageModel(hass,{health_entity:'binary_sensor.health'}).usage,undefined);
hass.states['binary_sensor.health']={state:'passed',attributes:{}};
assert.equal(storageModel(hass,{...config,healthy_states:['passed']}).healthStatus,'healthy');
const operationConfig={operation:{state:{entity:'binary_sensor.check',attribute:'status'},state_map:{paused:'Paused',completed:'Completed'},progress:{entity:'sensor.progress'},progress_states:['running','paused']}};
hass.states['binary_sensor.check']={state:'on',attributes:{status:'paused'}};
hass.states['sensor.progress']={state:'25',attributes:{}};
assert.equal(storageOperation(hass,operationConfig).label,'Paused');
assert.equal(storageOperation(hass,operationConfig).progress,25);
hass.states['sensor.progress'].state='0';assert.equal(storageOperation(hass,operationConfig).progress,0);
hass.states['binary_sensor.check']={state:'off',attributes:{status:'completed'}};
assert.equal(storageOperation(hass,operationConfig).label,'Completed');
assert.equal(storageOperation(hass,operationConfig).progress,undefined);
hass.states['binary_sensor.check'].state='unavailable';assert.equal(storageOperation(hass,operationConfig).label,undefined);
hass.states['binary_sensor.check']={state:'on',attributes:{status:'running'}};
for(const value of ['unavailable','-1','101']){hass.states['sensor.progress'].state=value;assert.equal(storageOperation(hass,operationConfig).progress,undefined);}
console.log('Storage: capacity, health, operation state/progress, and unavailable/stale checks passed.');
