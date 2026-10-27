import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const { outputText } = ts.transpileModule(readFileSync(new URL('../src/camera-events.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const exports = {};
vm.runInNewContext(outputText, { exports });
const { groupCameraEvents } = exports;
const e = (type, seconds, id = `${type}-${seconds}`) => ({ type, timestamp: new Date(1_700_000_000_000 + seconds * 1000).toISOString(), id, url: `/video/${id}` });
const raw = [e('person', 91), e('motion', 90), e('smartDetectLine', 98), e('animal', 170), e('ring', 94), e('motion', 40)];
const groups = groupCameraEvents(raw, 30);
assert.equal(groups.length, 4);
const person = groups.find(g => g.type === 'person');
assert.equal(person.members.length, 3);
assert.equal(person.url, '/video/person-91');
assert.equal(groups.find(g => g.type === 'animal').members.length, 1);
assert.equal(groups.find(g => g.type === 'ring').members.length, 1);
assert.equal(groups.flatMap(g => g.members).length, raw.length);
assert.equal(groupCameraEvents(raw, 0).length, raw.length);
assert.equal(groupCameraEvents([e('person', 100),e('animal',100)],30).length,2);
assert.equal(groupCameraEvents([e('motion', 100), e('motion', 75), e('motion', 50)], 30).length, 2, 'window must not grow by chaining');
assert.equal(groupCameraEvents([{type:'motion'}, e('motion', 1), {type:'motion',timestamp:'invalid'}], 30).length, 3);
assert.equal(raw[0].type, 'person', 'input order and objects must remain unchanged');
console.log('Camera events: bounded grouping, object separation, originals, disabled grouping and invalid dates passed.');
