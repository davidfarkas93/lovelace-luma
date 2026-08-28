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
  soak_remaining_entity?: string;
  remaining_entity?: string;
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
      .go[disabled] {
        cursor: default;
        opacity: 0.78;
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
        position: relative;
        height: 100%;
        border-radius: inherit;
        background: var(--tone);
        overflow: hidden;
        transition: width 0.45s ease;
      }
      .fill.soaking {
        background: linear-gradient(
          90deg,
          color-mix(in srgb, var(--info-color, #039be5) 72%, white),
          var(--info-color, #039be5)
        );
        box-shadow: 0 0 11px
          color-mix(in srgb, var(--info-color, #039be5) 38%, transparent);
      }
      .fill.soaking::after {
        position: absolute;
        inset: 0;
        content: "";
        background: linear-gradient(
          100deg,
          transparent 12%,
          rgb(255 255 255 / 0.52) 48%,
          transparent 84%
        );
        transform: translateX(-115%);
        animation: soak-flow 1.8s ease-in-out infinite;
      }
      @keyframes soak-flow {
        55%,
        100% {
          transform: translateX(115%);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .fill {
          transition: none;
        }
        .fill.soaking::after {
          animation: none;
          opacity: 0.2;
          transform: none;
        }
      }
      button:not([disabled]) {
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
    if (this.programRunning()) return;
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
  private programRunning() {
    if (!this.hass || !this.config) return false;
    const value = String(
      this.hass.states[this.config.active_program_entity]?.state || "",
    ).toLocaleLowerCase();
    return !["", "nincs", "none", "unknown", "unavailable"].includes(value);
  }
  private formatRemaining(value: number) {
    if (!Number.isFinite(value) || value <= 0) return "";
    const minutes = Math.ceil(value / 60);
    if (minutes < 60) {
      return localized(
        this.hass!,
        `${minutes} min remaining`,
        `${minutes} perc hátra`,
      );
    }
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return localized(
      this.hass!,
      `${hours} h ${rest} min remaining`,
      `${hours} ó ${rest} perc hátra`,
    );
  }
  render() {
    if (!this.hass || !this.config) return nothing;
    const c = this.config,
      s = this.hass.states,
      active = String(s[c.active_program_entity]?.state || "")
        .toLowerCase()
        .includes(c.program_name.toLowerCase()),
      programRunning = this.programRunning(),
      p = Math.max(
        0,
        Math.min(100, Number(s[c.progress_entity || ""]?.state) || 0),
      ),
      status = s[c.state_entity || ""]?.state,
      normalizedStatus = String(status || "").toLocaleLowerCase(),
      soakRemaining = Number(s[c.soak_remaining_entity || ""]?.state),
      overallRemaining = Number(s[c.remaining_entity || ""]?.state),
      soaking =
        active &&
        (normalizedStatus.includes("beszivárg") ||
          normalizedStatus.includes("soak")),
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
        >${programRunning
          ? html`<button class="go" disabled>
              ${active
                ? localized(this.hass, "Running", "Folyamatban")
                : localized(this.hass, "Busy", "Foglalt")}
            </button>`
          : html`<button class="go" @click=${() => this.start()}>
              ${this.pending
                ? localize(this.hass, "confirm")
                : localize(this.hass, "start")}
            </button>`}
      </div>
      ${active
        ? html`<div class="progress">
            <div class="meta">
              <span
                >${soaking
                  ? Number.isFinite(soakRemaining) && soakRemaining > 0
                    ? localized(
                        this.hass,
                        `Soaking · ${Math.ceil(soakRemaining / 60)} min left`,
                        `Beszivárgás · ${Math.ceil(soakRemaining / 60)} perc hátra`,
                      )
                    : localized(this.hass, "Soaking", "Beszivárgás")
                  : localized(
                      this.hass,
                      "Program progress",
                      "Programfolyamat",
                    )}</span
              ><span
                >${this.formatRemaining(overallRemaining) ||
                `${Math.round(p)}%`}</span
              >
            </div>
            <div class="track">
              <div
                class=${`fill ${soaking ? "soaking" : ""}`}
                style=${`width:${p}%`}
              ></div>
            </div>
          </div>`
        : nothing}</ha-card
    >`;
  }
}
