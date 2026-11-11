import assert from 'node:assert/strict';import {mkdirSync} from 'node:fs';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE||'playwright-core');
const output='/private/tmp/luma-clothing-advice-ui';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-gpu']});
const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{for(const width of [390,768,1280])for(const lang of ['hu','en']){
 await page.setViewportSize({width,height:844});await page.goto(`http://127.0.0.1:6006/iframe.html?id=patterns-main-dashboard-hero--clothing-advice&viewMode=story&globals=locale:${lang}`);
 const hero=page.locator('luma-home-hero-card');await hero.locator('.weather-advice').waitFor();
 assert.match(await hero.locator('.weather-advice').textContent(),/rétegesen/);
 await page.waitForTimeout(350);assert.equal(await hero.locator('.weather-details').evaluate(n=>n.getRootNode().activeElement===n),false,'a closed sheet must not steal focus on page load');
 assert.equal(await hero.locator('luma-daily-report-card').count(),0,'advice stays a text line, not a separate report card');
 const weather=await hero.locator('.subtitle').first().boundingBox(),advice=await hero.locator('.weather-advice').boundingBox();assert.ok(advice.y>=weather.y+weather.height,'advice follows weather data');
 assert.ok(await hero.locator('.weather-advice').evaluate(n=>n.scrollWidth<=n.clientWidth+1));
 await page.screenshot({path:`${output}/${lang}-${width}.png`,animations:'disabled'});
 await hero.evaluate(h=>{h.testCalls=[];h.hass={...h.hass,callService:async(...a)=>h.testCalls.push(a)};h.setConfig({...h.config,tap_action:{action:'none'}});});await hero.locator('.weather-advice').click();assert.equal(await hero.evaluate(h=>h.testCalls.length),0,'reading advice never calls AI or devices');
 const adviceComponent=hero.locator('luma-weather-advice'),sheet=adviceComponent.locator('luma-bottom-sheet');
 await adviceComponent.locator('.weather-details').click();await sheet.locator('dialog[open]').waitFor();assert.equal(await adviceComponent.locator('.period').count(),3);
 assert.match(await adviceComponent.locator('.period').nth(1).textContent(),lang==='hu'?/14 óra körül kisüthet/:/14:00/);
 assert.match(await adviceComponent.locator('.period').nth(2).textContent(),lang==='hu'?/nincs elérhető/:/No hourly/);
 assert.equal(await hero.evaluate(h=>h.testCalls.length),0,'opening weather details never invokes services');
 await page.screenshot({path:`${output}/details-${lang}-${width}.png`,animations:'disabled'});
 await page.keyboard.press('Escape');await sheet.locator('dialog').waitFor({state:'hidden'});assert.equal(await adviceComponent.locator('.weather-details').evaluate(n=>n.getRootNode().activeElement===n),true);
 await page.keyboard.press('Enter');await sheet.locator('dialog[open]').waitFor();await sheet.locator('.close').click();await sheet.locator('dialog').waitFor({state:'hidden'});
 // Expiry must update even without another HA state message.
 await hero.evaluate(h=>{const old=h.hass.states['sensor.clothing_tip'];h.hass={...h.hass,states:{...h.hass.states,'sensor.clothing_tip':{...old,attributes:{...old.attributes,valid_until:Date.now()/1000+.1}}}};});
 await hero.locator('.weather-advice.unavailable').waitFor();
 for(const suffix of ['expired','yesterday','failed','wrong-source']){
  await page.goto(`http://127.0.0.1:6006/iframe.html?id=patterns-main-dashboard-hero--clothing-advice-${suffix}&viewMode=story&globals=locale:${lang}`);
  await hero.locator('.weather-advice.unavailable').waitFor();assert.doesNotMatch(await hero.locator('.weather-advice').textContent(),/rétegesen/,'stale/failed/wrong-source advice is never current');
 }
}
await page.goto('http://127.0.0.1:6006/iframe.html?id=patterns-main-dashboard-hero--clothing-advice-no-hourly&viewMode=story&globals=locale:hu');await page.locator('luma-home-hero-card .weather-details').click();await page.locator('luma-home-hero-card .weather-report').waitFor();assert.match(await page.locator('luma-home-hero-card .weather-report').textContent(),/Napszakos bontás még nem/);
assert.deepEqual(errors,[]);console.log('Clothing advice: plain inline text below weather, HU/EN mobile/tablet/desktop, read-only details with hourly periods and missing-data states, no service calls, expiry without HA updates, old-date/failure/source isolation passed.');}finally{await browser.close();}
