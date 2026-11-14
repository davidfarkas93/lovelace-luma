import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE||'playwright-core');
const output=process.env.LUMA_UI_OUTPUT||'docs/previews/surface-refinement';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LUMA_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.LUMA_STORYBOOK_URL||'http://127.0.0.1:6006';
try{
 for(const width of [390,768,1280])for(const theme of ['dark','light']){
  await page.setViewportSize({width,height:1000});
  await page.goto(`${base}/iframe.html?id=design-review-surface-refinement--compare&viewMode=story`);
  const host=page.locator('luma-refinement-preview');await host.waitFor();
  await host.evaluate((n,{theme,width})=>{n.theme=theme;n.variant=width===1280?'compare':'refined';},{theme,width});
  await host.locator('.grid luma-metric-card').last().waitFor();await page.waitForFunction(()=>document.querySelector('luma-refinement-preview')?.getAttribute('data-ready')==='true');
  assert.equal(await host.locator('.grid ha-card').count(),width===1280?14:7);
  const proposed=host.locator('[data-variant="refined"]');
  for(const row of await proposed.locator('ha-card').evaluateAll(nodes=>nodes.map(n=>({gradient:getComputedStyle(n).backgroundImage,fit:n.scrollWidth<=n.clientWidth+1})))){assert.notEqual(row.gradient,'none');assert.ok(row.fit,'card content fits');}
  const room=proposed.locator('luma-room-card').first();
  await room.locator('.pill-control').first().focus();assert.equal(await room.locator('.pill-control').first().evaluate(n=>getComputedStyle(n).outlineStyle),'solid');
  await room.evaluate(n=>{n.testCalls=[];n.hass={...n.hass,callService:async(...args)=>n.testCalls.push(args)};});
  await page.keyboard.press('Space');assert.equal(await room.evaluate(n=>n.testCalls.length),1);
  await room.locator('.pill-control').first().evaluate(n=>n.blur());
  await host.locator('.review').screenshot({path:`${output}/${width}-${theme}.png`,animations:'disabled'});
 }
 assert.deepEqual(errors,[]);console.log('Refinement preview: 6 light/dark responsive captures; actual cards, valid gradients, no card overflow, keyboard focus and mock action preserved.');
}finally{await browser.close();}
