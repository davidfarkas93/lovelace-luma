import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LovelaceCard } from "../types";

interface Config { type:string; name:string; icon?:string; summary?:string; cards:Record<string,unknown>[]; open?:boolean }
@customElement("luma-disclosure-card")
export class LumaDisclosureCard extends LitElement implements LovelaceCard {
  @property({attribute:false}) private _hass?:HomeAssistant;
  @state() private config?:Config;
  @state() private expanded=false;
  private cardElements:HTMLElement[]=[];
  set hass(value:HomeAssistant|undefined){this._hass=value;for(const child of this.cardElements)(child as LovelaceCard).hass=value;this.requestUpdate()}
  get hass(){return this._hass}
  static styles=[lumaTokens,css`
    ha-card{overflow:visible;border:1px solid var(--luma-border);border-radius:17px;background:color-mix(in srgb,var(--primary-text-color) 2.5%,var(--luma-surface));box-shadow:none}.trigger{display:grid;grid-template-columns:34px minmax(0,1fr) auto auto;align-items:center;gap:9px;width:100%;min-height:50px;padding:8px 11px;border:0;border-radius:inherit;color:inherit;background:transparent;font:inherit;text-align:left}.icon{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;color:var(--luma-accent);background:color-mix(in srgb,var(--luma-accent) 10%,transparent)}.icon ha-icon{--mdc-icon-size:17px}.name{font-size:12px;font-weight:680}.summary{color:var(--luma-muted);font-size:10px}.chevron{color:var(--luma-muted);transition:transform .2s ease}.chevron.open{transform:rotate(180deg)}.content{display:grid;gap:6px;padding:0 7px 8px}.content[hidden]{display:none}
  `];
  async setConfig(c:Config){if(!c?.name||!Array.isArray(c.cards))throw Error("name and cards required");this.config=c;this.expanded=c.open||false;const helpers=await window.loadCardHelpers?.();this.cardElements=helpers?c.cards.map(x=>helpers.createCardElement(x)):[];for(const child of this.cardElements)(child as LovelaceCard).hass=this.hass;this.requestUpdate()}
  getCardSize(){return this.expanded?Math.max(1,this.cardElements.length):1}
  render(){if(!this.config)return nothing;return html`<ha-card><button class="trigger" @click=${()=>this.expanded=!this.expanded}><span class="icon"><ha-icon icon=${this.config.icon||"mdi:layers-outline"}></ha-icon></span><span class="name">${this.config.name}</span><span class="summary">${this.config.summary||`${this.config.cards.length} elem`}</span><ha-icon class=${`chevron ${this.expanded?"open":""}`} icon="mdi:chevron-down"></ha-icon></button><div class="content" ?hidden=${!this.expanded}>${this.cardElements}</div></ha-card>`}
}
