import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE||'playwright-core');
const out=process.env.LUMA_UI_OUTPUT||'/private/tmp/luma-comfort-ui';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LUMA_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.LUMA_STORYBOOK_URL||'http://127.0.0.1:6006';
async function open(story,mode){
 await page.goto(`${base}/iframe.html?id=cards-comfort--${story}&viewMode=story&globals=locale:hu`);const card=page.locator('luma-comfort-card');await card.waitFor();
 if(mode==='dark')await page.evaluate(()=>{for(const[k,v]of Object.entries({'--primary-text-color':'#eee','--secondary-text-color':'#9b9ba5','--primary-background-color':'#15161d','--ha-card-background':'#25252b','--card-background-color':'#25252b'}))document.documentElement.style.setProperty(k,v);});
 return card;
}
try{
 for(const width of [390,768,1280])for(const mode of ['light','dark']){
  await page.setViewportSize({width,height:1000});
  for(const story of ['integrated','cooling','warning','missing','alongside-rooms']){
   const card=await open(story,mode);
   assert.deepEqual(await card.locator('.card,.metric,.header,.actions').evaluateAll(ns=>ns.filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>n.className)),[],'no overflow');
   if(story==='integrated'){assert.equal(await card.locator('.climate').count(),0);assert.match(await card.locator('ha-card').getAttribute('style'),/success/);}
   if(story==='cooling'){assert.match(await card.locator('.climate-state').textContent(),/Épp hűt.*24 °C/);assert.equal(await card.locator('.operation').count(),1,'no duplicate AC activity chip');}
   if(story==='warning'){assert.equal(await card.locator('.reason').count(),0);assert.equal(await card.locator('.metric[data-severity=warning]').count(),1);assert.match(await card.locator('.metric[data-severity=warning]').getAttribute('aria-label'),/Emelkedett PM2.5/);assert.equal(await card.locator('.metric[data-severity=warning] .trend').textContent(),'↑');assert.match(await card.locator('ha-card').getAttribute('style'),/warning/);}
   if(story==='missing'){assert.match(await card.locator('.badge').textContent(),/Hiányos/);assert.equal(await card.locator('.climate [aria-pressed]').count(),0);}
   for(const size of await card.locator('button').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().height)))assert.ok(size>=44,'44px action');
   await page.screenshot({path:`${out}/${story}-${width}-${mode}.png`,fullPage:true});
  }
 }
 let card=await open('cooling','light');
 await card.evaluate(n=>{n.calls=[];n.infos=[];n.hass={...n.hass,callService:async(...args)=>{n.calls.push(args);throw Error('mock failure');}};n.addEventListener('hass-more-info',e=>n.infos.push(e.detail.entityId));});
 await card.locator('.metric').first().click();await card.locator('.settings').click();
 assert.deepEqual(await card.evaluate(n=>n.infos),['sensor.temperature','climate.ac']);
 await card.locator('.action[aria-pressed=false]').focus();await page.keyboard.press('Enter');
 assert.match(await card.locator('[role=alert]').textContent(),/sikertelen/);
 assert.deepEqual(await card.evaluate(n=>n.calls[0]),['climate','set_hvac_mode',{hvac_mode:'off'},{entity_id:'climate.ac'}]);
 assert.equal(await page.evaluate(()=>location.hash),'','controls must not open summary');
 await card.evaluate(n=>{n.hass={...n.hass,callService:(...args)=>{n.calls.push(args);return new Promise(resolve=>{n.finish=resolve;});}};});
 await card.locator('.action[aria-pressed=false]').click();assert.equal(await card.locator('.action[aria-pressed=true]').isDisabled(),true);
 await card.evaluate(n=>n.finish());await card.evaluate(n=>n.updateComplete);assert.equal(await card.locator('[role=alert]').count(),0);
 await card.evaluate(n=>{n.hass={...n.hass,states:{...n.hass.states,'climate.ac':{...n.hass.states['climate.ac'],state:'off'}}};return n.updateComplete;});
 assert.equal(await card.locator('.climate').count(),0,'off disappears after HA update');
 await card.locator('.header').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>location.hash),'#environment');
 card=await open('cooling','light');
 await card.evaluate(n=>{n.hass={...n.hass,states:{...n.hass.states,'climate.ac':{...n.hass.states['climate.ac'],attributes:{hvac_modes:['off'],restored:true,temperature:99}}}};return n.updateComplete;});
 assert.match(await card.locator('.climate-state').textContent(),/Friss adatra vár/);assert.doesNotMatch(await card.locator('.climate-state').textContent(),/99/);assert.equal(await card.locator('[aria-pressed]').count(),0);
 await card.evaluate(n=>{n.hass={...n.hass,states:{...n.hass.states,'climate.ac':{...n.hass.states['climate.ac'],attributes:{hvac_modes:['off'],temperature:24}}}};return n.updateComplete;});
 assert.equal(await card.locator('[aria-pressed]').count(),1,'unsupported mode excluded');assert.match(await card.locator('.climate-state').textContent(),/Hűtés mód/,'mode must not imply actual compressor activity');
 assert.deepEqual(errors,[]);console.log('Comfort UI: 30 responsive captures, Room consistency, off-hidden/active/unavailable/restored climate, source More Info, keyboard sheet entry, supported modes, mocked failure/retry/pending and service target passed.');
}catch(error){console.error('Failed page',page.url(),errors,await page.locator('body').innerText());await page.screenshot({path:out+'/failure.png'});throw error;}finally{await browser.close();}
