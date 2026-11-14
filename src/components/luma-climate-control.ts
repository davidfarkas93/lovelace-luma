import {LitElement,css,html,nothing} from 'lit';
import {customElement,property,state} from 'lit/decorators.js';
import {runAction} from '../helpers';
import {localized} from '../localize';
import {lumaTokens,lumaInteractionStyles,lumaSurfaceStyles} from '../styles';
import {entityAvailable,finiteMeasurement,formatNumber,missingLabel} from '../presentation';
import type {HomeAssistant} from '../types';
export interface ClimateControlConfig {entity:string;name?:string;icon?:string;modes?:{mode:string;name?:string;icon?:string}[]}
const modeLabels:Record<string,[string,string]>={off:['Off','Ki'],cool:['Cooling','Hűtés'],heat:['Heating','Fűtés'],auto:['Auto','Automata'],heat_cool:['Heat/cool','Fűtés/hűtés'],dry:['Dry','Párátlanítás'],fan_only:['Fan','Ventilátor']};
const modeIcons:Record<string,string>={off:'mdi:power',cool:'mdi:snowflake',heat:'mdi:fire',auto:'mdi:autorenew',heat_cool:'mdi:autorenew',dry:'mdi:water-percent',fan_only:'mdi:fan'};

/** Reusable climate controls for cards and detail surfaces; HA remains authoritative. */
@customElement('luma-climate-control')
export class LumaClimateControl extends LitElement {
 @property({attribute:false}) hass?:HomeAssistant;
 @property({attribute:false}) config?:ClimateControlConfig;
 @property({type:Boolean}) compact=false;
 @property({type:Boolean}) alwaysVisible=false;
 @state() private menuOpen=false;
 @state() private busy=false;
 @state() private error=false;
 static styles=[lumaTokens,lumaInteractionStyles,lumaSurfaceStyles,css`
:host{display:block;container-type:inline-size;min-width:0;color:var(--primary-text-color)}
.climate{border-top:1px solid var(--luma-border);padding-top:8px;display:grid;gap:6px;min-width:0}
.climate-header{display:flex;gap:8px;align-items:center;min-width:0}.climate-icon{display:grid;place-items:center;color:var(--luma-muted)}.climate-icon ha-icon{--mdc-icon-size:19px}
.climate-copy{display:flex;align-items:center;gap:8px;flex:1;min-width:0}.climate-name{font-size:12px;font-weight:600}.climate-state{font-size:11px;color:var(--luma-muted);margin-left:auto;text-align:right;overflow-wrap:anywhere}
.actions{display:flex;gap:6px;flex-wrap:wrap}.action{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;min-width:44px;padding:8px 12px;font-size:11px;line-height:1.3}
.action ha-icon{--mdc-icon-size:16px}.action[aria-pressed=true]{background:color-mix(in srgb,var(--mode-tone) 16%,transparent)}.action[aria-pressed=true] ha-icon{color:var(--mode-tone)}.settings{margin-left:auto}.error{font-size:12px;line-height:1.4}
.compact{border:0;padding:4px 8px;gap:6px;grid-template-columns:34px minmax(0,1fr) auto 44px;align-items:center}.compact .climate-header{display:contents}.compact .climate-icon{grid-column:1;grid-row:1}.compact .climate-copy{grid-column:2;grid-row:1}.compact .climate-name{overflow-wrap:anywhere}.compact .actions{grid-column:3;grid-row:1}.compact .settings{grid-column:4;grid-row:1}.compact .error{grid-column:1 / -1}.compact .climate-icon{width:34px;height:34px;border-radius:11px;background:color-mix(in srgb,var(--tone) 9%,transparent);color:var(--tone);flex-shrink:0}
.compact .climate-copy{display:grid;gap:4px}.compact .climate-state{display:flex;align-items:center;gap:5px;margin:0;text-align:left;flex-wrap:wrap}.compact .dot{width:6px;height:6px;border-radius:50%;background:var(--tone);flex-shrink:0}
.compact .actions:not(:has(button,select)){display:none}.compact .actions{margin:0;justify-self:end;max-width:200px;display:inline-flex;gap:2px;padding:3px;border-radius:var(--luma-radius-control);background:color-mix(in srgb,var(--primary-text-color) 4%,transparent)}.compact .action{border:0;box-shadow:none;background:transparent;border-radius:10px;padding:8px 10px}.compact .actions .action ha-icon{display:none}.compact .action:hover{background:var(--luma-hover-surface)}.compact .action[aria-pressed=true]{background:color-mix(in srgb,var(--mode-tone) 10%,var(--luma-surface));box-shadow:0 1px 3px color-mix(in srgb,var(--primary-text-color) 8%,transparent)}.compact .settings{padding:10px;color:var(--luma-muted);flex-shrink:0}
.more-trigger{font-size:18px!important}.compact .actions .more-trigger ha-icon{display:block}.more-trigger[data-active=true]{background:color-mix(in srgb,var(--info-color,var(--primary-color)) 12%,transparent)}
.mode-menu{position:fixed;inset:auto;margin:0;padding:5px;width:190px;max-width:calc(100vw - 24px);border:1px solid var(--luma-border);border-radius:var(--luma-radius-control);background:var(--luma-surface);color:var(--primary-text-color);box-shadow:0 8px 28px #0003}
.menu-mode{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;padding:8px 10px;border:0;border-radius:10px;background:transparent;color:inherit;text-align:left;font:inherit;font-size:12px}.menu-mode:hover{background:var(--luma-hover-surface)}.menu-mode[aria-checked=true]{background:color-mix(in srgb,var(--primary-color) 10%,transparent)}.menu-mode ha-icon{--mdc-icon-size:18px;color:var(--luma-muted)}.menu-check{margin-left:auto}
@container(max-width:320px){.compact.has-extra{grid-template-columns:minmax(0,1fr) auto 44px;gap:4px}.compact.has-extra .climate-icon{display:none}.compact.has-extra .climate-copy{grid-column:1}.compact.has-extra .actions{grid-column:2;grid-row:1}.compact.has-extra .settings{grid-column:3}}
@container(max-width:270px){.climate-copy{flex-wrap:wrap}.climate-state{margin-left:0}.compact{grid-template-columns:34px minmax(0,1fr) 44px}.compact .settings{grid-column:3}.compact .actions{grid-column:2 / -1;grid-row:2;justify-self:start}}
`];
 private readonly dismissOnScroll=()=>{
   const menu=this.renderRoot.querySelector<HTMLElement>('.mode-menu');
   if(menu?.matches(':popover-open'))menu.hidePopover();
 };
 private scrollTargets:EventTarget[]=[];
 private stopWatchingScroll(){for(const target of this.scrollTargets)target.removeEventListener('scroll',this.dismissOnScroll,true);this.scrollTargets=[];window.removeEventListener('resize',this.dismissOnScroll);}
 private watchScroll(){
   this.stopWatchingScroll();
   // Scroll events do not cross shadow roots: observe each root up to the document.
   let node:Node|null=this;
   while(node){
     const root=node.getRootNode();
     if(!this.scrollTargets.includes(root)){this.scrollTargets.push(root);root.addEventListener('scroll',this.dismissOnScroll,true);}
     node=(node instanceof Element?node.assignedSlot:null)||node.parentNode||(node instanceof ShadowRoot?node.host:null);
   }
   window.addEventListener('resize',this.dismissOnScroll);
 }
 disconnectedCallback(){this.stopWatchingScroll();super.disconnectedCallback();}
 private info(entity:string){runAction(this,this.hass!,{action:'more-info'},entity)}
  private modes(){
    const c=this.config,e=c?this.hass?.states[c.entity]:undefined;
    const supported=Array.isArray(e?.attributes.hvac_modes)?e.attributes.hvac_modes as string[]:[];
    return (c?.modes||[{mode:'off'},{mode:'cool'}]).filter(m=>supported.includes(m.mode));
  }
  private openModes(){
    const menu=this.renderRoot.querySelector<HTMLElement>('.mode-menu'),trigger=this.renderRoot.querySelector<HTMLElement>('.more-trigger');
    if(!menu||!trigger)return;
    if(menu.matches(':popover-open')){menu.hidePopover();return;}
    const rect=trigger.getBoundingClientRect();menu.showPopover();
    const height=menu.getBoundingClientRect().height;
    menu.style.left=`${Math.max(12,Math.min(rect.right-190,window.innerWidth-202))}px`;
    menu.style.top=`${Math.max(12,rect.bottom+height+8>window.innerHeight?rect.top-height-6:rect.bottom+6)}px`;
    (menu.querySelector<HTMLElement>('[aria-checked=true]')||menu.querySelector<HTMLElement>('button'))?.focus();
    this.watchScroll();
  }
  private menuKey(event:KeyboardEvent){
    const buttons=Array.from(this.renderRoot.querySelectorAll<HTMLButtonElement>('.menu-mode'));
    const index=buttons.indexOf(this.shadowRoot?.activeElement as HTMLButtonElement);
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();this.closeModes();}
    if(event.key==='Tab'){event.preventDefault();this.renderRoot.querySelector<HTMLElement>('.mode-menu')?.hidePopover();this.renderRoot.querySelector<HTMLElement>(event.shiftKey?'.more-trigger':'.settings')?.focus();}
  }
  private closeModes(){this.renderRoot.querySelector<HTMLElement>('.mode-menu')?.hidePopover();this.renderRoot.querySelector<HTMLElement>('.more-trigger')?.focus();}
  private async changeMode(mode:string){
    const c=this.config;
    if(!c||!this.hass||this.busy||!entityAvailable(this.hass.states[c.entity])||!this.modes().some(m=>m.mode===mode))return;
    this.busy=true;this.error=false;
    try{await this.hass.callService('climate','set_hvac_mode',{hvac_mode:mode},{entity_id:c.entity});}
    catch{this.error=true;}finally{this.busy=false;}
  }
  render(){
    if(!this.hass||!this.config)return nothing;
    const c=this.config;
    const e=this.hass!.states[c.entity],available=entityAvailable(e),mode=e?.state||'unavailable',target=available&&mode!=='off'?finiteMeasurement(e.attributes.temperature):null;
    if(available&&mode==='off'&&!this.alwaysVisible)return nothing;
    const unit=String(e?.attributes.temperature_unit||this.hass!.config?.unit_system?.temperature||'°C');
    const actionLabels:Record<string,[string,string]>={cooling:['Cooling now','Épp hűt'],heating:['Heating now','Épp fűt'],drying:['Drying now','Épp párátlanít'],idle:['Idle','Készenlét'],fan:['Fan running','Ventilátor működik'],defrosting:['Defrosting','Leolvasztás']};
    const action=String(e?.attributes.hvac_action||''),pair=modeLabels[mode];
    const status=!available?missingLabel(this.hass,e):mode==='off'?localized(this.hass,'Off','Kikapcsolva'):actionLabels[action]?localized(this.hass,...actionLabels[action]):pair?`${localized(this.hass,...pair)} ${localized(this.hass,'mode','mód')}`:mode;
    const active=available&&mode!=='off'&&['cooling','heating','drying','fan','defrosting'].includes(action);
    const tone=active?(action==='heating'?'var(--luma-state-warning)':'var(--info-color, var(--primary-color))'):'var(--luma-state-neutral)';
    const modes=available?this.modes():[];
    const direct=this.compact?modes.slice(0,2):modes;
    const extra=this.compact?modes.slice(2):[];
    const extraActive=extra.find(m=>m.mode===mode);
    const modeLabel=(m:{mode:string;name?:string})=>m.name||(modeLabels[m.mode]?localized(this.hass,...modeLabels[m.mode]):m.mode);
    const settings=html`<button class="action settings" aria-label=${localized(this.hass,'Climate settings','Klímabeállítások')} title=${localized(this.hass,'Settings','Beállítások')} @click=${()=>this.info(c.entity)}><ha-icon icon="mdi:tune-variant"></ha-icon>${this.compact?nothing:localized(this.hass,'Settings','Beállítások')}</button>`;
    return html`<section class=${`climate ${this.compact?`compact ${extra.length?'has-extra':''}`:''}`} style=${`--tone:${tone}`} aria-label=${c.name||localized(this.hass,'Air conditioning','Klíma')} aria-busy=${this.busy}>
      <div class="climate-header"><span class="climate-icon"><ha-icon icon=${c.icon||'mdi:air-conditioner'}></ha-icon></span><div class="climate-copy"><span class="climate-name">${c.name||localized(this.hass,'Air conditioning','Klíma')}</span><span class="climate-state" role="status">${this.compact?html`<span class="dot" aria-hidden="true"></span>`:nothing}${this.busy?localized(this.hass,'Sending…','Küldés…'):status}${target===null?nothing:html` · ${localized(this.hass,'target','cél')} ${formatNumber(this.hass,target)} ${unit}`}</span></div></div>
      <div class="actions">${direct.map(m=>html`<button class="action" aria-pressed=${available&&mode===m.mode} ?disabled=${!available||this.busy} style=${`--mode-tone:${m.mode==='off'?'var(--secondary-text-color)':m.mode==='heat'?'var(--warning-color)':'var(--info-color, var(--primary-color))'}`} @click=${()=>this.changeMode(m.mode)}><ha-icon icon=${m.icon||modeIcons[m.mode]||'mdi:thermostat'}></ha-icon><span>${m.name||(modeLabels[m.mode]?localized(this.hass,...modeLabels[m.mode]):m.mode)}</span></button>`)}
      ${extra.length?html`<button class="action more-trigger" aria-label=${`${localized(this.hass,'More modes','További módok')}${extraActive?`: ${modeLabel(extraActive)}`:''}`} title=${extraActive?modeLabel(extraActive):localized(this.hass,'More modes','További módok')} aria-haspopup="menu" aria-expanded=${this.menuOpen} aria-controls="extra-modes" data-active=${!!extraActive} ?disabled=${this.busy} @click=${()=>this.openModes()} @keydown=${(event:KeyboardEvent)=>{if(event.key==='ArrowDown'){event.preventDefault();this.openModes();}}}><ha-icon icon=${extraActive?.icon||modeIcons[extraActive?.mode||'']||'mdi:dots-horizontal'}></ha-icon></button>`:nothing}
      ${this.compact?nothing:settings}</div>
      ${this.compact?settings:nothing}
      ${extra.length?html`<div id="extra-modes" class="mode-menu" popover="auto" role="menu" aria-label=${localized(this.hass,'More modes','További módok')} @toggle=${(event:Event)=>{this.menuOpen=(event as Event&{newState:string}).newState==='open';if(!this.menuOpen)this.stopWatchingScroll();}} @keydown=${this.menuKey}>${extra.map(m=>html`<button class="menu-mode" role="menuitemradio" aria-checked=${mode===m.mode} ?disabled=${this.busy} @click=${()=>{this.closeModes();void this.changeMode(m.mode);}}><ha-icon icon=${m.icon||modeIcons[m.mode]||'mdi:thermostat'}></ha-icon><span>${modeLabel(m)}</span>${mode===m.mode?html`<span class="menu-check" aria-hidden="true">✓</span>`:nothing}</button>`)}</div>`:nothing}
      ${this.error?html`<div class="error" role="alert">${localized(this.hass,'Command failed. Try again.','A parancs sikertelen. Próbáld újra.')}</div>`:nothing}
    </section>`;
  }
}
