import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE||'playwright-core');
const out='/private/tmp/luma-garden-ui';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LUMA_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.LUMA_STORYBOOK_URL||'http://127.0.0.1:6006';
async function open(story){await page.goto(`${base}/iframe.html?id=design-review-garden-and-camera--${story}&viewMode=story&globals=locale:hu`);await page.locator('luma-camera-activity-card').waitFor();}
try{
 for(const width of [390,768,1280])for(const theme of ['light','dark'])for(const story of ['proposed','active','missing','no-events','main-context']){
  await page.setViewportSize({width,height:1100});await open(story);
  if(theme==='dark')await page.evaluate(()=>{for(const[k,v]of Object.entries({'--primary-text-color':'#eee','--secondary-text-color':'#9b9ba5','--primary-background-color':'#15161d','--ha-card-background':'#25252b','--card-background-color':'#25252b'}))document.documentElement.style.setProperty(k,v);});
  const camera=page.locator('luma-camera-activity-card');
  if(story==='missing'){assert.match(await camera.locator('.title').textContent(),/nem elérhető/);assert.equal(await camera.locator('img').count(),0);assert.equal(await camera.locator('.media').isDisabled(),true);}
  if(story==='no-events')assert.match(await camera.locator('.title').textContent(),/Nincs friss/);
  for(const card of await page.locator('luma-metric-card,luma-camera-activity-card').all())assert.deepEqual(await card.locator('ha-card,.value,.content,.actions').evaluateAll(ns=>ns.filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>n.className)),[],'no clipping');
  if(story!=='no-events'){
   const pair=page.locator('luma-metric-card').filter({has:page.locator('.label',{hasText:/^(Fűnyíró|Öntözés)$/})});
   // HA's native grid top-aligns cards; the card surface must still fill its row.
   await pair.evaluateAll(ns=>ns.forEach(n=>{n.style.alignSelf='start';n.parentElement.style.alignItems='start';}));
   const heights=await pair.locator('ha-card').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().height));
   assert.equal(heights.length,2);assert.ok(Math.abs(heights[0]-heights[1])<1,'paired status cards fill the same row height');
  }
  if(story==='active')assert.match(await page.locator('luma-metric-card .status').first().textContent(),/Füvet nyír/);
  await page.screenshot({path:`${out}/${story}-${width}-${theme}.png`,fullPage:true});
 }
 await open('proposed');const metrics=page.locator('luma-metric-card').filter({has:page.locator('.label',{hasText:'Fűnyíró'})}),camera=page.locator('luma-camera-activity-card');
 assert.equal(await page.locator('luma-metric-card .reading-unit').textContent(),'kWh');
 await metrics.first().locator('.primary-action').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>location.hash),'#lawn');
 await metrics.first().evaluate(n=>{n.hass={...n.hass,states:{...n.hass.states,'lawn_mower.garden':{...n.hass.states['lawn_mower.garden'],state:'docked',attributes:{restored:true}}}};return n.updateComplete;});assert.doesNotMatch(await metrics.first().locator('.value').textContent(),/Dokkolva/);
 await camera.evaluate(n=>{n.hass={...n.hass,states:{...n.hass.states,'sensor.garden_events':{...n.hass.states['sensor.garden_events'],state:'unavailable'}}};return n.updateComplete;});
 await camera.locator('img').waitFor({state:'detached'});assert.match(await camera.locator('.title').textContent(),/nem elérhető/);assert.equal(await camera.locator('.media').isDisabled(),true);
 await metrics.first().evaluate(n=>{n.setConfig({...n.config,error_states:['error']});n.hass={...n.hass,states:{...n.hass.states,'lawn_mower.garden':{...n.hass.states['lawn_mower.garden'],state:'error',attributes:{}}}};return n.updateComplete;});assert.match(await metrics.first().locator('ha-card').getAttribute('style'),/state-error/);
 await open('proposed');const validCamera=page.locator('luma-camera-activity-card');
 await validCamera.evaluate(n=>{n.hass={...n.hass,states:{...n.hass.states,'sensor.garden_events':{...n.hass.states['sensor.garden_events'],attributes:{events:[{timestamp:'not-a-date',snapshot:'/bad.jpg'}]}}}};return n.updateComplete;});await validCamera.locator('img').waitFor({state:'detached'});assert.match(await validCamera.locator('.title').textContent(),/Nincs friss/);
 await open('proposed');await page.locator('luma-camera-activity-card .action.all').click();assert.equal(await page.evaluate(()=>location.pathname),'/camera');
 assert.deepEqual(errors,[]);console.log('Garden UI: 30 responsive captures; status/metric hierarchy, missing/restored data, stale snapshot removal, keyboard navigation and camera timeline navigation passed.');
}finally{await browser.close();}
