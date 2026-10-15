import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function compile(file) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports });
  return exports;
}
const { thermostatSummary } = compile('../src/climate.ts');
const { itemIsVisible, conditionMatches } = compile('../src/helpers.ts');
const entity = (state = 'heat', action = 'idle', attributes = {}) => ({
  entity_id: 'climate.room', state,
  attributes: { current_temperature: 22.4, temperature: 21.5, hvac_action: action, ...attributes },
});
const chip = { entity: 'climate.room', attribute: 'hvac_action', state: 'heating' };
for (const action of ['idle', 'off', undefined, 'unknown', 'unavailable']) {
  const e = entity('heat', action, { hvac_action: action });
  assert.equal(thermostatSummary(e).active, false);
  assert.equal(itemIsVisible({ states: { 'climate.room': e } }, chip), false);
}
assert.equal(thermostatSummary(entity('auto', 'heating')).active, true);
assert.equal(itemIsVisible({ states: { 'climate.room': entity('auto', 'heating') } }, chip), true);
assert.equal(thermostatSummary(entity('heat', 'idle')).hu, 'Nem fűt');
assert.equal(thermostatSummary(entity('off', 'heating')).active, false);
assert.equal(thermostatSummary(entity('heat', undefined, { hvac_action: undefined })).hu, 'Működés ismeretlen');
for (const e of [undefined, entity('unavailable', 'heating'), entity('unknown', 'heating'), entity('heat', 'heating', { restored: true })]) {
  const result = thermostatSummary(e);
  assert.equal(result.active, false);
  assert.equal(result.current, undefined);
  assert.equal(result.target, undefined);
  assert.equal(itemIsVisible({ states: { 'climate.room': e } }, chip), false);
}
for (const value of [null, undefined, '', ' ', 'unknown', NaN, Infinity, true]) {
  const result = thermostatSummary(entity('heat', 'idle', { current_temperature: value, temperature: value }));
  assert.equal(result.current, undefined);
  assert.equal(result.target, undefined);
}
assert.equal(thermostatSummary(entity('heat', 'idle', { current_temperature: '0' })).current, 0);
assert.equal(conditionMatches(entity(), { state: 'heat' }), true); // Existing state filters retain their behavior.
assert.equal(conditionMatches(entity(), { attribute: 'temperature', above: 21 }), true);
assert.equal(conditionMatches(entity(), { attribute: 'temperature', below: 21 }), false);
assert.equal(conditionMatches(entity(), { attribute: 'missing', state_not: 'heating' }), false);
console.log('Thermostat: actual action, temperatures, missing data and hero attribute conditions passed.');
