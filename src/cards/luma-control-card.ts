import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { entityAreaName, entityIcon, entityName, entityState, mediaAppName, runAction } from "../helpers";
import { localize, localized } from "../localize";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LumaAction, LovelaceCard } from "../types";

interface Config { type:string; entity:string; name?:string; subtitle?:string; icon?:string; color?:string; active_color?:string; active_states?:string[]; state_map?:Record<string,string>; action_label?:string; display_as?:"light"|"media_player"|"switch"; artwork?:boolean; artwork_entity?:string; embedded_details?:boolean; compact?:boolean; tap_action?:LumaAction; hold_action?:LumaAction }

@customElement("luma-control-card")
export class LumaControlCard extends LitElement implements LovelaceCard {
  @property({attribute:false}) hass?:HomeAssistant;
  @state() private config?:Config;
  @state() private pending=false;
  private holdTimer?:number;
  private confirmTimer?:number;
  private held=false;
  static styles=[lumaTokens,css`
    :host{display:block}
    .card{position:relative;isolation:isolate;display:grid;grid-template-columns:46px minmax(0,1fr) auto;grid-template-areas:"icon name value" "icon subtitle action";align-items:center;gap:3px 12px;padding:16px;overflow:hidden;border:1px solid color-mix(in srgb,var(--tone) var(--border-mix),transparent);border-radius:var(--luma-radius-card);background:linear-gradient(145deg,color-mix(in srgb,var(--tone) var(--mix),var(--luma-surface)),color-mix(in srgb,var(--tone) 2%,var(--luma-surface)) 72%);box-shadow:0 13px 34px color-mix(in srgb,var(--tone) var(--shadow-mix),transparent);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
    .art-backdrop{position:absolute;z-index:-2;inset:-24px;width:calc(100% + 48px);height:calc(100% + 48px);object-fit:cover;filter:blur(22px) saturate(1.12);opacity:.16;transform:scale(1.06);pointer-events:none}.card.has-art::after{content:"";position:absolute;z-index:-1;inset:0;background:linear-gradient(90deg,color-mix(in srgb,var(--luma-surface) 90%,transparent),color-mix(in srgb,var(--luma-surface) 70%,transparent));pointer-events:none}
    .card.interactive:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--tone) 28%,transparent);box-shadow:0 17px 40px color-mix(in srgb,var(--tone) 14%,transparent)}
    .icon{grid-area:icon;display:grid;place-items:center;width:46px;height:46px;border-radius:15px;color:var(--tone);background:color-mix(in srgb,var(--tone) var(--icon-mix),transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--tone) 8%,transparent)}
    .icon ha-icon{--mdc-icon-size:23px}.icon.artwork{overflow:hidden;background:transparent}.icon.artwork img{width:100%;height:100%;object-fit:cover}.name{grid-area:name;align-self:end;min-width:0;font-size:var(--luma-text-md);font-weight:var(--luma-weight-strong);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.subtitle{grid-area:subtitle;align-self:start;min-width:0;color:var(--luma-muted);font-size:var(--luma-text-xs);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .value{grid-area:value;display:inline-flex;align-items:center;justify-content:center;justify-self:end;min-width:38px;padding:5px 9px;border-radius:999px;color:var(--value-color);background:color-mix(in srgb,var(--tone) var(--pill-mix),transparent);font-size:11px;font-weight:680;line-height:1;white-space:nowrap}.action{grid-area:action;justify-self:end;color:var(--tone);font-size:10px;font-weight:650;white-space:nowrap}
    .card.light,.card.compact{grid-template-columns:40px minmax(0,1fr);grid-template-areas:"icon name" "icon subtitle";gap:2px 10px;padding:13px}.card.light.with-details,.card.compact.with-details{grid-template-columns:40px minmax(0,1fr) 34px;grid-template-areas:"icon name details" "icon subtitle details"}.card.light .icon,.card.compact .icon{width:40px;height:40px;border-radius:13px}.card.light .icon ha-icon,.card.compact .icon ha-icon{--mdc-icon-size:20px}.card.light .name,.card.compact .name{white-space:normal;line-height:1.15}.card.light .value,.card.light .action,.card.compact .value,.card.compact .action{display:none}.details{display:none;grid-area:details;place-items:center;width:34px;height:34px;padding:0;border:0;border-radius:50%;color:var(--luma-muted);background:color-mix(in srgb,var(--primary-text-color) 6%,transparent);cursor:pointer;transition:color .16s ease,background .16s ease,transform .16s ease}.card.light.with-details .details,.card.compact.with-details .details{display:grid}.details:hover{color:var(--tone);background:color-mix(in srgb,var(--tone) 12%,transparent);transform:translateY(-1px)}.details ha-icon{--mdc-icon-size:17px}
    .card.media_player{min-height:66px;grid-template-columns:58px minmax(0,1fr) auto;padding:13px 15px}.card.media_player .icon{width:58px;height:58px;border-radius:16px}.card.media_player .icon ha-icon{--mdc-icon-size:27px}.card.media_player .name{font-size:var(--luma-text-lg)}
    @media(max-width:599px){.card{grid-template-columns:42px minmax(0,1fr) auto;grid-template-areas:"icon name value" "icon subtitle value";padding:13px}.icon{width:42px;height:42px;border-radius:14px}.action{display:none}}
  `];
  setConfig(config:Config){if(!config?.entity)throw Error("Luma control requires entity.");this.config={active_states:[],...config}}
  getCardSize(){return 2}
  protected shouldUpdate(changed:PropertyValues<this>){if(!changed.has("hass"))return true;const old=changed.get("hass") as HomeAssistant|undefined;const entity=this.config?.entity||"",artwork=this.config?.artwork_entity||"";return !old||old.states[entity]!==this.hass?.states[entity]||(artwork!==""&&old.states[artwork]!==this.hass?.states[artwork])}
  private startHold(){
    this.held=false;
    const domain=this.config?.display_as||this.config?.entity.split(".")[0];
    const action=this.config?.hold_action||(domain==="light"?{action:"more-info"} as const:undefined);
    this.holdTimer=window.setTimeout(()=>{this.held=true;void runAction(this,this.hass!,action,this.config?.entity)},500);
  }
  private cancelHold(){if(this.holdTimer)clearTimeout(this.holdTimer)}
  private moreInfo(event:Event){event.stopPropagation();this.cancelHold();void runAction(this,this.hass!,{action:"more-info"},this.config?.entity)}
  private activate(){const action=this.config?.tap_action;if(action&&"confirmation" in action&&action.confirmation){if(!this.pending){this.pending=true;clearTimeout(this.confirmTimer);this.confirmTimer=window.setTimeout(()=>this.pending=false,3500);return}this.pending=false}void runAction(this,this.hass!,action,this.config?.entity)}
  render(){
    if(!this.hass||!this.config)return nothing;
    const e=this.hass.states[this.config.entity],domain=this.config.display_as||this.config.entity.split(".")[0];
    const defaults=["light","fan","switch"].includes(domain)?["on"]:domain==="media_player"?["on","playing","paused","buffering"]:[];
    const states=this.config.active_states?.length?this.config.active_states:defaults,active=states.includes(e?.state);
    const activeTone=domain==="light"?"var(--warning-color)":domain==="media_player"?"#7c78d8":"var(--primary-color)";
    const tone=active?(this.config.active_color||activeTone):(this.config.color||"var(--secondary-text-color)");
    const media=String(e?.attributes?.media_title||mediaAppName(e)||"");
    const fallbackArtwork=this.config.artwork_entity?this.hass.states[this.config.artwork_entity]?.attributes:{};
    const artwork=domain==="media_player"&&active&&this.config.artwork!==false?String(e?.attributes?.entity_picture_local||e?.attributes?.entity_picture||fallbackArtwork?.entity_picture_local||fallbackArtwork?.entity_picture||""):"";
    const area=domain==="light"?entityAreaName(this.hass,this.config.entity):undefined;
    const subtitle=this.config.subtitle||(domain==="light"?(area||localized(this.hass,"Not assigned to an area","Nincs helyiséghez rendelve")):domain==="media_player"&&active&&media?media:entityName(e,localized(this.hass,"State","Állapot")));
    const vars=`--tone:${tone};--mix:${active?"13%":"1.5%"};--border-mix:${active?"22%":"7%"};--icon-mix:${active?"21%":"6%"};--pill-mix:${active?"16%":"5%"};--shadow-mix:${active?"12%":"2%"};--value-color:${active?tone:"var(--luma-muted)"}`;
    const actionLabel=this.config.action_label??(this.config.tap_action?.action==="toggle"?"":localized(this.hass,"Details →","Részletek →"));
    return html`<ha-card class=${`card ${domain} ${this.config.compact?"compact":""} ${this.config.embedded_details?"with-details":""} ${artwork?"has-art":""} ${this.config.tap_action?"interactive":""}`} style=${vars} role=${this.config.tap_action?"button":"presentation"} tabindex=${this.config.tap_action?"0":"-1"} @pointerdown=${()=>this.startHold()} @pointerup=${()=>this.cancelHold()} @pointerleave=${()=>this.cancelHold()} @click=${()=>{if(!this.held)this.activate()}}>${artwork?html`<img class="art-backdrop" src=${artwork} alt="" aria-hidden="true">`:nothing}<div class=${`icon ${artwork?"artwork":""}`}>${artwork?html`<img src=${artwork} alt="">`:html`<ha-icon icon=${this.pending?"mdi:check":this.config.icon||entityIcon(e)}></ha-icon>`}</div><div class="name">${this.pending?localize(this.hass,"confirm"):this.config.name||entityName(e,this.config.entity)}</div><div class="subtitle">${this.pending?(this.config.tap_action&&"confirmation" in this.config.tap_action?this.config.tap_action.confirmation?.text||localize(this.hass,"tap_to_execute"):localize(this.hass,"tap_to_execute")):subtitle}</div><div class="value">${entityState(this.hass,e,this.config.state_map)}</div>${actionLabel?html`<div class="action">${this.pending?`${localize(this.hass,"confirm")} →`:actionLabel}</div>`:nothing}${this.config.embedded_details?html`<button class="details" title=${localize(this.hass,"details")} @pointerdown=${(event:Event)=>event.stopPropagation()} @click=${(event:Event)=>this.moreInfo(event)}><ha-icon icon="mdi:tune-variant"></ha-icon></button>`:nothing}</ha-card>`;
  }
}
