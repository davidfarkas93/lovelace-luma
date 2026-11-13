import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE||'playwright-core');
const output=process.env.LUMA_UI_OUTPUT||'/private/tmp/luma-navbar-media-ui';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LUMA_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-gpu']});
const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const base=process.env.LUMA_STORYBOOK_URL||'http://127.0.0.1:6006';
const navbar=()=>page.locator('luma-navbar-card');
const popup=index=>navbar().locator('luma-popup-card').nth(index);
const sheet=index=>popup(index).locator('luma-bottom-sheet');
const remote=index=>popup(index).locator('luma-remote-card');
async function openStory(story='with-embedded-remotes',lang='hu'){
  await page.goto(`${base}/iframe.html?id=navigation-grouped-menu--${story}&viewMode=story&globals=locale:${lang}`);
  await navbar().locator('.media-dock').waitFor();
  await navbar().evaluate(n=>{n.testCalls=[];n.hass={...n.hass,editMode:false,callService:async(...args)=>n.testCalls.push(args)};});
}
try{
  for(const width of [390,768,1280])for(const lang of ['hu','en']){
    await page.setViewportSize({width,height:900});await openStory(undefined,lang);
    // A navbar in a separate dashboard has no other remote-popup card to rely on.
    await page.evaluate(()=>{history.replaceState(null,'','/dashboard-security/security?camera=front');window.dispatchEvent(new Event('location-changed'));});
    assert.equal(await navbar().locator('luma-popup-card').count(),2);
    await navbar().locator('.media-dock .title').click();await sheet(0).locator('dialog[open]').waitFor();
    await remote(0).locator('.nav .ok').waitFor();assert.equal(new URL(page.url()).pathname,'/dashboard-security/security');
    assert.equal(new URL(page.url()).search,'?camera=front');assert.equal(new URL(page.url()).hash,'#tv-remote');
    assert.equal(await navbar().locator('dialog[open]').count(),1,'exactly one remote opens');
    assert.deepEqual(await navbar().evaluate(n=>n.testCalls),[],'opening the dock sends no device command');
    assert.ok(await remote(0).locator('.wrap').evaluate(n=>n.scrollWidth<=n.clientWidth+1),'remote fits available width');
    await page.screenshot({path:`${output}/security-${lang}-${width}.png`,animations:'disabled'});
    await remote(0).locator('.nav .ok').click();
    assert.deepEqual(await navbar().evaluate(n=>n.testCalls),[['remote','send_command',{command:'KEYCODE_DPAD_CENTER'},{entity_id:'remote.tv'}]],'mock command targets the selected player');
    await remote(0).evaluate(n=>n.testIdentity='retained');
    await navbar().evaluate(n=>{const old=n.hass.states['media_player.tv'];n.hass={...n.hass,states:{...n.hass.states,'media_player.tv':{...old,attributes:{...old.attributes,media_title:'Updated programme'}}}};});
    await remote(0).locator('.name').filter({hasText:'Updated programme'}).waitFor();
    assert.equal(await remote(0).evaluate(n=>n.testIdentity),'retained','HA updates do not recreate the remote');
    await page.keyboard.press('Escape');await sheet(0).locator('dialog').waitFor({state:'hidden'});
    assert.equal(new URL(page.url()).pathname,'/dashboard-security/security');assert.equal(new URL(page.url()).search,'?camera=front');
    await navbar().locator('.pager').click();assert.match(await navbar().locator('.media-dock .meta').textContent(),/Hálószoba/);
    await navbar().locator('.media-dock').focus();await page.keyboard.press('Enter');await sheet(1).locator('dialog[open]').waitFor();
    await remote(1).locator('.nav .ok').click();assert.equal(await navbar().evaluate(n=>n.testCalls.at(-1)[3].entity_id),'remote.bedroom');
    await sheet(1).locator('.close').click();await sheet(1).locator('dialog').waitFor({state:'hidden'});
    await navbar().locator('.media-dock').focus();await page.keyboard.press('Space');await sheet(1).locator('dialog[open]').waitFor();
    await page.goBack();await sheet(1).locator('dialog').waitFor({state:'hidden'});assert.equal(new URL(page.url()).pathname,'/dashboard-security/security');
    await navbar().locator('.media-dock .title').click();await sheet(1).locator('dialog[open]').waitFor();
    await sheet(1).locator('.scrim').click({position:{x:5,y:5}});await sheet(1).locator('dialog').waitFor({state:'hidden'});
    // Deep links work even when that media player is not currently active.
    await navbar().evaluate(n=>{n.hass={...n.hass,states:{...n.hass.states,'media_player.tv':{...n.hass.states['media_player.tv'],state:'off'}}};history.replaceState(null,'','/dashboard-rooms/living-room#tv-remote');window.dispatchEvent(new Event('location-changed'));});
    await sheet(0).locator('dialog[open]').waitFor();await remote(0).locator('.name').filter({hasText:'Updated programme'}).waitFor();
    await page.keyboard.press('Escape');await sheet(0).locator('dialog').waitFor({state:'hidden'});
    // Playback remains independent of opening a popup.
    await navbar().evaluate(n=>{n.hass={...n.hass,states:{...n.hass.states,'media_player.tv':{...n.hass.states['media_player.tv'],state:'playing'}}};n.selectedMedia=0;});
    const calls=await navbar().evaluate(n=>n.testCalls.length);await navbar().locator('.control').click();
    assert.equal(await navbar().evaluate(n=>n.testCalls.length),calls+1);assert.equal(await navbar().locator('dialog[open]').count(),0);
  }
  await openStory('with-active-media');assert.equal(await navbar().locator('luma-popup-card').count(),0);
  await navbar().locator('.media-dock .title').click();await page.waitForFunction(()=>location.hash==='#remote');
  await openStory();
  const validation=await navbar().evaluate(n=>{
    const results=[];
    for(const popup of [{hash:'',cards:[{type:'markdown'}]},{hash:'remote',cards:[]},{hash:'navigation',cards:[{type:'markdown'}]}]){
      try{n.setConfig({...n.config,media_players:[{entity:'media_player.tv',name:'TV',popup}]});results.push(false);}catch{results.push(true);}
    }
    return results;
  });assert.deepEqual(validation,[true,true,true]);
  assert.deepEqual(errors,[]);
  console.log('Navbar media: owned remotes across dashboard paths, HU/EN mobile/tablet/desktop, no navigation or opening-time device actions, selected targets, live HA updates, deep links, keyboard, Back/Escape/close/backdrop, playback isolation and legacy hash compatibility passed.');
}finally{await browser.close();}
