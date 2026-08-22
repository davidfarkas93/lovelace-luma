import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ref } from "lit/directives/ref.js";
import {
  activeEntities,
  entityAreaName,
} from "../helpers";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LumaActiveConfig, LovelaceCard } from "../types";

interface Config {
  type: string;
  name?: string;
  empty_text?: string;
  active?: LumaActiveConfig;
}

@customElement("luma-active-card")
export class LumaActiveCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: Config;
  @state() private turningOff = false;

  static styles = [lumaTokens, css`
    .wrap { display:grid; gap:8px; }
    .heading { display:flex; align-items:center; gap:9px; padding:2px 3px; color:var(--primary-text-color); font-size:14px; font-weight:720; }
    .heading ha-icon { --mdc-icon-size:19px; color:var(--warning-color); }
    .heading-title { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .count { margin-left:auto; padding:4px 8px; border-radius:999px; color:var(--warning-color); background:color-mix(in srgb,var(--warning-color) 12%,transparent); font-size:10px; }
    .all-off { display:inline-flex; align-items:center; justify-content:center; gap:5px; min-height:30px; padding:0 10px; border:0; border-radius:999px; color:var(--warning-color); background:color-mix(in srgb,var(--warning-color) 12%,transparent); font:inherit; font-size:10px; font-weight:720; cursor:pointer; transition:transform .16s ease,background .16s ease; }
    .all-off:hover:not(:disabled) { transform:translateY(-1px); background:color-mix(in srgb,var(--warning-color) 18%,transparent); }
    .all-off:disabled { cursor:default; opacity:.55; }
    .all-off ha-icon { --mdc-icon-size:15px; color:inherit; }
    .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
    luma-control-card { display:block; min-width:0; }
    .empty { padding:17px; border:1px dashed var(--luma-border); border-radius:16px; color:var(--luma-muted); font-size:11px; text-align:center; }
    @media(max-width:480px) {
      .all-off { width:30px; padding:0; }
      .all-off span { display:none; }
      .grid { gap:6px; }
    }
  `];

  setConfig(config: Config): void { this.config = config || { type: "custom:luma-active-card" }; }
  getCardSize(): number { return 2; }
  protected shouldUpdate(changed: PropertyValues<this>): boolean {
    if (!changed.has("hass")) return true;
    return true;
  }

  private async turnOffAll(entityIds: string[]): Promise<void> {
    if (!this.hass || !entityIds.length || this.turningOff) return;
    this.turningOff = true;
    try {
      await this.hass.callService("homeassistant", "turn_off", {}, { entity_id: entityIds });
    } finally {
      this.turningOff = false;
    }
  }

  render() {
    if (!this.hass || !this.config) return nothing;
    const items = activeEntities(this.hass, this.config.active);
    const activeLights = items
      .filter(({ entity, rule }) => (rule.display_as || entity.entity_id.split(".")[0]) === "light")
      .map(({ entity }) => entity.entity_id);
    return html`<div class="wrap">
      <div class="heading"><ha-icon icon="mdi:lightning-bolt-outline"></ha-icon><span class="heading-title">${this.config.name || "Most aktív"}</span><span class="count">${items.length}</span>${activeLights.length ? html`<button class="all-off" ?disabled=${this.turningOff} title="Minden aktív lámpa lekapcsolása" @click=${() => this.turnOffAll(activeLights)}><ha-icon icon=${this.turningOff ? "mdi:loading" : "mdi:lightbulb-group-off-outline"}></ha-icon><span>${this.turningOff ? "Kikapcsolás…" : "Lámpák le"}</span></button>` : nothing}</div>
      ${items.length ? html`<div class="grid">${items.map(({ entity, rule }) => {
        const domain = rule.display_as || entity.entity_id.split(".")[0];
        const action = rule.tap_action || { action: domain === "light" ? "toggle" : "more-info" } as const;
        const childConfig={type:"custom:luma-control-card",entity:entity.entity_id,subtitle:rule.area_name||entityAreaName(this.hass!,entity.entity_id),display_as:rule.display_as,tap_action:action,hold_action:{action:"more-info"}};
        return html`<luma-control-card ${ref((node)=>{const card=node as (HTMLElement&LovelaceCard)|undefined;if(card){card.setConfig(childConfig);card.hass=this.hass}})}></luma-control-card>`;
      })}</div>` : html`<div class="empty">${this.config.empty_text || "Nincs aktív eszköz"}</div>`}
    </div>`;
  }
}
