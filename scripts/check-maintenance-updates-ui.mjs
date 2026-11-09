import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE||'playwright-core');
const output=process.env.LUMA_UI_OUTPUT||'/private/tmp/luma-maintenance-updates-ui';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LUMA_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-gpu']});
const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const all=()=>page.locator('luma-discovery-card luma-attention-card');
const update=id=>all().locator('luma-update-card').filter({hasText:id});
const story=async lang=>{await page.goto(`http://127.0.0.1:6006/iframe.html?id=patterns-infrastructure--policy-updates&viewMode=story&globals=locale:${lang}`);await all().locator('luma-update-card').first().waitFor();};
const capture=async name=>{await page.waitForTimeout(120);await page.screenshot({path:`${output}/${name}.png`,fullPage:true,animations:'disabled',timeout:15000});};
const mock=async()=>{await update('Weather integration').evaluate(card=>{card.testCalls=[];card.hass={...card.hass,callService:async(...args)=>{card.testCalls.push(args);}};});};
try {
 for(const width of [390,768,1280])for(const language of ['hu','en']){
  await page.setViewportSize({width,height:844});await story(language);
  assert.equal(await all().locator('luma-update-card').count(),3,'policy-backed embedded discovery must keep dedicated update cards');
  assert.equal(await all().locator('button.item').count(),0,'maintenance must not turn updates into notification-detail rows');
  await mock();
  const button=update('Weather integration').locator('button.action');
  await button.click();assert.equal(await update('Weather integration').evaluate(c=>c.testCalls.length),0,'first tap only confirms');
  assert.match(await button.textContent(),language==='hu'?/Megerősítés/:/Confirm/);
  await capture(`${language}-${width}-confirm`);
  await button.click();
  const calls=await update('Weather integration').evaluate(c=>c.testCalls);
  assert.equal(calls.length,1);assert.equal(calls[0][0],'update');assert.equal(calls[0][1],'install');assert.equal(calls[0][3].entity_id,'update.installable');
  assert.equal(await page.locator('dialog[open]').count(),0,'installation confirmation stays inline');
  const external=update('Virtualization host packages');
  assert.match(await external.locator('button.action').textContent(),language==='hu'?/Részletek/:/Details/);
  await external.evaluate(c=>{c.testCalls=[];c.hass={...c.hass,callService:async(...args)=>c.testCalls.push(args)};c.addEventListener('hass-more-info',e=>c.moreInfo=e.detail);});
  await external.locator('button.action').click();
  assert.equal(await external.evaluate(c=>c.testCalls.length),0,'unsupported host updates cannot call update.install');
  assert.equal(await external.evaluate(c=>c.moreInfo.entityId),'update.external');
  assert.equal(await update('Installing update').locator('button.action').isDisabled(),true,'0% counts as installing');
 }
 await story('hu');await mock();
 const card=update('Weather integration'),button=card.locator('button.action');await button.click();
 await card.evaluate(c=>{c.hass={...c.hass,states:{...c.hass.states,'update.installable':{...c.hass.states['update.installable'],attributes:{...c.hass.states['update.installable'].attributes,latest_version:'3.0'}}}};});
 await button.click();assert.equal(await card.evaluate(c=>c.testCalls.length),0,'a changed target version needs a new confirmation');
 await card.evaluate(c=>{c.hass={...c.hass,callService:async()=>{throw Error('Denied')}};});
 await button.click();await card.locator('[role="alert"]').waitFor();assert.match(await card.locator('[role="alert"]').textContent(),/Nem sikerült/);
 // A busy request must not allow a second submission.
 await story('hu');
 await update('Weather integration').evaluate(c=>{c.testCalls=[];c.hass={...c.hass,callService:(...args)=>{c.testCalls.push(args);return new Promise(resolve=>c.finish=resolve)}};});
 await update('Weather integration').locator('button.action').click();await update('Weather integration').locator('button.action').click();
 assert.equal(await update('Weather integration').locator('button.action').isDisabled(),true);
 assert.equal(await update('Weather integration').evaluate(c=>c.testCalls.length),1);
 await update('Weather integration').evaluate(c=>c.finish());
 // Notification updates use the same installer inside the existing detail sheet.
 for(const width of [390,768,1280])for(const language of ['hu','en']){
  await page.setViewportSize({width,height:844});
  await page.goto(`http://127.0.0.1:6006/iframe.html?id=attention-shared-policy--review-flow&viewMode=story&globals=locale:${language}`);
  await page.locator('luma-home-hero-card button.attention').click();await page.locator('luma-attention-card dialog.open').waitFor();
  const panel=page.locator('luma-attention-card');
  assert.equal(await panel.locator('luma-update-card').count(),0,'the initial list stays informational');
  await panel.locator('button.item:visible').filter({hasText:'Application updates'}).click();
  assert.equal(await panel.locator('.members luma-update-card').count(),2);
  const weather=panel.locator('luma-update-card').filter({hasText:'Weather integration'});
  await weather.evaluate(c=>{c.testCalls=[];c.hass={...c.hass,callService:async(...args)=>c.testCalls.push(args)};});
  await weather.locator('button.action').click();assert.equal(await weather.evaluate(c=>c.testCalls.length),0);
  await capture(`${language}-${width}-notification-confirm`);
  await weather.locator('button.action').click();
  assert.equal(await weather.evaluate(c=>c.testCalls[0][3].entity_id),'update.weather');
  assert.equal(await page.locator('dialog[open]').count(),1,'an update uses the already open notification sheet');
  await page.locator('luma-home-hero-card').evaluate(hero=>{const old=hero.hass.states['update.weather'];hero.hass={...hero.hass,states:{...hero.hass.states,'update.weather':{...old,state:'off',attributes:{...old.attributes,installed_version:old.attributes.latest_version}}}};});
  await panel.locator('.members luma-update-card').filter({hasText:'Camera card'}).waitFor();
  assert.equal(await panel.locator('.members luma-update-card').count(),1,'the remaining update stays reachable after the first completes');
  const backLabel=language==='hu'?'Vissza a jelzésekhez':'Back to notifications';await panel.locator(`luma-bottom-sheet button[aria-label="${backLabel}"]`).click();
  await panel.locator('button.item:visible').filter({hasText:'Virtualization host'}).click();
  const host=panel.locator('.members luma-update-card');
  assert.match(await host.locator('button.action').textContent(),language==='hu'?/Részletek/:/Details/);
 }
 assert.deepEqual(errors,[]);
 console.log('Maintenance update regression: exact discovery/policy/embedded path, HU/EN × 390/768/1280, Operations and notification group/single updates, inline confirmation, install capability, progress, version change, busy and failure paths passed with mocks only.');
}finally{await browser.close();}
