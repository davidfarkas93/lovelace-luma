import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const {chromium}=await import(process.env.LUMA_PLAYWRIGHT_MODULE||'playwright-core');
const out=process.env.LUMA_UI_OUTPUT||'/private/tmp/luma-surfaces-ui';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.LUMA_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({reducedMotion:'reduce'}),reports=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
const base=process.env.LUMA_STORYBOOK_URL||'http://127.0.0.1:6006';
async function measure(){return page.locator('luma-room-card,luma-metric-card,luma-gate-card,luma-comfort-card').evaluateAll(cards=>{
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d',{willReadFrequently:true});
 const rgba=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].map((v,i)=>i===3?v/255:v);};
 const parent=n=>n.parentElement||n.getRootNode().host;
 const blend=(front,back)=>front.slice(0,3).map((v,i)=>v*front[3]+back[i]*(1-front[3]));
 // Sample both gradient endpoints conservatively, including translucent controls.
 const split=value=>{let depth=0,start=0,out=[];for(let i=0;i<value.length;i++){if(value[i]==='(')depth++;if(value[i]===')')depth--;if(value[i]===','&&!depth){out.push(value.slice(start,i));start=i+1;}}return [...out,value.slice(start)];};
 function background(n,endpoint){
  if(!n)return [255,255,255];const cs=getComputedStyle(n),color=rgba(cs.backgroundColor);
  const base=color[3]===1?color.slice(0,3):blend(color,background(parent(n),endpoint));
  if(cs.backgroundImage==='none')return base;
  if(!cs.backgroundImage.startsWith('linear-gradient('))throw Error('Unsupported background: '+cs.backgroundImage);
  const stops=split(cs.backgroundImage.slice(16,-1)).slice(1).map(s=>s.trim().replace(/\s+[\d.]+%$/,''));
  if(stops.length!==2)throw Error('Expected two gradient stops');
  return blend(rgba(stops[endpoint]),base);
 }

 const lum=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 const contrast=(a,b)=>{a=lum(a);b=lum(b);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
 const text=[],controls=[],focus=[],overflow=[];
 for(const endpoint of [0,1])for(const card of cards){
  for(const n of card.shadowRoot.querySelectorAll('*')){
   if(['STYLE','HA-ICON'].includes(n.tagName)||n.closest('button:disabled')||!n.getClientRects().length)continue;
   const cs=getComputedStyle(n),bg=background(n,endpoint);
   const copy=[...n.childNodes].filter(c=>c.nodeType===Node.TEXT_NODE).map(c=>c.textContent.trim()).join('').trim();
   if(copy)text.push({card:card.tagName,element:n.className,text:copy,foreground:cs.color,background:bg,ratio:contrast(blend(rgba(cs.color),bg),bg)});
   if(n.matches('.pill-control,.secondary-action,.action'))controls.push({card:card.tagName,element:n.className,ratio:Math.min(contrast(rgba(cs.borderTopColor),bg),contrast(rgba(cs.borderTopColor),background(parent(n),endpoint)))});
   if(cs.outlineStyle!=='none'&&parseFloat(cs.outlineWidth)>0)focus.push({card:card.tagName,ratio:contrast(rgba(cs.outlineColor),bg)});
   if(n.matches('.value,.metrics,.env,.pill-control')&&n.scrollWidth>n.clientWidth+1)overflow.push({card:card.tagName,element:n.className});
  }
 }
 return {text,controls,focus,overflow};
});}
try{
 for(const width of [390,768,1280])for(const mode of ['light','dark']){
  await page.setViewportSize({width,height:1000});await page.goto(`${base}/iframe.html?id=design-system-surfaces-and-meaning--state-gallery&viewMode=story&globals=locale:hu`);
  await page.locator('luma-comfort-card').last().waitFor();
  if(mode==='dark')await page.evaluate(()=>{for(const[k,v]of Object.entries({'--primary-text-color':'#eee','--secondary-text-color':'#9b9ba5','--primary-background-color':'#15161d','--ha-card-background':'#25252b','--card-background-color':'#25252b'}))document.documentElement.style.setProperty(k,v);});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.locator('luma-metric-card .primary-action').focus();
  const result=await measure();reports.push({width,mode,...result});
  assert.ok(result.text.length>25,'meaningful text coverage');assert.ok(result.focus.length>0,'focus sampled');
  assert.deepEqual(result.overflow,[],'no clipped text');
  for(const row of result.text)assert.ok(row.ratio>=4.5,JSON.stringify(row));
  for(const row of result.focus)assert.ok(row.ratio>=3,JSON.stringify(row));
  await page.screenshot({path:`${out}/gallery-${width}-${mode}.png`,fullPage:true});
  // Closed gates carry a restrained success cue; open gates retain warning.
  assert.match(await page.locator('luma-gate-card').first().locator('ha-card').getAttribute('style'),/luma-state-success/);
  assert.match(await page.locator('luma-gate-card').nth(1).locator('ha-card').getAttribute('style'),/luma-state-warning/);
  assert.equal(await page.locator('luma-comfort-card .particle').count(),0);
  const gate=page.locator('luma-gate-card').nth(1);await gate.locator('.summary').click();await gate.locator('.primary').click();
  const confirm=await measure();for(const row of confirm.text)assert.ok(row.ratio>=4.5,JSON.stringify(row));for(const row of confirm.focus)assert.ok(row.ratio>=3,JSON.stringify(row));
  reports.push({width,mode,phase:'confirmation',...confirm});await page.screenshot({path:`${out}/confirm-${width}-${mode}.png`});await page.keyboard.press('Escape');
  await page.goto(`${base}/iframe.html?id=cards-comfort--cooling&viewMode=story&globals=locale:hu`);
  await page.locator('luma-comfort-card').waitFor();
  if(mode==='dark')await page.evaluate(()=>{for(const[k,v]of Object.entries({'--primary-text-color':'#eee','--secondary-text-color':'#9b9ba5','--primary-background-color':'#15161d','--ha-card-background':'#25252b','--card-background-color':'#25252b'}))document.documentElement.style.setProperty(k,v);});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.locator('luma-comfort-card .header').focus();
  const comfort=await measure();reports.push({width,mode,phase:'integrated-climate',...comfort});
  assert.deepEqual(comfort.overflow,[]);assert.ok(comfort.focus.length>0);
  for(const row of comfort.text)assert.ok(row.ratio>=4.5,JSON.stringify({width,mode,...row}));
  for(const row of comfort.focus)assert.ok(row.ratio>=3,JSON.stringify(row));
 }
 await page.setViewportSize({width:390,height:900});
 await page.goto(`${base}/iframe.html?id=design-system-surfaces-and-meaning--narrow-gates&viewMode=story&globals=locale:hu`);
 await page.locator('luma-gate-card').last().waitFor();
 for(const hint of await page.locator('luma-gate-card .hint').evaluateAll(ns=>ns.map(n=>({text:n.textContent,fit:n.scrollWidth<=n.clientWidth+1,wrap:getComputedStyle(n).whiteSpace})))){
  assert.equal(hint.wrap,'normal');assert.ok(hint.fit);assert.match(hint.text,/Koppints/);
 }
 await page.screenshot({path:`${out}/narrow-gates.png`});
 // Garage state comes from its contact sensor, independently of the relay state.
 await page.goto(`${base}/iframe.html?id=design-system-surfaces-and-meaning--garage-sensor&viewMode=story&globals=locale:hu`);
 const garage=page.locator('luma-gate-card');await garage.waitFor();
 for(const [state,tone] of [['off','success'],['on','warning'],['unknown','neutral'],['unavailable','neutral'],['unexpected','neutral']]){
  await garage.evaluate((n,state)=>{n.hass={...n.hass,states:{...n.hass.states,'binary_sensor.garage':{...n.hass.states['binary_sensor.garage'],state}}};return n.updateComplete;},state);
  const style=await garage.locator('ha-card').getAttribute('style');
  assert.match(style,tone==='neutral'?/secondary-text-color|luma-state-neutral/:new RegExp('luma-state-'+tone));
 }
 assert.deepEqual(errors,[]);writeFileSync(`${out}/contrast.json`,JSON.stringify(reports,null,2));
 console.log(JSON.stringify({textMinimum:Math.min(...reports.flatMap(r=>r.text.map(v=>v.ratio))),controlMinimum:Math.min(...reports.flatMap(r=>r.controls.map(v=>v.ratio))),focusMinimum:Math.min(...reports.flatMap(r=>r.focus.map(v=>v.ratio))),textSamples:reports.reduce((n,r)=>n+r.text.length,0),screenshots:13,output:out}));
}finally{await browser.close();}
