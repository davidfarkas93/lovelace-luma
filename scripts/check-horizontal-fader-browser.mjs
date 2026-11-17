import assert from 'node:assert/strict';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({...(process.env.LUMA_CHROME?{executablePath:process.env.LUMA_CHROME}:{}),headless:true});
try {
 const page=await browser.newPage({viewport:{width:1280,height:752}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.LUMA_STORYBOOK_URL||'http://127.0.0.1:6006')+'/iframe.html?id=cards-wall-panel--horizontal&viewMode=story&globals=locale:hu');
 const panel=page.locator('luma-wall-panel-card'),fader=panel.locator('luma-light-fader-card').first(),input=fader.locator('input');await input.waitFor();
 await panel.evaluate(el=>{window.calls=[];el.hass.callService=async(...args)=>window.calls.push(args)});
 const cdp=await page.context().newCDPSession(page),r=await input.boundingBox();
 const pt=pct=>[{x:r.x+16+(r.width-32)*pct/100,y:r.y+r.height/2}];
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:pt(71)});
 for(const pct of [65,50,40,25])await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:pt(pct)});
 await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>window.calls.length),0,'No command during touch drag');assert.equal(await fader.locator('.value').textContent(),'25%');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(60);
 assert.equal(await page.evaluate(()=>window.calls.length),1);assert.equal(await page.evaluate(()=>window.calls[0][2].brightness_pct),25);assert.equal(await input.inputValue(),'25');
 await panel.evaluate(el=>{el.hass={...el.hass,states:{...el.hass.states,'light.sofa':{...el.hass.states['light.sofa'],attributes:{...el.hass.states['light.sofa'].attributes,brightness:100}}}}});await page.waitForTimeout(40);
 assert.equal(await input.inputValue(),'25','Delayed feedback does not jump');
 // Real mouse drag also emits only on release.
 await page.mouse.move(pt(25)[0].x,pt(25)[0].y);await page.mouse.down();await page.mouse.move(pt(80)[0].x,pt(80)[0].y,{steps:20});
 assert.equal(await page.evaluate(()=>window.calls.length),1);await page.mouse.up();await page.waitForTimeout(60);assert.equal(await page.evaluate(()=>window.calls.length),2);assert.equal(await page.evaluate(()=>window.calls[1][2].brightness_pct),80);
 await input.dispatchEvent('pointerdown',{pointerId:20});await input.evaluate(el=>{el.value='15';el.dispatchEvent(new Event('input',{bubbles:true}))});await input.dispatchEvent('pointercancel',{pointerId:20});await input.dispatchEvent('change');
 assert.equal(await page.evaluate(()=>window.calls.length),2,'Cancellation never commits');
 await input.focus();await page.keyboard.press('ArrowLeft');await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>window.calls.length),3,'Native keyboard change commits');
 for(const [width,height] of [[1280,752],[768,1024],[390,844]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(100);
  const size=await panel.locator('.panel').evaluate(el=>({w:el.clientWidth,sw:el.scrollWidth,h:el.clientHeight,sh:el.scrollHeight}));assert(size.sw<=size.w&&size.sh<=size.h+1,JSON.stringify({width,...size}));
  await page.screenshot({path:`/private/tmp/luma-horizontal-${width}.png`});
 }
 await panel.evaluate(el=>{el.hass={...el.hass,states:{...el.hass.states,'light.sofa':{...el.hass.states['light.sofa'],state:'unavailable'}}}});await page.waitForTimeout(30);assert(await input.isDisabled());
 assert.deepEqual(errors,[]);console.log('PASS horizontal native touch/mouse release-only, draft, delayed feedback, cancel, keyboard, unavailable, responsive layouts.');
}finally{await browser.close()}
