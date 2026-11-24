import { mkdir } from 'node:fs/promises';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.LUMA_CHROME?{executablePath:process.env.LUMA_CHROME}:{})});
try {
 await mkdir('docs/previews/wall-touch',{recursive:true});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 await page.goto((process.env.LUMA_STORYBOOK_URL||'http://127.0.0.1:6006')+'/iframe.html?id=cards-wall-panel--touch-controls&viewMode=story&globals=locale:hu');
 const panel=page.locator('luma-wall-panel-card');await panel.locator('input').first().waitFor();
 await page.screenshot({path:'docs/previews/wall-touch/panel.png'});
 await panel.locator('luma-light-fader-card').nth(2).locator('.details').click();
 await panel.locator('dialog[open]').waitFor();
 await page.screenshot({path:'docs/previews/wall-touch/light.png'});
 await page.keyboard.press('Escape');await panel.locator('luma-wall-controls').waitFor({state:'detached'});
 await panel.locator('.cover-info').click();await panel.locator('dialog[open]').waitFor();
 await page.screenshot({path:'docs/previews/wall-touch/cover.png'});
 for(const [index,name] of [[0,'tv'],[1,'air']]){
  await page.keyboard.press('Escape');await panel.locator('luma-wall-controls').waitFor({state:'detached'});
  await panel.locator('.shortcut').nth(index).click();await panel.locator('dialog[open]').waitFor();
  await page.waitForTimeout(120);
  await page.screenshot({path:`docs/previews/wall-touch/${name}.png`});
 }
 await panel.locator('luma-wall-controls nav button').nth(1).click();
 await page.waitForTimeout(120);
 await page.screenshot({path:'docs/previews/wall-touch/humidifier.png'});
 await page.keyboard.press('Escape');await panel.locator('luma-wall-controls').waitFor({state:'detached'});
 await panel.locator('.metric').first().click();await panel.locator('luma-wall-sensor .chart').waitFor();
 await page.screenshot({path:'docs/previews/wall-touch/temperature.png'});
 await panel.locator('luma-wall-controls nav button').nth(1).click();await panel.locator('luma-wall-sensor .chart').waitFor();
 await page.screenshot({path:'docs/previews/wall-touch/humidity.png'});
 console.log('Saved all mock-only wall control previews.');
}finally{await browser.close()}
