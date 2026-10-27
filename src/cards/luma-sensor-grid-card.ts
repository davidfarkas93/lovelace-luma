import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { entityIcon, entityName, entityState, runAction } from "../helpers";
import { localized } from "../localize";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LumaAction, LovelaceCard } from "../types";

interface Item { entity: string; name?: string; icon?: string; tap_action?: LumaAction; state_map?: Record<string,string> }
interface Config { type: string; name?: string; icon?: string; columns?: number; surface?: boolean; items: Item[]; collapsible?: boolean; language?: string; clear_label?: string }

@customElement("luma-sensor-grid-card")
export class LumaSensorGridCard extends LitElement implements LovelaceCard {
  @property({attribute:false}) hass?: HomeAssistant;
  @state() private config?: Config;
  @state() private expanded = false;
  static styles = [lumaTokens, css`.wrap{display:grid;gap:9px}.wrap.surface{padding:13px;border:1px solid var(--luma-border);border-radius:var(--luma-radius-card);background:linear-gradient(145deg,color-mix(in srgb,var(--luma-accent) 5%,var(--luma-surface)),var(--luma-surface));box-shadow:0 10px 28px rgba(0,0,0,.04)}.head{display:flex;align-items:center;gap:8px;padding:3px 2px;font-size:var(--luma-text-sm);font-weight:var(--luma-weight-strong)}.head ha-icon{--mdc-icon-size:17px;color:var(--luma-accent)}.grid{display:grid;grid-template-columns:repeat(var(--cols,2),minmax(0,1fr));gap:8px}.item{display:grid;grid-template-columns:34px minmax(0,1fr);grid-template-areas:"i n" "i v";gap:1px 9px;align-items:center;padding:10px;border:0;border-radius:15px;background:color-mix(in srgb,var(--luma-accent) 5%,var(--luma-surface));color:inherit;font:inherit;text-align:left}.surface .item{background:color-mix(in srgb,var(--luma-accent) 7%,transparent)}.i{grid-area:i;display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:color-mix(in srgb,var(--luma-accent) 11%,transparent);color:var(--luma-accent)}.i ha-icon{--mdc-icon-size:18px}.n{grid-area:n;overflow:hidden;font-size:var(--luma-text-sm);font-weight:var(--luma-weight-strong);text-overflow:ellipsis;white-space:nowrap}.v{grid-area:v;color:var(--luma-muted);font-size:var(--luma-text-xs)}@media(max-width:1023px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:480px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.wrap.surface{padding:10px}}
    .summary { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; width: 100%; padding: 4px 2px; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; }
    .summary .head { padding: 0; }
    .summary-copy { display: grid; gap: 6px; }
    .summary-state { color: var(--luma-muted); font-size: 12px; line-height: 1.5; }
    .summary ha-icon { align-self: center; }
    .item { cursor: pointer; background: color-mix(in srgb,var(--item-tone,var(--luma-accent)) 5%,var(--luma-surface)); }
    .surface .item { background: color-mix(in srgb,var(--item-tone,var(--luma-accent)) 7%,transparent); }
    .i { color: var(--item-tone,var(--luma-accent)); background: color-mix(in srgb,var(--item-tone,var(--luma-accent)) 11%,transparent); }
    .n { white-space: normal; overflow-wrap: anywhere; }
    .grid { grid-template-columns: repeat(var(--cols,2),minmax(0,1fr)); }
    @media(max-width:480px) { .grid { grid-template-columns: repeat(2,minmax(0,1fr)); } }
  `];
  setConfig(c: Config) { if (!c?.items) throw Error("items required"); this.config = c; }
  getCardSize() { return this.config?.collapsible && !this.expanded ? 1 : 2; }
  render() {
    if (!this.hass || !this.config) return nothing;
    const c = this.config;
    const languageHass = c.language ? {...this.hass,locale:{...this.hass.locale,language:c.language}} : this.hass;
    const active = c.items.filter(x => this.hass!.states[x.entity]?.state === "on");
    const missing = c.items.filter(x => !this.hass!.states[x.entity] || ["unknown","unavailable"].includes(this.hass!.states[x.entity].state));
    const attention = [...missing,...active];
    const visible = c.collapsible && !this.expanded ? attention : c.items;
    const summary = [active.length ? localized(languageHass,`${active.length} active`,`${active.length} aktív`) : "", missing.length ? localized(languageHass,`${missing.length} unavailable`,`${missing.length} nem elérhető`) : ""].filter(Boolean).join(" · ") || c.clear_label || localized(languageHass,"All sensors clear","Minden érzékelő nyugalomban");
    return html`<div class=${`wrap ${c.surface ? "surface" : ""}`}>
      ${c.collapsible ? html`<button class="summary" aria-expanded=${this.expanded} aria-controls="sensor-items" @click=${()=>this.expanded=!this.expanded}><span class="summary-copy"><span class="head"><ha-icon icon=${c.icon||"mdi:shield-check-outline"}></ha-icon>${c.name||localized(languageHass,"Sensors","Érzékelők")}</span><span class="summary-state">${summary} · ${this.expanded ? localized(languageHass,"Less","Kevesebb") : localized(languageHass,"Details","Részletek")}</span></span><ha-icon icon=${this.expanded?"mdi:chevron-up":"mdi:chevron-down"}></ha-icon></button>` : c.name ? html`<div class="head"><ha-icon icon=${c.icon||"mdi:chart-box-outline"}></ha-icon>${c.name}</div>` : nothing}
      ${visible.length ? html`<div class="grid" id="sensor-items" style=${`--cols:${c.columns||2}`}>${visible.map(x=>{
        const e=this.hass!.states[x.entity];
        const tone = !c.collapsible ? "var(--luma-accent)" : !e || ["unknown","unavailable"].includes(e.state) || e.state === "on" ? "var(--warning-color)" : "var(--secondary-text-color)";
        const stateText = !e ? localized(languageHass,"Unavailable","Nem elérhető") : entityState(languageHass,e,{unknown:localized(languageHass,"Unknown","Ismeretlen"),unavailable:localized(languageHass,"Unavailable","Nem elérhető"),...x.state_map});
        return html`<button class="item" style=${`--item-tone:${tone}`} @click=${()=>runAction(this,this.hass!,x.tap_action||{action:"more-info"},x.entity)}><span class="i"><ha-icon icon=${x.icon||entityIcon(e)}></ha-icon></span><span class="n">${x.name||entityName(e,x.entity)}</span><span class="v">${stateText}</span></button>`;
      })}</div>` : nothing}
    </div>`;
  }
}
