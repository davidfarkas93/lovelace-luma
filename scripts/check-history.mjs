import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

process.env.TZ = 'Europe/Budapest';
const { outputText } = ts.transpileModule(readFileSync(new URL('../src/history.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const exports = {};
vm.runInNewContext(outputText, { exports, Date });
const { historyNumber, historyTimestamp, recordTime, recordValue, historyGroups, chartWindow, bucketCenter, bucketStart, shiftBucket, activityIntervals, mergeActivityIntervals, historySegments, historyLinePoints, tooltipLeft } = exports;
const plain = value => JSON.parse(JSON.stringify(value));
for (const value of [null, undefined, '', ' ', true, 'unknown', 'unavailable', NaN, Infinity]) assert.equal(historyNumber(value), undefined);
assert.equal(historyNumber('0'), 0);
assert.equal(historyTimestamp(1792252275.725), 1792252275725);
assert.equal(historyTimestamp(1792252275725), 1792252275725);
assert.equal(recordTime({lc:1792252275,lu:1792252375}),1792252375000);
assert.equal(recordValue({s:'heat',a:{current_temperature:22.4}},'current_temperature'),22.4);
assert.equal(recordValue({s:'unavailable',a:{current_temperature:22.4}},'current_temperature'),undefined);
assert.equal(recordValue({s:'heat',a:{restored:true,hvac_action:'heating'}},'hvac_action'),undefined);
assert.equal(historyGroups({'sensor.ev':[{s:'0',lu:1792252275}]}).length,1);
assert.equal(historyGroups([[{entity_id:'sensor.ev',state:'0'}]])[0].id,'sensor.ev');

const now = new Date('2026-10-17T20:00:00+02:00').getTime();
const days = chartWindow(now, 14*24, 'day');
assert.equal(new Date(days.start).getDate(),4); // Fourteen calendar days including today, no partial 15th bar.
assert.equal(new Date(days.end).getDate(),18);
const starts = Array.from({length:15},(_,i)=>shiftBucket(days.start,'day',i-1));
const visible = starts.filter(time=>time>=days.start&&time<days.end);
assert.equal(visible.length,14);
assert(visible.every((time,index)=>index===0||bucketCenter(time,'day')>bucketCenter(visible[index-1],'day')));
const months = chartWindow(now,365*24,'month');
assert.equal(new Date(months.start).getMonth(),10);
assert.equal(new Date(months.start).getFullYear(),2025);
assert.equal(new Date(months.end).getMonth(),10);
assert.equal(new Date(months.end).getFullYear(),2026);
const dst = new Date('2026-10-25T00:00:00+02:00').getTime();
assert.equal(shiftBucket(dst,'day',1)-dst,25*3600000);
assert.equal(bucketStart(now,'day'),new Date('2026-10-17T00:00:00+02:00').getTime());

assert.deepEqual(plain(activityIntervals([{time:0,active:true},{time:15,active:undefined},{time:18,active:true}],{start:10,end:20})),[{start:10,end:15},{start:18,end:20}]);
assert.deepEqual(plain(activityIntervals([{time:12,active:false}],{start:10,end:20})),[]);
assert.deepEqual(plain(mergeActivityIntervals([{start:10,end:15},{start:14,end:18},{start:20,end:22}])),[{start:10,end:18},{start:20,end:22}]);
assert.deepEqual(plain(historySegments([{time:0,value:5},{time:15},{time:18,value:0}],{start:10,end:20})),[[{time:10,value:5},{time:15,value:5}],[{time:18,value:0},{time:20,value:0}]]);
assert.deepEqual(plain(historySegments([{time:15}],{start:10,end:20})),[]);
assert.equal(tooltipLeft(0,150,300),8);
assert.equal(tooltipLeft(300,150,300),142);
assert.equal(tooltipLeft(150,150,300),75);
console.log('History: recorder timestamps/attributes, calendar buckets/DST, unknown gaps, activity unions and tooltip bounds passed.');

// An old zero followed hours later by the first charging measurement must
// remain flat until that measurement; area fills use the same stepped path.
const sparse = [{time:0,value:0},{time:8*3600000,value:4200},{time:9*3600000,value:0}];
assert.deepEqual(plain(historyLinePoints(sparse,'step')),[
  {time:0,value:0},{time:8*3600000,value:0},{time:8*3600000,value:4200},
  {time:9*3600000,value:4200},{time:9*3600000,value:0},
]);
assert.deepEqual(plain(historyLinePoints(sparse)),sparse);
const gapSegments=historySegments([{time:0,value:0},{time:4},{time:8,value:4200}],{start:0,end:10});
assert.equal(historyLinePoints(gapSegments[0],'step').at(-1).time,4);
assert.equal(historyLinePoints(gapSegments[1],'step')[0].time,8);
console.log('History: sparse step changes keep old values until the new measurement and preserve unavailable gaps.');
