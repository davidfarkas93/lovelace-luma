import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { entityIcon, entityName, entityState, runAction } from "../helpers";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LovelaceCard, LumaAction } from "../types";

interface LumaStatusConfig {
  type: string;
  entity: string;
  name?: string;
  icon?: string;
  subtitle?: string;
  attribute?: string;
  accent_color?: string;
  state_map?: Record<string, string>;
  tap_action?: LumaAction;
}

@customElement("luma-status-card")
export class LumaStatusCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: LumaStatusConfig;

  static styles = [
    lumaTokens,
    css`
      ha-card {
        display: grid;
        grid-template-columns: 44px minmax(0, 1fr) auto;
        grid-template-areas: "icon name value" "icon subtitle value";
        align-items: center;
        min-height: 76px;
        padding: 15px 16px;
        column-gap: 11px;
        border: 1px solid var(--luma-border);
        border-radius: var(--luma-radius-card);
        background: linear-gradient(
          145deg,
          color-mix(in srgb, var(--luma-accent) 7%, var(--luma-surface)),
          var(--luma-surface)
        );
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.04);
      }

      .icon {
        grid-area: icon;
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        border-radius: var(--luma-radius-control);
        color: var(--luma-accent);
        background: color-mix(in srgb, var(--luma-accent) 13%, transparent);
      }

      .icon ha-icon {
        --mdc-icon-size: 22px;
      }

      .name {
        grid-area: name;
        align-self: end;
        min-width: 0;
        overflow: hidden;
        font-size: 13px;
        font-weight: 680;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .subtitle {
        grid-area: subtitle;
        align-self: start;
        min-width: 0;
        overflow: hidden;
        color: var(--luma-muted);
        font-size: 11px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .value {
        grid-area: value;
        padding: 5px 8px;
        border-radius: 999px;
        color: var(--luma-accent);
        background: color-mix(in srgb, var(--luma-accent) 11%, transparent);
        font-size: 11px;
        font-weight: 700;
        white-space: nowrap;
      }
    `,
  ];

  setConfig(config: LumaStatusConfig): void {
    if (!config?.entity) throw new Error("Luma status requires an entity.");
    this.config = config;
  }

  getCardSize(): number {
    return 1;
  }

  protected shouldUpdate(changed: PropertyValues<this>): boolean {
    if (!changed.has("hass")) return true;
    const previous = changed.get("hass") as HomeAssistant | undefined;
    const id = this.config?.entity;
    return !previous || !id || previous.states[id] !== this.hass?.states[id];
  }

  render() {
    if (!this.hass || !this.config) return nothing;
    const entity = this.hass.states[this.config.entity];
    const attributeValue = this.config.attribute ? entity?.attributes[this.config.attribute] : undefined;
    const value =
      attributeValue === undefined
        ? entityState(this.hass, entity, this.config.state_map)
        : String(attributeValue);
    const subtitle = this.config.subtitle || entity?.attributes.friendly_name || this.config.entity;
    const accent = this.config.accent_color || "var(--primary-color)";

    return html`
      <ha-card
        class=${this.config.tap_action ? "interactive" : ""}
        style=${`--luma-accent:${accent}`}
        tabindex=${this.config.tap_action ? "0" : "-1"}
        @click=${() => runAction(this, this.hass!, this.config?.tap_action, this.config?.entity)}
        @keydown=${(event: KeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            void runAction(this, this.hass!, this.config?.tap_action, this.config?.entity);
          }
        }}
      >
        <div class="icon"><ha-icon icon=${this.config.icon || entityIcon(entity)}></ha-icon></div>
        <div class="name">${this.config.name || entityName(entity, this.config.entity)}</div>
        <div class="subtitle">${subtitle}</div>
        <div class="value">${value}</div>
      </ha-card>
    `;
  }
}
