import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { localized, localizedMap } from "../localize";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LovelaceCard } from "../types";

interface Config {
  type: string;
  entity: string;
  title?: string;
}

const ICONS: Record<string, string> = {
  Off: "mdi:power",
  Solar: "mdi:solar-power",
  Always: "mdi:ev-plug-type2",
};

@customElement("luma-ev-mode-card")
export class LumaEvModeCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: Config;
  @state() private pending = "";
  @state() private busy = false;
  private confirmTimer?: number;

  static styles = [lumaTokens, css`
    ha-card{display:grid;grid-template-columns:minmax(220px,1fr) minmax(330px,.9fr);align-items:center;gap:18px;padding:14px 16px;border:1px solid color-mix(in srgb,var(--primary-color) 13%,transparent);border-radius:22px;background:linear-gradient(135deg,color-mix(in srgb,var(--primary-color) 7%,var(--luma-surface)),var(--luma-surface) 70%);box-shadow:var(--luma-shadow)}
    .summary{display:flex;align-items:center;gap:12px;min-width:0}.summary-icon{display:grid;place-items:center;flex:0 0 42px;height:42px;border-radius:15px;background:color-mix(in srgb,var(--tone) 12%,transparent);color:var(--tone)}.summary-icon ha-icon{--mdc-icon-size:22px}.copy{display:grid;gap:3px;min-width:0}.title{font-size:13px;font-weight:var(--luma-weight-title)}.description{overflow:hidden;color:var(--luma-muted);font-size:10px;font-weight:590;text-overflow:ellipsis;white-space:nowrap}
    .modes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;padding:4px;border-radius:16px;background:color-mix(in srgb,var(--primary-text-color) 4%,transparent)}.mode{display:flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:8px 9px;border:1px solid transparent;border-radius:12px;background:transparent;color:var(--luma-muted);font:inherit;font-size:10px;font-weight:720;cursor:pointer;transition:.17s ease}.mode ha-icon{--mdc-icon-size:17px}.mode:hover:not(:disabled){background:color-mix(in srgb,var(--primary-color) 7%,transparent);color:var(--primary-text-color)}.mode.selected{border-color:color-mix(in srgb,var(--tone) 18%,transparent);background:color-mix(in srgb,var(--tone) 11%,transparent);color:var(--tone)}.mode.confirm{--tone:var(--warning-color);border-color:color-mix(in srgb,var(--warning-color) 25%,transparent);background:color-mix(in srgb,var(--warning-color) 12%,transparent);color:var(--warning-color)}.mode:disabled{cursor:default;opacity:.55}
    @media(max-width:700px){ha-card{grid-template-columns:1fr;gap:12px;padding:13px}.description{white-space:normal}.mode{min-height:43px;padding:7px 5px;font-size:9px}}
  `];

  setConfig(config: Config) {
    if (!config?.entity) throw Error("EV base mode entity required");
    this.config = config;
  }

  getCardSize() { return 2; }

  private label(value: string) {
    return localizedMap(this.hass,
      { Off: "Off", Solar: "Solar", Always: "Always charge" },
      { Off: "Kikapcsolva", Solar: "Napelemes", Always: "Mindig tölts" }, value);
  }

  private description(value: string) {
    if (this.pending) return localized(this.hass, `Tap ${this.label(this.pending)} again to confirm`, `Koppints újra: ${this.label(this.pending)}`);
    if (value === "Always") return localized(this.hass, "Charging starts whenever the vehicle is plugged in", "A töltés minden csatlakoztatáskor automatikusan elindul");
    if (value === "Solar") return localized(this.hass, "Charging starts when the adaptive Solar policy allows it", "A töltés az adaptív Solar feltételek teljesülésekor indul");
    return localized(this.hass, "Automatic charging is disabled", "Az automatikus töltés ki van kapcsolva");
  }

  private select(value: string, current: string) {
    if (!this.hass || !this.config || value === current || this.busy) return;
    if (this.pending !== value) {
      this.pending = value;
      clearTimeout(this.confirmTimer);
      this.confirmTimer = window.setTimeout(() => this.pending = "", 3500);
      return;
    }
    this.pending = "";
    this.busy = true;
    void this.hass.callService("select", "select_option", { option: value }, { entity_id: this.config.entity }).finally(() => this.busy = false);
  }

  render() {
    if (!this.hass || !this.config) return nothing;
    const state = this.hass.states[this.config.entity];
    const current = state?.state || "unknown";
    const options = (state?.attributes.options as string[] | undefined) || ["Off", "Solar", "Always"];
    const tone = current === "Always" ? "var(--success-color)" : current === "Solar" ? "var(--primary-color)" : "var(--luma-muted)";
    return html`<ha-card style=${`--tone:${tone}`}>
      <div class="summary"><span class="summary-icon"><ha-icon icon=${ICONS[current] || "mdi:ev-station"}></ha-icon></span><span class="copy"><span class="title">${this.config.title || localized(this.hass, "Default charging mode", "Alapértelmezett töltési mód")}</span><span class="description">${this.description(current)}</span></span></div>
      <div class="modes">${options.map((value) => html`<button class=${`mode ${value === current ? "selected" : ""} ${value === this.pending ? "confirm" : ""}`} style=${`--tone:${value === "Always" ? "var(--success-color)" : value === "Solar" ? "var(--primary-color)" : "var(--luma-muted)"}`} ?disabled=${this.busy} @click=${() => this.select(value, current)}><ha-icon icon=${value === this.pending ? "mdi:check" : ICONS[value] || "mdi:circle-outline"}></ha-icon>${this.label(value)}</button>`)}</div>
    </ha-card>`;
  }
}
