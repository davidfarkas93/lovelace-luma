// Review-only styling. Nothing in this module is imported by src/index.ts.
import {LitElement,css,html} from 'lit';
import {customElement,property} from 'lit/decorators.js';
import {createMockHass} from './mock-hass';
import type {LovelaceCard} from '../src/types';
import '../src/index';

import {legacySurfaceCSS} from './legacy-surfaces';

// Same simple vector icons in both review panels; HA's production icons are not modified.
const paths:Record<string,string>={
 'mdi:sofa':'M5 12V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5M5 10H3v9h18v-9h-2v5H5v-5M5 19v2m14-2v2',
 'mdi:bed-king':'M3 18V5m18 13V9H3m0 9h18M6 9V6h5v3m2 0V6h5v3M3 15h18',
 'mdi:lightbulb-outline':'M8 15c0-2-3-3-3-7a7 7 0 0 1 14 0c0 4-3 5-3 7M8 15h8v4H8zM10 22h4',
 'mdi:window-shutter':'M4 3h16v18H4zM4 7h16M4 11h16M4 15h16M4 19h16',
 'mdi:garage':'M3 10l9-7 9 7v11H3zM6 21V11h12v10M6 15h12M6 18h12',
 'mdi:gate':'M3 5v16m18-16v16M3 9h18M3 17h18M7 9v8m5-8v8m5-8v8',
 'mdi:gate-open':'M3 5v16m18-16v16M3 8l6-2v13l-6-2m18-9l-6-2v13l6-2',
 'mdi:home-thermometer-outline':'M3 11l8-8 8 8M5 10v11h8M17 8v8a3 3 0 1 0 4 0V8a2 2 0 0 0-4 0M19 12v7',
 'mdi:solar-panel':'M4 4h16l2 12H2zM7 4 6 16m11-12 1 12M3 10h18M9 16v5m6-5v5M7 21h10',
 'mdi:thermometer':'M10 5v10a4 4 0 1 0 4 0V5a2 2 0 0 0-4 0M12 9v10',
 'mdi:chevron-right':'m9 5 7 7-7 7',
 'mdi:gesture-tap':'M10 13V5a2 2 0 0 1 4 0v7l4 1v6l-3 3h-5l-5-7 2-2 3 3',
};
const definitions={
 'sensor.temp':{state:22.4,attributes:{unit_of_measurement:'°C'}},'sensor.humidity':{state:43},
 'sensor.pm':{state:18},'sensor.energy':{state:21.8,attributes:{unit_of_measurement:'kWh'}},
 'sensor.outside':{state:9.2,attributes:{unit_of_measurement:'°C'}},
 'light.living':{state:'on'},'light.bedroom':{state:'off'},'cover.blinds':{state:'closed'},
 'cover.garage':{state:'closed'},'cover.gate':{state:'open'},
};
const configs:Record<string,unknown>[]=[
 {type:'custom:luma-room-card',name:'Nappali',icon:'mdi:sofa',accent_color:'#58afc2',path:'#living',temperature_entity:'sensor.temp',humidity_entity:'sensor.humidity',light_entity:'light.living',cover_entity:'cover.blinds'},
 {type:'custom:luma-room-card',name:'Hálószoba',icon:'mdi:bed-king',accent_color:'#a18acb',path:'#bedroom',temperature_entity:'sensor.temp',humidity_entity:'sensor.humidity',light_entity:'light.bedroom',cover_entity:'cover.blinds'},
 {type:'custom:luma-gate-card',name:'Garázs',entity:'cover.garage',display:'popover'},
 {type:'custom:luma-gate-card',name:'Nagykapu',entity:'cover.gate',display:'popover'},
 {type:'custom:luma-comfort-card',name:'Komfort',temperature_entity:'sensor.temp',humidity_entity:'sensor.humidity',pm25_entity:'sensor.pm'},
 {type:'custom:luma-metric-card',entity:'sensor.energy',name:'Napelem ma',icon:'mdi:solar-panel',color:'#c7a453',decimals:1,subtitle:'Várt: 21,9 kWh',tap_action:{action:'more-info'}},
 {type:'custom:luma-metric-card',entity:'sensor.outside',name:'Kint',icon:'mdi:thermometer',color:'#62ada3',decimals:1,subtitle:'Szél: 5 km/h',tap_action:{action:'more-info'}},
];
@customElement('luma-refinement-preview')
export class RefinementPreview extends LitElement{
 @property() theme='dark';
 @property() variant='compare';
 static styles=css`
 :host{display:block;width:min(1220px,calc(100vw - 32px));font:14px/1.5 Inter,system-ui,sans-serif;}
 .review{padding:28px;border-radius:24px;background:var(--primary-background-color);color:var(--primary-text-color);}
 .intro{display:flex;justify-content:space-between;gap:24px;align-items:baseline;margin-bottom:24px;}.intro h1{font-size:22px;font-weight:620;margin:0;letter-spacing:-.03em;}.intro p{color:var(--secondary-text-color);margin:4px 0 0;font-size:12px;}
 .columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:32px}.columns.single{grid-template-columns:minmax(0,1fr);max-width:600px;margin:auto;}
 h2{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;margin:0 0 14px;color:var(--secondary-text-color);}
 .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start}.grid>*{min-width:0}.grid>luma-comfort-card{grid-column:1/-1}
 .note{font-size:12px;margin-top:20px;color:var(--secondary-text-color)}
 @media(max-width:900px){.columns{grid-template-columns:minmax(0,1fr)}}
 @media(max-width:480px){.review{padding:12px}.intro{margin-bottom:20px}.intro h1{font-size:19px}.columns{gap:28px}.grid{gap:8px}}
 `;
 private mountVersion=0;
 protected updated(){void this.mount();}
 private async mount(){
  const version=++this.mountVersion;this.removeAttribute('data-ready');
  const root=this.renderRoot.querySelector<HTMLElement>('.review');if(!root)return;
  const dark=this.theme==='dark';const tokens={'--primary-text-color':dark?'#ececf1':'#242630','--secondary-text-color':dark?'#a9aab8':'#676976','--primary-background-color':dark?'#141519':'#f5f5f8','--ha-card-background':dark?'#202127':'#ffffff','--card-background-color':dark?'#202127':'#ffffff','--primary-color':dark?'#78b7d0':'#397b94','--info-color':dark?'#64b9d2':'#328eaa','--success-color':dark?'#74b393':'#408465','--warning-color':dark?'#d1aa64':'#a57a27','--error-color':dark?'#d98186':'#be5761'};
  for(const[k,v]of Object.entries(tokens))root.style.setProperty(k,v);
  for(const grid of root.querySelectorAll<HTMLElement>('.grid')){
   grid.replaceChildren();const refined=grid.dataset.variant==='refined';
   for(const config of configs){
    const card=document.createElement(String(config.type).replace('custom:','')) as LovelaceCard & HTMLElement & {updateComplete:Promise<boolean>};
    card.setConfig({...config});card.hass=createMockHass(definitions);card.hass.locale={language:'hu'};
    if(version!==this.mountVersion)return;
    grid.append(card);await card.updateComplete;
    if(version!==this.mountVersion)return;
    if(!refined){
     const sheet=new CSSStyleSheet();sheet.replaceSync(legacySurfaceCSS+'ha-card {background:var(--luma-surface);}'+(config.entity==='cover.garage'?'ha-card {--tone:var(--luma-state-neutral) !important;}':''));
     if(card.shadowRoot)card.shadowRoot.adoptedStyleSheets=[...card.shadowRoot.adoptedStyleSheets,sheet];
    }
    for(const icon of card.shadowRoot?.querySelectorAll('ha-icon')||[]){
     const path=paths[icon.getAttribute('icon')||''];if(!path||!icon.shadowRoot)continue;
     icon.shadowRoot.innerHTML=`<style>:host{display:inline-flex;align-items:center;justify-content:center;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px)}svg{width:100%;height:100%}</style><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
    }
   }
  }
  this.setAttribute('data-ready','true');
 }
 render(){const variants=this.variant==='compare'?['current','refined']:[this.variant];return html`<div class="review"><div class="intro"><div><h1>Luma · finomhangolás</h1><p>Azonos kártyák, azonos adatok. Kizárólag vizuális előnézet.</p></div></div><div class=${`columns ${variants.length===1?'single':''}`}>${variants.map(v=>html`<section><h2>${v==='current'?'Most · 0.61.4':'Javasolt · finom színezés'}</h2><div class="grid" data-variant=${v}></div></section>`)}</div><p class="note">Puha felületek · visszafogott keretek · színes állapotok · megmaradó billentyűzetes fókusz</p></div>`;}
}
