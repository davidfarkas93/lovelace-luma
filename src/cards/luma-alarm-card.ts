import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { entityState, runAction } from "../helpers";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LovelaceCard } from "../types";

interface Mode {
  mode: "away" | "night" | "home" | "disarm";
  name: string;
  subtitle?: string;
  icon?: string;
}

interface Config {
  type: string;
  entity: string;
  name?: string;
  modes?: Mode[];
  compact_mobile?: boolean;
}

const stateLabels: Record<string, string> = {
  disarmed: "Kikapcsolva",
  armed_away: "Távoli védelem",
  armed_night: "Éjszakai védelem",
  armed_home: "Otthoni védelem",
  arming: "Élesítés folyamatban",
  pending: "Visszaszámlálás",
  triggered: "Riasztás!",
  unavailable: "Nem elérhető",
  unknown: "Ismeretlen",
};

const modeState: Record<Mode["mode"], string> = {
  away: "armed_away",
  night: "armed_night",
  home: "armed_home",
  disarm: "disarmed",
};

const modeIcon: Record<Mode["mode"], string> = {
  away: "mdi:shield-lock",
  night: "mdi:shield-moon",
  home: "mdi:shield-home",
  disarm: "mdi:shield-off-outline",
};

@customElement("luma-alarm-card")
export class LumaAlarmCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: Config;
  @state() private pending?: Mode["mode"];
  private timer?: number;

  static styles = [
    lumaTokens,
    css`
      ha-card {
        display: grid;
        gap: 14px;
        padding: 16px;
        border: 1px solid color-mix(in srgb, var(--tone) 16%, transparent);
        border-radius: 21px;
        background: linear-gradient(
          145deg,
          color-mix(in srgb, var(--tone) 9%, var(--luma-surface)),
          color-mix(in srgb, var(--tone) 2%, var(--luma-surface)) 66%,
          var(--luma-surface)
        );
        box-shadow: 0 14px 38px color-mix(in srgb, var(--tone) 7%, transparent);
      }

      .summary {
        display: grid;
        grid-template-columns: 48px minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px;
        padding: 0;
        border: 0;
        color: inherit;
        background: transparent;
        font: inherit;
        text-align: left;
      }

      .icon {
        display: grid;
        place-items: center;
        width: 48px;
        height: 48px;
        border-radius: 16px;
        color: var(--tone);
        background: color-mix(in srgb, var(--tone) 15%, transparent);
      }

      .icon ha-icon { --mdc-icon-size: 25px; }
      .copy { min-width: 0; }
      .name { font-size: 15px; font-weight: var(--luma-weight-title); }
      .hint { margin-top: 4px; color: var(--luma-muted); font-size: 10px; }

      .status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 9px;
        border-radius: 999px;
        color: var(--tone);
        background: color-mix(in srgb, var(--tone) 13%, transparent);
        font-size: 10px;
        font-weight: 760;
        white-space: nowrap;
      }

      .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

      .actions {
        display: grid;
        grid-template-columns: repeat(var(--count), minmax(0, 1fr));
        gap: 5px;
        padding: 5px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--primary-text-color) 4.5%, transparent);
      }

      .action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        min-width: 0;
        min-height: 42px;
        padding: 0 12px;
        border: 0;
        border-radius: 999px;
        color: var(--mode-tone);
        background: transparent;
        font: inherit;
        font-size: 11px;
        font-weight: var(--luma-weight-strong);
        transition: transform .16s ease, background .16s ease, color .16s ease;
      }

      .action:hover:not(:disabled) {
        transform: translateY(-1px);
        background: color-mix(in srgb, var(--mode-tone) 8%, transparent);
      }

      .action.active {
        background: color-mix(in srgb, var(--mode-tone) 14%, transparent);
      }

      .action.confirm {
        color: var(--warning-color);
        background: color-mix(in srgb, var(--warning-color) 16%, transparent);
      }

      .action.urgent {
        color: var(--error-color);
        background: color-mix(in srgb, var(--error-color) 15%, transparent);
      }

      .action:disabled { cursor: default; opacity: .48; }
      .action.active:disabled { opacity: 1; }
      .action ha-icon { --mdc-icon-size: 18px; flex: 0 0 auto; }
      .label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      @media (max-width: 520px) {
        ha-card { padding: 14px; gap: 12px; }
        .summary { grid-template-columns: 44px minmax(0, 1fr) auto; gap: 10px; }
        .icon { width: 44px; height: 44px; border-radius: 14px; }
        .action { min-height: 40px; padding: 0 8px; font-size: 10px; gap: 5px; }
        .action ha-icon { --mdc-icon-size: 17px; }
        .compact .hint { display: none; }
      }

      @media (max-width: 390px) {
        .status .dot { display: none; }
        .action { padding: 0 6px; }
      }
    `,
  ];

  setConfig(config: Config): void {
    if (!config?.entity) throw new Error("Luma alarm requires entity.");
    this.config = {
      modes: [
        { mode: "away", name: "Távol", subtitle: "Teljes védelem" },
        { mode: "night", name: "Éjszaka", subtitle: "Éjszakai zónák" },
        { mode: "disarm", name: "Kikapcsolás", subtitle: "Védelem leállítása" },
      ],
      ...config,
    };
  }

  getCardSize(): number { return 3; }

  protected shouldUpdate(changed: PropertyValues<this>): boolean {
    if (!changed.has("hass")) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    return !old || old.states[this.config!.entity] !== this.hass?.states[this.config!.entity];
  }

  private activate(mode: Mode["mode"], disabled: boolean): void {
    if (!this.hass || !this.config || disabled) return;
    if (this.pending !== mode) {
      this.pending = mode;
      clearTimeout(this.timer);
      this.timer = window.setTimeout(() => (this.pending = undefined), 3400);
      return;
    }
    this.pending = undefined;
    const service = mode === "disarm" ? "alarm_disarm" : `alarm_arm_${mode}`;
    void this.hass.callService("alarm_control_panel", service, undefined, { entity_id: this.config.entity });
  }

  render() {
    if (!this.hass || !this.config) return nothing;
    const entity = this.hass.states[this.config.entity];
    const current = entity?.state || "unavailable";
    const triggered = current === "triggered";
    const transitioning = ["arming", "pending"].includes(current);
    const disarmed = current === "disarmed";
    const tone = triggered
      ? "var(--error-color)"
      : transitioning
        ? "var(--warning-color)"
        : disarmed
          ? "var(--secondary-text-color)"
          : "var(--success-color)";
    const icon = triggered
      ? "mdi:shield-alert"
      : disarmed
        ? "mdi:shield-off-outline"
        : current === "armed_night"
          ? "mdi:shield-moon"
          : current === "armed_home"
            ? "mdi:shield-home"
            : "mdi:shield-lock";
    const hint = triggered
      ? "Azonnali figyelmet igényel"
      : transitioning
        ? "A rendszer állapotot vált"
        : disarmed
          ? "A rendszer jelenleg nincs élesítve"
          : "Biztonsági rendszer aktív";
    const modes = this.config.modes || [];

    return html`
      <ha-card class=${this.config.compact_mobile ? "compact" : ""} style=${`--tone:${tone}`}>
        <button class="summary" @click=${() => runAction(this, this.hass!, { action: "more-info" }, this.config!.entity)}>
          <span class="icon"><ha-icon icon=${icon}></ha-icon></span>
          <span class="copy">
            <span class="name">${this.config.name || "Riasztó"}</span>
            <div class="hint">${hint}</div>
          </span>
          <span class="status"><span class="dot"></span>${stateLabels[current] || entityState(this.hass, entity)}</span>
        </button>
        <div class="actions" style=${`--count:${modes.length}`}>
          ${modes.map((mode) => {
            const active = current === modeState[mode.mode];
            const disabled = active
              || current === "unavailable"
              || current === "unknown"
              || ((triggered || transitioning) && mode.mode !== "disarm");
            const confirming = this.pending === mode.mode;
            const modeTone = mode.mode === "disarm"
              ? "var(--error-color)"
              : mode.mode === "night"
                ? "var(--info-color,var(--primary-color))"
                : "var(--success-color)";
            const urgent = triggered && mode.mode === "disarm";
            return html`
              <button
                class=${`action ${active ? "active" : ""} ${confirming ? "confirm" : ""} ${urgent ? "urgent" : ""}`}
                style=${`--mode-tone:${modeTone}`}
                ?disabled=${disabled}
                title=${mode.subtitle || mode.name}
                @click=${() => this.activate(mode.mode, disabled)}
              >
                <ha-icon icon=${confirming ? "mdi:check" : mode.icon || modeIcon[mode.mode]}></ha-icon>
                <span class="label">${confirming ? "Megerősítés" : mode.name}</span>
              </button>
            `;
          })}
        </div>
      </ha-card>
    `;
  }
}
