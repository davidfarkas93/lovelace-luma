import assert from 'node:assert/strict';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.LUMA_CHROME?{executablePath:process.env.LUMA_CHROME}:{})});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.LUMA_STORYBOOK_URL||'http://127.0.0.1:6006')+'/iframe.html?id=cards-wall-panel--idle-details&viewMode=story&globals=locale:hu');
 const panel=page.locator('luma-wall-panel-card'),modal=panel.locator('luma-wall-controls');
 await panel.locator('input').first().waitFor();
 await panel.evaluate(el=>{window.calls=[];el.hass.callService=async(...args)=>window.calls.push(args)});
 await page.clock.install();
 const open=async()=>{await panel.locator('luma-light-fader-card .details').nth(2).click();await modal.locator('dialog[open]').waitFor()};
 await open();
 assert.equal(await modal.locator('luma-touch-range').count(),1,'white spectrum override hides XY controls, keeps Kelvin');
 for(const [width,height] of [[1280,800],[768,1024],[390,844]]){
  await page.setViewportSize({width,height});await page.clock.runFor(100);
  await page.screenshot({path:`/private/tmp/luma-idle-island-${width}.png`});
  assert(await modal.locator('.layout').evaluate(el=>el.scrollWidth<=el.clientWidth));
 }
 await page.setViewportSize({width:1280,height:800});
 await page.clock.runFor(29000);assert.equal(await modal.count(),1);
 // Backend updates must not keep an abandoned view open.
 await panel.evaluate(el=>{el.hass={...el.hass,states:{...el.hass.states,'light.island':{...el.hass.states['light.island'],state:'off'}}}});
 await page.clock.runFor(1100);await modal.waitFor({state:'detached'});
 await open();await page.clock.runFor(20000);
 await modal.locator('nav button').first().click();
 await page.clock.runFor(20000);assert.equal(await modal.count(),1,'navigation restarts timer');
 const input=modal.locator('luma-touch-range input').first();
 await input.dispatchEvent('pointerdown',{pointerId:7});
 await page.clock.runFor(60000);assert.equal(await modal.count(),1,'held pointer pauses timeout');
 await input.dispatchEvent('pointercancel',{pointerId:7});
 await page.clock.runFor(29000);assert.equal(await modal.count(),1,'cancel gives full idle period');
 await page.clock.runFor(1100);await modal.waitFor({state:'detached'});
 await open();
 await modal.dispatchEvent('touchstart',{changedTouches:[{identifier:1}]});
 await page.clock.runFor(60000);assert.equal(await modal.count(),1,'touch-only hold');
 await modal.dispatchEvent('touchend',{changedTouches:[{identifier:1}]});
 await page.clock.runFor(30001);await modal.waitFor({state:'detached'});
 await open();
 await modal.dispatchEvent('keydown',{key:'ArrowRight',code:'ArrowRight'});
 await page.clock.runFor(60000);assert.equal(await modal.count(),1,'keyboard hold');
 await modal.dispatchEvent('keyup',{key:'ArrowRight',code:'ArrowRight'});
 await page.clock.runFor(30001);await modal.waitFor({state:'detached'});
 await open();await modal.locator('.close').click();await modal.waitFor({state:'detached'});
 await page.clock.runFor(20000);await open();await page.clock.runFor(11000);assert.equal(await modal.count(),1,'old timer cannot close reopened view');
 await modal.evaluate(el=>{el.idleSeconds=0});await page.clock.runFor(120000);assert.equal(await modal.count(),1,'zero disables');
 // Genuine color lights retain their controls by default.
 await modal.evaluate(el=>{el.items=el.items.map(i=>({...i,show_color:undefined}))});
 assert.equal(await modal.locator('luma-touch-range').count(),3);
 assert.deepEqual(await page.evaluate(()=>window.calls),[],'opening/closing never sends device commands');
 assert.deepEqual(errors,[]);
 console.log('PASS: idle close, activity reset, state updates, held pointer/touch/key, cancellation, reopen, disable, white-spectrum override, responsive layouts, no service calls.');
}finally{await browser.close()}
