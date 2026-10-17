import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

let now = 0, nextId = 0;
const timers = new Map();
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/hold-gesture.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, {
  exports,
  setTimeout: (fn, delay) => { const id = ++nextId; timers.set(id, { fn, at: now + delay }); return id; },
  clearTimeout: id => timers.delete(id),
});
const { HoldGesture } = exports;
const advance = ms => {
  now += ms;
  for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.fn(); }
};
const doc = new EventTarget(), scroller = new EventTarget(), card = new EventTarget();
card.ownerDocument = doc;
const pointer = (extra = {}) => ({ isPrimary: true, button: 0, pointerId: 1, clientX: 40, clientY: 60,
  currentTarget: card, composedPath: () => [card, scroller, doc], ...extra });
const emit = (type, extra = {}, target = doc) => target.dispatchEvent(Object.assign(new Event(type), extra));
const tap = { detail: 1 }, keyboard = { detail: 0 };
let holds = 0;
const press = new HoldGesture();
const start = hold => press.start(pointer(), hold === false ? undefined : () => holds++);
const release = () => emit('pointerup', { pointerId: 1 });

start(); advance(499); assert.equal(holds, 0); release(); advance(50);
assert.equal(holds, 0); assert(press.allowsClick(tap));
start(); advance(500); assert.equal(holds, 1); release(); advance(1000);
assert.equal(holds, 1); assert(!press.allowsClick(tap)); assert(press.allowsClick(keyboard));

for (const cancel of [
  () => emit('pointermove', { pointerId: 1, clientX: 40, clientY: 70 }),
  () => emit('pointermove', { pointerId: 1, clientX: 50, clientY: 60 }),
  () => emit('pointercancel', { pointerId: 1 }),
  () => emit('lostpointercapture', { pointerId: 1 }),
  () => emit('touchmove', { touches: [{ clientX: 40, clientY: 70 }] }),
  () => emit('touchcancel'),
  () => emit('scroll', {}, scroller), // Does not bubble across a shadow boundary.
  () => emit('scroll'),
  () => emit('pointerdown', { pointerId: 2 }),
  () => press.cancel(), // Card disconnected or pointer left the card.
]) {
  const before = holds;
  start(); advance(200); cancel(); advance(600); release();
  assert.equal(holds, before); assert(!press.allowsClick(tap));
  // A fresh tap must not inherit the preceding cancelled gesture.
  start(); release(); assert(press.allowsClick(tap));
}

start(); emit('pointermove', { pointerId: 1, clientX: 42, clientY: 63 }); advance(500);
assert.equal(holds, 2); release();
start(false); advance(600); release(); assert(press.allowsClick(tap));
start(); emit('touchend'); advance(600); assert.equal(holds, 2); assert(press.allowsClick(tap));
press.start(pointer({ button: 2 }), () => holds++); advance(600); assert.equal(holds, 2);
start(); emit('pointerup', { pointerId: 99 }); advance(500); assert.equal(holds, 3); release();
assert.equal(timers.size, 0);
console.log('Hold gestures: stationary hold/tap, scroll in shadow roots, movement, cancellation, multi-touch and fresh/keyboard clicks passed.');
