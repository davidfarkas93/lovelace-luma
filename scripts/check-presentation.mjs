import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function compile(path, require=()=>{throw Error('Unexpected import')}){
 const exports={};const {outputText}=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 vm.runInNewContext(outputText,{exports,require,Intl});return exports;
}
const localize=compile('../src/localize.ts');
const {finiteMeasurement,entityMeasurement,entityAvailable,missingLabel,formatNumber,presentedState}=compile('../src/presentation.ts',name=>{assert.equal(name,'./localize');return localize;});
const entity=(state,attributes={})=>({state,attributes,entity_id:'sensor.demo'});
const hu={locale:{language:'hu'},states:{}},en={locale:{language:'en'},states:{}};
for(const value of [undefined,null,'',' ','unknown','unavailable','NaN',NaN,Infinity,true,[],{}])assert.equal(finiteMeasurement(value),null);
for(const [value,expected] of [['0',0],[0,0],['-2.4',-2.4],['22.4',22.4]])assert.equal(finiteMeasurement(value),expected);
assert.equal(entityMeasurement(entity('22.4',{restored:true})),null);
assert.equal(entityAvailable(entity('on',{restored:true})),false);
assert.equal(formatNumber(hu,22.4,1),'22,4');assert.equal(formatNumber(en,22.4,1),'22.4');assert.equal(formatNumber(hu,0,1),'0,0');
assert.equal(presentedState(hu,entity('off')),'Kikapcsolva');assert.equal(presentedState(hu,entity('open')),'Nyitva');
assert.equal(presentedState(hu,entity('unknown')),'Ismeretlen');assert.equal(presentedState(hu,undefined),'Nem elérhető');
assert.equal(missingLabel(hu,entity('22.4',{restored:true})),'Friss adatra vár');
assert.equal(presentedState(hu,entity('0',{unit_of_measurement:'W'})),'0 W');
assert.equal(presentedState(hu,entity('off'),{off:'Custom label'}),'Custom label');
assert.equal(presentedState({...hu,formatEntityState:()=> 'HA translation'},entity('open')),'HA translation');
console.log('Presentation: real zero, invalid/restored inputs, localized missing states/numbers, native translations and explicit labels passed.');
