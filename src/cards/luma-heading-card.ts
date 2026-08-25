import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { lumaTokens } from "../styles";
import { runAction } from "../helpers";
import type { HomeAssistant, LumaAction, LovelaceCard } from "../types";

interface Config { type: string; heading: string; icon?: string; description?: string; tap_action?: LumaAction }

@customElement("luma-heading-card")
export class LumaHeadingCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: Config;
  static styles = [lumaTokens, css`
    .heading { display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:10px; align-items:center; width:100%; padding:8px 2px 5px; box-sizing:border-box; border:0; color:inherit; background:transparent; font:inherit; text-align:left; }
    .heading.interactive{cursor:pointer;border-radius:12px;transition:color .16s ease,background .16s ease,transform .16s ease}.heading.interactive:hover{color:var(--luma-accent);background:color-mix(in srgb,var(--luma-accent) 5%,transparent);transform:translateX(2px)}
    .icon { display:grid; place-items:center; width:30px; height:30px; border-radius:10px; color:var(--luma-accent); background:color-mix(in srgb,var(--luma-accent) 10%,transparent); }
    ha-icon { --mdc-icon-size:17px; }
    h2 { margin:0; font-size:var(--luma-text-md); line-height:1.2; font-weight:var(--luma-weight-title); letter-spacing:-.01em; }
    p { margin:2px 0 0; color:var(--luma-muted); font-size:var(--luma-text-xs); line-height:1.3; font-weight:var(--luma-weight-medium); }
    .arrow{color:var(--luma-muted);opacity:.72}.arrow ha-icon{--mdc-icon-size:18px}
  `];
  setConfig(config: Config) { if (!config?.heading) throw new Error("heading is required"); this.config = config; }
  getCardSize() { return 1; }
  render() { const c=this.config; if(!c) return html``; return html`<button class=${`heading ${c.tap_action?"interactive":""}`} ?disabled=${!c.tap_action} @click=${()=>c.tap_action&&runAction(this,this.hass!,c.tap_action)}>${c.icon?html`<span class="icon"><ha-icon icon=${c.icon}></ha-icon></span>`:html``}<div><h2>${c.heading}</h2>${c.description?html`<p>${c.description}</p>`:html``}</div>${c.tap_action?html`<span class="arrow"><ha-icon icon="mdi:chevron-right"></ha-icon></span>`:html``}</button>`; }
}
