import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE||'playwright-core');
const out='/private/tmp/luma-room-ui';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
for(const width of [390,768,1280])for(const locale of ['hu','en'])for(const story of ['rooms','missing']){
 await page.setViewportSize({width,height:1000});await page.goto(`http://127.0.0.1:6006/iframe.html?id=design-review-room-mobile--${story}&viewMode=story&globals=locale:${locale}`);
 const cards=page.locator('luma-room-card');await cards.first().waitFor();
 const heights=await cards.locator('ha-card').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().height));
 assert.ok(Math.abs(heights[0]-heights[1])<1&&Math.abs(heights[2]-heights[3])<1,'equal heights per row');
 assert.deepEqual(await cards.locator('.card,.top,.pill-control,.env').evaluateAll(ns=>ns.filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>n.className)),[],'no clipped text');
 assert.ok(await cards.locator('.pill-control').evaluateAll(ns=>ns.every(n=>n.getBoundingClientRect().height>=44)));
 if(width===390){assert.ok(await cards.locator('.control-name').evaluateAll(ns=>ns.every(n=>getComputedStyle(n).display==='none')));assert.ok(await cards.locator('.pill-control').evaluateAll(ns=>ns.every(n=>n.clientHeight<=46||n.textContent.includes('unavailable')||n.textContent.includes('elérhető'))));}
 if(story==='missing')assert.equal(await cards.locator('.pill-control[disabled]').count(),4);
 await page.screenshot({path:`${out}/${story}-${width}-${locale}.png`});
}
const card=page.locator('luma-room-card').first();await card.evaluate(n=>{n.calls=[];n.infos=[];n.hass={...n.hass,callService:async(...a)=>n.calls.push(a)};n.addEventListener('hass-more-info',e=>n.infos.push(e.detail.entityId));});
await card.locator('.pill-control').nth(1).click();assert.deepEqual(await card.evaluate(n=>n.infos),['cover.room0']);assert.equal(await page.evaluate(()=>location.hash),'');
assert.deepEqual(errors,[]);console.log('Room: 12 responsive HU/EN captures, equal row heights, mobile controls, unavailable states and isolated cover More Info passed.');
}catch(e){await page.screenshot({path:out+'/failure.png'});console.log(await page.locator('luma-room-card').first().locator('.top,.name,.env,.icon,.arrow').evaluateAll(ns=>ns.map(n=>({cls:n.className,width:n.clientWidth,scroll:n.scrollWidth,rect:n.getBoundingClientRect().toJSON()}))));throw e;}finally{await browser.close();}
