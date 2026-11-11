import assert from 'node:assert/strict';import {mkdirSync} from 'node:fs';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE||'playwright-core');
const output=process.env.LUMA_UI_OUTPUT||'/private/tmp/luma-attention-snooze-ui';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-gpu']});
const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{for(const width of [390,768,1280])for(const lang of ['hu','en']){
 await page.setViewportSize({width,height:844});await page.goto(`http://127.0.0.1:6006/iframe.html?id=attention-shared-policy--snoozed-only&viewMode=story&globals=locale:${lang}`);
 const hero=page.locator('luma-home-hero-card'),panel=page.locator('luma-attention-card');await hero.locator('button.attention').waitFor();await page.waitForTimeout(250);
 assert.doesNotMatch(await hero.locator('button.attention').textContent(),/snoozed|szüneteltet|Weather/i);
 if(width===1280){const heights=await Promise.all(['.alarm','.attention','.active'].map(s=>hero.locator(s).first().evaluate(n=>n.getBoundingClientRect().height)));assert.ok(Math.max(...heights)-Math.min(...heights)<=1,`equal chip heights: ${heights}`);}
 await page.screenshot({path:`${output}/hero-${lang}-${width}.png`,animations:'disabled',fullPage:true});
 await hero.locator('button.attention').click();await panel.locator('select').waitFor();
 assert.equal(await panel.locator('button.item:visible').count(),0,'snoozed messages are absent from default active view');
 await panel.locator('select').selectOption('snoozed');await panel.locator('button.item:visible').first().waitFor();
 await panel.locator('button.item:visible').first().click();
 const restore=panel.locator('button.action').filter({hasText:lang==='hu'?'Jelzés visszaállítása':'Show alert again'});await restore.click();
 await panel.locator('button.action').filter({hasText:lang==='hu'?'Emlékeztess holnap':'Remind me tomorrow'}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.lumaHandlingCalls.map(c=>c.operation)),['unsnooze']);
 await page.screenshot({path:`${output}/restored-${lang}-${width}.png`,animations:'disabled',fullPage:true});
}assert.deepEqual(errors,[]);console.log('Snooze UI: main hero and default list hide paused alerts, explicit filter preserves restore, desktop chip heights match; HU/EN × mobile/tablet/desktop passed.');}finally{await browser.close();}
