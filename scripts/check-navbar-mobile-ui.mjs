import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE||'playwright-core');
const out='/private/tmp/luma-navbar-mobile-ui';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
async function open(){await page.goto('http://127.0.0.1:6006/iframe.html?id=navigation-grouped-menu--floating-media&viewMode=story&globals=locale:hu');await page.locator('luma-navbar-card').waitFor();return page.locator('luma-navbar-card');}
try{
 for(const width of [390,768,1280]){
 await page.setViewportSize({width,height:844});const nav=await open();
 assert.equal(await nav.locator('.media-bubble').isVisible(),width<768);
 assert.equal(await nav.locator('.media-dock').isVisible(),width>=768);
 const box=await nav.locator('.primary').boundingBox();assert.equal(Math.round(844-box.y-box.height),width<768?6:16);
 await page.screenshot({path:`${out}/navbar-${width}.png`});
 }
 await page.setViewportSize({width:390,height:844});const nav=await open();
 await nav.evaluate(n=>{n.calls=[];n.hass={...n.hass,callService:async(...a)=>n.calls.push(a)};});
 await nav.locator('.media-bubble').focus();await page.keyboard.press('Enter');await nav.locator('.media-choice').first().waitFor({state:'visible'});
 assert.equal(await nav.locator('.media-choice').count(),2);await page.screenshot({path:out+'/picker.png'});
 await nav.locator('.media-choice').nth(1).click();await page.waitForFunction(()=>location.hash==='#bedroom-remote');await nav.locator('luma-popup-card').nth(1).locator('dialog[open]').waitFor();await page.screenshot({path:out+'/remote.png'});
 await page.keyboard.press('Escape');await page.waitForFunction(()=>location.hash==='');
 await nav.evaluate(n=>{n.hass={...n.hass,states:{...n.hass.states,'media_player.bedroom':{...n.hass.states['media_player.bedroom'],state:'off'}}};return n.updateComplete;});
 assert.equal(await nav.locator('.media-count').count(),0);await nav.locator('.media-bubble').click();await page.waitForFunction(()=>location.hash==='#tv-remote');await nav.locator('luma-popup-card').first().locator('dialog[open]').waitFor();await page.keyboard.press('Escape');await page.waitForFunction(()=>location.hash==='');
 await nav.evaluate(n=>{n.hass={...n.hass,states:{...n.hass.states,'media_player.tv':{...n.hass.states['media_player.tv'],attributes:{restored:true}}}};return n.updateComplete;});
 assert.equal(await nav.locator('.media-bubble').count(),0,'restored media must not appear active');
 assert.deepEqual(await nav.evaluate(n=>n.calls),[],'opening media never calls a device service');assert.deepEqual(errors,[]);
 for(const width of [390,1280]){
 await page.setViewportSize({width,height:844});await page.goto('http://127.0.0.1:6006/iframe.html?id=navigation-grouped-menu--floating-without-artwork&viewMode=story&globals=locale:hu');
 const fallback=page.locator(width<768?'.media-bubble img':'.media-dock .art img');await fallback.waitFor({state:'visible'});assert.match(await fallback.getAttribute('src'),/^data:image\/svg\+xml,/);await page.screenshot({path:`${out}/placeholder-${width}.png`});
 }
 console.log('Navbar: responsive bubble/desktop dock, bottom spacing, keyboard picker, correct remote, Escape, single player and restored/off visibility passed.');
}finally{await browser.close();}
