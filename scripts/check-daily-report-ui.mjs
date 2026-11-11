import assert from 'node:assert/strict';import {mkdirSync} from 'node:fs';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE||'playwright-core');
const output=process.env.LUMA_UI_OUTPUT||'/private/tmp/luma-daily-report-ui';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LUMA_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-gpu']});
const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const card=()=>page.locator('luma-daily-report-card');
const open=async(story='complete',lang='hu')=>{await page.goto(`http://127.0.0.1:6006/iframe.html?id=cards-daily-report--${story}&viewMode=story&globals=locale:${lang}`);await card().locator('.preview-title').waitFor();await page.waitForTimeout(180);assert.equal(await card().locator('.metric').count(),0,'measurements stay out of the compact card');assert.equal(await card().locator('.report-details').count(),0,'closed sheets do not keep private detail DOM');assert.ok(await card().locator('ha-card').evaluate(c=>c.getBoundingClientRect().height<230),'the summary stays compact');await card().locator('.preview-button').click();await card().locator('luma-bottom-sheet').locator('dialog[open]').waitFor();await card().locator('.report-details').waitFor();};
try{
 for(const width of [390,768,1280])for(const lang of ['hu','en']){
  await page.setViewportSize({width,height:844});await open('complete',lang);
  await card().locator('.summary').waitFor();assert.match(await card().locator('.summary').textContent(),/kazán/);
  assert.equal(await card().locator('.metric').count(),3);
  await card().locator('.coverage summary').click();assert.match(await card().locator('.coverage').textContent(),/100%/);
  await card().locator('.analysis summary').click();assert.equal(await card().locator('.analysis h3').count(),2);
  await card().locator('.facts summary').click();assert.match(await card().locator('.evidence').textContent(),/Boiler/);
  assert.equal(await card().locator('.previous').count(),0,'the current report is not repeated as previous success');
  assert.ok(await card().evaluate(c=>c.getBoundingClientRect().right<=innerWidth+1));
  await page.screenshot({path:`${output}/${lang}-${width}.png`,animations:'disabled',fullPage:true});
  const sheet=card().locator('luma-bottom-sheet');
  await page.keyboard.press('Escape');await sheet.locator('dialog').waitFor({state:'hidden'});assert.equal(await card().locator('.preview-button').evaluate(n=>n.getRootNode().activeElement===n),true,'closing restores keyboard focus');
  await page.screenshot({path:`${output}/compact-${lang}-${width}.png`,animations:'disabled',fullPage:true});
  await page.keyboard.press('Enter');await sheet.locator('dialog[open]').waitFor();await sheet.locator('.close').click();await sheet.locator('dialog').waitFor({state:'hidden'});
  await card().locator('.preview-button').click();await sheet.locator('dialog[open]').waitFor();await sheet.locator('.scrim').click({position:{x:5,y:5}});await sheet.locator('dialog').waitFor({state:'hidden'});
  await card().locator('.preview-button').click();await sheet.locator('.layer.open').waitFor();await page.waitForTimeout(80);const handle=await sheet.locator('.handle-zone').boundingBox();await page.mouse.move(handle.x+handle.width/2,handle.y+15);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2,handle.y+155,{steps:8});await page.mouse.up();await sheet.locator('dialog').waitFor({state:'hidden'});

  await open('failed',lang);assert.equal(await card().locator('.summary:visible').count(),0,'a failed attempt cannot reuse the old successful narrative as its summary');
  assert.match(await card().locator('.status').textContent(),lang==='hu'?/Nem készült/:/could not be completed/);
  await card().locator('.previous summary').click();assert.match(await card().locator('.previous .summary').textContent(),/KORÁBBI/);
  await open('partial',lang);assert.match(await card().locator('.status').textContent(),lang==='hu'?/Nincs elég adat/:/Insufficient/);
  assert.equal((await card().locator('.metric strong').allTextContents())[2],'—','unknown historical gap counts must not render as zero');
 }
 for(const [story,pattern] of [['missed',/kimaradt/],['interrupted',/nem fejeződött/],['running',/készül/],['waiting',/vár/],['no-observation',/nincs megfigyelés/],['clear',/Nem találtam eltérést/],['unavailable',/nem olvasható/],['restricted',/adminisztrátori/],['stale',/nem olvasható/]]){
  await open(story);assert.match(await card().locator('.status').textContent(),pattern);
 }
 for(const width of [390,768,1280])for(const lang of ['hu','en']){
  await page.setViewportSize({width,height:844});await open('energy',lang);
  assert.equal(await card().locator('.metric').count(),4);
  const totals=await card().locator('.metric strong').allTextContents();
  assert.match(totals[3],/^0\s+kWh/,'verified zero charging is a measured zero');
  await card().locator('.coverage summary').click();
  assert.equal(await card().locator('.energy-row').count(),4);
  assert.match(await card().locator('.coverage').textContent(),/14\/14/);
  assert.match(await card().locator('.coverage').textContent(),lang==='hu'?/mindkettőnek/:/both must/);
  assert.match(await card().locator('.coverage').textContent(),lang==='hu'?/nem bizonyít hibát/:/does not prove a fault/);
  await card().locator('.facts summary').click();
  assert.doesNotMatch(await card().locator('.facts').textContent(),/A nap során észlelve/,'energy evidence is a daily measurement, not a new incident');
  assert.ok(await card().evaluate(c=>c.shadowRoot.querySelector('ha-card').scrollWidth<=c.shadowRoot.querySelector('ha-card').clientWidth+1));
  await page.screenshot({path:`${output}/energy-${lang}-${width}.png`,animations:'disabled',fullPage:true});
  await page.evaluate(()=>{window.reportMoreInfo=[];document.addEventListener('hass-more-info',e=>window.reportMoreInfo.push(e.detail.entityId));});await card().locator('.metric').first().click();await card().locator('luma-bottom-sheet').locator('dialog').waitFor({state:'hidden'});assert.deepEqual(await page.evaluate(()=>window.reportMoreInfo),['sensor.solar'],'measurement More Info opens after the report sheet closes');
  await open('energy-partial',lang);
  assert.match((await card().locator('.metric strong').allTextContents())[3],/—/,'unknown charging must not render as zero');
  await open('energy-failed',lang);assert.equal(await card().locator('.summary:visible').count(),0);
 }
 for(const width of [390,768,1280])for(const lang of ['hu','en']){
  await page.setViewportSize({width,height:844});await open('heating-partial',lang);assert.doesNotMatch(await card().locator('.preview-text').textContent(),/megfigyelése hiányos volt/);assert.match(await card().locator('.preview-text').textContent(),/újraindulási/);assert.match(await card().locator('.preview-quality').textContent(),lang==='hu'?/Hiányos adatok/:/Partial data/);
  assert.match(await card().locator('.status').textContent(),lang==='hu'?/Részleges megfigyelés/:/Partial observation/);
  assert.equal(await card().locator('.metric').count(),4);
  assert.match((await card().locator('.metric strong').allTextContents())[0],/≥6/);
  assert.match(await card().locator('.summary').textContent(),/hiányos/);
  await card().locator('.coverage summary').click();
  assert.match(await card().locator('.coverage').textContent(),lang==='hu'?/99,975%/:/99.975%/);
  assert.match(await card().locator('.coverage').textContent(),lang==='hu'?/nem kazánhiba/:/do not diagnose/);
  assert.match(await card().locator('.coverage').textContent(),lang==='hu'?/Melegvíz/:/Hot water/);
  await page.screenshot({path:`${output}/heating-${lang}-${width}.png`,animations:'disabled',fullPage:true});
  assert.ok(await card().evaluate(c=>c.shadowRoot.querySelector('ha-card').scrollWidth<=c.shadowRoot.querySelector('ha-card').clientWidth+1));
  await open('heating-warm',lang);assert.match(await card().locator('.status').textContent(),lang==='hu'?/nem volt gyors/:/No rapid/);assert.match(await card().locator('.quality-note').textContent(),lang==='hu'?/99,878%/:/99.878%/);assert.equal((await card().locator('.metric strong').allTextContents())[3].trim(),'0');assert.match(await card().locator('.summary').textContent(),/meleg rendszerben/);await card().locator('.coverage summary').click();assert.match(await card().locator('.coverage').textContent(),lang==='hu'?/Jóváhagyott háztartási/:/Approved household/);await page.screenshot({path:`${output}/heating-warm-${lang}-${width}.png`,animations:'disabled',fullPage:true});
  await page.keyboard.press('Escape');await card().locator('luma-bottom-sheet').locator('dialog').waitFor({state:'hidden'});await page.screenshot({path:`${output}/compact-warm-${lang}-${width}.png`,animations:'disabled',fullPage:true});
  await open('heating-idle',lang);const idle=await card().locator('.metric strong').allTextContents();assert.equal(idle[0].trim(),'0');assert.equal(idle[2].trim(),'—');assert.equal(idle[3].trim(),'0');
  await open('heating-empty',lang);assert.ok((await card().locator('.metric strong').allTextContents()).every(s=>s.trim()==='—'));
  await open('heating-failed',lang);assert.equal(await card().locator('.summary:visible').count(),0);
 }
 await open('long-summary');assert.match(await card().locator('.summary').textContent(),/minden rögzített megfigyelés/);await page.keyboard.press('Escape');await card().locator('luma-bottom-sheet').locator('dialog').waitFor({state:'hidden'});assert.ok(await card().locator('ha-card').evaluate(c=>c.getBoundingClientRect().height<230));
 await page.emulateMedia({reducedMotion:'no-preference'});await open('heating-warm');await page.waitForTimeout(380);const animatedSheet=card().locator('luma-bottom-sheet');const beforeClose=await animatedSheet.locator('.sheet').boundingBox();await animatedSheet.locator('.close').click();await page.waitForTimeout(90);const duringClose=await animatedSheet.locator('.sheet').boundingBox();assert.ok(Math.abs(beforeClose.height-duringClose.height)<2,'sheet content keeps its height during the exit animation');await animatedSheet.locator('dialog').waitFor({state:'hidden'});assert.equal(await card().locator('.report-details').count(),0);await page.emulateMedia({reducedMotion:'reduce'});
 await open();await card().evaluate(c=>{c.hass={...c.hass,connection:{},callWS:async()=>{throw Error('New account offline');}};});
 await page.waitForTimeout(200);assert.equal(await card().locator('.summary:visible').count(),0,'a new account cannot inherit private cached report text');assert.equal(await card().locator('.report-details').count(),0);assert.equal(await card().locator('.preview-button').getAttribute('aria-expanded'),'false');assert.doesNotMatch(await card().locator('.preview-text').textContent(),/kazán korábbról/);
 assert.deepEqual(errors,[]);console.log('Daily report UI: compact previews, shared sheet open/close/focus/Escape/backdrop/drag, deferred More Info, HU/EN × mobile/tablet/desktop, coverage/interpretation/evidence disclosure, old-success separation, failed/missed/interrupted/waiting/empty/stale/restricted states and connection privacy passed.');
}finally{await browser.close();}
