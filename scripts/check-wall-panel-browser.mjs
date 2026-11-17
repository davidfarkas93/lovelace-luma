import assert from 'node:assert/strict';
// Start Storybook first. Set LUMA_PLAYWRIGHT_MODULE when Playwright is outside this repo.
const { chromium } = await import(process.env.LUMA_PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({...(process.env.LUMA_CHROME ? {executablePath:process.env.LUMA_CHROME} : {}),headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.LUMA_STORYBOOK_URL || 'http://127.0.0.1:6006';
const url=base+'/iframe.html?id=cards-wall-panel--interactive-demo&viewMode=story&globals=locale:hu';
await page.goto(url);
const panel=page.locator('luma-wall-panel-card');await panel.locator('.lights').waitFor();
const fader=panel.locator('luma-light-fader-card').first(),track=fader.locator('.track');
await panel.evaluate(el=>{window.calls=[];const original=el.hass.callService;el.hass.callService=async(...args)=>{window.calls.push(args);return original(...args)}});
const rect=await track.boundingBox();
await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height*.8);await page.mouse.down();
await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height*.2,{steps:30});
assert.equal(await page.evaluate(()=>window.calls.length),0,'No service calls while dragging');
assert.equal(await track.getAttribute('aria-valuenow'),'80');
await page.mouse.up();await page.waitForTimeout(100);
assert.equal(await page.evaluate(()=>window.calls.length),1,'One service call on release');
assert.equal(await page.evaluate(()=>window.calls[0][2].brightness_pct),80);
assert.equal(await fader.locator('.value').textContent(),'80%');
// Cancelled pointers must never operate a light.
await panel.evaluate(el=>{window.calls=[];const service=async(...args)=>{window.calls.push(args)};el.hass.callService=service});

// Synthetic pointerdown cannot acquire capture; use the real mouse then cancel it.
await page.mouse.move(rect.x+20,rect.y+rect.height*.5);await page.mouse.down();
await track.dispatchEvent('pointercancel',{pointerId:1,isPrimary:true});await page.mouse.up();
assert.equal(await page.evaluate(()=>window.calls.length),0);
// Keyboard commits coalesce, including held key repeats.
await track.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.waitForTimeout(350);
assert.equal(await page.evaluate(()=>window.calls.length),1);
assert.equal(await page.evaluate(()=>window.calls[0][2].brightness_pct),70);
await panel.evaluate(el=>{window.calls=[];el.hass={...el.hass,states:{...el.hass.states,'light.sofa':{...el.hass.states['light.sofa'],state:'unavailable'}}}});
await page.waitForTimeout(50);assert.equal(await track.getAttribute('aria-disabled'),'true');assert.equal(await fader.locator('.value').textContent(),'—');
await track.dispatchEvent('keydown',{key:'ArrowUp'});assert.equal(await page.evaluate(()=>window.calls.length),0);
// Profile actual Lit updates under unrelated HA traffic.
await panel.evaluate(el=>{window.renders=0;const update=el.render.bind(el);el.render=()=>{window.renders++;return update()}});
for(let i=0;i<50;i++)await panel.evaluate((el,i)=>{el.hass={...el.hass,states:{...el.hass.states,'sensor.unrelated':{entity_id:'sensor.unrelated',state:String(i),attributes:{}}}};return el.updateComplete},i);
assert.equal(await page.evaluate(()=>window.renders),0,'No wall rerenders for unrelated states');
await page.goto(url);await panel.locator('.lights').waitFor();
for(const [width,height] of [[1280,800],[1024,600],[768,1024],[390,844]]){
 await page.setViewportSize({width,height});await page.waitForTimeout(80);
 const size=await panel.locator('.panel').evaluate(el=>({w:el.clientWidth,sw:el.scrollWidth,h:el.clientHeight,sh:el.scrollHeight}));
 assert(size.sw<=size.w,`No horizontal overflow ${width}: ${JSON.stringify(size)}`);assert(size.sh<=size.h+1,`No vertical overflow ${width}: ${JSON.stringify(size)}`);
 if(process.env.LUMA_SCREENSHOT_DIR) await page.screenshot({path:`${process.env.LUMA_SCREENSHOT_DIR}/luma-wall-${width}.png`});
}
// Real touch input, service failures, long press and busy state use mocks only.
await page.setViewportSize({width:1280,height:800});
await page.goto(url);await panel.locator('.lights').waitFor();
await panel.evaluate(el=>{window.calls=[];el.hass.callService=async(...args)=>{window.calls.push(args)}});
const touchRect=await track.boundingBox(), cdp=await page.context().newCDPSession(page);
const touchPoint=y=>[{x:touchRect.x+touchRect.width/2,y:touchRect.y+touchRect.height*y}];
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touchPoint(.75)});
await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touchPoint(.25)});
assert.equal(await page.evaluate(()=>window.calls.length),0);
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>window.calls.length),1);
assert.equal(await page.evaluate(()=>window.calls[0][2].brightness_pct),75);
await panel.evaluate(el=>{window.calls=[];el.hass.callService=async()=>{throw Error('mock failure')}});
await track.focus();await page.keyboard.press('End');await page.waitForTimeout(350);
assert.match(await fader.locator('.note').textContent(),/Nem sikerült/);
assert.equal(await fader.locator('.value').textContent(),'71%');
await panel.evaluate(el=>{window.calls=[];el.hass.callService=async(...args)=>{window.calls.push(args)}});
const power=await fader.locator('.power').boundingBox();
await page.mouse.move(power.x+20,power.y+20);await page.mouse.down();await page.waitForTimeout(600);await page.mouse.up();
assert.equal(await page.evaluate(()=>window.calls.length),0,'Long press opens details without toggling');
assert.equal(await page.locator('dialog').evaluate(el=>el.open),true);
await page.keyboard.press('Escape');
await panel.evaluate(el=>{el.hass.callService=()=>new Promise(resolve=>{window.releaseService=resolve})});
await fader.locator('.power').click();assert.equal(await fader.locator('.power').isDisabled(),true);assert.equal(await track.getAttribute('aria-disabled'),'false','A pending command does not discard a new drag');
await page.evaluate(()=>window.releaseService());await page.waitForTimeout(50);assert.equal(await fader.locator('.power').isDisabled(),false);
await page.goto(url.replace('interactive-demo','interactive-dark'));await panel.locator('.lights').waitFor();
if(process.env.LUMA_SCREENSHOT_DIR) await page.screenshot({path:`${process.env.LUMA_SCREENSHOT_DIR}/luma-wall-dark.png`});
console.log('PASS touch/mouse drag release, cancellation, keyboard coalescing, failure recovery, long press, busy, unavailable, 50 irrelevant state updates, responsive layouts.');
assert.deepEqual(errors,[], 'No browser errors');
await browser.close();
