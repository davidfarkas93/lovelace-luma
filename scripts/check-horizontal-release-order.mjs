import assert from 'node:assert/strict';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({executablePath:process.env.LUMA_CHROME,headless:true});
try {
 const page=await browser.newPage();
 await page.goto((process.env.LUMA_STORYBOOK_URL||'http://127.0.0.1:6006')+'/iframe.html?id=cards-wall-panel--horizontal&viewMode=story&globals=locale:hu');
 const panel=page.locator('luma-wall-panel-card');
 const fader=panel.locator('luma-light-fader-card').nth(3),input=fader.locator('input');
 await input.waitFor();
 await panel.evaluate(el=>{window.calls=[];el.hass.callService=async(...args)=>window.calls.push(args)});
 // Emulate a WebView delivering change in a later task than the release event.
 await input.evaluate(el=>{
  el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
  el.value='63';el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
 });
 await page.waitForTimeout(40);
 await input.dispatchEvent('change');
 await page.waitForTimeout(30);
 assert.equal(await page.evaluate(()=>window.calls.length),1,'Release plus late change must send exactly once');
 assert.equal(await page.evaluate(()=>window.calls[0][2].brightness_pct),63,'Release must preserve the last input sample');
 assert.equal(await fader.locator('.value').textContent(),'63%');
 // A missing change still commits on release; mixed end events do not duplicate it.
 await input.evaluate(el=>{
  el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
  el.value='28';el.dispatchEvent(new Event('input',{bubbles:true}));
 });
 await page.waitForTimeout(30);
 assert.equal(await page.evaluate(()=>window.calls.length),1,'Dragging must not send');
 await input.dispatchEvent('pointerup');await input.dispatchEvent('touchend');
 await page.waitForTimeout(30);
 assert.equal(await page.evaluate(()=>window.calls.length),2);
 assert.equal(await page.evaluate(()=>window.calls[1][2].brightness_pct),28);
 // Cancellation, including a cancel after release but before the deferred commit, sends nothing.
 for(const cancelFirst of [true,false]) {
  await input.evaluate((el,cancelFirst)=>{
   el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
   el.value='91';el.dispatchEvent(new Event('input',{bubbles:true}));
   for(const type of cancelFirst?['pointercancel','pointerup']:['pointerup','pointercancel'])el.dispatchEvent(new PointerEvent(type,{bubbles:true}));
   el.dispatchEvent(new Event('change',{bubbles:true}));
  },cancelFirst);
  await page.waitForTimeout(30);
  assert.equal(await page.evaluate(()=>window.calls.length),2,'Cancelled gestures never send');
 }
 // Return to the starting value without native change: no extra service call.
 await input.evaluate(el=>{
  const start=el.value;el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
  el.value='75';el.dispatchEvent(new Event('input',{bubbles:true}));
  el.value=start;el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
 });await page.waitForTimeout(30);
 assert.equal(await page.evaluate(()=>window.calls.length),2);
 console.log('PASS delayed/missing change, duplicate release, no move commands, cancellation and unchanged release.');
} finally {await browser.close()}
