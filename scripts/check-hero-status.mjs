import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const { outputText } = ts.transpileModule(readFileSync(new URL('../src/hero-status.ts',import.meta.url),'utf8'), { compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022} });
const exports = {};
vm.runInNewContext(outputText,{exports});
const {summarizeHeroGroup:summarize} = exports;
const state = value => ({state:value,attributes:{}});
const group={items:[{entity:'door',name:'Door'},{entity:'gate',name:'Gate'}]};
assert(summarize({door:state('off'),gate:state('off')},group).clear);
for(const value of ['unknown','unavailable','unexpected']) {
  const result=summarize({door:state('off'),gate:state(value)},group);
  assert(!result.clear);
  assert.deepEqual(Array.from(result.unavailable),['Gate']);
}
const missing=summarize({door:state('on')},group);
assert.deepEqual(Array.from(missing.active),['Door']);
assert.deepEqual(Array.from(missing.unavailable),['Gate']);
assert(!missing.clear);
assert(!summarize({}, {items:[]}).clear);
assert.equal(summarize({door:state('on')},{items:[...group.items,...group.items]}).active.length,1);
const custom=summarize({door:state('closed'),gate:state('open')},{...group,active_states:['open'],inactive_states:['closed']});
assert.deepEqual(Array.from(custom.active),['Gate']);
assert.equal(custom.unavailable.length,0);
console.log('Hero status: clear, active, unavailable, missing, unexpected, empty, deduplicated and configured states passed.');
