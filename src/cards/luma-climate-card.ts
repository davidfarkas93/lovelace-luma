import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { runAction } from "../helpers";
import { localize, localized, localizedMap } from "../localize";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LovelaceCard } from "../types";
import { thermostatSummary } from "../climate";
interface Mode {
  mode: string;
  name?: string;
  icon?: string;
}
interface Config {
  type: string;
  entity: string;
  variant?: "default" | "thermostat";
  name?: string;
  icon?: string;
  modes?: Mode[];
}
const labelsHu: Record<string, string> = {
  off: "Kikapcsolva",
  cool: "Hűtés",
  heat: "Fűtés",
  dry: "Párátlanítás",
  fan_only: "Ventiláció",
  auto: "Automata",
  unavailable: "Nem elérhető",
  unknown: "Ismeretlen",
};
const labelsEn: Record<string, string> = {off:"Off",cool:"Cooling",heat:"Heating",dry:"Dehumidifying",fan_only:"Fan",auto:"Auto",unavailable:"Unavailable",unknown:"Unknown"};
const icons: Record<string, string> = {
  off: "mdi:power",
  cool: "mdi:snowflake",
  heat: "mdi:fire",
  dry: "mdi:water-percent",
  fan_only: "mdi:fan",
  auto: "mdi:autorenew",
};
@customElement("luma-climate-card")
export class LumaClimateCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: Config;
  static styles = [
    lumaTokens,
    css`
      .thermostat-shell { container-type: inline-size; border: 0; background: transparent; box-shadow: none; overflow: visible; }
      .thermostat {
        display: grid;
        grid-template-columns: 46px minmax(0, 1fr);
        align-items: center;
        gap: 12px;
        width: 100%;
        height: 80px;
        box-sizing: border-box;
        padding: 16px;
        text-align: left;
        color: var(--primary-text-color);
        font: inherit;
        border: 1px solid color-mix(in srgb, var(--tone) var(--border-mix), transparent);
        border-radius: var(--luma-radius-card);
        background: linear-gradient(145deg, color-mix(in srgb, var(--tone) var(--mix), var(--luma-surface)), color-mix(in srgb, var(--tone) 2%, var(--luma-surface)) 72%);
        box-shadow: 0 13px 34px color-mix(in srgb, var(--tone) var(--shadow-mix), transparent);
        transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
        cursor: pointer;
      }
      .thermostat:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--tone) 28%, transparent); box-shadow: 0 17px 40px color-mix(in srgb, var(--tone) 14%, transparent); }
      .thermostat:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 3px; }
      .thermostat-icon { display: grid; place-items: center; width: 46px; height: 46px; border-radius: 15px; color: var(--tone); background: color-mix(in srgb, var(--tone) var(--icon-mix), transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tone) 8%, transparent); }
      .thermostat-icon ha-icon { --mdc-icon-size: 23px; }
      .thermostat-copy { min-width: 0; }
      .thermostat-header { display: flex; align-items: center; gap: 5px; width: 100%; min-width: 0; }
      .thermostat-header .name { flex: 1; min-width: 0; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .temperatures { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 7px; margin-top: 4px; white-space: nowrap; width: 100%; }
      .temperatures > div { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
      .temperature-label { font-size: 8px; line-height: 1; color: var(--luma-muted); }
      .temperature-value { font-size: 12px; font-weight: var(--luma-weight-strong); line-height: 1.1; font-variant-numeric: tabular-nums; }
      .target .temperature-value { font-weight: 600; }
      .operation { display: inline-flex; align-items: center; min-width: 0; max-width: 60%; padding: 3px 5px; border-radius: 999px; font-size: 9px; font-weight: 700; color: var(--tone); background: color-mix(in srgb, var(--tone) 12%, transparent); }
      .operation-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .operation ha-icon { display: none; --mdc-icon-size: 11px; }
      @container (max-width: 210px) {
        .operation-text { display: none; }
        .operation ha-icon { display: inline-grid; }
        .operation { padding: 3px; }
      }
      @container (max-width: 155px) {
        .temperature-unit { display: none; }
        .temperatures { gap: 4px; }
      }
      @media (max-width: 599px) {
        .thermostat { grid-template-columns: 42px minmax(0, 1fr); height: 70px; padding: 13px; }
        .thermostat-icon { width: 42px; height: 42px; border-radius: 14px; }
      }
      .card {
        display: grid;
        grid-template-columns: 44px minmax(110px, 1fr) auto;
        grid-template-areas: "icon copy actions";
        align-items: center;
        gap: 12px;
        min-height: 84px;
        padding: 16px 17px;
        border: 1px solid color-mix(in srgb, var(--tone) 16%, transparent);
        border-radius: 20px;
        background: linear-gradient(
          145deg,
          color-mix(in srgb, var(--tone) 9%, var(--luma-surface)),
          color-mix(in srgb, var(--tone) 3%, var(--luma-surface)) 55%,
          var(--luma-surface)
        );
        box-shadow: 0 12px 34px color-mix(in srgb, var(--tone) 6%, transparent);
      }
      .icon {
        grid-area: icon;
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        border-radius: 14px;
        color: var(--tone);
        background: color-mix(in srgb, var(--tone) 15%, transparent);
      }
      .icon ha-icon {
        --mdc-icon-size: 23px;
      }
      .copy {
        grid-area: copy;
        min-width: 0;
      }
      .name {
        font-size: 15px;
        font-weight: 700;
      }
      .subtitle {
        margin-top: 4px;
        color: var(--luma-muted);
        font-size: 11px;
      }
      .actions {
        grid-area: actions;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-height: 38px;
        padding: 0 13px;
        border: 1px solid
          color-mix(in srgb, var(--primary-text-color) 8%, transparent);
        border-radius: 999px;
        color: var(--primary-text-color);
        background: color-mix(
          in srgb,
          var(--primary-text-color) 5%,
          transparent
        );
        font: inherit;
        font-size: 11px;
        font-weight: 680;
        white-space: nowrap;
        transition: 0.16s ease;
      }
      .action ha-icon {
        --mdc-icon-size: 16px;
      }
      .action:hover {
        transform: translateY(-1px);
        background: color-mix(
          in srgb,
          var(--primary-text-color) 9%,
          transparent
        );
      }
      .action.active {
        border-color: color-mix(in srgb, var(--mode-tone) 20%, transparent);
        color: var(--mode-tone);
        background: color-mix(in srgb, var(--mode-tone) 13%, transparent);
      }
      @media (max-width: 599px) {
        .card {
          grid-template-columns: 40px minmax(0, 1fr);
          grid-template-areas: "icon copy" "actions actions";
          padding: 14px;
        }
        .icon {
          width: 40px;
          height: 40px;
          border-radius: 13px;
        }
        .actions {
          display: grid;
          grid-template-columns: repeat(var(--count), minmax(0, 1fr));
          gap: 6px;
          margin-top: 8px;
        }
        .action {
          min-width: 0;
          padding: 0 8px;
        }
        .action span {
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }
    `,
  ];
  setConfig(c: Config) {
    if (!c?.entity) throw new Error("Luma climate requires entity.");
    this.config = c;
  }
  getCardSize() {
    return this.config?.variant === "thermostat" ? 2 : 1;
  }
  protected shouldUpdate(changed: PropertyValues<this>) {
    if (!changed.has("hass")) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    return (
      !old ||
      old.states[this.config!.entity] !== this.hass?.states[this.config!.entity]
    );
  }
  private async mode(mode: string) {
    if (!this.hass || !this.config) return;
    if (mode === "off")
      await this.hass.callService("climate", "turn_off", undefined, {
        entity_id: this.config.entity,
      });
    else
      await this.hass.callService(
        "climate",
        "set_hvac_mode",
        { hvac_mode: mode },
        { entity_id: this.config.entity },
      );
  }
  render() {
    if (!this.hass || !this.config) return nothing;
    if (this.config.variant === "thermostat") return this.renderThermostat();
    const e = this.hass.states[this.config.entity],
      mode = e?.state || "unknown",
      target = e?.attributes.temperature,
      tone =
        mode === "heat"
          ? "var(--warning-color)"
          : mode === "cool"
            ? "var(--info-color, #65a9dc)"
            : mode === "dry"
              ? "#7b91cf"
              : mode === "off"
                ? "var(--secondary-text-color)"
                : "var(--primary-color)",
      subtitle = `${localizedMap(this.hass,labelsEn,labelsHu,mode)}${mode !== "off" && target != null ? ` · ${target}°C` : ""}`,
      modes = this.config.modes || [{mode:"off"},{mode:"cool"}];
    return html`<ha-card
      class="card"
      style=${`--tone:${tone};--count:${modes.length + 1}`}
      ><span class="icon"
        ><ha-icon
          icon=${this.config.icon || "mdi:air-conditioner"}
        ></ha-icon></span
      ><span class="copy"
        ><div class="name">${this.config.name || localized(this.hass,"Climate","Klíma")}</div>
        <div class="subtitle">${subtitle}</div></span
      ><span class="actions"
        >${modes.map(
          (m) =>
            html`<button
              class=${`action ${mode === m.mode ? "active" : ""}`}
              style=${`--mode-tone:${m.mode === "cool" ? "var(--info-color, #65a9dc)" : m.mode === "heat" ? "var(--warning-color)" : "var(--secondary-text-color)"}`}
              @click=${() => this.mode(m.mode)}
            >
              <ha-icon
                icon=${m.icon || icons[m.mode] || "mdi:circle-outline"}
              ></ha-icon
              ><span>${m.name || localizedMap(this.hass,labelsEn,labelsHu,m.mode)}</span>
            </button>`,
        )}<button
          class="action"
          @click=${() =>
            runAction(
              this,
              this.hass!,
              { action: "more-info" },
              this.config!.entity,
            )}
        >
          <ha-icon icon="mdi:tune-variant"></ha-icon
          ><span>${localize(this.hass, "details")}</span>
        </button></span
      ></ha-card
    >`;
  }

  private renderThermostat() {
    const hass = this.hass!, config = this.config!;
    const summary = thermostatSummary(hass.states[config.entity]);
    const tone = summary.active ? "var(--warning-color)" : "var(--secondary-text-color)";
    const format = (value: number | undefined) => value === undefined ? "—" : value.toLocaleString(hass.locale?.language || "en", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const unit = hass.config?.unit_system?.temperature || "°C";
    const name = config.name || localized(hass, "Heating", "Fűtés");
    return html`<ha-card class="thermostat-shell"><button class="thermostat" style=${`--tone:${tone};--mix:${summary.active?'13%':'1.5%'};--border-mix:${summary.active?'22%':'7%'};--shadow-mix:${summary.active?'12%':'2%'};--icon-mix:${summary.active?'21%':'6%'}`}
      aria-label=${`${name} · ${localized(hass, summary.en, summary.hu)} · ${localized(hass, "Now", "Most")}: ${format(summary.current)} ${unit} · ${localized(hass, "Target", "Cél")}: ${format(summary.target)} ${unit} · ${localized(hass, "Settings", "Beállítások")}`}
      @click=${() => runAction(this, hass, { action: "more-info" }, config.entity)}>
      <span class="thermostat-icon"><ha-icon icon=${config.icon || "mdi:radiator"}></ha-icon></span>
      <span class="thermostat-copy"><span class="thermostat-header"><span class="name">${name}</span><span class="operation" title=${localized(hass, summary.en, summary.hu)}><ha-icon icon=${summary.icon}></ha-icon><span class="operation-text">${localized(hass, summary.en, summary.hu)}</span></span></span>
      <div class="temperatures">
        <div><span class="temperature-label">${localized(hass, "Now", "Most")}<span class="temperature-unit"> · ${unit}</span></span><span class="temperature-value">${format(summary.current)}</span></div>
        <div class="target"><span class="temperature-label">${localized(hass, "Target", "Cél")}<span class="temperature-unit"> · ${unit}</span></span><span class="temperature-value">${format(summary.target)}</span></div>
      </div></span>
    </button></ha-card>`;
  }
}
