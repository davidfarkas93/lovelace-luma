import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE||'playwright-core');
const out='/private/tmp/luma-home-hero-ui';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
async function open(story){await page.goto(`http://127.0.0.1:6006/iframe.html?id=design-review-home-hero--${story}&viewMode=story&globals=locale:hu`);const card=page.locator('luma-home-hero-card');await card.waitFor();return card;}
try{
 for(const width of [390,768,1280])for(const theme of ['light','dark'])for(const story of ['quiet','advice','windy','windy-clear','busy','warning','missing','waste']){
 await page.setViewportSize({width,height:1000});const card=await open(story);
 if(theme==='dark')await page.evaluate(()=>{for(const[k,v]of Object.entries({'--primary-text-color':'#eee','--secondary-text-color':'#9b9ba5','--ha-card-background':'#25252b','--card-background-color':'#25252b','--primary-background-color':'#15161d'}))document.documentElement.style.setProperty(k,v);document.body.style.background='#15161d';});
 assert.deepEqual(await card.locator('.content,.top,.status,.weather-link,.banner-summary').evaluateAll(ns=>ns.filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>n.className)),[],'no overflow');
 assert.ok(await card.locator('.status button,.weather-link').evaluateAll(ns=>ns.every(n=>n.getBoundingClientRect().height>=44)),'44px controls');
 assert.doesNotMatch(await card.locator('.weather-link').textContent(),/jelzés|adatforrás/,'weather does not repeat attention');
 assert.equal(await card.locator('.wind').count(),story.startsWith('windy')?1:0);
 if(story==='quiet')assert.equal(await card.locator('luma-weather-advice .weather-advice').count(),0,'missing optional tip hidden');
 if(story==='missing')assert.equal(await card.locator('.sky').count(),0,'no fictional sky when weather missing');
 if(story==='busy'){assert.equal(await card.locator('.banner-group').getAttribute('open'),null);assert.match(await card.locator('.banner-summary').textContent(),/4/);await card.locator('.banner-summary').click();assert.equal(await card.locator('.banner').count(),4);await card.locator('.banner-summary').click();}
 await page.screenshot({path:`${out}/${story}-${width}-${theme}.png`});
 }
 let card=await open('quiet');await card.evaluate(n=>{n.calls=[];n.hass={...n.hass,callService:async(...a)=>n.calls.push(a)};});
 await card.locator('.weather-link').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>location.hash),'#weather');
 await card.locator('.alarm').click();await card.locator('luma-bottom-sheet dialog[open]').waitFor();
 assert.equal(await card.locator('.alarm-actions').evaluate(n=>getComputedStyle(n).display),'grid');
 assert.ok(await card.locator('.alarm-mode').evaluateAll(ns=>ns.every(n=>n.getBoundingClientRect().height>=48&&getComputedStyle(n).borderTopWidth==='0px')),'alarm controls use full touch targets and Luma surfaces');
 await page.screenshot({path:out+'/alarm-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/alarm-mobile.png'});
 await card.locator('.alarm-mode').first().click();assert.equal(await card.evaluate(n=>n.calls.length),0,'first tap only confirms');
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('luma-home-hero-card').alarmPopoverOpen);
 await card.locator('.alarm').click();await card.locator('.alarm-mode').first().click();assert.equal(await card.evaluate(n=>n.calls.length),0,'closing clears confirmation');
 await card.evaluate(n=>{n.hass={...n.hass,callService:async(...a)=>{n.calls.push(a);throw Error('mock failure')}};});
 await card.locator('.alarm-mode').first().click();await card.locator('[role=alert]').waitFor();assert.match(await card.locator('[role=alert]').textContent(),/sikertelen/);assert.deepEqual(await card.evaluate(n=>n.calls[0]),['alarm_control_panel','alarm_arm_away',undefined,{entity_id:'alarm_control_panel.home'}]);
 await card.evaluate(n=>{n.hass={...n.hass,callService:()=>new Promise(resolve=>n.finish=resolve)};});
 await card.locator('.alarm-mode').first().click();await card.locator('.alarm-mode').first().click();assert.ok(await card.locator('.alarm-mode').evaluateAll(ns=>ns.every(n=>n.disabled)));await card.evaluate(n=>n.finish());await page.waitForFunction(()=>!document.querySelector('luma-home-hero-card').alarmPopoverOpen);
 card=await open('windy');await card.evaluate(n=>{n.hass={...n.hass,states:{...n.hass.states,'weather.home':{...n.hass.states['weather.home'],attributes:{temperature:10,wind_speed:6,wind_speed_unit:'m/s'}}}};return n.updateComplete;});assert.equal(await card.locator('.wind').count(),1,'wind threshold normalized to km/h');
 assert.deepEqual(errors,[]);console.log('Home hero: 48 responsive captures; quiet/warning/missing states, 4-activity collapse, weather keyboard action, alarm confirmation/Escape/failure/pending and wind conversion passed.');
}catch(e){console.log(page.url(),errors);await page.screenshot({path:out+'/failure.png'});throw e;}finally{await browser.close();}
