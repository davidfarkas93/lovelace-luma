import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE||'playwright-core');
const output=process.env.LUMA_UI_OUTPUT||'/private/tmp/luma-state-ui';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LUMA_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.LUMA_STORYBOOK_URL||'http://127.0.0.1:6006';
async function open(story,tag){await page.goto(`${base}/iframe.html?id=design-system-state-presentation--${story}&viewMode=story&globals=locale:hu`);const card=page.locator(tag);await card.waitFor();return card;}
async function state(card,id,value,attributes={}){await card.evaluate((n,{id,value,attributes})=>{n.hass={...n.hass,states:{...n.hass.states,[id]:{...n.hass.states[id],entity_id:id,state:value,attributes}}};},{id,value,attributes});await card.evaluate(n=>n.updateComplete);}
async function locale(card,language){await card.evaluate((n,language)=>{n.hass={...n.hass,locale:{...n.hass.locale,language}};},language);await card.evaluate(n=>n.updateComplete);}
try{
 for(const width of [390,768,1280])for(const mode of ['light','dark']){
  await page.setViewportSize({width,height:1000});
  for(const [story,tag] of [['metric','luma-metric-card'],['comfort','luma-comfort-card'],['room','luma-room-card'],['hero','luma-home-hero-card']]){
   const card=await open(story,tag);
   if(mode==='dark')await page.evaluate(()=>{for(const [k,v]of Object.entries({'--primary-text-color':'#eee','--secondary-text-color':'#b9bbc6','--primary-background-color':'#15161d','--ha-card-background':'#25252b','--card-background-color':'#25252b'}))document.documentElement.style.setProperty(k,v);});
   const text=await card.textContent();
   const visible=await card.evaluate(n=>n.shadowRoot.textContent);
   if(story==='metric')assert.match(visible,/22,4 °C/);
   if(story==='comfort'){assert.match(await card.locator('.status').textContent(),/Hiányos adatok/);assert.match(await card.locator('.metrics').textContent(),/PM2.5.*Nincs adat/s);}
   if(story==='room'){assert.match(await card.locator('.env').textContent(),/22,4 °C/);assert.equal(await card.locator('.pill-control').first().isDisabled(),true);}
   if(story==='hero'){assert.match(await card.locator('.subtitle').textContent(),/9,2 °C.*szél 0 km\/h/);assert.match(await card.locator('.alarm').textContent(),/Nem elérhető/);assert.match(await card.locator('.alarm').getAttribute('style'),/secondary-text-color/);}
   await page.screenshot({path:`${output}/${story}-${width}-${mode}.png`});
   await locale(card,'en');
   if(story==='metric')assert.match(await card.locator('.value').textContent(),/22\.4/);
   if(story==='comfort')assert.equal(await card.locator('.status').textContent(),'Incomplete data');
   if(story==='room')assert.match(await card.locator('.env').textContent(),/22\.4 °C/);
   if(story==='hero')assert.match(await card.locator('.subtitle').textContent(),/9\.2 °C.*wind 0/);
  }
 }
 let card=await open('metric','luma-metric-card');
 for(const value of ['unknown','unavailable','']){await state(card,'sensor.value',value,{unit_of_measurement:'°C'});assert.doesNotMatch(await card.locator('.value').textContent(),/0|°C/);}
 await state(card,'sensor.value','0',{unit_of_measurement:'W'});assert.equal(await card.locator('.value').textContent(),'0,0 W');
 await state(card,'sensor.value','22.4',{restored:true});assert.equal(await card.locator('.value').textContent(),'Friss adatra vár');
 await state(card,'sensor.value','3600');await card.evaluate(n=>n.setConfig({...n.config,format:'duration'}));assert.equal(await card.locator('.value').textContent(),'1 ó 0 p');assert.equal(await card.locator('.secondary').textContent(),'Humidity: 43 %');
 await card.evaluate(n=>n.setConfig({...n.config,format:undefined,absolute:true,positive_suffix:'import',state_map:{'3600':'Saját felirat'}}));assert.equal(await card.locator('.value').textContent(),'Saját felirat');assert.equal(await card.locator('.secondary').textContent(),'Humidity: 43 %');
 card=await open('comfort','luma-comfort-card');
 await state(card,'sensor.temperature','unavailable');await state(card,'sensor.humidity','unknown');assert.equal(await card.locator('.status').textContent(),'Hiányos adatok');
 await state(card,'sensor.temperature','32');assert.equal(await card.locator('.status').textContent(),'Figyelmet kér');assert.match(await card.locator('.metrics').textContent(),/Nincs adat/);
 await state(card,'sensor.temperature','22.4');await state(card,'sensor.humidity','43');await state(card,'sensor.pm','0');assert.equal(await card.locator('.status').textContent(),'Kellemes');
 await state(card,'sensor.temperature','22.4',{restored:true});assert.equal(await card.locator('.status').textContent(),'Hiányos adatok');
 card=await open('room','luma-room-card');await state(card,'light.room','on',{restored:true});assert.equal(await card.locator('.pill-control').first().isDisabled(),true);assert.match(await card.locator('.pill-control').first().textContent(),/Friss adatra vár/);
 card=await open('hero','luma-home-hero-card');await state(card,'weather.home','unavailable',{temperature:33,wind_speed:20});assert.doesNotMatch(await card.locator('.subtitle').textContent(),/33|20 km/);
 await card.evaluate(n=>{const states={...n.hass.states};delete states['alarm_control_panel.home'];n.hass={...n.hass,states};});assert.match(await card.locator('.alarm').textContent(),/Nem elérhető/);
 assert.deepEqual(errors,[]);console.log('State UI: 24 responsive screenshots, live locale changes, zero vs missing/restored data, partial comfort severity, independent secondary formatting and unavailable alarm passed.');
}finally{await browser.close();}
