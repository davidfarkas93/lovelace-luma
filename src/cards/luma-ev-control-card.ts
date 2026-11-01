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
  language?: string;
  hide_stop?: boolean;
}

@customElement("luma-ev-control-card")
export class LumaEvControlCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: Config;
  @state() private pending = "";
  @state() private busy = "";
  private confirmTimer?: number;
  @state() private error = "";
  @state() private powerValid = true;

  static styles = [lumaTokens, css`
    ha-card{padding:5px;border:1px solid color-mix(in srgb,var(--primary-color) 13%,transparent);border-radius:22px;background:linear-gradient(145deg,color-mix(in srgb,var(--primary-color) 6%,var(--luma-surface)),var(--luma-surface) 72%);box-shadow:var(--luma-shadow)}
    .top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 10px 5px 12px}.title{font-size:14px;font-weight:var(--luma-weight-title)}
    .mode{display:flex;align-items:center;gap:6px;min-height:30px;padding:6px 11px;border-radius:999px;background:color-mix(in srgb,var(--tone) 10%,transparent);color:var(--tone);font-size:10px;font-weight:700}.mode ha-icon{--mdc-icon-size:15px}
    .page{padding:8px}.status{display:flex;align-items:center;gap:9px;min-height:34px;margin-bottom:8px;padding:8px 10px;border-radius:13px;background:color-mix(in srgb,var(--tone) 8%,transparent);color:var(--tone);font-size:10px;font-weight:680}.status ha-icon{--mdc-icon-size:18px}.status-copy{display:grid;gap:2px;min-width:0}.status-copy strong{color:var(--primary-text-color);font-size:11px}.status-copy small{overflow:hidden;color:var(--luma-muted);font-size:9px;font-weight:600;text-overflow:ellipsis;white-space:nowrap}
    .fields{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:8px}.field{display:grid;gap:7px;min-width:0;padding:10px;border-radius:15px;background:color-mix(in srgb,var(--primary-text-color) 4%,transparent)}.field-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.field label{overflow:hidden;color:var(--luma-muted);font-size:9px;font-weight:680;text-overflow:ellipsis;white-space:nowrap}.value{font-size:11px;font-weight:720}.field select{width:100%;height:32px;padding:0 9px;border:0;border-radius:10px;background:color-mix(in srgb,var(--primary-text-color) 7%,transparent);color:var(--primary-text-color);font:inherit;font-size:11px}.range-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:7px}.field input[type=range]{width:100%;height:22px;margin:0;accent-color:var(--primary-color);cursor:pointer}.preset{height:27px;padding:0 9px;border:0;border-radius:9px;background:color-mix(in srgb,var(--primary-color) 11%,transparent);color:var(--primary-color);font:inherit;font-size:9px;font-weight:760;cursor:pointer;transition:.17s ease}.preset:hover:not(:disabled){background:color-mix(in srgb,var(--primary-color) 18%,transparent)}.preset:disabled{cursor:default;opacity:.45}
    .actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px}.single-actions{grid-template-columns:1fr}.action{display:flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:9px 12px;border:1px solid color-mix(in srgb,var(--tone) 16%,transparent);border-radius:15px;background:color-mix(in srgb,var(--tone) 8%,transparent);color:var(--primary-text-color);font:inherit;font-size:11px;font-weight:720;cursor:pointer;transition:.17s ease}.action ha-icon{--mdc-icon-size:19px;color:var(--tone)}.action:hover:not(:disabled){transform:translateY(-1px);background:color-mix(in srgb,var(--tone) 13%,transparent)}.action:disabled{cursor:default;opacity:.42}.action.confirm{--tone:var(--warning-color)}
    :host{display:block;container-type:inline-size}.field input[type=number]{box-sizing:border-box;min-width:0;width:100%;min-height:44px;padding:7px 10px;border:1px solid var(--luma-border);border-radius:10px;background:var(--luma-surface);color:var(--primary-text-color);font:inherit;font-size:22px;font-weight:750}.power-entry{display:flex;align-items:center;gap:8px}.power-entry span{font-size:13px;color:var(--luma-muted)}.hint{margin:0 0 12px;color:var(--luma-muted);font-size:12px;line-height:1.5}.status-copy small{white-space:normal}.field label{font-size:11px}.field select{height:44px;font-size:13px}.error{padding:8px;color:var(--error-color);font-size:12px}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--primary-color);outline-offset:2px}
    @container(max-width:440px){.top{padding:9px 8px 5px}.fields{grid-template-columns:1fr}.actions{grid-template-columns:1fr}}
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

  private get languageHass() {
    return this.config?.language && this.hass ? { ...this.hass, locale: { ...this.hass.locale, language: this.config.language } } : this.hass;
  }

  getCardSize() { return 4; }
  disconnectedCallback() { super.disconnectedCallback(); clearTimeout(this.confirmTimer); }
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
      return localized(this.languageHass, "the selected base mode", "a kiválasztott alapmód");
    }
    return localizedMap(this.languageHass,
      { Off: "the Off mode", Solar: "Solar control", Always: "Always charge mode" },
      { Off: "a kikapcsolt mód", Solar: "a Solar vezérlés", Always: "a Mindig tölts mód" }, value);
  }
  private durationOption(value: string) {
    return localizedMap(this.languageHass,
      { "Until stopped": "Until stopped", "30 minutes": "30 minutes", "1 hour": "1 hour", "2 hours": "2 hours" },
      { "Until stopped": "Leállításig", "30 minutes": "30 perc", "1 hour": "1 óra", "2 hours": "2 óra" }, value);
  }
  private async service(domain: string, service: string, entity_id: string, data: Record<string, unknown> = {}) {
    this.error = "";
    try { if (this.hass) await this.hass.callService(domain, service, data, { entity_id }); }
    catch { this.error = localized(this.languageHass,"Could not apply the change. Try again.","Nem sikerült alkalmazni a módosítást. Próbáld újra."); }
  }
  private async setSelect(entity: string, event: Event) {
    this.busy = "settings";
    try { await this.service("select", "select_option", entity, { option: (event.target as HTMLSelectElement).value }); }
    finally { this.busy = ""; }
  }
  private async setNumber(entity: string, event: Event, scale = 1) {
    const input = event.target as HTMLInputElement;
    if (!input.value.trim() || !input.checkValidity()) { input.reportValidity(); return; }
    const state = this.entity(entity);
    const value = Number(input.value) * scale;
    if (!state || !Number.isFinite(value) || value < Number(state.attributes.min) || value > Number(state.attributes.max)) return;
    this.busy = "settings";
    try { await this.service("number", "set_value", entity, { value }); }
    finally { this.busy = ""; }
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
    return html`<ha-card><div class="top"><span class="title">${this.config.title || localized(this.languageHass, "Charge Now", "Töltés most")}</span></div>${this.controlPage()}${this.error ? html`<div class="error" role="alert">${this.error}</div>` : nothing}</ha-card>`;
  }

  private controlPage() {
    const active = this.chargeNowActive();
    const armed = this.armed();
    const transaction = this.activeTransaction();
    const power = this.entity(this.config!.power_entity);
    const duration = this.entity(this.config!.duration_entity);
    const returnMode = this.entity(this.config!.charge_now_return_mode_entity)?.state;
    const remaining = this.remainingText();
    let icon = "mdi:ev-station";
    let tone = "var(--primary-color)";
    let title = localized(this.languageHass, "Charge when you need it", "Tölts, amikor szükséged van rá");
    let detail = localized(this.languageHass, "Choose a limit and duration, then start Charge Now", "Állíts be limitet és időtartamot, majd indítsd a Töltés most módot");
    if (active) {
      icon = "mdi:flash";
      tone = "var(--success-color)";
      title = localized(this.languageHass, "Charge Now is active", "A Töltés most aktív");
      detail = remaining
        ? localized(this.languageHass, `${remaining} remaining, then ${this.modeLabel(returnMode || "")} takes over`, `${remaining} van hátra, utána ${this.modeLabel(returnMode || "")} veszi át a vezérlést`)
        : localized(this.languageHass, "Runs until stopped; power changes apply immediately", "Leállításig fut; a teljesítmény módosítása azonnal érvényesül");
    } else if (armed) {
      icon = "mdi:timer-sand";
      tone = "var(--warning-color)";
      title = localized(this.languageHass, "Charge Now is armed", "A Töltés most élesítve");
      detail = localized(this.languageHass, "Waiting for the vehicle; the timer has not started", "Az autóra vár; az időzítő még nem indult el");
    }
    return html`<div class="page">${active || armed ? html`<div class="status" style=${`--tone:${tone}`}><ha-icon icon=${icon}></ha-icon><span class="status-copy"><strong>${title}</strong><small>${detail}</small></span></div>` : html`<p class="hint">${transaction ? localized(this.languageHass,"Change power without interrupting charging.","Válts teljesítményt a töltés megszakítása nélkül.") : localized(this.languageHass,"Choose power and duration, then start.","Válassz teljesítményt és időtartamot, majd indíts.")}</p>`}<div class="fields">${this.numberField(localized(this.languageHass, "Power limit", "Teljesítménylimit"), this.config!.power_entity, power, this.config!.max_entity)}${this.durationField(duration)}</div>${this.actions(active, armed, transaction)}</div>`;
  }

  private durationField(duration?: HassEntity) {
    const options = (duration?.attributes.options as string[] | undefined) || [];
    const available = duration && !["unknown","unavailable"].includes(duration.state) && duration.attributes.restored !== true;
    return html`<div class="field"><label for="duration">${localized(this.languageHass, "Duration", "Időtartam")}</label><select id="duration" ?disabled=${!available} @change=${(event: Event) => this.setSelect(this.config!.duration_entity, event)}>${!available ? html`<option>${localized(this.languageHass,"Unavailable","Nem elérhető")}</option>` : options.map((item) => html`<option value=${item} ?selected=${item === duration?.state}>${this.durationOption(item)}</option>`)}</select></div>`;
  }

  private actions(active: boolean, armed: boolean, transaction: boolean) {
    const stop = !this.config!.hide_stop && transaction ? this.action("stop", this.config!.stop_entity, "mdi:stop", localized(this.languageHass,"Stop charging","Töltés leállítása"),"var(--error-color)",false) : nothing;
    if (active) return html`<div class=${`actions ${this.config!.hide_stop ? "single-actions" : ""}`}>${this.action("automatic", this.config!.return_to_automatic_entity, "mdi:backup-restore", localized(this.languageHass, "Return to base mode", "Vissza az alapmódhoz"), "var(--primary-color)", false)}${stop}</div>`;
    if (armed) return html`<div class="actions single-actions">${this.action("cancel", this.config!.return_to_automatic_entity, "mdi:close-circle-outline", localized(this.languageHass, "Cancel override", "Felülbírálás megszakítása"), "var(--primary-color)", false)}</div>`;
    const label = transaction ? localized(this.languageHass,"Apply Charge Now","Töltés most alkalmazása") : localized(this.languageHass,"Start charging","Töltés indítása");
    const ready = this.powerValid && !this.error && [this.config!.power_entity,this.config!.duration_entity].every(id=>{const e=this.entity(id);return e && !["unknown","unavailable"].includes(e.state) && e.attributes.restored !== true;});
    return html`<div class=${`actions ${transaction && !this.config!.hide_stop ? "" : "single-actions"}`}>${this.action("start", this.config!.start_entity, "mdi:play", label, "var(--success-color)", !ready)}${stop}</div>`;
  }

  private remainingText() {
    const state = this.entity(this.config!.charge_now_remaining_entity)?.state;
    const seconds = Number(state);
    if (!state || state === "unknown" || state === "unavailable" || !Number.isFinite(seconds)) return "";
    const minutes = Math.max(0, Math.ceil(seconds / 60));
    if (minutes < 60) return localized(this.languageHass, `${minutes} min`, `${minutes} perc`);
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? localized(this.languageHass, `${hours} h ${rest} min`, `${hours} óra ${rest} perc`) : localized(this.languageHass, `${hours} h`, `${hours} óra`);
  }

  private numberField(label: string, entity: string, state?: HassEntity, presetEntity?: string) {
    const available = state && !["unknown","unavailable"].includes(state.state) && state.attributes.restored !== true && Number.isFinite(Number(state.state));
    const scale = state?.attributes.unit_of_measurement === "kW" ? 1 : 1000;
    const min = Number(state?.attributes.min ?? 0)/scale, max = Number(state?.attributes.max ?? 11000)/scale, step = Number(state?.attributes.step ?? 100)/scale;
    return html`<div class="field"><div class="field-head"><label for="power">${label}</label>${presetEntity ? html`<button class="preset" ?disabled=${!available || Boolean(this.busy)} @click=${() => this.press("max", presetEntity)}>MAX</button>` : nothing}</div><div class="power-entry"><input id="power" type="number" inputmode="decimal" required min=${min} max=${max} step=${step} .value=${available ? String(Number(state.state)/scale) : ""} placeholder="—" ?disabled=${!available} @input=${(event: Event)=>this.powerValid=(event.target as HTMLInputElement).checkValidity()} @change=${(event: Event)=>this.setNumber(entity,event,scale)}><span>kW</span></div></div>`;
  }

  private action(key: string, entity: string, icon: string, label: string, tone: string, disabled: boolean) {
    const confirming = this.pending === key;
    return html`<button class=${`action ${confirming ? "confirm" : ""}`} style=${`--tone:${tone}`} ?disabled=${disabled || Boolean(this.busy)} @click=${() => this.confirm(key, entity)}><ha-icon icon=${this.busy === key ? "mdi:loading" : confirming ? "mdi:check" : icon}></ha-icon>${confirming ? localized(this.languageHass, "Tap again to confirm", "Koppints újra a megerősítéshez") : label}</button>`;
  }
}
