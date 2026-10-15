import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const { outputText } = ts.transpileModule(readFileSync(new URL('../src/comfort.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const exports = {};
vm.runInNewContext(outputText, { exports });
const { comfortActivity } = exports;
const config = { heating_entity: 'sensor.heating', air_conditioner_entity: 'climate.ac' };
const entity = (id, state, attributes = {}) => ({ entity_id: id, state, attributes });
const run = (heat, ac, options = config) => comfortActivity({ states: {
  ...(heat ? { [heat.entity_id]: heat } : {}), ...(ac ? { [ac.entity_id]: ac } : {}),
} }, options).map(item => item.en).join(',');
const heat = state => entity('sensor.heating', state);
const ac = (state, attributes) => entity('climate.ac', state, attributes);
assert.equal(run(heat('heat'), ac('cool', { hvac_action: 'cooling' })), 'Heating,AC cooling');
assert.equal(run(heat('idle'), ac('cool', { hvac_action: 'idle' })), '');
assert.equal(run(heat('idle'), ac('cool')), 'AC on');
assert.equal(run(heat('idle'), ac('off', { hvac_action: 'cooling' })), '');
assert.equal(run(null, null), '');
for (const state of ['unknown', 'unavailable', '']) {
  assert.equal(run(heat(state), ac(state, { hvac_action: 'cooling' })), '');
}
assert.equal(run(entity('sensor.heating', 'heat', { restored: true }), ac('cool', { restored: true })), '');
const thermostat = action => entity('climate.thermostat', 'heat', action === undefined ? {} : { hvac_action: action });
for (const action of [undefined, 'idle', 'off', 'unknown', 'unavailable']) {
  assert.equal(run(thermostat(action), null, { heating_entity: 'climate.thermostat' }), '');
}
assert.equal(run(thermostat('heating'), null, { heating_entity: 'climate.thermostat' }), 'Heating');
for (const [action, label] of Object.entries({ heating: 'AC heating', cooling: 'AC cooling', drying: 'AC drying', fan: 'AC fan', defrosting: 'AC defrosting' })) {
  assert.equal(run(null, ac('auto', { hvac_action: action })), label);
}
console.log('Comfort: actual thermostat action, AC action/fallback, idle and unavailable checks passed.');
