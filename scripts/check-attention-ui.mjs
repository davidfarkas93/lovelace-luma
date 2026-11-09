// Run against local Storybook. Install playwright-core separately or set its module URL.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE || 'playwright-core');
const base=process.env.LUMA_STORYBOOK_URL || 'http://127.0.0.1:6006';
const output=process.env.LUMA_UI_OUTPUT || '/private/tmp/luma-attention-ui';
mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LUMA_CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-gpu']});
const errors=[];
const page=await browser.newPage({reducedMotion:'reduce'});
page.on('pageerror',e=>errors.push(e.message));
const story=async(name,language='hu')=>{await page.goto(`${base}/iframe.html?id=attention-shared-policy--${name}&viewMode=story&globals=locale:${language}`);await page.locator('luma-attention-card').waitFor({state:'attached'});};
const capture=async(path)=>{await page.waitForTimeout(120);await page.screenshot({path,animations:'disabled',timeout:15000});};
const panel=()=>page.locator('luma-attention-card');
const back=()=>panel().locator('luma-bottom-sheet button[aria-label="Vissza a jelzésekhez"], luma-bottom-sheet button[aria-label="Back to notifications"]');
try {
 for(const width of [390,768,1280])for(const language of ['hu','en']) {
  await page.setViewportSize({width,height:width===768?1024:844});
  await story('review-flow',language);
  const pill=page.locator('luma-home-hero-card button.attention');
  await page.waitForFunction(()=>{const hero=document.querySelector('luma-home-hero-card');return hero?.shadowRoot?.querySelector('.attention')?.textContent?.includes('3 ');});
  assert.match(await pill.textContent(),language==='hu'?/1 ügy.*3 frissíthető összetevő/:/1 issue.*3 updatable components/);
  await pill.click();
  await panel().locator('button.item').first().waitFor({state:'visible'});
  assert.equal(await page.locator('dialog[open]').count(),1,'one shared modal only');
  await panel().locator('dialog.open').waitFor();
  await capture(`${output}/${language}-${width}-list.png`);
  const search=panel().locator('input');
  await search.fill('Application');
  const row=panel().locator('button.item:visible');assert.equal(await row.count(),1);
  await row.click();
  assert.equal(await panel().locator('.members luma-update-card').count(),2,'update group keeps named members');
  assert.match((await panel().locator('.members luma-update-card .name').allTextContents()).join(' '),/Weather integration.*Camera card/s);
  assert.equal(await page.locator('dialog[open]').count(),1);
  await capture(`${output}/${language}-${width}-members.png`);
  await back().click();
  assert.equal(await search.inputValue(),'Application','back preserves the search');
  assert.equal(await row.evaluate(node=>node.getRootNode().activeElement===node),true,'back restores row focus');
  await search.fill('');
  const scroll=await panel().evaluate(node=>{const sheet=node.shadowRoot.querySelector('luma-bottom-sheet');sheet.restoreScrollPosition(80);return sheet.getScrollPosition();});
  await panel().locator('button.item:visible').first().click();
  await back().click();
  assert.ok(Math.abs(await panel().evaluate(node=>node.shadowRoot.querySelector('luma-bottom-sheet').getScrollPosition())-scroll)<2,'back restores list scroll');
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('luma-home-hero-card')?.shadowRoot?.querySelector('luma-attention-card')?.shadowRoot?.querySelector('luma-bottom-sheet')?.shadowRoot?.querySelector('dialog')?.open);
  assert.equal(await pill.evaluate(node=>node.getRootNode().activeElement===node),true,'close returns focus to hero');
 }
 for(const width of [390,768,1280])for(const [language,format] of [['en','12'],['hu','24']]) {
  await page.setViewportSize({width,height:844});await story('review-flow',language);
  await page.locator('luma-home-hero-card').evaluate((hero,{language,format})=>{
    hero.hass={...hero.hass,locale:{language,time_format:format},states:{...hero.hass.states,
      'sensor.dryer':{entity_id:'sensor.dryer',state:'running',attributes:{friendly_name:'Dryer'}},
      'sensor.dryer_finish':{entity_id:'sensor.dryer_finish',state:new Date(Date.now()+1800000).toISOString(),attributes:{device_class:'timestamp'}},
    }};
    hero.setConfig({...hero.config,appliances:[{entity:'sensor.dryer',name:'Dryer',remaining_entity:'sensor.dryer_finish'}]});
  },{language,format});
  const label=page.locator('luma-home-hero-card .banner-state');await label.waitFor();
  const text=await label.textContent();
  if(format==='12'){assert.match(text,/AM|PM/);assert.ok(/\u00a0(AM|PM)/.test(text));assert.match(text,/min left/);}else{assert.doesNotMatch(text,/AM|PM/);assert.match(text,/p hátra/);}
  await capture(`${output}/${language}-${width}-clock-${format}.png`);
 }
 await page.setViewportSize({width:390,height:844});await story('review-flow','hu');
 await page.evaluate(()=>{for(const [name,value] of Object.entries({'--primary-text-color':'#eff0f7','--secondary-text-color':'#b0b3c3','--primary-background-color':'#15161d','--card-background-color':'#22242d','--ha-card-background':'#22242d','--primary-color':'#9caaf0'}))document.documentElement.style.setProperty(name,value);});
 await page.locator('luma-home-hero-card button.attention').click();await panel().locator('dialog.open').waitFor();
 await capture(`${output}/dark-mobile-list.png`);
 await page.setViewportSize({width:390,height:844});
 for(const [name,loading] of [['registry-loading',true],['registry-failed',false],['repairs-loading',true],['repairs-failed',false]]) {
  await story(name);
  await page.waitForTimeout(150);
  await panel().locator('dialog.open').waitFor();
  const text=await panel().evaluate(node=>node.shadowRoot.textContent);
  if(loading)assert.match(text,/ellenőrzése|ellenőrzésére/i);
  assert.ok(!text.includes('3 adatkimaradás'),'loading ignored labels cannot make three false gaps');
  assert.ok(!text.includes('Nincs aktív jelzés'),'incomplete check must not claim clear');
  await capture(`${output}/${name}.png`);
 }
 await story('household-task');
 await panel().locator('dialog.open').waitFor();
 await panel().locator('button.item:visible').filter({hasText:'Indoor plants'}).click();
 assert.match(await panel().locator('.context').textContent(),/season and indoor temperature/);
 assert.equal(await page.locator('dialog[open]').count(),1);
 await panel().evaluate(node=>{node.testCalls=[];node.hass={...node.hass,callService:async(...args)=>{node.testCalls.push(args);}};});
 const complete=panel().locator('button.action').filter({hasText:"Watered"});
 await complete.click();
 assert.equal(await panel().evaluate(node=>node.testCalls.length),0,'opening confirmation must never perform watering');
 await panel().locator('.confirmation button').filter({hasText:'Mégse'}).click();
 assert.equal(await panel().evaluate(node=>node.testCalls.length),0);
 await complete.click();
 await capture(`${output}/household-confirmation.png`);
 await panel().locator('.confirmation button').filter({hasText:'Megerősítés'}).click();
 const calls=await panel().evaluate(node=>node.testCalls);
 assert.equal(calls.length,1);assert.equal(calls[0][0],'input_button');assert.equal(calls[0][1],'press');
 assert.match(await panel().locator('.detail-status').textContent(),/Figyelmet kér/,'service success does not invent source recovery');
 // Dismissal uses the separate native channel, without pressing the task button.
 await panel().locator('button.action').filter({hasText:"HA-értesítés törlése"}).click();
 assert.equal(await panel().evaluate(node=>node.testCalls.filter(call=>call[0]==='input_button').length),1);
 assert.match(await panel().locator('.detail-status').textContent(),/Figyelmet kér/);
 // Failure stays visible and is not presented as a completed task.
 await back().click();await panel().locator('button.item:visible').filter({hasText:'Indoor plants'}).click();
 await panel().evaluate(node=>{node.hass={...node.hass,callService:async()=>{throw Error('Denied');}};});
 await complete.click();await panel().locator('.confirmation button').filter({hasText:'Megerősítés'}).click();
 await panel().locator('[role="alert"]').waitFor();
 assert.match(await panel().locator('[role="alert"]').textContent(),/nem sikerült/);
 for(const width of [390,768,1280])for(const language of ['hu','en']){
  await page.setViewportSize({width,height:844});await story('backend-observer',language);
  await page.locator('luma-home-hero-card button.attention').click();
  await panel().locator('dialog.open').waitFor();
  await panel().locator('button.item:visible').filter({hasText:'Application updates'}).click();
  assert.equal(await panel().locator('.members luma-update-card').count(),2);
  const update=panel().locator('luma-update-card').filter({hasText:'Weather integration'});
  await update.evaluate(c=>{c.testCalls=[];c.hass={...c.hass,callService:async(...args)=>c.testCalls.push(args)}});
  await update.locator('button.action').click();assert.equal(await update.evaluate(c=>c.testCalls.length),0);
  await capture(`${output}/backend-${language}-${width}.png`);
  await update.locator('button.action').click();assert.equal(await update.evaluate(c=>c.testCalls.length),1);
  await story('backend-unavailable',language);
  const pill=page.locator('luma-home-hero-card button.attention');
  await page.waitForTimeout(300);
  assert.match(await pill.textContent(),language==='hu'?/adatkimaradás/:/data gap/);
 }
 assert.deepEqual(errors,[]);
 console.log('Attention UI: 390/768/1280 × HU/EN, hero → list → group → back, search/scroll/focus, Escape, registry/adapters, dark mode, 12/24-hour appliance labels and confirmed mock actions passed.');
} finally {await browser.close();}
