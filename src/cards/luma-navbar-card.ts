import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { mediaAppName } from "../helpers";
import type { HomeAssistant, LovelaceCard } from "../types";

type Preset="auto"|"global"|"energy"|"lawn"|"irrigation"|"homelab"|"security";
interface MediaItem{entity:string;activity_entity?:string;name:string;popup:string;artwork_entity?:string}
interface Config{type:string;preset?:Preset;routes?:Record<string,unknown>[];media_players?:MediaItem[];app_names?:Record<string,string>}
type Route=Record<string,unknown>;

const route=(url:string,label:string,icon:string,icon_selected?:string):Route=>({url,label,icon,...(icon_selected?{icon_selected}:{})});
const home=route("/lovelace/overview","Főoldal","mdi:home-outline","mdi:home");
const more:Route={icon:"mdi:dots-horizontal",label:"Továbbiak",tap_action:{action:"open-popup"},popup:[
  route("/dashboard-homelab/overview","Szerver","mdi:server"),route("/lovelace/energy","Energia","mdi:lightning-bolt"),route("/lovelace/lawn","Gyep","mdi:mower"),route("/dashboard-irrigation/irrigation","Öntözés","mdi:sprinkler"),route("/dashboard-camera/camera-timeline","Kamera idővonal","mdi:camera-burst"),route("/lovelace/battery","Akkumulátor","mdi:battery"),route("/lovelace/waste","Hulladék","mdi:trash-can-outline"),route("/lovelace/weather","Időjárás","mdi:weather-cloudy"),route("/lovelace/maintenance","Karbantartás","mdi:tools"),route("/config?disable_km","Beállítások","mdi:cog-outline")
]};
const presets:Record<Exclude<Preset,"auto">,Route[]>={
  global:[home,route("/dashboard-rooms/rooms","Szobák","mdi:sofa-outline","mdi:sofa"),route("/dashboard-camera/camera","Kamera","mdi:camera-outline","mdi:camera"),route("/lovelace/covers","Redőnyök","mdi:window-shutter","mdi:window-shutter-open"),more],
  energy:[home,route("/lovelace/energy","Energia","mdi:lightning-bolt-outline","mdi:lightning-bolt"),route("/lovelace/energy-solar","Napenergia","mdi:solar-power"),route("/lovelace/energy-grid","Hálózat","mdi:transmission-tower"),route("/lovelace/energy-details","Részletek","mdi:tune-variant")],
  lawn:[home,route("/lovelace/lawn","Áttekintés","mdi:mower"),route("/lovelace/lawn-camera","Kamera","mdi:camera-outline"),route("/lovelace/lawn-maintenance","Karbantartás","mdi:tools"),route("/lovelace/lawn-map","Térkép","mdi:map-outline")],
  irrigation:[home,route("/dashboard-irrigation/irrigation","Áttekintés","mdi:sprinkler-variant"),route("/dashboard-irrigation/schedules","Ütemezés","mdi:calendar-clock"),route("/dashboard-irrigation/zones","Zónák","mdi:pipe-valve"),route("/dashboard-irrigation/settings","Beállítások","mdi:tune-variant")],
  homelab:[home,route("/dashboard-homelab/overview","Áttekintés","mdi:view-dashboard-outline"),route("/dashboard-homelab/services","Services","mdi:heart-pulse"),route("/dashboard-homelab/compute","Compute","mdi:server"),route("/dashboard-homelab/storage-power","Storage","mdi:database"),route("/dashboard-homelab/operations","Ops","mdi:tools")],
  security:[home,route("/dashboard-camera/camera","Áttekintés","mdi:shield-home-outline"),route("/dashboard-camera/camera-timeline","Bejárat","mdi:doorbell-video"),route("/dashboard-camera/camera-timeline-garage","Garázs","mdi:garage-variant"),route("/dashboard-camera/camera-timeline-back-yard","Hátsó kert","mdi:tree-outline")],
};

const defaultMedia:MediaItem[]=[
  {entity:"media_player.tcl_tv",activity_entity:"media_player.tcl_tv_remote",name:"Nappali",popup:"#tv-remote",artwork_entity:"media_player.android_tv_10_0_79_197"},
  {entity:"media_player.telekom_tv_2",name:"Hálószoba",popup:"#bedroom-tv-remote"},
];

@customElement("luma-navbar-card")
export class LumaNavbarCard extends LitElement implements LovelaceCard{
  @property({attribute:false})hass?:HomeAssistant;
  @state()private config?:Config;
  private child?:HTMLElement&LovelaceCard;
  static styles=css`
    :host{display:block;min-height:74px}.host{min-height:74px}
    .media-dock{position:fixed;z-index:101;left:100px;bottom:18px;box-sizing:border-box;display:grid;grid-template-columns:48px minmax(0,1fr) auto;grid-template-areas:"art title controls" "art meta controls";align-items:center;gap:2px 11px;width:min(360px,calc(100vw - 118px));min-height:66px;padding:9px 11px;overflow:hidden;border:1px solid color-mix(in srgb,#7c78d8 18%,transparent);border-radius:20px;color:var(--primary-text-color);background:linear-gradient(125deg,color-mix(in srgb,#7c78d8 11%,var(--card-background-color)),color-mix(in srgb,var(--card-background-color) 91%,transparent));box-shadow:0 16px 42px rgba(0,0,0,.16);backdrop-filter:blur(24px) saturate(145%);cursor:pointer;-webkit-tap-highlight-color:transparent}
    .backdrop{position:absolute;z-index:-2;inset:-20px;width:calc(100% + 40px);height:calc(100% + 40px);object-fit:cover;filter:blur(22px) saturate(1.16);opacity:.18;transform:scale(1.06)}.media-dock.has-art::after{content:"";position:absolute;z-index:-1;inset:0;background:linear-gradient(90deg,color-mix(in srgb,var(--card-background-color) 88%,transparent),color-mix(in srgb,var(--card-background-color) 68%,transparent))}
    .art{grid-area:art;display:grid;place-items:center;width:48px;height:48px;overflow:hidden;border-radius:14px;color:#7c78d8;background:color-mix(in srgb,#7c78d8 15%,transparent)}.art img{width:100%;height:100%;object-fit:cover}.art ha-icon{--mdc-icon-size:24px}.title{grid-area:title;align-self:end;min-width:0;overflow:hidden;font-size:13px;font-weight:720;text-overflow:ellipsis;white-space:nowrap}.meta{grid-area:meta;align-self:start;min-width:0;overflow:hidden;color:var(--secondary-text-color);font-size:10px;font-weight:560;text-overflow:ellipsis;white-space:nowrap}.controls{grid-area:controls;display:flex;align-items:center;gap:5px}.control{display:grid;place-items:center;width:34px;height:34px;padding:0;border:0;border-radius:50%;color:#7c78d8;background:color-mix(in srgb,#7c78d8 13%,transparent);cursor:pointer}.control ha-icon{--mdc-icon-size:18px}.count{display:grid;place-items:center;min-width:20px;height:20px;padding:0 5px;border-radius:999px;color:#7c78d8;background:color-mix(in srgb,#7c78d8 12%,transparent);font-size:9px;font-weight:750}
    @media(max-width:767px){.media-dock{left:12px;right:12px;bottom:108px;width:auto;min-height:62px;border-radius:18px}.art{width:44px;height:44px;border-radius:13px}.title{font-size:12px}}
  `;
  setConfig(c:Config){this.config={preset:"auto",...c};void this.mount()}
  getCardSize(){return 1}
  protected updated(){if(this.child&&this.hass)this.child.hass=this.hass}
  private inferred():Exclude<Preset,"auto">{const p=window.location.pathname;if(p.startsWith("/dashboard-homelab"))return"homelab";if(p.startsWith("/dashboard-irrigation"))return"irrigation";if(p.startsWith("/dashboard-camera")&&!p.endsWith("/camera"))return"security";if(p.startsWith("/lovelace/energy"))return"energy";if(p==="/lovelace/lawn"||p.includes("/lovelace/lawn-"))return"lawn";return"global"}
  private async mount(){if(!this.config||!this.renderRoot.querySelector(".host"))return;const helpers=await window.loadCardHelpers?.();if(!helpers)return;const preset=this.config.preset==="auto"||!this.config.preset?this.inferred():this.config.preset;const cfg={type:"custom:navbar-card",mobile:{show_labels:true},desktop:{show_labels:true,position:"left",min_width:768},routes:this.config.routes||presets[preset],styles:".navbar-card{z-index:100!important;background:color-mix(in srgb,var(--card-background-color) 88%,transparent)!important;backdrop-filter:blur(24px) saturate(150%);border:1px solid color-mix(in srgb,var(--primary-text-color) 9%,transparent);border-radius:20px;box-shadow:0 16px 45px rgba(0,0,0,.10);margin:12px 0 16px;overflow:hidden}"};this.child=helpers.createCardElement(cfg) as HTMLElement&LovelaceCard;if(this.hass)this.child.hass=this.hass;const host=this.renderRoot.querySelector(".host")!;host.replaceChildren(this.child)}
  private activeMedia(){if(!this.hass)return[];const active=["on","playing","paused","buffering"];return(this.config?.media_players||defaultMedia).filter(item=>active.includes(this.hass!.states[item.activity_entity||item.entity]?.state))}
  private open(hash:string){if(window.location.hash===hash)window.dispatchEvent(new HashChangeEvent("hashchange"));else window.location.hash=hash}
  private playPause(event:Event,entity:string){event.stopPropagation();void this.hass?.callService("media_player","media_play_pause",undefined,{entity_id:entity})}
  private hasPlayback(entity:HomeAssistant["states"][string]|undefined){
    if(!entity||!["playing","paused","buffering"].includes(entity.state))return false;
    const attrs=entity.attributes;
    return Boolean(attrs.media_title||attrs.media_series_title||Number(attrs.media_duration)>0||Number(attrs.media_position)>0);
  }
  protected firstUpdated(){void this.mount()}
  render(){
    if(!this.config||!this.hass)return nothing;
    const active=this.activeMedia(),item=active[0],entity=item?this.hass.states[item.entity]:undefined,attrs=entity?.attributes||{};
    const fallback=item?.artwork_entity?this.hass.states[item.artwork_entity]?.attributes||{}:{};
    const artwork=String(attrs.entity_picture_local||attrs.entity_picture||fallback.entity_picture_local||fallback.entity_picture||"");
    const title=String(attrs.media_title||mediaAppName(entity,this.config.app_names)||entity?.attributes.friendly_name||"Média");
    const hasPlayback=this.hasPlayback(entity);
    const state=hasPlayback?(entity?.state==="paused"?"Szüneteltetve":"Lejátszás"):"Aktív";
    return html`${item?html`<div class=${`media-dock ${artwork?"has-art":""}`} role="button" tabindex="0" @click=${()=>this.open(item.popup)}>${artwork?html`<img class="backdrop" src=${artwork} alt="" aria-hidden="true">`:nothing}<div class="art">${artwork?html`<img src=${artwork} alt="">`:html`<ha-icon icon="mdi:television-play"></ha-icon>`}</div><div class="title">${title}</div><div class="meta">${item.name} · ${state}</div><div class="controls">${active.length>1?html`<span class="count">+${active.length-1}</span>`:nothing}${hasPlayback?html`<button class="control" title="Lejátszás vagy szünet" @click=${(event:Event)=>this.playPause(event,item.entity)}><ha-icon icon=${entity?.state==="playing"?"mdi:pause":"mdi:play"}></ha-icon></button>`:nothing}</div></div>`:nothing}<div class="host"></div>`
  }
}
