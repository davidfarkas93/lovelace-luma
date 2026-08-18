import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  activeEntities,
  entityAreaName,
  entityIcon,
  entityName,
  entityState,
  runAction,
} from "../helpers";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LumaActiveConfig, LovelaceCard } from "../types";

interface Config {
  type: string;
  name?: string;
  empty_text?: string;
  active?: LumaActiveConfig;
}

const labels: Record<string, string> = {
  on: "Bekapcsolva",
  playing: "Lejátszik",
  paused: "Szünet",
  cool: "Hűtés",
  heat: "Fűtés",
};

@customElement("luma-active-card")
export class LumaActiveCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: Config;

  static styles = [lumaTokens, css`
    .wrap { display:grid; gap:8px; }
    .heading { display:flex; align-items:center; gap:9px; padding:2px 3px; color:var(--primary-text-color); font-size:14px; font-weight:720; }
    .heading ha-icon { --mdc-icon-size:19px; color:var(--warning-color); }
    .count { margin-left:auto; padding:4px 8px; border-radius:999px; color:var(--warning-color); background:color-mix(in srgb,var(--warning-color) 12%,transparent); font-size:10px; }
    .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
    .item { display:grid; grid-template-columns:38px minmax(0,1fr); grid-template-areas:"icon name" "icon value"; align-items:center; gap:2px 10px; min-width:0; padding:10px; border:1px solid color-mix(in srgb,var(--tone) 13%,transparent); border-radius:16px; color:var(--primary-text-color); background:linear-gradient(145deg,color-mix(in srgb,var(--tone) 7%,var(--luma-surface)),var(--luma-surface)); font:inherit; text-align:left; }
    .icon { grid-area:icon; display:grid; place-items:center; width:38px; height:38px; border-radius:12px; color:var(--tone); background:color-mix(in srgb,var(--tone) 13%,transparent); }
    .icon ha-icon { --mdc-icon-size:20px; }
    .name { grid-area:name; align-self:end; overflow:hidden; font-size:12px; font-weight:680; text-overflow:ellipsis; white-space:nowrap; }
    .value { grid-area:value; align-self:start; overflow:hidden; color:var(--luma-muted); font-size:10px; text-overflow:ellipsis; white-space:nowrap; }
    .empty { padding:17px; border:1px dashed var(--luma-border); border-radius:16px; color:var(--luma-muted); font-size:11px; text-align:center; }
    @media(max-width:480px) {
      .grid { gap:6px; }
      .item { grid-template-columns:32px minmax(0,1fr); gap:2px 7px; padding:8px; }
      .icon { width:32px; height:32px; border-radius:10px; }
      .icon ha-icon { --mdc-icon-size:17px; }
      .name { font-size:11px; }
      .value { font-size:9px; }
    }
  `];

  setConfig(config: Config): void { this.config = config || { type: "custom:luma-active-card" }; }
  getCardSize(): number { return 2; }
  protected shouldUpdate(changed: PropertyValues<this>): boolean {
    if (!changed.has("hass")) return true;
    return true;
  }

  render() {
    if (!this.hass || !this.config) return nothing;
    const items = activeEntities(this.hass, this.config.active);
    return html`<div class="wrap">
      <div class="heading"><ha-icon icon="mdi:lightning-bolt-outline"></ha-icon><span>${this.config.name || "Most aktív"}</span><span class="count">${items.length}</span></div>
      ${items.length ? html`<div class="grid">${items.map(({ entity, rule }) => {
        const domain = rule.display_as || entity.entity_id.split(".")[0];
        const tone = domain === "light" ? "var(--warning-color)" : domain === "climate" ? "var(--info-color, var(--primary-color))" : "var(--primary-color)";
        const action = rule.tap_action || { action: domain === "light" ? "toggle" : "more-info" } as const;
        const secondary = domain === "light"
          ? rule.area_name || entityAreaName(this.hass!, entity.entity_id) || "Világítás"
          : labels[entity.state] || entityState(this.hass!, entity);
        return html`<button class="item" style=${`--tone:${tone}`} @click=${() => runAction(this, this.hass!, action, entity.entity_id)}><span class="icon"><ha-icon icon=${entityIcon(entity)}></ha-icon></span><span class="name">${entityName(entity, entity.entity_id)}</span><span class="value">${secondary}</span></button>`;
      })}</div>` : html`<div class="empty">${this.config.empty_text || "Nincs aktív eszköz"}</div>`}
    </div>`;
  }
}
