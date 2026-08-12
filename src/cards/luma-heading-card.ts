import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LovelaceCard } from "../types";

interface Config { type: string; heading: string; icon?: string; description?: string }

@customElement("luma-heading-card")
export class LumaHeadingCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: Config;
  static styles = [lumaTokens, css`
    .heading { display:grid; grid-template-columns:auto minmax(0,1fr); gap:10px; align-items:center; padding:8px 2px 5px; }
    .icon { display:grid; place-items:center; width:30px; height:30px; border-radius:10px; color:var(--luma-accent); background:color-mix(in srgb,var(--luma-accent) 10%,transparent); }
    ha-icon { --mdc-icon-size:17px; }
    h2 { margin:0; font-size:var(--luma-text-md); line-height:1.2; font-weight:var(--luma-weight-title); letter-spacing:-.01em; }
    p { margin:2px 0 0; color:var(--luma-muted); font-size:var(--luma-text-xs); line-height:1.3; font-weight:var(--luma-weight-medium); }
  `];
  setConfig(config: Config) { if (!config?.heading) throw new Error("heading is required"); this.config = config; }
  getCardSize() { return 1; }
  render() { const c=this.config; if(!c) return html``; return html`<div class="heading">${c.icon?html`<span class="icon"><ha-icon icon=${c.icon}></ha-icon></span>`:html``}<div><h2>${c.heading}</h2>${c.description?html`<p>${c.description}</p>`:html``}</div></div>`; }
}
