import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { entityIcon, entityName, entityState, runAction } from "../helpers";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LumaAction, LovelaceCard } from "../types";

interface LumaControlConfig {
  type: string;
  entity: string;
  name?: string;
  subtitle?: string;
  icon?: string;
  color?: string;
  active_color?: string;
  active_states?: string[];
  state_map?: Record<string,string>;
  action_label?: string;
  tap_action?: LumaAction;
  hold_action?: LumaAction;
}

@customElement("luma-control-card")
export class LumaControlCard extends LitElement implements LovelaceCard {
  @property({attribute:false}) hass?:HomeAssistant;
  @state() private config?:LumaControlConfig;
  private holdTimer?:number;
  private held=false;

  static styles=[lumaTokens,css`
    .card{display:grid;grid-template-columns:44px minmax(0,1fr) auto;grid-template-areas:"icon name value" "icon subtitle action";align-items:center;gap:3px 12px;padding:17px;border:1px solid var(--luma-border);border-radius:var(--luma-radius-card);background:linear-gradient(145deg,color-mix(in srgb,var(--tone) var(--mix),var(--luma-surface)),var(--luma-surface));box-shadow:0 12px 34px rgba(0,0,0,.055);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
    .card.interactive:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--tone) 22%,transparent);box-shadow:0 17px 40px rgba(0,0,0,.085)}
    .icon{grid-area:icon;display:grid;place-items:center;width:44px;height:44px;border-radius:14px;color:var(--tone);background:color-mix(in srgb,var(--tone) 14%,transparent)}
    .icon ha-icon{--mdc-icon-size:23px}.name{grid-area:name;align-self:end;min-width:0;font-size:14px;font-weight:680;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.subtitle{grid-area:subtitle;align-self:start;min-width:0;color:var(--luma-muted);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .value{grid-area:value;padding:5px 9px;border-radius:999px;background:color-mix(in srgb,var(--primary-text-color) 6%,transparent);font-size:11px;font-weight:650;white-space:nowrap}.action{grid-area:action;justify-self:end;color:var(--luma-accent);font-size:10px;font-weight:650;white-space:nowrap}
    @media(max-width:599px){.card{grid-template-columns:40px minmax(0,1fr) auto;grid-template-areas:"icon name value" "icon subtitle value";padding:14px}.icon{width:40px;height:40px;border-radius:13px}.action{display:none}}
  `];

  setConfig(config:LumaControlConfig):void{if(!config?.entity)throw new Error("Luma control requires entity.");this.config={active_states:[],action_label:"Részletek →",...config}}
  getCardSize():number{return 2}
  protected shouldUpdate(changed:PropertyValues<this>):boolean{if(!changed.has("hass"))return true;const old=changed.get("hass") as HomeAssistant|undefined;return !old||old.states[this.config?.entity||""]!==this.hass?.states[this.config?.entity||""]}
  private startHold(){this.held=false;this.holdTimer=window.setTimeout(()=>{this.held=true;void runAction(this,this.hass!,this.config?.hold_action,this.config?.entity)},500)}
  private cancelHold(){if(this.holdTimer)window.clearTimeout(this.holdTimer)}
  render(){if(!this.hass||!this.config)return nothing;const entity=this.hass.states[this.config.entity],active=this.config.active_states?.includes(entity?.state),tone=active?(this.config.active_color||"var(--warning-color)"):(this.config.color||"var(--primary-color)");return html`<ha-card class=${`card ${this.config.tap_action?"interactive":""}`} style=${`--tone:${tone};--mix:${active?"9%":"3%"}`} role=${this.config.tap_action?"button":"presentation"} tabindex=${this.config.tap_action?"0":"-1"} @pointerdown=${()=>this.startHold()} @pointerup=${()=>this.cancelHold()} @pointerleave=${()=>this.cancelHold()} @click=${()=>{if(!this.held)void runAction(this,this.hass!,this.config?.tap_action,this.config?.entity)}} @keydown=${(e:KeyboardEvent)=>{if(e.key==="Enter"||e.key===" ")void runAction(this,this.hass!,this.config?.tap_action,this.config?.entity)}}><div class="icon"><ha-icon icon=${this.config.icon||entityIcon(entity)}></ha-icon></div><div class="name">${this.config.name||entityName(entity,this.config.entity)}</div><div class="subtitle">${this.config.subtitle||entityName(entity,"Állapot")}</div><div class="value">${entityState(this.hass,entity,this.config.state_map)}</div>${this.config.action_label?html`<div class="action">${this.config.action_label}</div>`:nothing}</ha-card>`}
}
