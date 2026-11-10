import assert from 'node:assert/strict';import {mkdirSync} from 'node:fs';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE||'playwright-core');
const output=process.env.LUMA_UI_OUTPUT||'/private/tmp/luma-daily-report-ui';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LUMA_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-gpu']});
const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const card=()=>page.locator('luma-daily-report-card');
const open=async(story='complete',lang='hu')=>{await page.goto(`http://127.0.0.1:6006/iframe.html?id=cards-daily-report--${story}&viewMode=story&globals=locale:${lang}`);await card().locator('h2').waitFor();await page.waitForTimeout(180);};
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
  await open('energy-partial',lang);
  assert.match((await card().locator('.metric strong').allTextContents())[3],/—/,'unknown charging must not render as zero');
  await open('energy-failed',lang);assert.equal(await card().locator('.summary:visible').count(),0);
 }
 for(const width of [390,768,1280])for(const lang of ['hu','en']){
  await page.setViewportSize({width,height:844});await open('heating-partial',lang);
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
  await open('heating-idle',lang);const idle=await card().locator('.metric strong').allTextContents();assert.equal(idle[0].trim(),'0');assert.equal(idle[2].trim(),'—');assert.equal(idle[3].trim(),'—');
  await open('heating-empty',lang);assert.ok((await card().locator('.metric strong').allTextContents()).every(s=>s.trim()==='—'));
  await open('heating-failed',lang);assert.equal(await card().locator('.summary:visible').count(),0);
 }
 await open();await card().evaluate(c=>{c.hass={...c.hass,connection:{},callWS:async()=>{throw Error('New account offline');}};});
 await page.waitForTimeout(200);assert.equal(await card().locator('.summary:visible').count(),0,'a new account cannot inherit private cached report text');
 assert.deepEqual(errors,[]);console.log('Daily report UI: HU/EN × mobile/tablet/desktop, coverage/interpretation/evidence disclosure, old-success separation, failed/missed/interrupted/waiting/empty/stale/restricted states and connection privacy passed.');
}finally{await browser.close();}
