import assert from 'node:assert/strict';import {mkdirSync} from 'node:fs';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE||'playwright-core');
const output='/private/tmp/luma-hero-report-ui';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-gpu']});
const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const hero=page.locator('luma-hero-card'),report=hero.locator('luma-daily-report-card'),sheet=report.locator('luma-bottom-sheet');
try{
 for(const width of [390,768,1280])for(const lang of ['hu','en'])for(const scope of ['energy','heating','nas','operations']){
  await page.setViewportSize({width,height:844});await page.goto(`http://127.0.0.1:6006/iframe.html?id=cards-daily-report--hero-${scope}&viewMode=story&globals=locale:${lang}`);
  await report.locator('.preview-text').waitFor();await page.waitForTimeout(100);
  assert.equal(await report.locator('.metric').count(),0);assert.equal(await page.locator('luma-daily-report-card').count(),1);
  assert.ok(await report.locator('ha-card').evaluate(n=>getComputedStyle(n).backgroundColor==='rgba(0, 0, 0, 0)'&&getComputedStyle(n).borderTopWidth==='0px'),'the report has no separate card surface');
  assert.ok(await hero.locator('ha-card').first().evaluate(n=>n.scrollWidth<=n.clientWidth+1));
  const outer=await hero.locator('ha-card').first().boundingBox(),summary=await hero.locator('.report').boundingBox();assert.ok(summary.width>outer.width*.8,'summary must span the hero even with inline chips');
  await page.screenshot({path:`${output}/${scope}-${lang}-${width}.png`,animations:'disabled'});
  await report.locator('.preview-button').click();await sheet.locator('dialog[open]').waitFor();assert.equal(await page.evaluate(()=>location.hash),'','detail click must not navigate the hero');
  await report.locator('.report-details').waitFor();assert.ok(await report.locator('.metric').count()>=3);
  await page.keyboard.press('Escape');await sheet.locator('dialog').waitFor({state:'hidden'});assert.equal(await report.locator('.preview-button').evaluate(n=>n.getRootNode().activeElement===n),true);
  await page.keyboard.press('Enter');await sheet.locator('dialog[open]').waitFor();assert.equal(await page.evaluate(()=>location.hash),'','detail keyboard event must not trigger hero navigation');
  await sheet.locator('.close').click();await sheet.locator('dialog').waitFor({state:'hidden'});
 }
 for(const [state,pattern] of [['failed',/Nem készült/],['missed',/kimaradt/],['partial',/Hiányos adatok/],['restricted',/adminisztrátori/]]){
  await page.goto(`http://127.0.0.1:6006/iframe.html?id=cards-daily-report--hero-${state}&viewMode=story&globals=locale:hu`);await report.locator('.preview-text').waitFor();await page.waitForTimeout(150);assert.match(await report.locator('.preview-button').textContent(),pattern);
  if(state!=='partial')assert.doesNotMatch(await report.locator('.preview-text').textContent(),/KORÁBBI/);
 }
 await page.goto('http://127.0.0.1:6006/iframe.html?id=cards-daily-report--hero-energy&viewMode=story&globals=locale:hu');await report.locator('.preview-text').waitFor();await page.waitForTimeout(100);await report.locator('.preview-button').click();await sheet.locator('dialog[open]').waitFor();
 await hero.evaluate(h=>{h.hass={...h.hass,connection:{},callWS:async()=>{throw Error('new account offline')}};});await page.waitForTimeout(150);assert.equal(await report.locator('.report-details').count(),0);assert.equal(await report.locator('.preview-button').getAttribute('aria-expanded'),'false');
 assert.deepEqual(errors,[]);console.log('Hero reports: all four scopes, HU/EN 390/768/1280, integrated surface, details/keyboard/focus, no parent navigation, failed/missed/partial/restricted states and account isolation passed.');
}finally{await browser.close();}
