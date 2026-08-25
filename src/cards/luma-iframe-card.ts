import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { localized } from "../localize";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LovelaceCard } from "../types";

interface Config { type:string; url:string; height?:number; title?:string; mobile_bottom_space?:number }

@customElement("luma-iframe-card")
export class LumaIframeCard extends LitElement implements LovelaceCard {
  @property({attribute:false}) hass?:HomeAssistant;
  @state() private config?:Config;
  static styles=[lumaTokens,css`ha-card{position:relative;border:1px solid var(--luma-border);border-radius:22px;background:var(--luma-surface);box-shadow:var(--luma-shadow);overflow:hidden}.loading{position:absolute;inset:0;display:grid;place-items:center;color:var(--luma-muted);font-size:12px;background:linear-gradient(135deg,color-mix(in srgb,var(--primary-color) 5%,var(--luma-surface)),var(--luma-surface))}iframe{position:relative;display:block;width:100%;height:var(--height);border:0;background:transparent}@media(max-width:699px){ha-card{margin-bottom:var(--mobile-bottom-space,0)}}`];
  setConfig(c:Config){if(!c?.url)throw Error("url required");this.config={height:350,...c}}
  getCardSize(){return 6}
  render(){return html`<ha-card style=${`--mobile-bottom-space:${this.config?.mobile_bottom_space||0}px`}><div class="loading">${localized(this.hass,"Loading content…","Tartalom betöltése…")}</div><iframe title=${this.config?.title||localized(this.hass,"Embedded content","Beágyazott tartalom")} src=${this.config?.url||""} style=${`--height:${this.config?.height||350}px`} loading="lazy"></iframe></ha-card>`}
}
