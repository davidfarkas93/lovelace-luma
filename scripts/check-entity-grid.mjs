import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Test the production matching method without a browser. Only Lit's rendering
// and decorator APIs are stubbed; the actual shared glob helper is loaded.
function compile(path, require) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true, useDefineForClassFields: false },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require, console });
  return exports;
}
const helpers = compile('../src/helpers.ts', () => { throw Error('Unexpected import'); });
const { LumaEntityGridCard } = compile('../src/cards/luma-entity-grid-card.ts', (name) => {
  if (name === 'lit') return { LitElement: class {}, css: () => '', html: () => '', nothing: null };
  if (name === 'lit/decorators.js') return {
    customElement: () => cls => cls,
    property: () => () => {}, state: () => () => {}, query: () => () => {},
  };
  if (name === '../helpers') return helpers;
  if (name === '../styles') return { lumaTokens: '' };
  throw Error(`Unexpected import ${name}`);
});
const card = new LumaEntityGridCard();
const service = 'switch.example_service';
const stack = 'switch.example_stack';
card.hass = { states: {}, entities: {} };
for (const id of [service, stack, 'switch.other', 'sensor.example']) {
  card.hass.states[id] = { state: 'on', attributes: {} };
  card.hass.entities[id] = { platform: id === 'switch.other' ? 'other' : 'komodo' };
}
const base = { type: 'custom:luma-entity-grid-card', integration: 'komodo', domain: 'switch' };
card.setConfig(base);
assert.equal(card.matchesEntity(service), true);
assert.equal(card.matchesEntity(stack), true); // Existing configs unchanged.
card.setConfig({ ...base, exclude: ['switch.*_stack'] });
assert.equal(card.matchesEntity(service), true);
assert.equal(card.matchesEntity(stack), false);
assert.equal(card.matchesEntity('switch.other'), false);
assert.equal(card.matchesEntity('sensor.example'), false);
assert.equal(card.matchesEntity('switch.missing'), false);
for (const state of ['off', 'unknown', 'unavailable']) {
  card.hass.states[service].state = state;
  assert.equal(card.matchesEntity(service), true); // No accidental health filtering.
}
card.setConfig({ ...base, entity_pattern: 'switch.*', exclude: [service] });
assert.equal(card.matchesEntity(service), false); // Exact exclusions win over includes.
assert.equal(card.matchesEntity(stack), true);
card.setConfig({ ...base, exclude: [] });
assert.equal(card.matchesEntity(service), true); // Runtime reconfiguration.
card.setConfig({ ...base, state_not: ['unavailable'], exclude: ['switch.*_stack'] });
assert.equal(card.matchesEntity(service), false);
assert.equal(helpers.glob('switch.example_stack', 'switchXexample_stack'), false);
console.log('Entity grid filter regression checks passed.');
