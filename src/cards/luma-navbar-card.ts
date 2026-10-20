import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { mediaAppName } from "../helpers";
import { localized, localize } from "../localize";
import { navigateRoute, routeIsActive, type NavigationRoute } from "../navigation";
import { lumaTokens } from "../styles";
import "../components/luma-bottom-sheet";
import type { HomeAssistant, LovelaceCard } from "../types";

interface MediaItem{entity:string;activity_entity?:string;name:string;popup:string;artwork_entity?:string}
interface MenuGroup { name:string; icon?:string; items:NavigationRoute[] }
interface Menu { name?:string; hash?:string; groups:MenuGroup[] }
interface Config{type:string;routes:Record<string,unknown>[];menu?:Menu;media_players?:MediaItem[];app_names?:Record<string,string>}

@customElement("luma-navbar-card")
export class LumaNavbarCard extends LitElement implements LovelaceCard{
  @property({attribute:false})hass?:HomeAssistant;
  @state()private config?:Config;
  @state()private selectedMedia=0;
  @state()private path=window.location.pathname;
  @state()private menuOpen=false;
  private ownsMenuEntry=false;
  private locationChanged=()=>{
    this.path=window.location.pathname;
    this.menuOpen=Boolean(this.config?.menu&&window.location.hash===this.menuHash);
    if(!this.menuOpen)this.ownsMenuEntry=false;
  };
  private child?:HTMLElement&LovelaceCard;
  private dragStart?:{x:number;y:number};
  private suppressOpen=false;
  static styles=[lumaTokens,css`
    :host{display:block}.host{min-height:96px}
    .primary-space{min-height:96px}
    .primary{position:fixed;z-index:100;left:16px;top:50%;transform:translateY(-50%);display:grid;gap:5px;width:88px;padding:9px 5px;border:1px solid var(--luma-border);border-radius:var(--luma-radius-card);color:var(--primary-text-color);background:color-mix(in srgb,var(--luma-surface) 94%,transparent);box-shadow:var(--luma-shadow);backdrop-filter:blur(24px)}
    .primary a,.primary button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-width:0;min-height:64px;padding:4px 2px;border:0;border-radius:var(--luma-radius-control);color:var(--luma-muted);background:transparent;font:inherit;font-size:11px;font-weight:var(--luma-weight-strong);text-decoration:none;cursor:pointer}
    .primary .nav-icon{display:grid;place-items:center;width:58px;height:31px;border-radius:99px}
    .primary ha-icon{--mdc-icon-size:23px}
    .primary .active{color:var(--primary-color)}
    .primary .active .nav-icon{background:color-mix(in srgb,var(--primary-color) 18%,transparent)}
    .primary a:hover,.primary button:hover{background:color-mix(in srgb,var(--primary-color) 6%,transparent)}
    a:focus-visible,button:focus-visible{outline:2px solid var(--primary-color);outline-offset:-2px}
    .menu-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px 20px;padding:2px 0 6px}
    .menu-group{min-width:0}.menu-group h3{display:flex;align-items:center;gap:8px;margin:0 0 10px;color:var(--luma-muted);font-size:12px;font-weight:var(--luma-weight-strong)}
    .menu-group h3 ha-icon{--mdc-icon-size:18px}
    .menu-items{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .menu-link{display:flex;align-items:center;gap:10px;min-height:64px;padding:10px;border:1px solid var(--luma-border);border-radius:var(--luma-radius-control);color:var(--primary-text-color);background:color-mix(in srgb,var(--primary-color) 3%,var(--luma-surface));text-decoration:none}
    .menu-link:hover,.menu-link[aria-current=page]{border-color:color-mix(in srgb,var(--primary-color) 30%,transparent);background:color-mix(in srgb,var(--primary-color) 10%,var(--luma-surface))}
    .menu-link .item-icon{display:grid;flex:0 0 34px;place-items:center;height:34px;border-radius:11px;color:var(--primary-color);background:color-mix(in srgb,var(--primary-color) 10%,transparent)}
    .menu-link ha-icon{--mdc-icon-size:20px}.menu-link .item-label{min-width:0;font-size:12px;font-weight:var(--luma-weight-strong);line-height:1.35;overflow-wrap:anywhere}
    @media(max-width:767px){.primary-space{min-height:110px}.primary-space.with-media{min-height:190px}.primary{left:12px;right:12px;top:auto;bottom:calc(16px + env(safe-area-inset-bottom));transform:none;grid-template-columns:repeat(5,minmax(0,1fr));width:auto;padding:6px 3px;gap:0}.primary a,.primary button{min-height:62px;font-size:10px}.primary .nav-icon{width:52px;height:30px}}
    @media(max-width:599px){.menu-groups{grid-template-columns:minmax(0,1fr);gap:20px}.menu-link{min-height:58px}}
    .media-dock{position:fixed;z-index:101;left:100px;bottom:18px;box-sizing:border-box;display:grid;grid-template-columns:48px minmax(0,1fr) auto;grid-template-areas:"art title controls" "art meta controls";align-items:center;gap:2px 11px;width:min(360px,calc(100vw - 118px));min-height:66px;padding:9px 11px;overflow:hidden;border:1px solid color-mix(in srgb,#7c78d8 18%,transparent);border-radius:20px;color:var(--primary-text-color);background:linear-gradient(125deg,color-mix(in srgb,#7c78d8 11%,var(--card-background-color)),color-mix(in srgb,var(--card-background-color) 91%,transparent));box-shadow:0 16px 42px rgba(0,0,0,.16);backdrop-filter:blur(24px) saturate(145%);cursor:pointer;touch-action:pan-y;user-select:none;-webkit-tap-highlight-color:transparent}
    .media-dock.has-art{background:color-mix(in srgb,var(--card-background-color) 72%,transparent);border-color:color-mix(in srgb,#7c78d8 24%,transparent)}.backdrop{position:absolute;z-index:-2;inset:-24px;width:calc(100% + 48px);height:calc(100% + 48px);object-fit:cover;filter:blur(22px) saturate(1.45);opacity:.48;transform:scale(1.12)}.media-dock.has-art::after{content:"";position:absolute;z-index:-1;inset:0;background:linear-gradient(100deg,color-mix(in srgb,var(--card-background-color) 78%,transparent) 2%,color-mix(in srgb,var(--card-background-color) 46%,transparent) 58%,color-mix(in srgb,var(--card-background-color) 62%,transparent));box-shadow:inset 0 1px 0 color-mix(in srgb,#fff 12%,transparent)}
    .art{grid-area:art;display:grid;place-items:center;width:48px;height:48px;overflow:hidden;border-radius:14px;color:#7c78d8;background:color-mix(in srgb,#7c78d8 15%,transparent)}.art img{width:100%;height:100%;object-fit:cover}.art ha-icon{--mdc-icon-size:24px}.title{grid-area:title;align-self:end;min-width:0;overflow:hidden;font-size:13px;font-weight:720;text-overflow:ellipsis;white-space:nowrap}.meta{grid-area:meta;align-self:start;min-width:0;overflow:hidden;color:var(--secondary-text-color);font-size:10px;font-weight:560;text-overflow:ellipsis;white-space:nowrap}.controls{grid-area:controls;display:flex;align-items:center;gap:6px}.control{display:grid;place-items:center;width:34px;height:34px;padding:0;border:0;border-radius:50%;color:#7c78d8;background:color-mix(in srgb,#7c78d8 13%,transparent);cursor:pointer}.control ha-icon{--mdc-icon-size:18px}.pager{display:flex;align-items:center;gap:4px;height:24px;padding:0 6px;border:0;border-radius:999px;background:transparent;cursor:pointer}.dot{width:5px;height:5px;border-radius:999px;background:color-mix(in srgb,var(--secondary-text-color) 32%,transparent);transition:width .18s ease,background .18s ease}.dot.active{width:13px;background:#7c78d8}
    @media(max-width:767px){.host{min-height:190px}.media-dock{left:12px;right:12px;bottom:calc(108px + env(safe-area-inset-bottom));width:auto;min-height:62px;border-radius:18px}.art{width:44px;height:44px;border-radius:13px}.title{font-size:12px}}
  `];
  setConfig(c:Config){
    if(!Array.isArray(c.routes)||!c.routes.length)throw new Error("Luma Navbar requires a non-empty routes list");
    if(c.menu){
      if(c.routes.length!==4||c.routes.some(route=>!route.url||!route.label))throw new Error("Grouped navigation requires four labelled primary routes.");
      if(!Array.isArray(c.menu.groups)||c.menu.groups.some(group=>!group.name||!Array.isArray(group.items)||group.items.some(item=>!item.url||!item.label)))throw new Error("Navigation menu groups require names and labelled item URLs.");
    }
    this.config=c;this.locationChanged();void this.mount();
  }
  connectedCallback(){super.connectedCallback();for(const name of ["hashchange","location-changed","popstate"])window.addEventListener(name,this.locationChanged);this.locationChanged()}
  disconnectedCallback(){for(const name of ["hashchange","location-changed","popstate"])window.removeEventListener(name,this.locationChanged);super.disconnectedCallback()}
  private get menuHash(){return "#"+(this.config?.menu?.hash||"navigation").replace(/^#/,"")}
  private openMenu(event:MouseEvent){navigateRoute(event,this.menuHash);this.ownsMenuEntry=true}
  private closeMenu(){
    if(this.ownsMenuEntry){this.ownsMenuEntry=false;history.back();return}
    history.replaceState(null,"",window.location.pathname+window.location.search);window.dispatchEvent(new Event("location-changed"));
  }
  private renderNavigation(hasMedia:boolean){
    if(!this.config?.menu)return html`<div class="host"></div>`;
    const menu=this.config.menu,routes=this.config.routes as unknown as NavigationRoute[];
    const menuActive=this.menuOpen||!routes.some(route=>routeIsActive(route,this.path));
    return html`<div class=${`primary-space ${hasMedia?"with-media":""}`}>
      <nav class="primary" aria-label=${localized(this.hass,"Main navigation","Fő navigáció")}>
        ${routes.map(route=>{const active=routeIsActive(route,this.path);return html`<a href=${route.url} class=${active?"active":""} aria-current=${active?"page":nothing} @click=${(event:MouseEvent)=>navigateRoute(event,route.url)}><span class="nav-icon"><ha-icon icon=${active?(route.icon_selected||route.icon||"mdi:circle-outline"):(route.icon||"mdi:circle-outline")}></ha-icon></span><span>${route.label}</span></a>`})}
        <button class=${menuActive?"active":""} aria-haspopup="dialog" aria-expanded=${this.menuOpen} @click=${this.openMenu}><span class="nav-icon"><ha-icon icon="mdi:view-grid-outline"></ha-icon></span><span>${menu.name||localized(this.hass,"Menu","Menü")}</span></button>
      </nav>
    </div>
    <luma-bottom-sheet .open=${this.menuOpen} .heading=${menu.name||localized(this.hass,"Menu","Menü")}
      .icon=${"mdi:view-grid-outline"} .maxWidth=${800} .closeLabel=${localize(this.hass,"dismiss")} @sheet-dismiss=${this.closeMenu}>
      <div class="menu-groups">${menu.groups.map(group=>html`<section class="menu-group"><h3>${group.icon?html`<ha-icon icon=${group.icon}></ha-icon>`:nothing}${group.name}</h3><div class="menu-items">
        ${group.items.map(route=>html`<a class="menu-link" href=${route.url} aria-current=${routeIsActive(route,this.path)?"page":nothing} @click=${(event:MouseEvent)=>navigateRoute(event,route.url,this.ownsMenuEntry)}><span class="item-icon"><ha-icon icon=${route.icon||"mdi:arrow-right"}></ha-icon></span><span class="item-label">${route.label}</span></a>`)}
      </div></section>`)}</div>
    </luma-bottom-sheet>`;
  }
  getCardSize(){return 1}
  protected updated(changed:Map<PropertyKey,unknown>){if(changed.has("config")&&!this.config?.menu)void this.mount();if(this.child&&this.hass)this.child.hass=this.hass}
  private async mount(){if(!this.config||this.config.menu||!this.renderRoot.querySelector(".host"))return;const helpers=await window.loadCardHelpers?.();if(!helpers)return;const cfg={type:"custom:navbar-card",mobile:{show_labels:true},desktop:{show_labels:true,position:"left",min_width:768},routes:this.config.routes,styles:".navbar-card{z-index:100!important;background:color-mix(in srgb,var(--card-background-color) 88%,transparent)!important;backdrop-filter:blur(24px) saturate(150%);border:1px solid color-mix(in srgb,var(--primary-text-color) 9%,transparent);border-radius:20px;box-shadow:0 16px 45px rgba(0,0,0,.10);margin:12px 0 16px;overflow:hidden}"};this.child=helpers.createCardElement(cfg) as HTMLElement&LovelaceCard;if(this.hass)this.child.hass=this.hass;const host=this.renderRoot.querySelector(".host")!;host.replaceChildren(this.child)}
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
    return html`${item?html`<div class=${`media-dock ${artwork?"has-art":""}`} role="button" tabindex="0" @pointerdown=${this.dragBegin} @pointerup=${(event:PointerEvent)=>this.dragEnd(event,active.length)} @pointercancel=${this.dragCancel} @click=${()=>this.openMedia(item.popup)}>${artwork?html`<img class="backdrop" src=${artwork} alt="" aria-hidden="true">`:nothing}<div class="art">${artwork?html`<img src=${artwork} alt="">`:html`<ha-icon icon="mdi:television-play"></ha-icon>`}</div><div class="title">${title}</div><div class="meta">${item.name} · ${state}</div><div class="controls">${active.length>1?html`<button class="pager" title="Aktív lejátszó váltása" aria-label="Aktív lejátszó váltása, ${selected+1}/${active.length}" @click=${(event:Event)=>this.selectMedia(event,(selected+1)%active.length)}>${active.map((_,index)=>html`<span class=${`dot ${index===selected?"active":""}`}></span>`)}</button>`:nothing}${hasPlayback?html`<button class="control" title="Lejátszás vagy szünet" @click=${(event:Event)=>this.playPause(event,item.entity)}><ha-icon icon=${entity?.state==="playing"?"mdi:pause":"mdi:play"}></ha-icon></button>`:nothing}</div></div>`:nothing}${this.renderNavigation(Boolean(item))}`
  }
}
