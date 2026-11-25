import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { IdleDismiss } from '../idle-dismiss';
import { keyed } from 'lit/directives/keyed.js';
import { customElement, property, state } from 'lit/decorators.js';
import { entityName, entityState, runAction } from '../helpers';
import { localized } from '../localize';
import { lumaTokens, lumaInteractionStyles } from '../styles';
import type { HomeAssistant, LumaAction } from '../types';
import './luma-bottom-sheet';
import './luma-touch-range';
import './luma-wall-sensor';
import '../cards/luma-light-fader-card';

export interface WallControlEntity {
  entity:string; name?:string; show_color?:boolean; remote_entity?:string;
  apps?:{name:string; icon?:string; tap_action:LumaAction}[];
  metrics?:{entity:string; name?:string}[];
  mode_labels?:Record<string,string>;
}
/** Mounted only while open. No discovery, history, polling or device actions on mount. */
@customElement('luma-wall-controls')
export class LumaWallControls extends LitElement {
  @property({attribute:false}) hass?:HomeAssistant;
  @property({attribute:false}) items:WallControlEntity[]=[];
  @property() entity='';
  @property({type:Number}) idleSeconds=0;
  private idle?:IdleDismiss;
  connectedCallback(){super.connectedCallback();this.idle=new IdleDismiss(this,()=>this.idleSeconds,()=>this.dispatchEvent(new CustomEvent('controls-close')));}
  protected updated(changed:PropertyValues<this>){if(changed.has('idleSeconds'))this.idle?.reset();}
  @state() private busy=false;
  @state() private error=false;
  @state() private sent=false;
  private serial=0;
  private saturation=100;
  private hue=0;
  private colorPendingUntil=0;
  static styles=[lumaTokens,lumaInteractionStyles,css`
    :host{display:block;color:var(--primary-text-color)}
    .layout{display:grid;grid-template-columns:minmax(180px,240px) minmax(0,1fr);gap:24px;max-width:1180px;width:100%;margin:auto}
    nav{display:flex;flex-direction:column;gap:10px}button{min-height:64px;border:1px solid var(--luma-border);border-radius:var(--luma-radius-control);background:var(--luma-surface);padding:14px 18px;text-align:left;font-size:17px}
    nav button[aria-pressed=true]{border-color:var(--primary-color);background:color-mix(in srgb,var(--primary-color) 14%,var(--luma-surface))}
    main{min-width:0;display:grid;align-content:start;gap:22px}.surface{background:var(--luma-surface);border:1px solid var(--luma-border);border-radius:var(--luma-radius-card);padding:22px;display:grid;gap:22px}
    luma-light-fader-card{height:190px;min-height:190px}.actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.actions button{text-align:center;display:flex;align-items:center;justify-content:center;gap:12px;min-height:80px}.actions ha-icon{--mdc-icon-size:28px}
    .status{font-size:14px;min-height:22px;color:var(--luma-muted)}.error{color:var(--error-color)}
    h2{font-size:18px;margin:0}.layout.single{grid-template-columns:minmax(0,1fr)}
    .device-top{display:flex;justify-content:space-between;align-items:center;gap:16px}.device-top button{display:flex;align-items:center;gap:12px;min-width:130px;justify-content:center}
    .choices{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.choices button[aria-pressed=true],.power-on{border-color:var(--primary-color);background:color-mix(in srgb,var(--primary-color) 15%,var(--luma-surface))}
    .readings{display:flex;gap:28px;flex-wrap:wrap}.reading{display:grid;gap:6px}.reading small,.muted{font-size:14px;color:var(--luma-muted)}.reading strong{font-size:24px;font-variant-numeric:tabular-nums}
    .tv-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:22px}.tv-grid .surface{align-content:start}
    .dpad{display:grid;grid-template-columns:repeat(3,minmax(64px,96px));grid-template-rows:repeat(3,80px);gap:10px;justify-content:center}.dpad button{text-align:center;padding:10px}.dpad .up{grid-column:2}.dpad .left{grid-column:1;grid-row:2}.dpad .center{grid-column:2;grid-row:2;background:color-mix(in srgb,var(--primary-color) 18%,var(--luma-surface))}.dpad .right{grid-column:3;grid-row:2}.dpad .down{grid-column:2;grid-row:3}.dpad ha-icon{--mdc-icon-size:30px}
    @media(max-width:850px){.tv-grid{grid-template-columns:minmax(0,1fr)}}
    .state{font-size:22px;font-weight:var(--luma-weight-strong)}
    @media(max-width:650px){.layout{grid-template-columns:minmax(0,1fr);gap:16px}nav{flex-direction:row;overflow:auto;padding-bottom:4px}nav button{flex:0 0 auto;max-width:220px}.surface{padding:16px}.actions button{padding:10px;gap:6px;flex-direction:column;font-size:15px}}
  `];
  protected shouldUpdate(changed:PropertyValues<this>){
    if(!changed.has('hass')||changed.size>1)return true;
    const old=changed.get('hass') as HomeAssistant|undefined;
    const item=this.items.find(i=>i.entity===this.entity);
    return !old||old.locale!==this.hass?.locale||[this.entity,item?.remote_entity,...(item?.metrics||[]).map(m=>m.entity)].some(id=>id&&old.states[id]!==this.hass?.states[id]);
  }
  protected willUpdate(changed:PropertyValues<this>){
    if(changed.has('entity')){this.serial++;this.busy=false;this.error=false;this.sent=false;this.colorPendingUntil=0;}
    const hs=this.hass?.states[this.entity]?.attributes.hs_color;
    if(Array.isArray(hs)&&(changed.has('hass')||changed.has('entity'))&&!this.busy&&(Date.now()>this.colorPendingUntil||(Math.abs(Number(hs[0])-this.hue)<1&&Math.abs(Number(hs[1])-this.saturation)<1))){this.hue=Number(hs[0]);this.saturation=Number(hs[1]);this.colorPendingUntil=0;}
  }
  disconnectedCallback(){this.idle?.destroy();this.idle=undefined;this.serial++;super.disconnectedCallback()}
  private async send(service:string,data:Record<string,unknown>={},entity=this.entity){
    const e=this.hass?.states[entity];
    if(!this.hass||this.busy||!e||e.attributes.restored||['unknown','unavailable'].includes(e.state))return;
    const serial=++this.serial;this.busy=true;this.error=false;this.sent=false;
    try{await this.hass.callService(entity.split('.')[0],service,data,{entity_id:entity});if(serial===this.serial)this.sent=true;}
    catch{if(serial===this.serial)this.error=true;}
    finally{if(serial===this.serial)this.busy=false;}
  }
  private range(label:string,value:number|undefined,min:number,max:number,unit:string,disabled:boolean,commit:(v:number)=>void,track='',step=1){
    return html`<luma-touch-range .label=${label} .value=${value} .min=${min} .max=${max} .unit=${unit} .step=${step} .disabled=${disabled} .track=${track} @value-commit=${(e:CustomEvent)=>commit(e.detail.value)}></luma-touch-range>`;
  }
  private t(en:string,hu:string){return localized(this.hass,en,hu)}
  private modeLabel(mode:string){
    const configured=this.items.find(i=>i.entity===this.entity)?.mode_labels?.[mode];
    if(configured)return configured;
    const labels:Record<string,[string,string]>={auto:['Automatic','Automatikus'],allergen:['Allergen','Allergén'],night:['Night','Éjszakai'],speed_1:['Speed 1','1. fokozat'],speed_2:['Speed 2','2. fokozat'],speed_3:['Speed 3','3. fokozat'],turbo:['Turbo','Turbó'],purification:['Purification','Légtisztítás'],purification_humidification:['Purification + humidity','Tisztítás + párásítás']};
    return labels[mode]?this.t(...labels[mode]):mode;
  }
  private async launch(action:LumaAction){
    if(!this.hass||this.busy)return;
    const serial=++this.serial;this.busy=true;this.error=false;this.sent=false;
    try{await runAction(this,this.hass,action);if(serial===this.serial)this.sent=true;}
    catch{if(serial===this.serial)this.error=true;}
    finally{if(serial===this.serial)this.busy=false;}
  }
  private deviceControls(disabled:boolean){
    const e=this.hass!.states[this.entity],a=e?.attributes||{},item=this.items.find(i=>i.entity===this.entity),domain=this.entity.split('.')[0],features=Number(a.supported_features||0),on=e?.state!=='off';
    const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:undefined;
    const button=(label:string,icon:string,service:string,data:Record<string,unknown>={},blocked=disabled,target=this.entity)=>html`<button aria-label=${label} ?disabled=${blocked} @click=${()=>this.send(service,data,target)}><ha-icon icon=${icon}></ha-icon><span>${label}</span></button>`;
    const remote=item?.remote_entity,remoteState=remote?this.hass?.states[remote]:undefined,remoteUnavailable=!remoteState||!!remoteState.attributes.restored||['unknown','unavailable'].includes(remoteState.state);
    const key=(label:string,icon:string,command:string,position='')=>html`<button class=${position} aria-label=${label} ?disabled=${disabled||remoteUnavailable||!on} @click=${()=>this.send('send_command',{command},remote!)}>${position==='center'?'OK':html`<ha-icon icon=${icon}></ha-icon>`}</button>`;
    const powerSupported=domain!=='media_player'&&domain!=='fan'||!!(features&(domain==='fan'?(on?32:16):(on?256:128)));
    const presets=(domain==='fan'?a.preset_modes:a.available_modes);
    return html`
      <section class="surface"><div class="device-top"><div><div class="state">${e?entityState(this.hass!,e):this.t('Unavailable','Nem elérhető')}</div>${domain==='media_player'&&(a.media_title||a.app_name)?html`<div class="muted">${String(a.media_title||a.app_name)}</div>`:nothing}</div>
      ${powerSupported?button(on?this.t('Turn off','Kikapcsolás'):this.t('Turn on','Bekapcsolás'),'mdi:power',on?'turn_off':'turn_on'):remote?button(this.t('Power','Be / ki'),'mdi:power','send_command',{command:'KEYCODE_POWER'},this.busy||remoteUnavailable,remote):nothing}</div>
      ${item?.metrics?.length?html`<div class="readings">${item.metrics.map(m=>{const state=this.hass?.states[m.entity];return html`<div class="reading"><small>${m.name||entityName(state,m.entity)}</small><strong>${state&&!['unknown','unavailable'].includes(state.state)?entityState(this.hass!,state):'—'}</strong></div>`})}</div>`:nothing}</section>
      ${domain==='media_player'?html`<div class="tv-grid">
        <section class="surface">${remote?html`<div class="dpad">${key(this.t('Up','Fel'),'mdi:chevron-up','KEYCODE_DPAD_UP','up')}${key(this.t('Left','Balra'),'mdi:chevron-left','KEYCODE_DPAD_LEFT','left')}${key('OK','mdi:check','KEYCODE_DPAD_CENTER','center')}${key(this.t('Right','Jobbra'),'mdi:chevron-right','KEYCODE_DPAD_RIGHT','right')}${key(this.t('Down','Le'),'mdi:chevron-down','KEYCODE_DPAD_DOWN','down')}</div>
          <div class="actions">${button(this.t('Back','Vissza'),'mdi:arrow-u-left-top','send_command',{command:'KEYCODE_BACK'},disabled||remoteUnavailable||!on,remote)}${button(this.t('Home','Kezdőlap'),'mdi:home','send_command',{command:'KEYCODE_HOME'},disabled||remoteUnavailable||!on,remote)}${button(this.t('Menu','Menü'),'mdi:menu','send_command',{command:'KEYCODE_MENU'},disabled||remoteUnavailable||!on,remote)}</div>`:nothing}
          <div class="actions">${features&16?button(this.t('Previous','Előző'),'mdi:skip-previous','media_previous_track',{},disabled||!on):nothing}${features&(e?.state==='playing'?1:16384)?button(e?.state==='playing'?this.t('Pause','Szünet'):this.t('Play','Lejátszás'),e?.state==='playing'?'mdi:pause':'mdi:play',e?.state==='playing'?'media_pause':'media_play',{},disabled||!on):nothing}${features&32?button(this.t('Next','Következő'),'mdi:skip-next','media_next_track',{},disabled||!on):nothing}</div>
        </section>
        <section class="surface"><h2>${this.t('Volume','Hangerő')}</h2><div class="actions">${features&1024?button(this.t('Quieter','Halkabb'),'mdi:volume-minus','volume_down',{},disabled||!on):nothing}${features&8?button(a.is_volume_muted?this.t('Unmute','Hang vissza'):this.t('Mute','Némítás'),'mdi:volume-off','volume_mute',{is_volume_muted:!a.is_volume_muted},disabled||!on):nothing}${features&1024?button(this.t('Louder','Hangosabb'),'mdi:volume-plus','volume_up',{},disabled||!on):nothing}</div>
          ${features&4?this.range(this.t('Volume','Hangerő'),num(a.volume_level)===undefined?undefined:Number(a.volume_level)*100,0,100,'%',disabled||!on,v=>void this.send('volume_set',{volume_level:v/100})):nothing}
          ${item?.apps?.length?html`<h2>${this.t('Apps','Alkalmazások')}</h2><div class="choices">${item.apps.map(app=>html`<button ?disabled=${disabled} @click=${()=>this.launch(app.tap_action)}>${app.name}</button>`)}</div>`:nothing}
          ${features&2048&&Array.isArray(a.source_list)&&a.source_list.length?html`<h2>${this.t('Input','Bemenet')}</h2><div class="choices">${a.source_list.map(source=>html`<button ?disabled=${disabled||!on} aria-pressed=${a.source===source} @click=${()=>this.send('select_source',{source})}>${String(source)}</button>`)}</div>`:nothing}
        </section></div>`:html`
        <section class="surface">${Array.isArray(presets)&&presets.length&&features&(domain==='fan'?8:1)?html`<h2>${this.t('Mode','Üzemmód')}</h2><div class="choices">${presets.map(mode=>html`<button aria-pressed=${(domain==='fan'?a.preset_mode:a.mode)===mode} ?disabled=${disabled} @click=${()=>this.send(domain==='fan'?'set_preset_mode':'set_mode',domain==='fan'?{preset_mode:mode}:{mode})}>${this.modeLabel(String(mode))}</button>`)}</div>`:nothing}
        ${domain==='fan'&&features&1?this.range(this.t('Fan speed','Ventilátor sebessége'),num(a.percentage),0,100,'%',disabled,v=>void this.send('set_percentage',{percentage:v}),'',num(a.percentage_step)??1):nothing}
        ${domain==='humidifier'?this.range(this.t('Target humidity','Cél páratartalom'),num(a.humidity),num(a.min_humidity)??0,num(a.max_humidity)??100,'%',disabled,v=>void this.send('set_humidity',{humidity:v})):nothing}
        </section>`}
    `;
  }
  render(){
    if(!this.hass)return nothing;
    const e=this.hass.states[this.entity],a=e?.attributes||{},light=this.entity.startsWith('light.'),cover=this.entity.startsWith('cover.'),media=this.entity.startsWith('media_player.'),sensor=this.entity.startsWith('sensor.'),name=this.items.find(i=>i.entity===this.entity)?.name||entityName(e,this.entity);
    const unavailable=!e||!!a.restored||['unknown','unavailable'].includes(e.state),disabled=unavailable||this.busy;
    const modes=Array.isArray(a.supported_color_modes)?a.supported_color_modes:[],color=this.items.find(i=>i.entity===this.entity)?.show_color!==false&&modes.some(m=>['hs','xy','rgb','rgbw','rgbww'].includes(String(m))),features=Number(a.supported_features||0);
    const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:undefined;
    const t=(en:string,hu:string)=>localized(this.hass,en,hu);
    return html`<luma-bottom-sheet .open=${true} .fullscreen=${true} .heading=${name} .subtitle=${light?t('Light controls','Világítás'):cover?t('Shutter controls','Redőnyök'):media?t('Remote control','Távirányító'):sensor?t('History','Előzmények'):t('Air care','Levegő')} .icon=${light?'mdi:lightbulb-outline':cover?'mdi:window-shutter':media?'mdi:television':sensor?'mdi:chart-line':'mdi:air-purifier'} .closeLabel=${t('Close','Bezárás')} @sheet-dismiss=${()=>this.dispatchEvent(new CustomEvent('controls-close'))}>
      <div class="layout ${this.items.length===1?'single':''}">${this.items.length>1?html`<nav aria-label=${t('Select device','Eszköz kiválasztása')}>${this.items.map(i=>html`<button aria-pressed=${i.entity===this.entity} @click=${()=>{this.entity=i.entity}}>${i.name||entityName(this.hass?.states[i.entity],i.entity)}</button>`)}</nav>`:nothing}
      <main>${keyed(this.entity, html`${sensor?html`<luma-wall-sensor .hass=${this.hass} .entity=${this.entity}></luma-wall-sensor>`:light?html`<luma-light-fader-card .hass=${this.hass} .config=${{entity:this.entity,name,orientation:'horizontal',touch_controls:true,details:'none'}}></luma-light-fader-card>
        ${modes.includes('color_temp')?html`<section class="surface">${this.range(t('White temperature','Színhőmérséklet'),num(a.color_temp_kelvin),num(a.min_color_temp_kelvin)??2000,num(a.max_color_temp_kelvin)??6500,' K',disabled,v=>void this.send('turn_on',{color_temp_kelvin:v}),'linear-gradient(90deg,#e7a352,#eee5cb,#bcd9f5)')}</section>`:nothing}
        ${color?html`<section class="surface">${this.range(t('Hue','Színárnyalat'),num(Array.isArray(a.hs_color)?a.hs_color[0]:undefined),0,360,'°',disabled,v=>{this.hue=v;this.colorPendingUntil=Date.now()+5000;void this.send('turn_on',{hs_color:[v,this.saturation]})},'linear-gradient(90deg,#dc5959,#d9cd57,#5cba6a,#53b9c6,#6b6ad2,#c566b4,#dc5959)')}
        ${this.range(t('Saturation','Színtelítettség'),num(Array.isArray(a.hs_color)?a.hs_color[1]:undefined),0,100,'%',disabled,v=>{this.saturation=v;this.colorPendingUntil=Date.now()+5000;void this.send('turn_on',{hs_color:[this.hue,v]})})}</section>`:nothing}
      `:!cover?this.deviceControls(disabled):html`<section class="surface"><div class="state">${e?entityState(this.hass,e):t('Unavailable','Nem elérhető')}</div>
        <div class="actions">${([['open_cover',1,'mdi:arrow-up',t('Open','Fel')],['stop_cover',8,'mdi:stop',t('Stop','Állj')],['close_cover',2,'mdi:arrow-down',t('Close','Le')]] as const).map(([service,flag,icon,label])=>html`<button ?disabled=${unavailable||!(features&flag)||(this.busy&&service!=='stop_cover')} @click=${()=>{if(service==='stop_cover')this.busy=false;void this.send(service)}}><ha-icon icon=${icon}></ha-icon>${label}</button>`)}</div>
        ${features&4?this.range(t('Open position','Nyitottság'),num(a.current_position),0,100,'%',disabled,v=>void this.send('set_cover_position',{position:v})):nothing}
        ${features&128?this.range(t('Tilt position','Lamellák nyitottsága'),num(a.current_tilt_position),0,100,'%',disabled,v=>void this.send('set_cover_tilt_position',{tilt_position:v})):nothing}
      </section>`}
      `)}<div class="status ${this.error?'error':''}" role="status">${unavailable?t('Unavailable','Nem elérhető'):this.error?t('Could not send command','Nem sikerült elküldeni'):this.busy?t('Sending…','Küldés…'):this.sent?t('Command sent','Parancs elküldve'):''}</div></main></div>
    </luma-bottom-sheet>`;
  }
}
