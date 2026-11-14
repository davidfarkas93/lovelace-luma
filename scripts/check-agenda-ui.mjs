import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE||'playwright-core');
const out='/private/tmp/luma-agenda-ui';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.LUMA_STORYBOOK_URL||'http://127.0.0.1:6006';
async function open(story){await page.goto(`${base}/iframe.html?id=design-review-agenda--${story}&viewMode=story&globals=locale:hu`);await page.locator('luma-story-agenda-fixture').waitFor();return page.locator('luma-tab-card');}
try{
 for(const width of [390,768,1280])for(const theme of ['light','dark'])for(const story of ['calendar','shopping','long-events','empty']){
  await page.setViewportSize({width,height:900});const card=await open(story);
  if(theme==='dark')await page.evaluate(()=>{for(const[k,v]of Object.entries({'--primary-background-color':'#15161d','--primary-text-color':'#eee','--secondary-text-color':'#9b9ba5','--ha-card-background':'#25252b','--card-background-color':'#25252b'}))document.documentElement.style.setProperty(k,v);document.body.style.background='#15161d';});
  assert.deepEqual(await card.locator('.shell,.tabs,.content,.event,.title,form').evaluateAll(ns=>ns.filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>n.className)),[],'no clipping');
  assert.equal(await card.locator('[role=tab][tabindex="0"]').count(),1);
  assert.ok(await card.locator('[role=tab]').evaluateAll(ns=>ns.every(n=>n.getBoundingClientRect().height>=44)));
  if(story==='calendar')assert.ok((await card.boundingBox()).height<170,'single event is compact');
  await page.screenshot({path:`${out}/${story}-${width}-${theme}.png`});
 }
 const card=await open('calendar'),tabs=card.locator('[role=tab]'),panel=card.locator('[role=tabpanel]');
 await tabs.first().focus();await page.keyboard.press('ArrowRight');await page.locator('input[type=text]').waitFor();
 assert.equal(await tabs.nth(1).getAttribute('aria-selected'),'true');assert.equal(await panel.getAttribute('aria-labelledby'),'tab-1');assert.equal(await tabs.nth(1).evaluate(n=>n.getRootNode().activeElement===n),true);
 await card.locator('input[type=text]').fill('Alma');await card.locator('button[aria-label=Hozzáadás]').click();assert.equal(await card.locator('label').count(),4);
 await tabs.nth(1).focus();await page.keyboard.press('Home');await page.locator('.event').waitFor();await page.keyboard.press('End');await page.locator('input[type=text]').waitFor();assert.equal(await card.locator('label').count(),4,'cached child state survives');
 await page.keyboard.press('Tab');assert.equal(await panel.evaluate(n=>n.getRootNode().activeElement===n),true,'Tab enters panel');
 await tabs.nth(1).focus();await page.keyboard.press('ArrowRight');assert.equal(await tabs.first().getAttribute('aria-selected'),'true','arrow wraps');
 await card.evaluate(async n=>{window.loadCardHelpers=async()=>({createCardElement(){throw Error('mock failure');}});n.setConfig({tabs:[{name:'Hiba',card:{type:'custom:broken'}}]});await n.updateComplete;});
 await page.waitForFunction(()=>document.querySelector('luma-tab-card').shadowRoot.querySelector('[role=tabpanel]').textContent.includes('nem tölthető'));
 assert.equal(await panel.getAttribute('aria-busy'),'false');assert.equal(await card.locator('luma-story-agenda-fixture').count(),0,'failed mount clears stale child');
 assert.deepEqual(errors,[]);console.log('Agenda: 24 responsive captures, equal accessible tabs, keyboard navigation, labelled panel, cached child state and failed child mount passed.');
}finally{await browser.close();}
