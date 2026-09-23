import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { localized, localizedMap } from "../localize";
import { lumaTokens } from "../styles";
import type { HassEntity, HomeAssistant, LovelaceCard } from "../types";

interface Config {
  type: string;
  power_entity: string;
  duration_entity: string;
  start_entity: string;
  max_entity: string;
  stop_entity: string;
  ownership_entity: string;
  charge_now_armed_entity: string;
  charge_now_active_entity: string;
  charge_now_remaining_entity: string;
  charge_now_return_mode_entity: string;
  return_to_automatic_entity: string;
  title?: string;
}

@customElement("luma-ev-control-card")
export class LumaEvControlCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: Config;
  @state() private pending = "";
  @state() private busy = "";
  private confirmTimer?: number;

  static styles = [lumaTokens, css`
    ha-card{padding:5px;border:1px solid color-mix(in srgb,var(--primary-color) 13%,transparent);border-radius:22px;background:linear-gradient(145deg,color-mix(in srgb,var(--primary-color) 6%,var(--luma-surface)),var(--luma-surface) 72%);box-shadow:var(--luma-shadow)}
    .top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 10px 5px 12px}.title{font-size:14px;font-weight:var(--luma-weight-title)}
    .mode{display:flex;align-items:center;gap:6px;min-height:30px;padding:6px 11px;border-radius:999px;background:color-mix(in srgb,var(--tone) 10%,transparent);color:var(--tone);font-size:10px;font-weight:700}.mode ha-icon{--mdc-icon-size:15px}
    .page{padding:8px}.status{display:flex;align-items:center;gap:9px;min-height:34px;margin-bottom:8px;padding:8px 10px;border-radius:13px;background:color-mix(in srgb,var(--tone) 8%,transparent);color:var(--tone);font-size:10px;font-weight:680}.status ha-icon{--mdc-icon-size:18px}.status-copy{display:grid;gap:2px;min-width:0}.status-copy strong{color:var(--primary-text-color);font-size:11px}.status-copy small{overflow:hidden;color:var(--luma-muted);font-size:9px;font-weight:600;text-overflow:ellipsis;white-space:nowrap}
    .fields{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:8px}.field{display:grid;gap:7px;min-width:0;padding:10px;border-radius:15px;background:color-mix(in srgb,var(--primary-text-color) 4%,transparent)}.field-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.field label{overflow:hidden;color:var(--luma-muted);font-size:9px;font-weight:680;text-overflow:ellipsis;white-space:nowrap}.value{font-size:11px;font-weight:720}.field select{width:100%;height:32px;padding:0 9px;border:0;border-radius:10px;background:color-mix(in srgb,var(--primary-text-color) 7%,transparent);color:var(--primary-text-color);font:inherit;font-size:11px}.range-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:7px}.field input[type=range]{width:100%;height:22px;margin:0;accent-color:var(--primary-color);cursor:pointer}.preset{height:27px;padding:0 9px;border:0;border-radius:9px;background:color-mix(in srgb,var(--primary-color) 11%,transparent);color:var(--primary-color);font:inherit;font-size:9px;font-weight:760;cursor:pointer;transition:.17s ease}.preset:hover:not(:disabled){background:color-mix(in srgb,var(--primary-color) 18%,transparent)}.preset:disabled{cursor:default;opacity:.45}
    .actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px}.single-actions{grid-template-columns:1fr}.action{display:flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:9px 12px;border:1px solid color-mix(in srgb,var(--tone) 16%,transparent);border-radius:15px;background:color-mix(in srgb,var(--tone) 8%,transparent);color:var(--primary-text-color);font:inherit;font-size:11px;font-weight:720;cursor:pointer;transition:.17s ease}.action ha-icon{--mdc-icon-size:19px;color:var(--tone)}.action:hover:not(:disabled){transform:translateY(-1px);background:color-mix(in srgb,var(--tone) 13%,transparent)}.action:disabled{cursor:default;opacity:.42}.action.confirm{--tone:var(--warning-color)}
    @media(max-width:650px){.top{padding:9px 8px 5px}.fields{grid-template-columns:1fr}.actions{grid-template-columns:1fr}.status-copy small{white-space:normal}}
  `];

  setConfig(config: Config) {
    const required: Array<keyof Config> = [
      "power_entity", "duration_entity", "start_entity",
      "max_entity", "stop_entity", "ownership_entity",
      "charge_now_armed_entity", "charge_now_active_entity",
      "charge_now_remaining_entity", "charge_now_return_mode_entity",
      "return_to_automatic_entity",
    ];
    if (!config || required.some((key) => !config[key])) throw Error("EV control lifecycle entities required");
    this.config = config;
  }

  getCardSize() { return 4; }
  private entity(id: string): HassEntity | undefined { return this.hass?.states[id]; }
  private isOn(id: string) { return this.entity(id)?.state === "on"; }
  private armed() { return this.isOn(this.config!.charge_now_armed_entity); }
  private chargeNowActive() { return this.isOn(this.config!.charge_now_active_entity); }
  private activeTransaction() {
    const value = this.entity(this.config!.ownership_entity)?.state;
    return Boolean(value && value !== "unknown" && value !== "unavailable");
  }
  private ownership() { return this.entity(this.config!.ownership_entity)?.state || "unknown"; }
  private modeLabel(value: string) {
    if (!value || value === "unknown" || value === "unavailable") {
      return localized(this.hass, "the selected base mode", "a kiválasztott alapmód");
    }
    return localizedMap(this.hass,
      { Off: "the Off mode", Solar: "Solar control", Always: "Always charge mode" },
      { Off: "a kikapcsolt mód", Solar: "a Solar vezérlés", Always: "a Mindig tölts mód" }, value);
  }
  private durationOption(value: string) {
    return localizedMap(this.hass,
      { "Until stopped": "Until stopped", "30 minutes": "30 minutes", "1 hour": "1 hour", "2 hours": "2 hours" },
      { "Until stopped": "Leállításig", "30 minutes": "30 perc", "1 hour": "1 óra", "2 hours": "2 óra" }, value);
  }
  private async service(domain: string, service: string, entity_id: string, data: Record<string, unknown> = {}) {
    if (this.hass) await this.hass.callService(domain, service, data, { entity_id });
  }
  private async setSelect(entity: string, event: Event) {
    await this.service("select", "select_option", entity, { option: (event.target as HTMLSelectElement).value });
  }
  private async setNumber(entity: string, event: Event) {
    await this.service("number", "set_value", entity, { value: Number((event.target as HTMLInputElement).value) });
  }
  private press(key: string, entity: string) {
    this.busy = key;
    void this.service("button", "press", entity).finally(() => this.busy = "");
  }
  private confirm(key: string, entity: string) {
    if (this.pending !== key) {
      this.pending = key;
      clearTimeout(this.confirmTimer);
      this.confirmTimer = window.setTimeout(() => this.pending = "", 3200);
      return;
    }
    this.pending = "";
    this.press(key, entity);
  }

  render() {
    if (!this.hass || !this.config) return nothing;
    const active = this.chargeNowActive();
    const armed = this.armed();
    const transaction = this.activeTransaction();
    const tone = active ? "var(--success-color)" : armed ? "var(--warning-color)" : "var(--primary-color)";
    const label = active
      ? localized(this.hass, "Charge Now", "Töltés most")
      : armed
        ? localized(this.hass, "Armed", "Élesítve")
        : transaction
          ? localized(this.hass, "Base mode charging", "Alapmód szerinti töltés")
          : localized(this.hass, "Ready", "Készen áll");
    return html`<ha-card><div class="top"><span class="title">${this.config.title || localized(this.hass, "Charging control", "Töltésvezérlés")}</span><span class="mode" style=${`--tone:${tone}`}><ha-icon icon=${active ? "mdi:flash" : armed ? "mdi:timer-sand" : transaction ? "mdi:solar-power" : "mdi:ev-station"}></ha-icon>${label}</span></div>${this.controlPage()}</ha-card>`;
  }

  private controlPage() {
    const active = this.chargeNowActive();
    const armed = this.armed();
    const transaction = this.activeTransaction();
    const ownership = this.ownership();
    const power = this.entity(this.config!.power_entity);
    const duration = this.entity(this.config!.duration_entity);
    const returnMode = this.entity(this.config!.charge_now_return_mode_entity)?.state;
    const remaining = this.remainingText();
    let icon = "mdi:ev-station";
    let tone = "var(--primary-color)";
    let title = localized(this.hass, "Charge when you need it", "Tölts, amikor szükséged van rá");
    let detail = localized(this.hass, "Choose a limit and duration, then start Charge Now", "Állíts be limitet és időtartamot, majd indítsd a Töltés most módot");
    if (active) {
      icon = "mdi:flash";
      tone = "var(--success-color)";
      title = localized(this.hass, "Charge Now is active", "A Töltés most aktív");
      detail = remaining
        ? localized(this.hass, `${remaining} remaining, then ${this.modeLabel(returnMode || "")} takes over`, `${remaining} van hátra, utána ${this.modeLabel(returnMode || "")} veszi át a vezérlést`)
        : localized(this.hass, "Runs until stopped; power changes apply immediately", "Leállításig fut; a teljesítmény módosítása azonnal érvényesül");
    } else if (armed) {
      icon = "mdi:timer-sand";
      tone = "var(--warning-color)";
      title = localized(this.hass, "Charge Now is armed", "A Töltés most élesítve");
      detail = localized(this.hass, "Waiting for the vehicle; the timer has not started", "Az autóra vár; az időzítő még nem indult el");
    } else if (transaction) {
      icon = ownership === "solar" ? "mdi:solar-power" : "mdi:car-connected";
      tone = "var(--success-color)";
      title = ownership === "solar"
        ? localized(this.hass, "Solar is controlling this session", "A sessiont a Solar vezérli")
        : localized(this.hass, "An external session is active", "Külső session van folyamatban");
      detail = localized(this.hass, "Charge Now can take over without restarting the session", "A Töltés most a session újraindítása nélkül átveheti a vezérlést");
    }
    return html`<div class="page"><div class="status" style=${`--tone:${tone}`}><ha-icon icon=${icon}></ha-icon><span class="status-copy"><strong>${title}</strong><small>${detail}</small></span></div><div class="fields">${this.numberField(localized(this.hass, "Power limit", "Teljesítménylimit"), this.config!.power_entity, power, this.config!.max_entity)}${this.durationField(duration)}</div>${this.actions(active, armed, transaction)}</div>`;
  }

  private durationField(duration?: HassEntity) {
    const options = (duration?.attributes.options as string[] | undefined) || [];
    return html`<div class="field"><div class="field-head"><label>${localized(this.hass, "Duration", "Időtartam")}</label><span class="value">${this.durationOption(duration?.state || "")}</span></div><select @change=${(event: Event) => this.setSelect(this.config!.duration_entity, event)}>${options.map((item) => html`<option value=${item} ?selected=${item === duration?.state}>${this.durationOption(item)}</option>`)}</select></div>`;
  }

  private actions(active: boolean, armed: boolean, transaction: boolean) {
    if (active) return html`<div class="actions">${this.action("automatic", this.config!.return_to_automatic_entity, "mdi:backup-restore", localized(this.hass, "Return to base mode", "Vissza az alapmódhoz"), "var(--primary-color)", false)}${this.action("stop", this.config!.stop_entity, "mdi:stop", localized(this.hass, "Stop charging", "Töltés leállítása"), "var(--error-color)", false)}</div>`;
    if (armed) return html`<div class="actions single-actions">${this.action("cancel", this.config!.return_to_automatic_entity, "mdi:close-circle-outline", localized(this.hass, "Cancel override", "Felülbírálás megszakítása"), "var(--primary-color)", false)}</div>`;
    const label = transaction ? localized(this.hass, "Take over with Charge Now", "Átvétel Töltés most móddal") : localized(this.hass, "Start Charge Now", "Töltés most indítása");
    return html`<div class=${`actions ${transaction ? "" : "single-actions"}`}>${this.action("start", this.config!.start_entity, "mdi:play", label, "var(--success-color)", false)}${transaction ? this.action("stop", this.config!.stop_entity, "mdi:stop", localized(this.hass, "Stop charging", "Töltés leállítása"), "var(--error-color)", false) : nothing}</div>`;
  }

  private remainingText() {
    const state = this.entity(this.config!.charge_now_remaining_entity)?.state;
    const seconds = Number(state);
    if (!state || state === "unknown" || state === "unavailable" || !Number.isFinite(seconds)) return "";
    const minutes = Math.max(0, Math.ceil(seconds / 60));
    if (minutes < 60) return localized(this.hass, `${minutes} min`, `${minutes} perc`);
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? localized(this.hass, `${hours} h ${rest} min`, `${hours} óra ${rest} perc`) : localized(this.hass, `${hours} h`, `${hours} óra`);
  }

  private numberField(label: string, entity: string, state?: HassEntity, presetEntity?: string) {
    const min = Number(state?.attributes.min ?? 0), max = Number(state?.attributes.max ?? 11000), step = Number(state?.attributes.step ?? 100), value = Number(state?.state) || min;
    const unit = String(state?.attributes.unit_of_measurement || "W");
    return html`<div class="field"><div class="field-head"><label>${label}</label><span class="value">${value.toLocaleString(this.hass?.locale?.language || undefined)} ${unit}</span></div><div class="range-row"><input type="range" min=${min} max=${max} step=${step} .value=${String(value)} @change=${(event: Event) => this.setNumber(entity, event)}>${presetEntity ? html`<button class="preset" ?disabled=${this.busy === "max"} @click=${() => this.press("max", presetEntity)}>MAX</button>` : nothing}</div></div>`;
  }

  private action(key: string, entity: string, icon: string, label: string, tone: string, disabled: boolean) {
    const confirming = this.pending === key;
    return html`<button class=${`action ${confirming ? "confirm" : ""}`} style=${`--tone:${tone}`} ?disabled=${disabled || this.busy === key} @click=${() => this.confirm(key, entity)}><ha-icon icon=${this.busy === key ? "mdi:loading" : confirming ? "mdi:check" : icon}></ha-icon>${confirming ? localized(this.hass, "Tap again to confirm", "Koppints újra a megerősítéshez") : label}</button>`;
  }
}
