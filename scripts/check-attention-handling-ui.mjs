import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE||'playwright-core');
const output=process.env.LUMA_UI_OUTPUT||'/private/tmp/luma-attention-handling-ui';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LUMA_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-gpu']});
const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const panel=()=>page.locator('luma-attention-card'),handling=()=>page.locator('luma-attention-handling');
const open=async(story='backend-handling',lang='hu',name='Application')=>{
 await page.goto(`http://127.0.0.1:6006/iframe.html?id=attention-shared-policy--${story}&viewMode=story&globals=locale:${lang}`);
 await page.locator('luma-home-hero-card button.attention').click();
 await panel().locator('button.item:visible').filter({hasText:name}).click();await handling().waitFor();
};
const calls=()=>page.evaluate(()=>window.lumaHandlingCalls);
try{
 for(const width of [390,768,1280])for(const lang of ['hu','en']){
  await page.setViewportSize({width,height:844});await open('backend-handling',lang);
  assert.equal(await handling().locator('details.history').count(),2,'one readable history per group member');
  await handling().locator('[data-handling="seen"]').click();
  await handling().locator('[data-handling="seen"]:disabled').waitFor();
  assert.match(await handling().locator('.seen-state').textContent(),lang==='hu'?/Elolvasva/:/Read/);
  assert.equal((await calls()).length,1);assert.equal((await calls())[0].targets.length,2);
  await handling().locator('[data-handling="claimed_fixed"]').click();assert.equal((await calls()).length,1,'review does not record a fix');
  await handling().locator('textarea').fill('Checked the connection.');
  assert.match(await handling().locator('.review').textContent(),lang==='hu'?/nem zárja le/:/does not close/);
  await handling().locator('[data-handling="confirm"]').click();
  await handling().locator('[data-handling="claimed_fixed"]:disabled').waitFor();
  assert.equal((await calls())[1].operation,'claimed_fixed');
  assert.equal(await panel().locator('.members luma-update-card').count(),2,'a claimed fix does not remove active updates or installers');
  await handling().locator('details.history').first().locator('summary').click();
  await handling().locator('.event').first().waitFor();assert.match(await handling().locator('.event').first().textContent(),/Household member/);
  await handling().locator('[data-handling="note"]').click();await handling().locator('textarea').fill('<b>This is household context, not HTML or an exclusion.</b>');
  await handling().locator('[data-handling="confirm"]').click();await handling().locator('.review').waitFor({state:'detached'});
  await page.waitForFunction(()=>document.querySelector('luma-home-hero-card')?.shadowRoot?.querySelector('luma-attention-card')?.shadowRoot?.querySelector('luma-attention-handling')?.shadowRoot?.textContent?.includes('<b>This'));
  assert.equal(await handling().locator('.event b').count(),0,'notes render as text');
  const snooze=panel().locator('button.action').filter({hasText:lang==='hu'?'Emlékeztess holnap':'Remind me tomorrow'});await snooze.click();
  const restore=panel().locator('button.action').filter({hasText:lang==='hu'?'Jelzés visszaállítása':'Show alert again'});await restore.waitFor();await restore.click();await snooze.waitFor();
  assert.deepEqual((await calls()).map(c=>c.operation),['seen','claimed_fixed','note','snooze','unsnooze']);
  assert.ok((await calls()).every(c=>c.targets.length===2));
  assert.ok(await handling().evaluate(c=>c.getBoundingClientRect().right<=innerWidth+1));
  await page.screenshot({path:`${output}/${lang}-${width}.png`,animations:'disabled'});
 }
 await open('handling-lost-response');await handling().locator('[data-handling="seen"]').click();await handling().locator('[data-handling="seen"]:disabled').waitFor();
 const retried=await calls();assert.equal(retried.length,2);assert.deepEqual(retried[0],retried[1],'response loss retries the same idempotent request');
 await page.evaluate(()=>window.lumaHandlingClear());
 await handling().locator('[data-handling="seen"]').waitFor({state:'detached'});
 assert.equal(await handling().locator('details.history').count(),2,'both histories survive removal of a selected source group');
 await handling().locator('summary').first().click();await handling().locator('.event').first().waitFor();
 for(const name of ['handling-failure','handling-conflict']){
  await open(name);await handling().locator('[data-handling="claimed_fixed"]').click();await handling().locator('textarea').fill('Keep this draft');await handling().locator('[data-handling="confirm"]').click();
  await handling().locator('[role="alert"]').waitFor();assert.equal(await handling().locator('textarea').inputValue(),'Keep this draft');
  assert.equal(await panel().locator('.members luma-update-card').count(),2);
 }
 await open('handling-readonly');assert.equal(await handling().locator('[data-handling]').count(),0);await handling().locator('summary').first().click();await handling().locator('.event').first().waitFor();
 assert.equal(await panel().locator('button.action').filter({hasText:'Emlékeztess holnap'}).count(),0,'read-only users cannot write snooze metadata');
 assert.deepEqual(errors,[]);console.log('Attention handling: HU/EN × 390/768/1280; audited group handling, inline fix review, plain-text notes, snooze/restore, source preservation, lost-response retry, conflicts, failures and read-only history passed.');
}finally{await browser.close();}
