import assert from 'node:assert/strict';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.LUMA_CHROME?{executablePath:process.env.LUMA_CHROME}:{})});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.LUMA_STORYBOOK_URL||'http://127.0.0.1:6006')+'/iframe.html?id=cards-wall-panel--touch-controls&viewMode=story&globals=locale:hu');
 const panel=page.locator('luma-wall-panel-card'),modal=panel.locator('luma-wall-controls');await panel.locator('.shortcut').first().waitFor();
 await panel.evaluate(el=>{window.calls=[];el.hass.callService=async(...args)=>window.calls.push(args)});
 await panel.locator('.shortcut').nth(0).click();await modal.locator('dialog[open]').waitFor();
 assert.equal(await page.evaluate(()=>window.calls.length),0);
 assert.equal(await modal.locator('luma-touch-range').count(),0,'TCL does not support absolute volume');
 await modal.locator('.dpad .up').click();
 assert.deepEqual(await page.evaluate(()=>window.calls.at(-1)),['remote','send_command',{command:'KEYCODE_DPAD_UP'},{entity_id:'remote.tv'}]);
 await modal.getByRole('button',{name:'Hangosabb',exact:true}).click();assert.equal(await page.evaluate(()=>window.calls.at(-1)[1]),'volume_up');
 await modal.getByRole('button',{name:'Némítás',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.calls.at(-1)[2]),{is_volume_muted:true});
 await modal.getByRole('button',{name:'Netflix',exact:true}).click();assert.equal(await page.evaluate(()=>window.calls.at(-1)[0]),'script');
 for(const [width,height] of [[1280,800],[768,1024],[390,844]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(40);
  assert(await modal.locator('.layout').evaluate(el=>el.scrollWidth<=el.clientWidth),'TV no horizontal overflow');
  const b=await modal.locator('.sheet').boundingBox();assert.equal(b.width,width);assert.equal(b.height,height);
 }
 await page.setViewportSize({width:1280,height:800});
 await panel.evaluate(el=>{el.hass={...el.hass,states:{...el.hass.states,'remote.tv':{...el.hass.states['remote.tv'],state:'unavailable'}}}});await page.waitForTimeout(30);assert(await modal.locator('.dpad .up').isDisabled());
 await page.keyboard.press('Escape');await modal.waitFor({state:'detached'});
 await panel.locator('.shortcut').nth(1).click();await modal.locator('dialog[open]').waitFor();
 assert.match(await modal.locator('.readings').textContent(),/12.*μg\/m³/);
 await modal.getByRole('button',{name:'Éjszakai',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.calls.at(-1)),['fan','set_preset_mode',{preset_mode:'night'},{entity_id:'fan.air'}]);
 const speed=modal.locator('luma-touch-range input');assert.equal(await speed.getAttribute('step'),'20');
 const before=await page.evaluate(()=>window.calls.length);
 await speed.dispatchEvent('pointerdown',{pointerId:1});await speed.evaluate(el=>{el.value='80';el.dispatchEvent(new Event('input',{bubbles:true}))});assert.equal(await page.evaluate(()=>window.calls.length),before);
 await speed.dispatchEvent('change');assert.deepEqual(await page.evaluate(()=>window.calls.at(-1)),['fan','set_percentage',{percentage:80},{entity_id:'fan.air'}]);
 await modal.locator('nav button').nth(1).click();
 const humidity=modal.locator('luma-touch-range input');assert.equal(await humidity.getAttribute('min'),'40');assert.equal(await humidity.getAttribute('max'),'70');
 await humidity.fill('60');await humidity.dispatchEvent('change');assert.deepEqual(await page.evaluate(()=>window.calls.at(-1)),['humidifier','set_humidity',{humidity:60},{entity_id:'humidifier.air'}]);
 await modal.getByRole('button',{name:'Légtisztítás',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.calls.at(-1)[2]),{mode:'purification'});
 await panel.evaluate(el=>{el.hass.callService=async()=>{throw new Error('mock failure')}});
 await modal.getByRole('button',{name:'Kikapcsolás',exact:true}).click();assert.match(await modal.locator('.status').textContent(),/Nem sikerült/);
 await panel.evaluate(el=>{el.hass={...el.hass,states:{...el.hass.states,'humidifier.air':{...el.hass.states['humidifier.air'],state:'unavailable'}}}});await page.waitForTimeout(30);assert(await humidity.isDisabled());
 assert.deepEqual(errors,[]);console.log('PASS TV remote/apps/volume/capabilities/responsive/offline; air modes/step/release-only/humidity bounds/targeting/errors/unavailable.');
}finally{await browser.close()}
