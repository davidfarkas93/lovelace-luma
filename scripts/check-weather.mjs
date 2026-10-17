import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const { outputText } = ts.transpileModule(readFileSync(new URL('../src/weather.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const exports = {};
vm.runInNewContext(outputText, { exports });
const { weatherNumber, precipitationChance, precipitationOutlook, temperatureRange, weatherVisual, dailyTemperatureBands } = exports;

for (const value of [null, undefined, '', ' ', 'unknown', 'unavailable', NaN, Infinity, true]) assert.equal(weatherNumber(value), undefined);
assert.equal(weatherNumber('0'), 0);
assert.equal(precipitationChance({ precipitation: 7 }), undefined); // Millimeters are not percent.
assert.equal(precipitationChance({ precipitation_probability: 0 }), 0);
assert.equal(precipitationChance({ precipitation_probability: 101 }), undefined);
assert.equal(precipitationOutlook([]).kind, 'unknown');
assert.equal(precipitationOutlook([{ condition: 'sunny' }]).kind, 'unknown');
assert.equal(precipitationOutlook([{ precipitation_probability: 2 }, {}]).kind, 'unknown');
assert.equal(precipitationOutlook([{ precipitation_probability: 2 }, { precipitation_probability: 7 }]).kind, 'dry');
assert.equal(precipitationOutlook([{ condition: 'rainy' }]).kind, 'possible');
assert.equal(precipitationOutlook([{ condition: 'snowy' }]).kind, 'possible');
const rain = { datetime: '2030-01-01T14:00:00Z', precipitation_probability: 75 };
assert.equal(precipitationOutlook([{ precipitation_probability: 2 }, rain]).first.datetime, rain.datetime);
assert.equal(precipitationOutlook([rain]).kind, 'likely');
assert.equal(temperatureRange([{}, { temperature: null }]), undefined);
assert.equal(temperatureRange([{ temperature: 0 }, {}, { temperature: -3 }, { temperature: 8 }]).min, -3);
assert.equal(temperatureRange([{ temperature: 0 }]).max, 0);
assert.notEqual(weatherVisual('sunny').tone, weatherVisual('rainy').tone);
assert.notEqual(weatherVisual('cloudy').tone, weatherVisual('clear-night').tone);
assert.equal(weatherVisual('sunny', true).label, 'Napos');
assert.equal(weatherVisual('unavailable', true).label, 'Nincs adat');
const bands = dailyTemperatureBands([{ templow: -5, temperature: 5 }, { templow: 0, temperature: 15 }, {}, { templow: 10, temperature: 5 }]);
assert.equal(bands[0].start, 0);
assert.equal(bands[0].end, 50);
assert.equal(bands[1].start, 25);
assert.equal(bands[1].end, 100);
assert.equal(bands[2], undefined);
assert.equal(bands[3], undefined);
assert.equal(dailyTemperatureBands([{ templow: 0, temperature: 0 }])[0].start, 50);
assert.equal(dailyTemperatureBands([{ temperature: 12 }])[0], undefined);
assert.equal(dailyTemperatureBands([{ templow: null, temperature: 12 }])[0], undefined);
console.log('Weather: missing/zero values, rain timing, condition semantics and shared daily temperature scale passed.');
