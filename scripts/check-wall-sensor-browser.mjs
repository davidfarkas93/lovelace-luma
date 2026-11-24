import assert from 'node:assert/strict';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.LUMA_CHROME?{executablePath:process.env.LUMA_CHROME}:{})});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.LUMA_STORYBOOK_URL||'http://127.0.0.1:6006')+'/iframe.html?id=cards-wall-panel--touch-controls&viewMode=story&globals=locale:hu');
 const panel=page.locator('luma-wall-panel-card'),modal=panel.locator('luma-wall-controls'),sensor=modal.locator('luma-wall-sensor');await panel.locator('.metric').first().waitFor();
 await panel.evaluate(el=>{const original=el.hass.callWS;window.queries=[];window.services=[];el.hass.callWS=async m=>{window.queries.push(m);return original(m)};el.hass.callService=async(...args)=>window.services.push(args)});
 assert.equal(await page.evaluate(()=>window.queries.length),0);
 await panel.locator('.metric').first().click();await sensor.locator('.chart').waitFor();
 assert.equal(await page.evaluate(()=>window.queries.length),1);
 assert.equal(await page.evaluate(()=>window.queries[0].no_attributes),true);
 for(const [width,height] of [[1280,800],[768,1024],[390,844]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(40);assert(await modal.locator('.layout').evaluate(el=>el.scrollWidth<=el.clientWidth));
  await page.screenshot({path:`/private/tmp/luma-sensor-${width}.png`});
 }
 await panel.evaluate(el=>{el.hass={...el.hass,states:{...el.hass.states,'sensor.temp':{...el.hass.states['sensor.temp'],state:'0'}}}});await page.waitForTimeout(50);
 assert.match(await sensor.locator('.current').textContent(),/^0/);assert.equal(await page.evaluate(()=>window.queries.length),1,'live update does not refetch history');
 await sensor.getByRole('button',{name:'6 óra',exact:true}).click();await sensor.locator('.chart').waitFor();assert.equal(await page.evaluate(()=>window.queries.length),2);
 assert.equal(await page.evaluate(()=>Date.parse(window.queries[1].end_time)-Date.parse(window.queries[1].start_time)),6*3600000);
 await modal.locator('nav button').nth(1).click();await sensor.locator('.chart').waitFor();assert.equal(await page.evaluate(()=>window.queries.at(-1).entity_ids[0]),'sensor.humidity');
 await panel.evaluate(el=>{el.hass.callWS=async()=>{throw new Error('mock history error')}});
 await sensor.getByRole('button',{name:'Frissítés',exact:true}).click();await sensor.locator('.empty').waitFor();assert.match(await sensor.locator('.empty').textContent(),/nem tölthetők/);
 await panel.evaluate(el=>{el.hass.callWS=async()=>({})});await sensor.getByRole('button',{name:'Frissítés',exact:true}).click();await page.waitForTimeout(50);assert.match(await sensor.locator('.empty').textContent(),/nincs rögzített adat/);
 await panel.evaluate(el=>{el.hass.callWS=()=>new Promise(resolve=>window.finishHistory=resolve)});await sensor.getByRole('button',{name:'Frissítés',exact:true}).click();
 await page.keyboard.press('Escape');await modal.waitFor({state:'detached'});await page.evaluate(()=>window.finishHistory({}));
 assert.equal(await page.evaluate(()=>window.services.length),0);assert.deepEqual(errors,[]);
 console.log('PASS lazy history query, live value without refetch, time window, sensor switching, responsive SVG, zero, error/empty, close during request, no services.');
}finally{await browser.close()}
