import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { runAction } from "../helpers";
import { localize, localized } from "../localize";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LovelaceCard } from "../types";
interface Config {
  type: string;
  name: string;
  icon?: string;
  color?: string;
  button_entity: string;
  active_program_entity: string;
  program_name: string;
  progress_entity?: string;
  state_entity?: string;
  runtime?: string;
}
@customElement("luma-irrigation-program-card")
export class LumaIrrigationProgramCard
  extends LitElement
  implements LovelaceCard
{
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: Config;
  @state() private pending = false;
  private timer?: number;
  static styles = [
    lumaTokens,
    css`
      ha-card {
        padding: 17px;
        border: 1px solid color-mix(in srgb, var(--tone) 18%, transparent);
        border-radius: 20px;
        background: linear-gradient(
          145deg,
          color-mix(in srgb, var(--tone) 10%, var(--luma-surface)),
          var(--luma-surface) 70%
        );
        box-shadow: var(--luma-shadow);
      }
      .row {
        display: grid;
        grid-template-columns: 46px 1fr auto;
        align-items: center;
        gap: 12px;
      }
      .icon {
        display: grid;
        place-items: center;
        width: 46px;
        height: 46px;
        border-radius: 15px;
        color: var(--tone);
        background: color-mix(in srgb, var(--tone) 16%, transparent);
      }
      .name {
        font-size: 16px;
        font-weight: 730;
      }
      .sub {
        margin-top: 3px;
        color: var(--luma-muted);
        font-size: 10px;
      }
      .go {
        padding: 8px 12px;
        border: 0;
        border-radius: 999px;
        color: var(--tone);
        background: color-mix(in srgb, var(--tone) 15%, transparent);
        font-size: 11px;
        font-weight: 760;
      }
      .progress {
        margin-top: 14px;
      }
      .meta {
        display: flex;
        justify-content: space-between;
        color: var(--luma-muted);
        font-size: 10px;
      }
      .track {
        height: 7px;
        margin-top: 7px;
        border-radius: 99px;
        background: color-mix(
          in srgb,
          var(--primary-text-color) 8%,
          transparent
        );
        overflow: hidden;
      }
      .fill {
        height: 100%;
        border-radius: inherit;
        background: var(--tone);
      }
      button {
        cursor: pointer;
      }
    `,
  ];
  setConfig(c: Config) {
    if (!c?.button_entity || !c.active_program_entity)
      throw Error("button_entity and active_program_entity required");
    this.config = c;
  }
  getCardSize() {
    return 2;
  }
  private start() {
    if (!this.pending) {
      this.pending = true;
      clearTimeout(this.timer);
      this.timer = window.setTimeout(() => (this.pending = false), 3500);
      return;
    }
    this.pending = false;
    void runAction(
      this,
      this.hass!,
      {
        action: "perform-action",
        perform_action: "button.press",
        target: { entity_id: this.config!.button_entity },
      },
      this.config!.button_entity,
    );
  }
  render() {
    if (!this.hass || !this.config) return nothing;
    const c = this.config,
      s = this.hass.states,
      active = String(s[c.active_program_entity]?.state || "")
        .toLowerCase()
        .includes(c.program_name.toLowerCase()),
      p = Math.max(
        0,
        Math.min(100, Number(s[c.progress_entity || ""]?.state) || 0),
      ),
      status = s[c.state_entity || ""]?.state,
      tone = c.color || "var(--primary-color)";
    return html`<ha-card style=${`--tone:${tone}`}
      ><div class="row">
        <span class="icon"
          ><ha-icon icon=${c.icon || "mdi:sprinkler-variant"}></ha-icon></span
        ><span
          ><div class="name">${c.name}</div>
          <div class="sub">
            ${active
              ? status || localized(this.hass,"Program in progress","Program folyamatban")
              : c.runtime || localized(this.hass,"Manual program start","Kézi programindítás")}
          </div></span
        ><button class="go" @click=${() => this.start()}>
          ${this.pending ? localize(this.hass, "confirm") : localize(this.hass, "start")}
        </button>
      </div>
      ${active
        ? html`<div class="progress">
            <div class="meta">
              <span>${localized(this.hass,"Program progress","Programfolyamat")}</span><span>${Math.round(p)}%</span>
            </div>
            <div class="track">
              <div class="fill" style=${`width:${p}%`}></div>
            </div>
          </div>`
        : nothing}</ha-card
    >`;
  }
}
