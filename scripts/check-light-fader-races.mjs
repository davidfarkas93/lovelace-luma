import assert from 'node:assert/strict';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({...(process.env.LUMA_CHROME ? {executablePath:process.env.LUMA_CHROME}:{}),headless:true});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const url=(process.env.LUMA_STORYBOOK_URL || 'http://127.0.0.1:6006')+'/iframe.html?id=cards-wall-panel--interactive-demo&viewMode=story&globals=locale:hu';
const panel=page.locator('luma-wall-panel-card'), fader=panel.locator('luma-light-fader-card').first(), track=fader.locator('.track');
const open=async()=>{await page.goto(url);await track.waitFor();await panel.evaluate(el=>{window.calls=[];el.hass.callService=async(...args)=>{window.calls.push(args)}})};
const publish=async pct=>{await panel.evaluate((el,pct)=>{const previous=el.hass.states['light.sofa'];el.hass={...el.hass,states:{...el.hass.states,'light.sofa':{...previous,state:pct===0?'off':'on',attributes:{...previous.attributes,brightness:Math.round(pct*2.55)}}}}},pct);await page.waitForTimeout(30)};
const drag=async(pct,release=true)=>{const r=await track.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height*.5);await page.mouse.down();await page.mouse.move(r.x+r.width/2,r.y+r.height*(1-pct/100),{steps:20});if(release)await page.mouse.up();await page.waitForTimeout(40)};
const value=()=>fader.locator('.value').textContent();
await open();await drag(80);
assert.equal(await value(),'80%','Service success must not snap back to the old 71% state');
for(const pct of [71,73,77,79,71,80]) {await publish(pct);assert.equal(await value(),'80%','Intermediate device/group reports must not jump the display')}
await page.waitForTimeout(450);assert.equal(await fader.locator('.note').textContent(),'','Stable matching feedback clears pending');
await publish(40);assert.equal(await value(),'40%','After acknowledgement genuine external changes remain visible');
// During a new drag, HA changes cannot overwrite the finger position.
await drag(90,false);await publish(20);assert.equal(await value(),'90%');await page.mouse.up();await page.waitForTimeout(30);assert.equal(await value(),'90%');
// Keep following a mouse/pen even if a WebView releases pointer capture mid-drag.
await open();const r=await track.boundingBox();
await page.mouse.move(r.x+20,r.y+r.height*.8);await page.mouse.down();
await track.evaluate(el=>{if(el.hasPointerCapture(1))el.releasePointerCapture(1)});
await page.mouse.move(r.x+r.width+30,r.y+r.height*.35,{steps:10});await page.mouse.up();await page.waitForTimeout(40);
assert.equal(await page.evaluate(()=>window.calls.length),1);assert.equal(await page.evaluate(()=>window.calls[0][2].brightness_pct),65);
// Slow real touch drag: multiple moves, changing HA feedback, then release.
await open();const cdp=await page.context().newCDPSession(page),t=await track.boundingBox();
const point=(fraction)=>[{x:t.x+t.width/2,y:t.y+t.height*fraction}];
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:point(.9)});
for(let i=1;i<=20;i++) {await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:point(.9-i*.035)});if(i===10)await publish(10);await page.waitForTimeout(25)}
assert.equal(await value(),'80%');assert.equal(await page.evaluate(()=>window.calls.length),0);
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(40);
assert.equal(await page.evaluate(()=>window.calls.length),1,'Touch and pointer streams must commit exactly once');assert.equal(await page.evaluate(()=>window.calls[0][2].brightness_pct),80);
// Touch-only WebViews: no PointerEvents needed. Cancellation never sends a command.
await open();await track.evaluate(el=>{
 const r=el.getBoundingClientRect(),touch=y=>new Touch({identifier:7,target:el,clientX:r.x+20,clientY:r.y+r.height*y});
 const emit=(type,touches,changedTouches=touches)=>el.dispatchEvent(new TouchEvent(type,{bubbles:true,composed:true,cancelable:true,touches,targetTouches:touches,changedTouches}));
 emit('touchstart',[touch(.9)]);emit('touchmove',[touch(.2)]);emit('touchend',[],[touch(.2)]);
});await page.waitForTimeout(40);assert.equal(await page.evaluate(()=>window.calls.length),1);assert.equal(await value(),'80%');
await track.evaluate(el=>{const r=el.getBoundingClientRect(),t=new Touch({identifier:8,target:el,clientX:r.x+20,clientY:r.y+20});el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[t]}));el.dispatchEvent(new TouchEvent('touchcancel',{bubbles:true,cancelable:true,touches:[],changedTouches:[t]}))});
assert.equal(await page.evaluate(()=>window.calls.length),1);
// Embedded WebViews can report the original contact coordinate on release.
// The displayed last move is the user's selection, not the end-event coordinate.
for (const releaseKind of ['pointer', 'touch']) {
 await open();
 await track.evaluate((el,kind)=>{
  const r=el.getBoundingClientRect(),y=f=>r.y+r.height*f;
  if(kind==='pointer') {
   const emit=(type,f)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,composed:true,cancelable:true,pointerId:19,pointerType:'touch',isPrimary:true,button:0,clientX:r.x+20,clientY:y(f)}));
   emit('pointerdown',.6);emit('pointermove',.2);emit('pointerup',.6);
  } else {
   const t=f=>new Touch({identifier:19,target:el,clientX:r.x+20,clientY:y(f)});
   const emit=(type,touches,changedTouches=touches)=>el.dispatchEvent(new TouchEvent(type,{bubbles:true,composed:true,cancelable:true,touches,changedTouches}));
   emit('touchstart',[t(.6)]);emit('touchmove',[t(.2)]);emit('touchend',[],[t(.6)]);
  }
 },releaseKind);
 await page.waitForTimeout(40);
 assert.equal(await page.evaluate(()=>window.calls.length),1);
 assert.equal(await page.evaluate(()=>window.calls[0][2].brightness_pct),80,`${releaseKind}: release must preserve the last move`);
 assert.equal(await value(),'80%');
}
// Serialize releases; an older failed request cannot reset the latest requested value.
await open();await panel.evaluate(el=>{window.rejectFirst=null;el.hass.callService=(...args)=>{window.calls.push(args);return window.calls.length===1?new Promise((_,reject)=>window.rejectFirst=reject):Promise.resolve()}});
await drag(80);await drag(30);assert.equal(await value(),'30%');assert.equal(await page.evaluate(()=>window.calls.length),1);
await page.evaluate(()=>window.rejectFirst(Error('old request failed')));await page.waitForTimeout(50);
assert.equal(await page.evaluate(()=>window.calls.length),2);assert.equal(await page.evaluate(()=>window.calls[1][2].brightness_pct),30);assert.equal(await value(),'30%');
assert(!/Nem sikerült/.test(await fader.locator('.note').textContent()));await publish(30);await page.waitForTimeout(450);
// No optimistic state is retained forever when the hardware never acknowledges it.
await open();await drag(80);await page.waitForTimeout(5100);assert.equal(await value(),'71%');assert.match(await fader.locator('.note').textContent(),/Nincs visszaigazolás/);
assert.deepEqual(errors,[]);console.log('PASS delayed/intermediate/late HA echoes, drag isolation, lost capture, slow touch, touch-only, cancellation, serialized rapid gestures, stale rejection and feedback timeout.');
await browser.close();
