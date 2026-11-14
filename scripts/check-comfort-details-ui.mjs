import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE||'playwright-core');
const out='/private/tmp/luma-comfort-details';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.LUMA_STORYBOOK_URL||'http://127.0.0.1:6006';
async function open(missing=false){await page.goto(`${base}/iframe.html?id=cards-comfort--details${missing?'-missing':''}&viewMode=story&globals=locale:hu`);await page.locator('.room-row').first().waitFor();return page.locator('luma-comfort-card');}
try{
 for(const width of [390,768,1280])for(const dark of [false,true])for(const missing of [false,true]){
  await page.setViewportSize({width,height:1000});const card=await open(missing);
  if(dark)await page.evaluate(()=>{for(const[k,v]of Object.entries({'--primary-text-color':'#eee','--secondary-text-color':'#9b9ba5','--primary-background-color':'#15161d','--ha-card-background':'#25252b','--card-background-color':'#25252b'}))document.documentElement.style.setProperty(k,v);});
  assert.deepEqual(await card.locator('.detail,.metric,.room-row,.climate,.actions,.context-row').evaluateAll(ns=>ns.filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>n.className)),[]);
  assert.match(await card.locator('.assessment .status').textContent(),/Nem komfortos/);
  assert.match(await card.locator('.metric[data-severity=warning]').getAttribute('aria-label'),/Emelkedett PM2.5/);
  if(missing){assert.match(await card.locator('.room-row').first().textContent(),/Nem elérhető/);assert.doesNotMatch(await card.locator('.room-row').first().textContent(),/99/);assert.match(await card.locator('.room-row').nth(3).textContent(),/Működés ismeretlen/);}
  else{assert.match(await card.locator('.room-row').first().textContent(),/Fűt.*23/);assert.match(await card.locator('.room-row').nth(1).textContent(),/Nem fűt/);assert.match(await card.locator('.climate-state').textContent(),/Kikapcsolva/);}
  await page.screenshot({path:`${out}/${missing?'missing':'details'}-${width}-${dark?'dark':'light'}.png`});
 }
 const card=await open();await card.evaluate(n=>{n.calls=[];n.infos=[];n.hass={...n.hass,callService:async(...args)=>n.calls.push(args)};n.addEventListener('hass-more-info',e=>n.infos.push(e.detail.entityId));});
 await card.locator('.room-row').first().click();await card.locator('.metric').last().click();assert.deepEqual(await card.evaluate(n=>n.infos),['climate.living','sensor.pm']);
 await card.locator('.action[aria-pressed=false]').click();assert.deepEqual(await card.evaluate(n=>n.calls[0]),['climate','set_hvac_mode',{hvac_mode:'cool'},{entity_id:'climate.ac'}]);
 await card.evaluate(n=>{n.hass={...n.hass,states:{...n.hass.states,'climate.living':{...n.hass.states['climate.living'],attributes:{hvac_action:'idle',temperature:23}}}};return n.updateComplete;});assert.match(await card.locator('.room-row').first().textContent(),/Nem fűt/);
 await card.evaluate(n=>{n.setConfig({...n.config,pm25_elevated:30});return n.updateComplete;});assert.match(await card.locator('.assessment .status').textContent(),/Kellemes/);
 await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'hidden'});assert.deepEqual(errors,[]);
 for(const story of ['compact-climate','compact-climate-cooling']){
  await page.goto(`${base}/iframe.html?id=cards-comfort--${story}&viewMode=story&globals=locale:hu`);
  const standalone=page.locator('luma-climate-card');await standalone.locator('.climate').waitFor();
  assert.match(await standalone.locator('.climate-state').textContent(),story.endsWith('cooling')?/Épp hűt/:/Kikapcsolva/);
  await standalone.evaluate(n=>{n.calls=[];n.infos=[];n.hass={...n.hass,callService:async(...args)=>{n.calls.push(args);throw Error('mock');}};n.addEventListener('hass-more-info',e=>n.infos.push(e.detail.entityId));});
  await standalone.locator('.settings').click();assert.deepEqual(await standalone.evaluate(n=>n.infos),['climate.ac']);
  await standalone.locator('.action[aria-pressed=false]').first().click();assert.match(await standalone.locator('[role=alert]').textContent(),/sikertelen/);
  await standalone.evaluate(n=>{n.hass={...n.hass,states:{...n.hass.states,'climate.ac':{...n.hass.states['climate.ac'],state:'unavailable'}}};return n.updateComplete;});assert.equal(await standalone.locator('[aria-pressed]').count(),0);
 }
 await page.setViewportSize({width:390,height:844});
 await page.goto(`${base}/iframe.html?id=cards-comfort--compact-climate-modes&viewMode=story&globals=locale:hu`);
 const multi=page.locator('luma-climate-card');await multi.locator('.more-trigger').waitFor();
 assert.equal(await multi.locator('.actions [aria-pressed]').count(),2);assert.equal(await multi.locator('.menu-mode').count(),2);
 assert.ok(await multi.locator('.climate-copy').evaluate(n=>n.clientWidth>=60),'room for climate label');
 assert.deepEqual(await multi.locator('.climate,.actions,.climate-copy').evaluateAll(ns=>ns.filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>n.className)),[]);
 await multi.evaluate(n=>{n.calls=[];n.hass={...n.hass,callService:(...args)=>{n.calls.push(args);return new Promise(resolve=>{n.finish=resolve;});}};return n.updateComplete;});
 await multi.locator('.more-trigger').click();await page.screenshot({path:`${out}/extra-modes-open-390.png`});await multi.locator('.menu-mode').first().click();assert.equal(await multi.locator('.more-trigger').isDisabled(),true);
 assert.equal(await multi.locator('.actions [aria-pressed=true]').textContent(),'Ki','wait for authoritative HA mode');
 assert.deepEqual(await multi.evaluate(n=>n.calls[0]),['climate','set_hvac_mode',{hvac_mode:'heat'},{entity_id:'climate.ac'}]);
 await multi.evaluate(n=>{n.finish();n.hass={...n.hass,states:{...n.hass.states,'climate.ac':{...n.hass.states['climate.ac'],state:'heat'}}};return n.updateComplete;});
 await multi.locator('.more-trigger').focus();await page.keyboard.press('Tab');assert.equal(await multi.locator('.settings').evaluate(n=>n.getRootNode().activeElement===n),true);
 assert.equal(await multi.locator('.more-trigger').getAttribute('data-active'),'true');await multi.locator('.more-trigger').click();await page.keyboard.press('ArrowDown');assert.equal(await multi.locator('.menu-mode').nth(1).evaluate(n=>n.getRootNode().activeElement===n),true);await page.keyboard.press('Escape');assert.equal(await multi.locator('.more-trigger').getAttribute('aria-expanded'),'false');
 await page.screenshot({path:`${out}/compact-modes-390.png`});
 await page.goto(`${base}/iframe.html?id=cards-comfort--compact-climate&viewMode=story&globals=locale:hu`);
 const two=page.locator('luma-climate-card');await two.locator('[aria-pressed]').first().focus();await page.keyboard.press('Tab');assert.equal(await two.locator('[aria-pressed]').nth(1).evaluate(n=>n.getRootNode().activeElement===n),true);
 await page.keyboard.press('Tab');assert.equal(await two.locator('.settings').evaluate(n=>n.getRootNode().activeElement===n),true);
 assert.deepEqual(errors,[]);
 // Exercise the menu inside the slotted, independently scrolling sheet.
 await page.setViewportSize({width:390,height:700});
 const sheetCard=await open();
 await sheetCard.evaluate(n=>{n.setConfig({...n.config,climate:{...n.config.climate,modes:[{mode:'off'},{mode:'cool'},{mode:'heat'},{mode:'dry'}]}});return n.updateComplete;});
 await sheetCard.locator('.more-trigger').click();await page.keyboard.press('Tab');
 assert.equal(await sheetCard.locator('.settings').evaluate(n=>n.getRootNode().activeElement===n),true);
 assert.equal(await sheetCard.locator('.mode-menu').isVisible(),false);
 await sheetCard.locator('.more-trigger').click();await page.keyboard.press('Shift+Tab');
 assert.equal(await sheetCard.locator('.more-trigger').evaluate(n=>n.getRootNode().activeElement===n),true);
 await sheetCard.locator('.more-trigger').click();
 await page.locator('luma-bottom-sheet').evaluate(n=>{const content=n.shadowRoot.querySelector('.content');content.scrollTop=content.scrollTop>50?content.scrollTop-100:content.scrollTop+100;});
 await sheetCard.locator('.mode-menu').waitFor({state:'hidden'});
 assert.equal(await page.locator('dialog').isVisible(),true);
 await sheetCard.locator('.more-trigger').click();await page.keyboard.press('Escape');
 assert.equal(await page.locator('dialog').isVisible(),true);
 assert.equal(await sheetCard.locator('.more-trigger').evaluate(n=>n.getRootNode().activeElement===n),true);
 assert.deepEqual(errors,[]);
 console.log('Comfort details: 12 responsive captures; source/thermostat targets, actual heating, missing/restored states, shared thresholds, mock AC activation and Escape passed.');
}finally{await browser.close();}
