import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { mediaAppName } from "../helpers";
import type { HomeAssistant, LovelaceCard } from "../types";

interface MediaItem{entity:string;activity_entity?:string;name:string;popup:string;artwork_entity?:string}
interface Config{type:string;routes:Record<string,unknown>[];media_players?:MediaItem[];app_names?:Record<string,string>}

@customElement("luma-navbar-card")
export class LumaNavbarCard extends LitElement implements LovelaceCard{
  @property({attribute:false})hass?:HomeAssistant;
  @state()private config?:Config;
  @state()private selectedMedia=0;
  private child?:HTMLElement&LovelaceCard;
  private dragStart?:{x:number;y:number};
  private suppressOpen=false;
  static styles=css`
    :host{display:block;min-height:74px}.host{min-height:74px}
    .media-dock{position:fixed;z-index:101;left:100px;bottom:18px;box-sizing:border-box;display:grid;grid-template-columns:48px minmax(0,1fr) auto;grid-template-areas:"art title controls" "art meta controls";align-items:center;gap:2px 11px;width:min(360px,calc(100vw - 118px));min-height:66px;padding:9px 11px;overflow:hidden;border:1px solid color-mix(in srgb,#7c78d8 18%,transparent);border-radius:20px;color:var(--primary-text-color);background:linear-gradient(125deg,color-mix(in srgb,#7c78d8 11%,var(--card-background-color)),color-mix(in srgb,var(--card-background-color) 91%,transparent));box-shadow:0 16px 42px rgba(0,0,0,.16);backdrop-filter:blur(24px) saturate(145%);cursor:pointer;touch-action:pan-y;user-select:none;-webkit-tap-highlight-color:transparent}
    .backdrop{position:absolute;z-index:-2;inset:-20px;width:calc(100% + 40px);height:calc(100% + 40px);object-fit:cover;filter:blur(22px) saturate(1.16);opacity:.18;transform:scale(1.06)}.media-dock.has-art::after{content:"";position:absolute;z-index:-1;inset:0;background:linear-gradient(90deg,color-mix(in srgb,var(--card-background-color) 88%,transparent),color-mix(in srgb,var(--card-background-color) 68%,transparent))}
    .art{grid-area:art;display:grid;place-items:center;width:48px;height:48px;overflow:hidden;border-radius:14px;color:#7c78d8;background:color-mix(in srgb,#7c78d8 15%,transparent)}.art img{width:100%;height:100%;object-fit:cover}.art ha-icon{--mdc-icon-size:24px}.title{grid-area:title;align-self:end;min-width:0;overflow:hidden;font-size:13px;font-weight:720;text-overflow:ellipsis;white-space:nowrap}.meta{grid-area:meta;align-self:start;min-width:0;overflow:hidden;color:var(--secondary-text-color);font-size:10px;font-weight:560;text-overflow:ellipsis;white-space:nowrap}.controls{grid-area:controls;display:flex;align-items:center;gap:6px}.control{display:grid;place-items:center;width:34px;height:34px;padding:0;border:0;border-radius:50%;color:#7c78d8;background:color-mix(in srgb,#7c78d8 13%,transparent);cursor:pointer}.control ha-icon{--mdc-icon-size:18px}.pager{display:flex;align-items:center;gap:4px;height:24px;padding:0 6px;border:0;border-radius:999px;background:transparent;cursor:pointer}.dot{width:5px;height:5px;border-radius:999px;background:color-mix(in srgb,var(--secondary-text-color) 32%,transparent);transition:width .18s ease,background .18s ease}.dot.active{width:13px;background:#7c78d8}
    @media(max-width:767px){.media-dock{left:12px;right:12px;bottom:108px;width:auto;min-height:62px;border-radius:18px}.art{width:44px;height:44px;border-radius:13px}.title{font-size:12px}}
  `;
  setConfig(c:Config){if(!Array.isArray(c.routes)||!c.routes.length)throw new Error("Luma Navbar requires a non-empty routes list");this.config=c;void this.mount()}
  getCardSize(){return 1}
  protected updated(){if(this.child&&this.hass)this.child.hass=this.hass}
  private async mount(){if(!this.config||!this.renderRoot.querySelector(".host"))return;const helpers=await window.loadCardHelpers?.();if(!helpers)return;const cfg={type:"custom:navbar-card",mobile:{show_labels:true},desktop:{show_labels:true,position:"left",min_width:768},routes:this.config.routes,styles:".navbar-card{z-index:100!important;background:color-mix(in srgb,var(--card-background-color) 88%,transparent)!important;backdrop-filter:blur(24px) saturate(150%);border:1px solid color-mix(in srgb,var(--primary-text-color) 9%,transparent);border-radius:20px;box-shadow:0 16px 45px rgba(0,0,0,.10);margin:12px 0 16px;overflow:hidden}"};this.child=helpers.createCardElement(cfg) as HTMLElement&LovelaceCard;if(this.hass)this.child.hass=this.hass;const host=this.renderRoot.querySelector(".host")!;host.replaceChildren(this.child)}
  private activeMedia(){if(!this.hass)return[];const active=["on","playing","paused","buffering"];return(this.config?.media_players||[]).filter(item=>active.includes(this.hass!.states[item.activity_entity||item.entity]?.state))}
  private open(hash:string){if(window.location.hash===hash)window.dispatchEvent(new HashChangeEvent("hashchange"));else window.location.hash=hash}
  private openMedia(hash:string){if(this.suppressOpen){this.suppressOpen=false;return}this.open(hash)}
  private selectMedia(event:Event,index:number){event.stopPropagation();this.selectedMedia=index}
  private dragBegin(event:PointerEvent){if((event.target as Element)?.closest?.("button"))return;this.dragStart={x:event.clientX,y:event.clientY};(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)}
  private dragEnd(event:PointerEvent,count:number){
    if(!this.dragStart)return;
    const dx=event.clientX-this.dragStart.x,dy=event.clientY-this.dragStart.y;
    this.dragStart=undefined;
    if(count<2)return;
    if(Math.abs(dx)<38||Math.abs(dx)<=Math.abs(dy)*1.2)return;
    this.selectedMedia=(this.selectedMedia+(dx<0?1:-1)+count)%count;
    this.suppressOpen=true;
    window.setTimeout(()=>{this.suppressOpen=false},350);
    event.preventDefault();
  }
  private dragCancel(){this.dragStart=undefined}
  private playPause(event:Event,entity:string){event.stopPropagation();void this.hass?.callService("media_player","media_play_pause",undefined,{entity_id:entity})}
  private hasPlayback(entity:HomeAssistant["states"][string]|undefined){
    if(!entity||!["playing","paused","buffering"].includes(entity.state))return false;
    const attrs=entity.attributes;
    return Boolean(attrs.media_title||attrs.media_series_title||Number(attrs.media_duration)>0||Number(attrs.media_position)>0);
  }
  protected firstUpdated(){void this.mount()}
  render(){
    if(!this.config||!this.hass)return nothing;
    const active=this.activeMedia(),selected=active.length?this.selectedMedia%active.length:0,item=active[selected],entity=item?this.hass.states[item.entity]:undefined,attrs=entity?.attributes||{};
    const fallback=item?.artwork_entity?this.hass.states[item.artwork_entity]?.attributes||{}:{};
    const artwork=String(attrs.entity_picture_local||attrs.entity_picture||fallback.entity_picture_local||fallback.entity_picture||"");
    const title=String(attrs.media_title||mediaAppName(entity,this.config.app_names)||entity?.attributes.friendly_name||"Média");
    const hasPlayback=this.hasPlayback(entity);
    const state=hasPlayback?(entity?.state==="paused"?"Szüneteltetve":"Lejátszás"):"Aktív";
    return html`${item?html`<div class=${`media-dock ${artwork?"has-art":""}`} role="button" tabindex="0" @pointerdown=${this.dragBegin} @pointerup=${(event:PointerEvent)=>this.dragEnd(event,active.length)} @pointercancel=${this.dragCancel} @click=${()=>this.openMedia(item.popup)}>${artwork?html`<img class="backdrop" src=${artwork} alt="" aria-hidden="true">`:nothing}<div class="art">${artwork?html`<img src=${artwork} alt="">`:html`<ha-icon icon="mdi:television-play"></ha-icon>`}</div><div class="title">${title}</div><div class="meta">${item.name} · ${state}</div><div class="controls">${active.length>1?html`<button class="pager" title="Aktív lejátszó váltása" aria-label="Aktív lejátszó váltása, ${selected+1}/${active.length}" @click=${(event:Event)=>this.selectMedia(event,(selected+1)%active.length)}>${active.map((_,index)=>html`<span class=${`dot ${index===selected?"active":""}`}></span>`)}</button>`:nothing}${hasPlayback?html`<button class="control" title="Lejátszás vagy szünet" @click=${(event:Event)=>this.playPause(event,item.entity)}><ha-icon icon=${entity?.state==="playing"?"mdi:pause":"mdi:play"}></ha-icon></button>`:nothing}</div></div>`:nothing}<div class="host"></div>`
  }
}
