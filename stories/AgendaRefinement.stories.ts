import type {Meta,StoryObj} from '@storybook/web-components-vite';
import {LitElement,css,html,nothing} from 'lit';
import '../src/index';
import {createMockHass} from '../storybook/mock-hass';
import {lumaTokens,lumaInteractionStyles} from '../src/styles';
import type {LovelaceCard} from '../src/types';

// Visual fixtures only: HA owns the real calendar-card-pro and todo-list children.
// Do not register these fixtures in src/index.ts or use them in a live dashboard.
class AgendaFixture extends LitElement {
 private config:{kind?:string;empty?:boolean;long?:boolean}={};
 private items=['Tej','Kenyér','Zöldségek a hétvégi főzéshez'];
 static styles=[lumaTokens,lumaInteractionStyles,css`
  :host{font-size:14px;color:var(--primary-text-color)}
  .event{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 0;min-height:64px}
  .date{display:grid;gap:1px;text-align:center;color:var(--secondary-text-color);font-size:10px}.day{font-size:20px;font-weight:560;line-height:1.1;color:var(--primary-text-color)}
  .event-copy{border-left:2px solid #9bbd60;padding-left:10px;min-width:0}.title{font-size:14px;font-weight:560;line-height:1.4;overflow-wrap:anywhere}.time{font-size:11px;color:var(--secondary-text-color);margin-top:3px}.weather{font-size:11px;color:var(--secondary-text-color)}
  .event+.event{border-top:1px solid color-mix(in srgb,var(--primary-text-color) 7%,transparent)}
  form{display:flex;gap:8px;padding:4px 0 8px}input[type=text]{flex:1;min-width:0;border:1px solid color-mix(in srgb,var(--primary-text-color) 12%,transparent);border-radius:10px;min-height:44px;padding:0 12px;background:transparent;color:inherit;font:inherit;font-size:13px}
  button{min-width:44px;min-height:44px;border:0;border-radius:10px;background:color-mix(in srgb,var(--primary-color) 9%,transparent);color:var(--primary-color);font:inherit;font-size:20px;cursor:pointer}
  label{display:flex;align-items:center;gap:10px;min-height:44px;font-size:14px;cursor:pointer}input[type=checkbox]{width:18px;height:18px;accent-color:var(--primary-color)}label:has(:checked) span{text-decoration:line-through;color:var(--secondary-text-color)}
  .empty{margin:0;padding:14px 0;color:var(--secondary-text-color);font-size:12px}
 `];
 setConfig(config:typeof this.config){this.config=config;if(config.empty)this.items=[];this.requestUpdate();}
 render(){return this.config.kind==='shopping'?html`
  <form @submit=${(e:SubmitEvent)=>{e.preventDefault();const input=this.renderRoot.querySelector<HTMLInputElement>('input[type=text]')!;if(input.value.trim()){this.items=[...this.items,input.value.trim()];input.value='';this.requestUpdate();}}}><input type="text" aria-label="Új tétel" placeholder="Új tétel hozzáadása"><button aria-label="Hozzáadás">+</button></form>
  ${!this.items.length?html`<p class="empty">Minden megvan a bevásárláshoz.</p>`:this.items.map(item=>html`<label><input type="checkbox"><span>${item}</span></label>`)}
 `:this.config.empty?html`<p class="empty">Nincs közelgő esemény a következő 5 napban.</p>`:html`
  <div class="event"><div class="date"><span>HÉT</span><span class="day">16</span><span>NOV</span></div><div class="event-copy"><div class="title">${this.config.long?'Téli kerékcsere és időszakos átvizsgálás a szervizben':'Id. 3 kerékcsere'}</div><div class="time">11:00 – 12:00</div></div><span class="weather">☁ 9°</span></div>
  ${this.config.long?html`<div class="event"><div class="date"><span>KED</span><span class="day">17</span><span>NOV</span></div><div class="event-copy"><div class="title">Családi program</div><div class="time">Egész nap</div></div></div>`:nothing}
 `;}
}
if(!customElements.get('luma-story-agenda-fixture'))customElements.define('luma-story-agenda-fixture',AgendaFixture);
function preview(initial=0,empty=false,long=false){
 const card=document.createElement('luma-tab-card')as LovelaceCard;
 card.setConfig({type:'custom:luma-tab-card',initial_tab:initial,tabs:[{name:'Naptár',icon:'mdi:calendar-month-outline',card:{type:'custom:luma-story-agenda-fixture',empty,long}},{name:'Bevásárlólista',icon:'mdi:cart-outline',card:{type:'custom:luma-story-agenda-fixture',kind:'shopping',empty}}]});card.hass=createMockHass({});
 return html`<div style="width:min(600px,calc(100vw - 32px))"><luma-heading-card .hass=${card.hass} .config=${{heading:'Napirend',description:'Következő események és feladatok',icon:'mdi:calendar-check-outline'}}></luma-heading-card>${card}<p style="font-size:11px;color:var(--secondary-text-color);margin:12px 4px">Mintatartalom: a füles keret valódi Luma-komponens; a naptár és a lista vizuális előnézet.</p></div>`;
}
const meta:Meta={title:'Design review/Agenda',parameters:{docs:{description:{component:'Real Luma tab shell with illustrative calendar and shopping-list fixtures. Calendar deployment styling is recorded in docs/agenda-refinement.md. Native HA child-card rendering must be checked before deployment.'}}}};export default meta;type Story=StoryObj;
export const Calendar:Story={render:()=>preview()};
export const Shopping:Story={render:()=>preview(1)};
export const LongEvents:Story={render:()=>preview(0,false,true)};
export const Empty:Story={render:()=>preview(0,true)};
