import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  entityIcon,
  entityName,
  entityState,
  itemIsVisible,
  relevantEntityIds,
  runAction,
} from "../helpers";
import { lumaTokens } from "../styles";
import type {
  HomeAssistant,
  LumaAction,
  LumaBannerConfig,
  LumaEntityItem,
  LovelaceCard,
} from "../types";

interface LumaHeroConfig {
  type: string;
  entity?: string;
  name?: string;
  subtitle?: string;
  icon?: string;
  accent_color?: string;
  badge?: LumaEntityItem;
  chips?: LumaEntityItem[];
  banners?: LumaBannerConfig[];
  tap_action?: LumaAction;
}

@customElement("luma-hero-card")
export class LumaHeroCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: LumaHeroConfig;

  static styles = [
    lumaTokens,
    css`
      .hero {
        position: relative;
        padding: 26px;
        border-radius: var(--luma-radius-hero);
        border: 1px solid color-mix(in srgb, var(--luma-accent) 22%, transparent);
        background: linear-gradient(
          135deg,
          color-mix(in srgb, var(--luma-accent) 15%, var(--luma-surface)),
          color-mix(in srgb, var(--luma-accent) 4%, var(--luma-surface)) 64%
        );
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.08);
      }

      .top {
        display: grid;
        grid-template-columns: 58px minmax(0, 1fr) auto;
        grid-template-areas: "icon title badge" "icon subtitle badge";
        align-items: center;
        column-gap: 17px;
      }

      .icon {
        grid-area: icon;
        display: grid;
        place-items: center;
        width: 58px;
        height: 58px;
        border-radius: 19px;
        color: var(--luma-accent);
        background: color-mix(in srgb, var(--luma-accent) 15%, transparent);
      }

      .icon ha-icon {
        --mdc-icon-size: 31px;
      }

      h2 {
        grid-area: title;
        align-self: end;
        margin: 0;
        font-size: clamp(20px, 4vw, 27px);
        line-height: 1.12;
        font-weight: 720;
      }

      .subtitle {
        grid-area: subtitle;
        align-self: start;
        margin-top: 5px;
        color: var(--luma-muted);
        font-size: 13px;
        line-height: 1.35;
      }

      .badge {
        grid-area: badge;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 11px;
        border-radius: 999px;
        color: var(--item-color, var(--luma-accent));
        background: color-mix(in srgb, var(--item-color, var(--luma-accent)) 13%, transparent);
        font-size: 11px;
        font-weight: 720;
        white-space: nowrap;
      }

      .badge ha-icon {
        --mdc-icon-size: 16px;
      }

      .chips {
        display: flex;
        justify-content: flex-end;
        flex-wrap: wrap;
        gap: 7px;
        margin-top: 16px;
      }

      .chip {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-height: 34px;
        padding: 7px 11px;
        border: 0;
        border-radius: 999px;
        color: var(--item-color, var(--primary-text-color));
        background: color-mix(in srgb, var(--item-color, var(--primary-text-color)) 9%, transparent);
        font: inherit;
        font-size: 11px;
        font-weight: 680;
      }

      .chip ha-icon {
        --mdc-icon-size: 17px;
      }

      .banners {
        display: grid;
        gap: 8px;
        margin-top: 14px;
      }

      .banner {
        display: grid;
        grid-template-columns: 24px auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 9px;
        width: 100%;
        min-height: 42px;
        padding: 9px 12px;
        border: 1px solid color-mix(in srgb, var(--item-color, var(--luma-accent)) 17%, transparent);
        border-radius: var(--luma-radius-control);
        color: var(--item-color, var(--luma-accent));
        background: color-mix(in srgb, var(--item-color, var(--luma-accent)) 11%, transparent);
        font: inherit;
        text-align: left;
      }

      .banner ha-icon {
        --mdc-icon-size: 19px;
      }

      .banner-label {
        font-size: 11px;
        font-weight: 720;
        white-space: nowrap;
      }

      .banner-state {
        min-width: 0;
        overflow: hidden;
        color: var(--primary-text-color);
        font-size: 11px;
        font-weight: 620;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .banner-action {
        padding: 4px 7px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--item-color, var(--luma-accent)) 14%, transparent);
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.05em;
      }

      @media (max-width: 599px) {
        .hero {
          padding: 18px;
        }

        .top {
          grid-template-columns: 46px minmax(0, 1fr) auto;
          column-gap: 12px;
        }

        .icon {
          width: 46px;
          height: 46px;
          border-radius: 15px;
        }

        .icon ha-icon {
          --mdc-icon-size: 25px;
        }

        .subtitle {
          font-size: 12px;
        }

        .chips {
          justify-content: flex-start;
          margin-top: 12px;
        }

        .banner {
          grid-template-columns: 21px minmax(0, 1fr) auto;
          padding: 8px 10px;
        }

        .banner-label {
          display: none;
        }
      }
    `,
  ];

  setConfig(config: LumaHeroConfig): void {
    if (!config) throw new Error("Luma hero requires a configuration.");
    this.config = { chips: [], banners: [], ...config };
  }

  getCardSize(): number {
    return 3 + (this.config?.banners?.length || 0);
  }

  protected shouldUpdate(changed: PropertyValues<this>): boolean {
    if (!changed.has("hass")) return true;
    const previous = changed.get("hass") as HomeAssistant | undefined;
    if (!previous || !this.hass || !this.config) return true;
    return this.entityIds.some((id) => previous.states[id] !== this.hass?.states[id]);
  }

  private get entityIds(): string[] {
    if (!this.config) return [];
    return relevantEntityIds([
      ...(this.config.entity ? [{ entity: this.config.entity }] : []),
      ...(this.config.badge ? [this.config.badge] : []),
      ...(this.config.chips || []),
      ...(this.config.banners || []),
    ]);
  }

  private renderItem(item: LumaEntityItem, className: "chip" | "badge") {
    if (!this.hass || !itemIsVisible(this.hass, item)) return nothing;
    const entity = this.hass.states[item.entity];
    const label = item.name || entityName(entity, item.entity);
    const state = item.show_state === false ? "" : entityState(this.hass, entity, item.state_map);
    const content = html`
      <ha-icon icon=${item.icon || entityIcon(entity)}></ha-icon>
      <span>${label}${state ? html` · ${state}` : nothing}</span>
    `;
    const color = item.color || "var(--luma-accent)";

    if (className === "badge") {
      return html`<div class="badge" style=${`--item-color:${color}`}>${content}</div>`;
    }

    return html`
      <button
        class="chip interactive"
        style=${`--item-color:${color}`}
        @click=${(event: Event) => {
          event.stopPropagation();
          void runAction(this, this.hass!, item.tap_action, item.entity);
        }}
      >
        ${content}
      </button>
    `;
  }

  private renderBanner(item: LumaBannerConfig) {
    if (!this.hass || !itemIsVisible(this.hass, item)) return nothing;
    const entity = this.hass.states[item.entity];
    const label = item.label || item.name || entityName(entity, item.entity);
    const state = item.state_label || entityState(this.hass, entity, item.state_map);
    const color = item.color || "var(--luma-accent)";
    return html`
      <button
        class="banner interactive"
        style=${`--item-color:${color}`}
        @click=${(event: Event) => {
          event.stopPropagation();
          void runAction(this, this.hass!, item.tap_action, item.entity);
        }}
      >
        <ha-icon icon=${item.icon || entityIcon(entity)}></ha-icon>
        <span class="banner-label">${label}</span>
        <span class="banner-state">${state}</span>
        <span class="banner-action">${item.name || "OPEN"}</span>
      </button>
    `;
  }

  render() {
    if (!this.hass || !this.config) return nothing;
    const entity = this.config.entity ? this.hass.states[this.config.entity] : undefined;
    const title = this.config.name || entityName(entity, "Luma");
    const subtitle = this.config.subtitle || (entity ? entityState(this.hass, entity) : "");
    const icon = this.config.icon || entityIcon(entity, "mdi:home-outline");
    const accent = this.config.accent_color || "var(--primary-color)";
    const chips = (this.config.chips || []).filter((item) => itemIsVisible(this.hass!, item));
    const banners = (this.config.banners || []).filter((item) => itemIsVisible(this.hass!, item));

    return html`
      <ha-card
        class=${`hero ${this.config.tap_action ? "interactive" : ""}`}
        style=${`--luma-accent:${accent}`}
        tabindex=${this.config.tap_action ? "0" : "-1"}
        @click=${() => runAction(this, this.hass!, this.config?.tap_action, this.config?.entity)}
        @keydown=${(event: KeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            void runAction(this, this.hass!, this.config?.tap_action, this.config?.entity);
          }
        }}
      >
        <div class="top">
          <div class="icon"><ha-icon icon=${icon}></ha-icon></div>
          <h2>${title}</h2>
          <div class="subtitle">${subtitle}</div>
          ${this.config.badge ? this.renderItem(this.config.badge, "badge") : nothing}
        </div>
        ${chips.length ? html`<div class="chips">${chips.map((item) => this.renderItem(item, "chip"))}</div>` : nothing}
        ${banners.length
          ? html`<div class="banners">${banners.map((item) => this.renderBanner(item))}</div>`
          : nothing}
      </ha-card>
    `;
  }
}
