import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { entityIcon, entityName, entityState, runAction } from "../helpers";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LumaAction, LovelaceCard } from "../types";

interface LumaControlGroupItem {
  entity:string; name?:string; icon?:string; color?:string; active_color?:string;
  active_states?:string[]; state_map?:Record<string,string>; tap_action?:LumaAction; hold_action?:LumaAction;
}
interface LumaControlGroupConfig { type:string; items:LumaControlGroupItem[]; columns?:number; }

@customElement("luma-control-group-card")
export class LumaControlGroupCard extends LitElement implements LovelaceCard {
  @property({attribute:false}) hass?:HomeAssistant;
  @state() private config?:LumaControlGroupConfig;
  private holdTimer?:number; private held=false;
  static styles=[lumaTokens,css`
    .group{display:grid;grid-template-columns:repeat(var(--columns),minmax(0,1fr));gap:6px;padding:6px;border:1px solid var(--luma-border);border-radius:var(--luma-radius-card);background:var(--luma-surface);box-shadow:0 10px 28px rgba(0,0,0,.04)}
    button{display:grid;grid-template-columns:36px minmax(0,1fr);grid-template-areas:"icon name" "icon state";align-items:center;gap:2px 9px;min-width:0;min-height:58px;padding:9px;border:0;border-radius:15px;color:var(--primary-text-color);background:linear-gradient(145deg,color-mix(in srgb,var(--tone) var(--mix),var(--luma-surface)),color-mix(in srgb,var(--tone) 2%,var(--luma-surface)));font:inherit;text-align:left;transition:transform .16s ease,background .16s ease}
    button:hover{transform:translateY(-1px);background:linear-gradient(145deg,color-mix(in srgb,var(--tone) 13%,var(--luma-surface)),color-mix(in srgb,var(--tone) 3%,var(--luma-surface)))}
    .icon{grid-area:icon;display:grid;place-items:center;width:36px;height:36px;border-radius:12px;color:var(--tone);background:color-mix(in srgb,var(--tone) 14%,transparent)}.icon ha-icon{--mdc-icon-size:20px}.name{grid-area:name;align-self:end;min-width:0;font-size:12px;font-weight:680;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.state{grid-area:state;align-self:start;color:var(--luma-muted);font-size:10px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  `];
  setConfig(config:LumaControlGroupConfig):void{if(!config?.items?.length)throw new Error("Luma control group requires items.");this.config={columns:config.items.length,...config}}
  getCardSize():number{return 1}
  protected shouldUpdate(changed:PropertyValues<this>):boolean{if(!changed.has("hass"))return true;const old=changed.get("hass") as HomeAssistant|undefined;return !old||this.config!.items.some(i=>old.states[i.entity]!==this.hass?.states[i.entity])}
  private down(item:LumaControlGroupItem){this.held=false;this.holdTimer=window.setTimeout(()=>{this.held=true;void runAction(this,this.hass!,item.hold_action,item.entity)},500)}
  private up(){if(this.holdTimer)window.clearTimeout(this.holdTimer)}
  render(){if(!this.hass||!this.config)return nothing;return html`<ha-card class="group" style=${`--columns:${this.config.columns}`}>${this.config.items.map(item=>{const entity=this.hass!.states[item.entity],active=item.active_states?.includes(entity?.state),tone=active?(item.active_color||"var(--warning-color)"):(item.color||"var(--primary-color)");return html`<button class="interactive" style=${`--tone:${tone};--mix:${active?"9%":"3%"}`} @pointerdown=${()=>this.down(item)} @pointerup=${()=>this.up()} @pointerleave=${()=>this.up()} @click=${()=>{if(!this.held)void runAction(this,this.hass!,item.tap_action,item.entity)}}><span class="icon"><ha-icon icon=${item.icon||entityIcon(entity)}></ha-icon></span><span class="name">${item.name||entityName(entity,item.entity)}</span><span class="state">${entityState(this.hass!,entity,item.state_map)}</span></button>`})}</ha-card>`}
}
