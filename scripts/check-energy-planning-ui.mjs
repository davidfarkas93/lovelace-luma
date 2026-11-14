import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE||'playwright-core');
const output='/private/tmp/luma-energy-planning-ui';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-gpu']});
const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const report=page.locator('luma-daily-report-card'),sheet=report.locator('luma-bottom-sheet');
try{
 for(const width of [390,768,1280])for(const lang of ['hu','en'])for(const state of ['energy-planning','energy-planning-expired','energy-planning-missing']){
  await page.setViewportSize({width,height:844});await page.goto(`http://127.0.0.1:6006/iframe.html?id=cards-daily-report--${state}&viewMode=story&globals=locale:${lang}`);
  await report.locator('.preview-text').waitFor();await page.waitForTimeout(100);
  const text=await report.locator('.preview-text').textContent();
  if(state==='energy-planning'){assert.match(text,lang==='hu'?/^Ma:/:/^Today:/);assert.match(text,/ha töltenéd/);assert.doesNotMatch(text,/Tegnap|Yesterday/);}
  else {assert.match(text,lang==='hu'?/^Tegnap:/:/^Yesterday:/);assert.doesNotMatch(text,/ha töltenéd/);}
  assert.equal(await report.locator('.preview-footer,.preview-period,.detail-quality').count(),0,'the hero stays compact');
  assert.ok(await page.locator('luma-hero-card').locator('ha-card').first().evaluate(n=>n.scrollWidth<=n.clientWidth+1));
  await page.screenshot({path:`${output}/${state}-${lang}-${width}-hero.png`,animations:'disabled'});
  await report.locator('.preview-button').click();await sheet.locator('dialog[open]').waitFor();
  await report.locator('.today-planning').waitFor();assert.match(await report.locator('.summary').textContent(),/korábbi napok mediánja/,'yesterday’s measurements remain separate');
  const detail=await report.locator('.today-planning').textContent();assert.doesNotMatch(detail,/NaN|undefined/);
  assert.match(detail,lang==='hu'?/kizárólag napelemes töltés/:/solar-only charging/);
  if(state==='energy-planning-expired')assert.match(detail,lang==='hu'?/már nem aktuális/:/expired/);
  if(state==='energy-planning-missing')assert.match(detail,/Nincs elég friss/);
  assert.ok(await report.locator('.report-details').evaluate(n=>n.scrollWidth<=n.clientWidth+1));
  await page.screenshot({path:`${output}/${state}-${lang}-${width}-detail.png`,animations:'disabled'});
  await page.keyboard.press('Escape');await sheet.locator('dialog').waitFor({state:'hidden'});
 }
 assert.deepEqual(errors,[]);console.log('Energy planning: current/expired/missing, HU/EN 390/768/1280, explicit Today/Yesterday separation, compact heroes, forecast limitations and read-only details passed.');
}finally{await browser.close();}
