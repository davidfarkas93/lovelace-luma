import {LitElement,css,html,nothing} from 'lit';
import {customElement,property,state} from 'lit/decorators.js';
import {isHungarian,localized} from '../localize';
import {weatherVisual} from '../weather';
import {lumaTokens} from '../styles';
import type {HomeAssistant} from '../types';
import './luma-bottom-sheet';

type Point={hour:number;temperature_c:number;wind_kmh:number|null;rain_probability_percent:number|null;condition:string|null};
type Period={key:string;status:string;samples:Point[]};
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const bounded=(v:unknown,lo:number,hi:number):v is number=>finite(v)&&v>=lo&&v<=hi;
const conditions=new Set(['sunny','clear-night','cloudy','partlycloudy','rainy','pouring','snowy','snowy-rainy','lightning','lightning-rainy','windy','windy-variant','fog','hail','exceptional']);

/** Public weather-only sensor data. No journal reads, AI calls or action services. */
@customElement('luma-weather-advice')
export class LumaWeatherAdvice extends LitElement{
 @property({attribute:false}) hass?:HomeAssistant;
 @property() entityId='';
 @property() weatherEntity='';
 @state() private open=false;
 @state() private mounted=false;
 private expiry?:number;
 private binding='';
 private connection?:object;
 static styles=[lumaTokens,css`
  :host{display:block;min-width:0}p{margin:0;line-height:1.6;overflow-wrap:anywhere}
  .weather-advice{margin:8px 0 0;max-width:65ch;font-size:var(--luma-text-sm);font-weight:450;color:var(--primary-text-color)}
  .unavailable,.muted{color:var(--luma-muted)}
  button{display:inline-flex;align-items:center;gap:2px;margin:0 0 0 8px;min-height:28px;padding:0 2px;border:0;border-radius:4px;background:transparent;color:var(--primary-color);font:inherit;font-weight:600;cursor:pointer;vertical-align:baseline}
  button:hover{text-decoration:underline}button:focus-visible{outline:2px solid var(--primary-color);outline-offset:3px}button ha-icon{--mdc-icon-size:15px}
  .detail-summary{font-size:var(--luma-text-md);margin:0 0 18px}.period{padding:16px 0;border-top:1px solid var(--luma-border)}h3{margin:0 0 7px;font-size:var(--luma-text-md)}.period p{font-size:var(--luma-text-sm)}small{display:block;font-size:var(--luma-text-xs);line-height:1.6;color:var(--luma-muted);margin-top:6px}.forecast-note{margin-top:16px}
 `];
 disconnectedCallback(){clearTimeout(this.expiry);this.open=false;this.mounted=false;super.disconnectedCallback();}
 protected willUpdate(){const binding=JSON.stringify([this.entityId,this.weatherEntity]);const connection=this.hass?.connection||this.hass?.callWS||this.hass;if(binding!==this.binding||this.connection!==connection){this.open=false;this.mounted=false;this.binding=binding;this.connection=connection;}}
 protected updated(){clearTimeout(this.expiry);const until=this.hass?.states[this.entityId]?.attributes.valid_until;if(finite(until)&&until*1000>Date.now())this.expiry=window.setTimeout(()=>this.requestUpdate(),Math.min(2147483647,until*1000-Date.now()+50));if(!this.current()&&this.open){this.open=false;this.mounted=false;}}
 private t(en:string,hu:string){return localized(this.hass,en,hu);}
 private current(){
  const entity=this.hass?.states[this.entityId],a=entity?.attributes||{},now=Date.now()/1000;
  let day='';try{day=new Intl.DateTimeFormat('en-CA',{timeZone:this.hass?.config?.time_zone||Intl.DateTimeFormat().resolvedOptions().timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).replace(/\//g,'-');}catch{return undefined;}
  return entity&&!a.restored&&!['unknown','unavailable',''].includes(entity.state)&&a.status==='ready'&&a.weather_entity===this.weatherEntity&&a.day===day&&finite(a.generated_at)&&a.generated_at<=now+10&&finite(a.valid_until)&&a.valid_until>now&&entity.state.length<=200?entity:undefined;
 }
 private periods():Period[]{
  const raw=this.current()?.attributes.periods;if(!Array.isArray(raw)||raw.length!==3)return [];
  const keys=['morning','afternoon','evening'];
  return raw.flatMap((p,i)=>{
   if(!p||p.key!==keys[i]||!['available','partial','missing','elapsed'].includes(p.status)||!Array.isArray(p.samples)||p.samples.length>6)return [];
   const start=6+i*6,end=start+6,seen=new Set<number>();
   const samples:Point[]=p.samples.filter((s:Point)=>{if(!s||!Number.isInteger(s.hour)||s.hour<start||s.hour>=end||seen.has(s.hour)||!bounded(s.temperature_c,-60,60)||!(s.wind_kmh===null||bounded(s.wind_kmh,0,400))||!(s.rain_probability_percent===null||bounded(s.rain_probability_percent,0,100))||!(s.condition===null||conditions.has(s.condition)))return false;seen.add(s.hour);return true;});
   if(samples.length!==p.samples.length||(['available','partial'].includes(p.status)&&!samples.length)||(['elapsed','missing'].includes(p.status)&&samples.length))return [];
   return [{key:p.key,status:p.status,samples:samples.sort((a:Point,b:Point)=>a.hour-b.hour)}];
  });
 }
 private description(p:Period){
  if(p.status==='elapsed')return this.t('This part of the day has passed.','Ez a napszak már elmúlt.');
  if(!p.samples.length)return this.t('No hourly forecast is available for this part of today.','Ehhez a mai napszakhoz nincs elérhető órás előrejelzés.');
  const fmt=(n:number)=>n.toLocaleString(this.hass?.locale?.language,{maximumFractionDigits:1});
  const temps=p.samples.map(s=>s.temperature_c),low=Math.min(...temps),high=Math.max(...temps);
  const range=low===high?fmt(low):`${fmt(low)}–${fmt(high)}`;
  const codes=[...new Set(p.samples.map(s=>s.condition).filter((s):s is string=>!!s))];
  const sky=codes.map(c=>weatherVisual(c,isHungarian(this.hass)).label.toLocaleLowerCase()).join(', ');
  const temp=this.t(`Expect ${range} °C.`,`${range} °C-ra számíthatsz.`);
  const weather=sky?this.t(` Forecast conditions: ${sky}.`,` Várható időjárás: ${sky}.`):'';
  const sunny=p.samples.find(s=>s.condition==='sunny');
  const sunshine=sunny?this.t(` Sunshine is forecast around ${sunny.hour}:00.`,` ${sunny.hour} óra körül kisüthet a nap.`):'';
  const probs=p.samples.flatMap(s=>s.rain_probability_percent===null?[]:[s.rain_probability_percent]);
  const rain=probs.length===p.samples.length?this.t(` The highest precipitation chance in these hours is ${fmt(Math.max(...probs))}%.`,` A csapadék legnagyobb jelzett esélye ezekben az órákban ${fmt(Math.max(...probs))}%.`):'';
  const winds=p.samples.flatMap(s=>s.wind_kmh===null?[]:[s.wind_kmh]);
  const wind=winds.length===p.samples.length&&Math.max(...winds)>=20?this.t(` Wind may reach ${fmt(Math.max(...winds))} km/h.`,` A jelzett szél elérheti a ${fmt(Math.max(...winds))} km/h-t.`):'';
  return temp+weather+sunshine+rain+wind;
 }
 render(){
  const entity=this.current();const a=entity?.attributes;const periods=this.periods();
  const labels:{[key:string]:[string,string]}={morning:['Morning · 06–12','Délelőtt · 06–12'],afternoon:['Afternoon · 12–18','Délután · 12–18'],evening:['Evening · 18–24','Este · 18–24']};
  return html`<p class=${`weather-advice${entity?'':' unavailable'}`}>${entity?entity.state:this.t('A fresh clothing tip is not available yet.','Még nincs friss öltözködési tipp.')}${entity?html`<button class="weather-details" aria-haspopup="dialog" aria-expanded=${String(this.open)} @click=${(e:Event)=>{e.stopPropagation();this.mounted=true;this.open=true;}} @keydown=${(e:Event)=>e.stopPropagation()}>${this.t('Details','Részletek')}<ha-icon icon="mdi:chevron-right"></ha-icon></button>`:nothing}</p>
  <luma-bottom-sheet .open=${this.open} .heading=${this.t('Today’s weather & clothing','Mai időjárás és öltözködés')} .subtitle=${a?new Date(a.day+'T12:00:00Z').toLocaleDateString(this.hass?.locale?.language,{month:'long',day:'numeric',timeZone:this.hass?.config?.time_zone}):''} .icon=${'mdi:weather-partly-cloudy'} .closeLabel=${this.t('Close','Bezárás')} .maxWidth=${700} @click=${(e:Event)=>e.stopPropagation()} @keydown=${(e:Event)=>e.stopPropagation()} @sheet-dismiss=${()=>{this.open=false;}} @sheet-closed=${()=>{this.mounted=false;this.renderRoot.querySelector<HTMLButtonElement>('.weather-details')?.focus({preventScroll:true});}}>
  ${this.mounted&&entity?html`<div class="weather-report"><p class="detail-summary">${entity.state}</p>${periods.length===3?periods.map(p=>html`<section class="period"><h3>${this.t(...labels[p.key])}</h3><p>${this.description(p)}</p>${p.status==='partial'?html`<small>${this.t('Hourly data covers only part of the remaining period.','Az órás adatok a hátralévő napszaknak csak egy részét fedik le.')}</small>`:nothing}</section>`):html`<p class="muted">${this.t('An hourly breakdown is not available yet.','Napszakos bontás még nem érhető el.')}</p>`}<small class="forecast-note">${this.t('Hourly forecast for the remaining parts of today.','Órás előrejelzés a mai nap még hátralévő időszakaira.')}</small><small>${this.t('Updated','Frissítve')}: ${new Date(Number(a!.generated_at)*1000).toLocaleString(this.hass?.locale?.language,{timeZone:this.hass?.config?.time_zone})}</small></div>`:nothing}
  </luma-bottom-sheet>`;
 }
}
