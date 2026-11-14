import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE||'playwright-core');
const output=process.env.LUMA_UI_OUTPUT||'/private/tmp/luma-interactions-ui';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LUMA_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const base=process.env.LUMA_STORYBOOK_URL||'http://127.0.0.1:6006';
async function open(story,tag,mode='light'){
 await page.goto(`${base}/iframe.html?id=design-system-interactions--${story}&viewMode=story&globals=locale:hu`);
 const card=page.locator(tag);await card.waitFor();
 await page.evaluate(mode=>{const colors=mode==='dark'?{'--primary-text-color':'#eee','--secondary-text-color':'#b9bbc6','--primary-background-color':'#15161d','--ha-card-background':'#25252b','--card-background-color':'#25252b'}:{};for(const [k,v] of Object.entries(colors))document.documentElement.style.setProperty(k,v);},mode);
 await card.evaluate(n=>{n.calls=[];n.infos=[];n.hass={...n.hass,callService:async(...args)=>n.calls.push(args)};n.addEventListener('hass-more-info',e=>n.infos.push(e.detail.entityId));});
 return card;
}
try{
 for(const width of [390,768,1280])for(const mode of ['light','dark']){
  await page.setViewportSize({width,height:900});
  let card=await open('metric-actions','luma-metric-card',mode);
  await card.locator('.primary-action').focus();await page.keyboard.press('Enter');
  await card.locator('.secondary-action').focus();await page.keyboard.press('Space');
  assert.deepEqual(await card.evaluate(n=>n.infos),['sensor.temperature','sensor.humidity']);
  assert.equal(await card.locator('button button').count(),0);
  await page.screenshot({path:`${output}/metric-${width}-${mode}.png`});
  card=await open('room-actions-and-status','luma-room-card',mode);
  assert.equal(await card.locator('.pill-status').count(),1);
  await card.locator('.top').focus();await page.keyboard.press('Enter');
  const toggle=card.locator('.pill-control').first();await toggle.focus();await page.keyboard.press('Space');
  assert.equal(await card.evaluate(n=>n.calls.length),1);assert.deepEqual(await card.evaluate(n=>n.infos),['sensor.temperature']);
  await card.locator('.pill-control').nth(1).click();assert.deepEqual(await card.evaluate(n=>n.infos),['sensor.temperature','cover.room']);
  for(const rect of await card.locator('.pill-control').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().height)))assert.ok(rect>=44);
  await page.screenshot({path:`${output}/room-${width}-${mode}.png`});
  await card.evaluate(n=>{n.setConfig({...n.config,tap_action:{action:'none'}});});assert.equal(await card.locator('button.top').count(),0);
  card=await open('gate-popover','luma-gate-card',mode);
  await card.locator('.summary').focus();await page.keyboard.press('Enter');
  assert.equal(await card.evaluate(n=>n.shadowRoot.activeElement?.className),'close');
  await page.keyboard.press('Escape');await card.locator('.popover').waitFor({state:'hidden'});
  assert.equal(await card.evaluate(n=>n.shadowRoot.activeElement?.className),'summary');
  await card.locator('.summary').click();await card.locator('.primary').click();assert.equal(await card.evaluate(n=>n.calls.length),0);
  await page.screenshot({path:`${output}/gate-confirm-${width}-${mode}.png`});
  await card.locator('.primary').click();assert.equal(await card.evaluate(n=>n.calls.length),1);await card.locator('.popover').waitFor({state:'hidden'});
  assert.equal(await card.evaluate(n=>n.shadowRoot.activeElement?.className),'summary');
 }
 let card=await open('gate-popover','luma-gate-card');
 await card.evaluate(n=>{n.hass={...n.hass,callService:()=>new Promise((resolve,reject)=>{n.resolveCall=resolve;n.rejectCall=reject;})};});
 await card.locator('.summary').click();await card.locator('.primary').click();await card.locator('.primary').click();
 assert.equal(await card.locator('.primary').isDisabled(),true);
 await card.evaluate(n=>n.rejectCall(new Error('mock failure')));await card.locator('[role="alert"]').waitFor();assert.equal(await card.locator('.primary').isDisabled(),false);
 await card.locator('.primary').click();assert.equal(await card.locator('.primary').textContent(),'Megerősítés');
 await page.keyboard.press('Escape');await card.locator('.summary').click();assert.doesNotMatch(await card.locator('.primary').textContent(),/Megerősítés/);
 card=await open('gate-unavailable','luma-gate-card');assert.equal(await card.locator('.primary').isDisabled(),true);assert.match(await card.locator('ha-card').getAttribute('style'),/secondary-text-color/);
 card=await open('metric-actions','luma-metric-card');await card.evaluate(n=>n.setConfig({...n.config,tap_action:{action:'none'},secondary_tap_action:{action:'none'}}));assert.equal(await card.locator('button').count(),0);
 assert.deepEqual(errors,[]);console.log('Interaction checks passed: separate native actions, no propagation, 44px controls, gate confirmation, focus/Escape, pending/failure and unavailable states; 18 responsive screenshots.');
}finally{await browser.close();}
