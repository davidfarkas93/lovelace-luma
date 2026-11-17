import assert from 'node:assert/strict';
const { chromium } = await import(process.env.LUMA_PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ ...(process.env.LUMA_CHROME ? { executablePath: process.env.LUMA_CHROME } : {}), headless: true });
try {
 const page = await browser.newPage({viewport:{width:1280,height:752}});
 const errors=[]; page.on('pageerror', e=>errors.push(e.message));
 await page.goto((process.env.LUMA_STORYBOOK_URL || 'http://127.0.0.1:6006')+'/iframe.html?id=cards-wall-panel--physical-buttons&viewMode=story&globals=locale:hu');
 const card=page.locator('luma-wall-panel-card'); await card.locator('.legend').waitFor();
 assert.equal(await card.locator('.scene').count(),0);
 assert.deepEqual(await card.locator('.legend-item .label').allTextContents(),['Film','Pihenés','Teljes fény','Fények le']);
 assert.equal(await card.locator('.pressed').count(),0,'No flash on load');
 await card.evaluate(el=>{window.calls=[];window.originalFader=el.shadowRoot.querySelector('luma-light-fader-card');el.hass.callService=async(...args)=>window.calls.push(args)});
 const publish=async(type='single_push',offset=0,extra={},reconnect=false)=>card.evaluate(async(el,{type,offset,extra,reconnect})=>{
   const id='event.button_1'; el.hass={...el.hass,...(reconnect?{connection:{}}:{}),states:{...el.hass.states,[id]:{...el.hass.states[id],state:new Date(Date.now()+offset).toISOString(),attributes:{event_type:type,...extra}}}};await el.updateComplete;
 },{type,offset,extra,reconnect});
 for(const type of ['btn_down','btn_up','double_push','long_push']) {await publish(type);assert.equal(await card.locator('.pressed').count(),0)}
 await publish('single_push',-60000);assert.equal(await card.locator('.pressed').count(),0,'Ignore stale');
 await publish('single_push',0,{restored:true});assert.equal(await card.locator('.pressed').count(),0,'Ignore restored');
 await publish('single_push',1,{},true);assert.equal(await card.locator('.pressed').count(),0,'Ignore reconnection snapshot');
 await page.waitForTimeout(10);await publish();assert.equal(await card.locator('.pressed').count(),1);
 await page.waitForTimeout(500);await publish();await page.waitForTimeout(400);assert.equal(await card.locator('.pressed').count(),1,'Repeated press restarts flash');
 await page.waitForTimeout(400);assert.equal(await card.locator('.pressed').count(),0,'Flash expires');
 await card.locator('.legend-item').first().dispatchEvent('click');
 assert.equal(await page.evaluate(()=>window.calls.length),0,'Legend never calls services');
 assert.equal(await card.evaluate(el=>window.originalFader===el.shadowRoot.querySelector('luma-light-fader-card')),true,'Events preserve fader instance');
 for(const [width,height] of [[1280,752],[768,1024],[390,844]]) {
   await page.setViewportSize({width,height});await page.waitForTimeout(100);
   const layout=await card.evaluate(el=>{const root=el.shadowRoot,p=root.querySelector('.panel'),l=root.querySelector('.lights').getBoundingClientRect(),r=root.querySelector('.legend').getBoundingClientRect();return {w:p.clientWidth,sw:p.scrollWidth,h:p.clientHeight,sh:p.scrollHeight,right:r.x>=l.right}});
   assert(layout.sw<=layout.w && layout.sh<=layout.h+1,JSON.stringify({width,...layout}));assert(layout.right);
 }
 await page.setViewportSize({width:1280,height:752});
 await page.screenshot({path:'/private/tmp/luma-wall-buttons.png'});
 await card.evaluate(async el=>{el.setConfig({...el.config,physical_buttons:{...el.config.physical_buttons,side:'left'}});await el.updateComplete});
 assert(await card.evaluate(el=>el.shadowRoot.querySelector('.legend').getBoundingClientRect().right<=el.shadowRoot.querySelector('.lights').getBoundingClientRect().left));
 await publish();await card.evaluate(el=>el.remove());
 assert.equal(await card.count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS physical legend ordering, event filtering, repeated press, timeout, no services, stable faders, responsive and left layouts.');
} finally {await browser.close()}
