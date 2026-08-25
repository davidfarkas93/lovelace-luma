import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, LovelaceCard } from "../types";

type Preset="auto"|"global"|"energy"|"lawn"|"irrigation"|"homelab"|"security";
interface Config{type:string;preset?:Preset;routes?:Record<string,unknown>[]}
type Route=Record<string,unknown>;

const route=(url:string,label:string,icon:string,icon_selected?:string):Route=>({url,label,icon,...(icon_selected?{icon_selected}:{})});
const home=route("/lovelace/overview","Főoldal","mdi:home-outline","mdi:home");
const more:Route={icon:"mdi:dots-horizontal",label:"Továbbiak",tap_action:{action:"open-popup"},popup:[
  route("/dashboard-homelab/overview","Szerver","mdi:server"),route("/lovelace/energy","Energia","mdi:lightning-bolt"),route("/lovelace/lawn","Gyep","mdi:mower"),route("/dashboard-irrigation/irrigation","Öntözés","mdi:sprinkler"),route("/dashboard-camera/camera-timeline","Kamera idővonal","mdi:camera-burst"),route("/lovelace/battery","Akkumulátor","mdi:battery"),route("/lovelace/waste","Hulladék","mdi:trash-can-outline"),route("/lovelace/weather","Időjárás","mdi:weather-cloudy"),route("/lovelace/maintenance","Karbantartás","mdi:tools")
]};
const presets:Record<Exclude<Preset,"auto">,Route[]>={
  global:[home,route("/dashboard-rooms/rooms","Szobák","mdi:sofa-outline","mdi:sofa"),route("/dashboard-camera/camera","Kamera","mdi:camera-outline","mdi:camera"),route("/lovelace/covers","Redőnyök","mdi:window-shutter","mdi:window-shutter-open"),more],
  energy:[home,route("/lovelace/energy","Energia","mdi:lightning-bolt-outline","mdi:lightning-bolt"),route("/lovelace/energy-solar","Napenergia","mdi:solar-power"),route("/lovelace/energy-grid","Hálózat","mdi:transmission-tower"),route("/lovelace/energy-details","Részletek","mdi:tune-variant")],
  lawn:[home,route("/lovelace/lawn","Áttekintés","mdi:mower"),route("/lovelace/lawn-camera","Kamera","mdi:camera-outline"),route("/lovelace/lawn-maintenance","Karbantartás","mdi:tools"),route("/lovelace/lawn-map","Térkép","mdi:map-outline")],
  irrigation:[home,route("/dashboard-irrigation/irrigation","Áttekintés","mdi:sprinkler-variant"),route("/dashboard-irrigation/schedules","Ütemezés","mdi:calendar-clock"),route("/dashboard-irrigation/zones","Zónák","mdi:pipe-valve"),route("/dashboard-irrigation/settings","Beállítások","mdi:tune-variant")],
  homelab:[home,route("/dashboard-homelab/overview","Áttekintés","mdi:view-dashboard-outline"),route("/dashboard-homelab/services","Services","mdi:heart-pulse"),route("/dashboard-homelab/compute","Compute","mdi:server"),route("/dashboard-homelab/storage-power","Storage","mdi:database"),route("/dashboard-homelab/operations","Ops","mdi:tools")],
  security:[home,route("/dashboard-camera/camera","Áttekintés","mdi:shield-home-outline"),route("/dashboard-camera/camera-timeline","Bejárat","mdi:doorbell-video"),route("/dashboard-camera/camera-timeline-garage","Garázs","mdi:garage-variant"),route("/dashboard-camera/camera-timeline-back-yard","Hátsó kert","mdi:tree-outline")],
};

const mediaPlayer={album_cover_background:true,players:[
  {entity:"media_player.tcl_tv",show:"[[[return ['on','playing','paused','buffering'].includes(states['media_player.tcl_tv_remote']?.state)]]]",title:"[[[return states['media_player.tcl_tv']?.attributes?.media_title||states['media_player.tcl_tv']?.attributes?.app_name||'TCL TV']]]",subtitle:"Nappali",tap_action:{action:"navigate",navigation_path:"#tv-remote"},icon:"mdi:remote-tv"},
  {entity:"media_player.telekom_tv_2",show:"[[[return ['on','playing','paused','buffering'].includes(states['media_player.telekom_tv_2']?.state)]]]",title:"[[[return states['media_player.telekom_tv_2']?.attributes?.media_title||states['media_player.telekom_tv_2']?.attributes?.app_id||'Telekom TV']]]",subtitle:"Hálószoba",tap_action:{action:"navigate",navigation_path:"#bedroom-tv-remote"},icon:"mdi:remote-tv"}
],show:"[[[const active=['on','playing','paused','buffering'];return active.includes(states['media_player.tcl_tv_remote']?.state)||active.includes(states['media_player.telekom_tv_2']?.state)]]]"};

@customElement("luma-navbar-card")
export class LumaNavbarCard extends LitElement implements LovelaceCard{
  @property({attribute:false})hass?:HomeAssistant;
  @state()private config?:Config;
  private child?:HTMLElement&LovelaceCard;
  static styles=css`:host{display:block;min-height:74px}.host{min-height:74px}`;
  setConfig(c:Config){this.config={preset:"auto",...c};void this.mount()}
  getCardSize(){return 1}
  protected updated(){if(this.child&&this.hass)this.child.hass=this.hass}
  private inferred():Exclude<Preset,"auto">{const p=window.location.pathname;if(p.startsWith("/dashboard-homelab"))return"homelab";if(p.startsWith("/dashboard-irrigation"))return"irrigation";if(p.startsWith("/dashboard-camera")&&!p.endsWith("/camera"))return"security";if(p.startsWith("/lovelace/energy"))return"energy";if(p==="/lovelace/lawn"||p.includes("/lovelace/lawn-"))return"lawn";return"global"}
  private async mount(){if(!this.config||!this.renderRoot.querySelector(".host"))return;const helpers=await window.loadCardHelpers?.();if(!helpers)return;const preset=this.config.preset==="auto"||!this.config.preset?this.inferred():this.config.preset;const cfg={type:"custom:navbar-card",mobile:{show_labels:true},desktop:{show_labels:true,position:"left",min_width:768},routes:this.config.routes||presets[preset],styles:".navbar-card{z-index:100!important;background:color-mix(in srgb,var(--card-background-color) 88%,transparent)!important;backdrop-filter:blur(24px) saturate(150%);border:1px solid color-mix(in srgb,var(--primary-text-color) 9%,transparent);border-radius:20px;box-shadow:0 16px 45px rgba(0,0,0,.10);margin:12px 0 16px;overflow:hidden}.controls,.media-player-button{display:none!important}",media_player:mediaPlayer};this.child=helpers.createCardElement(cfg) as HTMLElement&LovelaceCard;if(this.hass)this.child.hass=this.hass;const host=this.renderRoot.querySelector(".host")!;host.replaceChildren(this.child)}
  protected firstUpdated(){void this.mount()}
  render(){return this.config?html`<div class="host"></div>`:nothing}
}
