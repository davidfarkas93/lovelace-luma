import assert from 'node:assert/strict';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({executablePath:process.env.LUMA_CHROME,headless:true});
try {
 const page=await browser.newPage({viewport:{width:1280,height:752}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const open=async()=>{
  await page.goto((process.env.LUMA_STORYBOOK_URL||'http://127.0.0.1:6006')+'/iframe.html?id=cards-wall-panel--handle-fader&viewMode=story&globals=locale:hu');
  await page.locator('.drag-handle').waitFor();
  await page.locator('luma-light-fader-card').evaluate(el=>{window.calls=[];el.hass={...el.hass,callService:async(...a)=>window.calls.push(a)}});
 };
 const f=page.locator('luma-light-fader-card'),handle=f.locator('.drag-handle'),track=f.locator('.track');
 const cdp=await page.context().newCDPSession(page);
 const touch=async(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x,y}]});
 await open();
 let h=await handle.boundingBox(),r=await track.boundingBox(),x=h.x+h.width/2,y=h.y+h.height/2;
 await touch('touchStart',x,y);await page.waitForFunction(el=>el.handleDrag.active,await f.elementHandle());
 await touch('touchMove',x+(r.width-h.width)*.75,y+100);
 await touch('touchMove',x+(r.width-h.width)*.45,y+180);
 await page.waitForTimeout(40);
 assert.equal(await page.evaluate(()=>window.calls.length),0,'No command during diagonal drag outside card');
 assert.equal(await f.locator('.value').textContent(),'45%');
 await touch('touchEnd');await page.waitForTimeout(40);
 assert.equal(await page.evaluate(()=>window.calls.length),1);
 assert.equal(await page.evaluate(()=>window.calls[0][2].brightness_pct),45);
 // HA echoes cannot replace a held draft, cancellation never sends.
 h=await handle.boundingBox();x=h.x+h.width/2;y=h.y+h.height/2;
 await touch('touchStart',x,y);await page.waitForFunction(el=>el.handleDrag.active,await f.elementHandle());
 await touch('touchMove',x+40,y+80);
 await f.evaluate(el=>{const e=el.hass.states[el.config.entity];el.hass={...el.hass,states:{...el.hass.states,[el.config.entity]:{...e,state:'on',attributes:{...e.attributes,brightness:255}}}}});
 await touch('touchCancel');await page.waitForTimeout(40);
 assert.equal(await page.evaluate(()=>window.calls.length),1);
 // Mouse drags start without a press delay, outside the card too.
 await open();h=await handle.boundingBox();r=await track.boundingBox();x=h.x+h.width/2;y=h.y+h.height/2;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+(r.width-h.width)*.6,y+150,{steps:10});
 assert.equal(await page.evaluate(()=>window.calls.length),0);await page.mouse.up();await page.waitForTimeout(40);
 assert.equal(await page.evaluate(()=>window.calls.length),1);assert.equal(await page.evaluate(()=>window.calls[0][2].brightness_pct),60);
 await handle.focus();await page.keyboard.press('ArrowLeft');await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>window.calls.length),2);
 // Availability loss while holding cancels; restoring state cannot revive the drag.
 await open();h=await handle.boundingBox();x=h.x+22;y=h.y+h.height/2;
 await touch('touchStart',x,y);await page.waitForFunction(el=>el.handleDrag.active,await f.elementHandle());await touch('touchMove',x+80,y+80);
 await f.evaluate(el=>{const e=el.hass.states[el.config.entity];window.oldEntity=e;el.hass={...el.hass,states:{...el.hass.states,[el.config.entity]:{...e,state:'unavailable'}}}});await page.waitForTimeout(40);
 await f.evaluate(el=>{el.hass={...el.hass,states:{...el.hass.states,[el.config.entity]:window.oldEntity}}});await page.waitForTimeout(40);
 await touch('touchEnd');await page.waitForTimeout(40);assert.equal(await page.evaluate(()=>window.calls.length),0);
 for(const width of [1280,768,390]){await page.setViewportSize({width,height:752});await page.screenshot({path:`/private/tmp/luma-handle-${width}.png`});}
 assert.deepEqual(errors,[]);console.log('PASS handle diagonal/reversing/outside drag, release only, cancel, mouse, keyboard, state loss and responsive rendering.');
}finally{await browser.close()}
