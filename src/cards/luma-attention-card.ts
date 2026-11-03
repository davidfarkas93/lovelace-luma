import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import { activeAttention, attentionAckValue, attentionCoverageRows, attentionSummaries, type AttentionEntry } from "../attention";
import { AttentionSubscription, attentionPolicy, dismissAttentionNotification, policyRows } from "../attention-runtime";
import { localized } from "../localize";
import { runAction } from "../helpers";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LovelaceCard } from "../types";
import "./luma-update-card";
import "../components/luma-bottom-sheet";

interface Config {
  type: string;
  policy: string;
  scope?: string;
  mode?: "incidents" | "updates" | "diagnostics";
  title?: string;
  /** The containing popup already supplies the surface and heading. */
  embedded?: boolean;
}

@customElement("luma-attention-card")
export class LumaAttentionCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: Config;
  @state() private query = "";
  @state() private filter = "active";
  @state() private selected?: string;
  @state() private detailsOpen = false;
  @state() private limit = 50;
  @state() private saving = false;
  @state() private error = "";
  private subscription = new AttentionSubscription(() => this.requestUpdate());

  static styles = [lumaTokens, css`
    :host{min-width:0;container-type:inline-size}
    ha-card{padding:20px;border:1px solid var(--luma-border);border-radius:var(--luma-radius-card);background:var(--luma-surface);box-shadow:var(--luma-shadow)}
    ha-card.embedded{padding:0;border:0;border-radius:0;background:transparent;box-shadow:none;overflow:visible}
    .header{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px}
    .header-main{display:flex;align-items:center;gap:12px;min-width:0}
    .header-main>.icon{--tone:var(--primary-color);width:42px;height:42px;flex:0 0 42px}
    .title{font-size:var(--luma-text-lg);font-weight:var(--luma-weight-title);line-height:1.3}
    .subtitle,.muted{font-size:var(--luma-text-sm);line-height:1.55;color:var(--luma-muted)}
    .subtitle{margin-top:3px}.summary{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
    .pill{display:inline-flex;align-items:center;justify-content:center;gap:6px;max-width:100%;border:1px solid transparent;border-radius:999px;padding:6px 10px;background:color-mix(in srgb,var(--tone) 10%,transparent);color:var(--tone);font:inherit;font-size:11px;font-weight:var(--luma-weight-strong);line-height:1.4;white-space:normal}
    button.pill{min-height:36px;cursor:pointer}.pill[aria-pressed=true]{border-color:color-mix(in srgb,var(--tone) 40%,transparent)}.pill ha-icon{--mdc-icon-size:15px;flex-shrink:0}
    .toolbar{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
    .field{display:flex;align-items:center;gap:9px;min-width:0;min-height:44px;padding:0 13px;border:1px solid var(--luma-border);border-radius:var(--luma-radius-control);background:color-mix(in srgb,var(--primary-text-color) 3%,transparent);color:var(--luma-muted)}
    .search{flex:1 1 220px}.view{flex:0 1 210px}.field ha-icon{--mdc-icon-size:19px;flex-shrink:0}.field:focus-within{outline:2px solid var(--primary-color);outline-offset:2px}
    input,select{width:100%;min-width:0;min-height:44px;padding:0;border:0;outline:0;background:transparent;color:var(--primary-text-color);font:inherit;font-size:var(--luma-text-sm)}select{cursor:pointer}option{background:var(--luma-surface);color:var(--primary-text-color)}input::placeholder{color:var(--luma-muted)}
    .list{display:grid;gap:8px}.item{display:grid;grid-template-columns:40px minmax(0,1fr) auto 16px;align-items:center;gap:12px;width:100%;min-width:0;padding:14px;border:1px solid color-mix(in srgb,var(--tone) 13%,var(--luma-border));border-radius:var(--luma-radius-control);background:linear-gradient(125deg,color-mix(in srgb,var(--tone) 6%,var(--luma-surface)),var(--luma-surface) 85%);color:var(--primary-text-color);font:inherit;text-align:left;cursor:pointer;transition:border-color .16s,background .16s}
    .item:hover{border-color:color-mix(in srgb,var(--tone) 35%,transparent)}
    .icon{display:grid;place-items:center;width:40px;height:40px;border-radius:var(--luma-radius-control);background:color-mix(in srgb,var(--tone) 12%,transparent);color:var(--tone)}.icon ha-icon{--mdc-icon-size:22px}
    .copy{min-width:0}.name{display:block;font-size:var(--luma-text-md);font-weight:var(--luma-weight-title);line-height:1.4;overflow-wrap:anywhere}.message{display:block;margin-top:4px;font-size:var(--luma-text-sm);color:var(--luma-muted);line-height:1.55;white-space:pre-line;overflow-wrap:anywhere}.chevron{--mdc-icon-size:17px;color:var(--luma-muted)}
    .group-header{display:flex;align-items:center;gap:10px;margin:22px 0 10px;font-size:var(--luma-text-sm);font-weight:var(--luma-weight-title);color:var(--luma-muted)}.group-header:first-child{margin-top:0}.group-header::after{content:"";height:1px;flex:1;background:var(--luma-border)}
    .updates{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .empty{display:grid;justify-items:center;gap:8px;padding:32px 18px;text-align:center}.empty>.icon{width:48px;height:48px;margin-bottom:4px}.empty strong{font-size:var(--luma-text-md);font-weight:var(--luma-weight-title)}.empty p{max-width:440px;margin:0;font-size:var(--luma-text-sm);line-height:1.6;color:var(--luma-muted)}
    .action{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:44px;padding:10px 15px;border:1px solid color-mix(in srgb,var(--primary-color) 18%,transparent);border-radius:999px;background:color-mix(in srgb,var(--primary-color) 9%,transparent);color:var(--primary-color);font:inherit;font-size:var(--luma-text-sm);font-weight:var(--luma-weight-strong);cursor:pointer}.action ha-icon{--mdc-icon-size:18px}.action.secondary{color:var(--luma-muted);background:transparent;border-color:var(--luma-border)}.action:disabled{opacity:.5;cursor:default}.more{margin-top:14px;width:100%}
    .detail{display:grid;gap:18px;min-width:0}.detail-status{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.detail-message{margin:0;font-size:var(--luma-text-md);line-height:1.7;white-space:pre-line;overflow-wrap:anywhere}.explanation{margin:0;padding:14px 16px;border-left:2px solid color-mix(in srgb,var(--primary-color) 35%,transparent);border-radius:0 var(--luma-radius-control) var(--luma-radius-control) 0;background:color-mix(in srgb,var(--primary-color) 4%,transparent);color:var(--luma-muted);font-size:var(--luma-text-sm);line-height:1.6}.actions{display:flex;gap:8px;flex-wrap:wrap}
    .context{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.context-item{min-width:0;padding:14px;border:1px solid var(--luma-border);border-radius:var(--luma-radius-control);background:color-mix(in srgb,var(--primary-color) 4%,transparent);color:var(--primary-text-color);font:inherit;text-align:left;overflow-wrap:anywhere}.context-item span{display:block;font-size:11px;color:var(--luma-muted);line-height:1.5}.context-item strong{display:block;margin-top:6px;font-size:var(--luma-text-md);font-weight:var(--luma-weight-strong);line-height:1.5}button.context-item{cursor:pointer;min-height:44px}
    .context>div{grid-column:1/-1}
    .technical{border-top:1px solid var(--luma-border);padding-top:14px}.technical summary{display:flex;align-items:center;gap:8px;min-height:44px;color:var(--luma-muted);font-size:var(--luma-text-sm);font-weight:var(--luma-weight-strong);cursor:pointer}.technical summary::after{content:"+";margin-left:auto;font-size:18px}.technical[open] summary::after{content:"−"}.technical summary ha-icon{--mdc-icon-size:18px}
    dl{display:grid;grid-template-columns:110px minmax(0,1fr);gap:10px 16px;margin:12px 0 0;font-size:var(--luma-text-sm);line-height:1.6}dt{color:var(--luma-muted)}dd{margin:0;min-width:0;overflow-wrap:anywhere}dd code{font-size:11px}.error{margin:0;color:var(--error-color);font-size:var(--luma-text-sm);line-height:1.6}
    button:focus-visible,summary:focus-visible{outline:2px solid var(--primary-color);outline-offset:3px}
    @container(max-width:1000px){.updates{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @container(max-width:580px){ha-card{padding:16px}.updates{grid-template-columns:1fr}.header{gap:12px}.summary{width:100%}.view{flex:1 1 150px}.item{grid-template-columns:36px minmax(0,1fr) 16px;gap:10px;padding:12px}.item>.icon{width:36px;height:36px;border-radius:12px}.item>.pill{grid-column:2;justify-self:start;padding:3px 8px;font-size:10px}.item>.chevron{grid-column:3;grid-row:1}.name{font-size:13px}dl{grid-template-columns:1fr;gap:3px}dd{margin-bottom:9px}.empty{padding:26px 10px}}
  `];

  setConfig(config: Config) {
    if (!config?.policy) throw Error("Attention policy required");
    if (config.mode && !["incidents", "updates", "diagnostics"].includes(config.mode)) throw Error("Unknown attention mode");
    this.config = { mode: "incidents", ...config };
    this.query = ""; this.filter = "active"; this.limit = 50;
    this.detailsOpen = false; this.selected = undefined;
  }
  getCardSize() { return 4; }
  connectedCallback() { super.connectedCallback(); this.subscription.connect(); }
  disconnectedCallback() { super.disconnectedCallback(); this.subscription.disconnect(); this.detailsOpen = false; }
  protected updated() { this.subscription.update(this.hass, this.config?.policy); }
  private t(en: string, hu: string) { return localized(this.hass, en, hu); }

  private tone(row: AttentionEntry) {
    if (row.snoozedUntil) return "var(--secondary-text-color)";
    if (row.status === "active") return row.tone === "error" ? "var(--error-color)" : "var(--warning-color)";
    if (row.status === "installing") return "var(--info-color,var(--primary-color))";
    if (row.status === "inactive") return "var(--success-color)";
    return "var(--secondary-text-color)";
  }
  private status(row: AttentionEntry) {
    if (row.snoozedUntil) return this.t("Snoozed", "Szüneteltetve");
    const labels: Record<string, [string, string]> = {
      active: ["Needs attention", "Figyelmet kér"], inactive: ["Clear", "Rendben"],
      pending: ["Waiting", "Megfigyelés alatt"], unavailable: ["No data", "Adathiány"],
      excluded: ["Excluded", "Kizárva"], installing: ["Installing", "Telepítés alatt"], event: ["Latest event", "Legutóbbi esemény"],
    };
    return this.t(...labels[row.status]);
  }
  private icon(row: AttentionEntry) {
    if (row.snoozedUntil) return "mdi:bell-sleep-outline";
    if (row.kind === "update") return "mdi:package-up";
    if (row.status === "unavailable") return "mdi:cloud-question-outline";
    if (row.kind === "repair") return "mdi:wrench-outline";
    if (row.kind === "integration") return "mdi:puzzle-outline";
    if (row.kind === "notification") return "mdi:bell-outline";
    if (row.kind === "event") return "mdi:history";
    return row.status === "inactive" ? "mdi:check-circle-outline" : row.tone === "error" ? "mdi:alert-circle-outline" : "mdi:alert-outline";
  }
  private kind(row: AttentionEntry) {
    const labels: Record<AttentionEntry["kind"], [string, string]> = {
      incident: ["Monitored condition", "Felügyelt jelzés"], update: ["Device & software update", "Eszköz- és szoftverfrissítés"],
      notification: ["Home Assistant notification", "Home Assistant értesítés"], repair: ["Home Assistant repair", "Home Assistant javítási feladat"],
      integration: ["Integration status", "Integráció állapota"], event: ["Recorded event", "Rögzített esemény"],
    };
    return this.t(...labels[row.kind]);
  }
  private reason(row: AttentionEntry) {
    if (row.status === "inactive" && row.reason === "problem_signal") return this.t("The integration reports no problem.", "Az integráció nem jelez hibát.");
    const labels: Record<string, [string, string]> = {
      condition_not_met: ["The alert condition is not present.", "A riasztási feltétel nem áll fenn."],
      condition_met: ["The monitored condition needs attention.", "A figyelt állapot beavatkozást igényelhet."],
      grace_period: ["Waiting to see whether this condition persists.", "A rendszer megvárja, tartósan fennáll-e ez az állapot."],
      source_unavailable: ["This source is not reporting a reliable state.", "Ez a forrás nem szolgáltat megbízható állapotadatot."],
      metadata_unavailable: ["Entity information has not loaded yet.", "Az entitások adatai még nem töltődtek be."],
      disabled: ["Disabled in Home Assistant.", "Le van tiltva a Home Assistantban."],
      restored: ["An old registration without current measurements.", "Korábbi bejegyzés, aktuális mérési adatok nélkül."],
      ignored_label: ["Excluded by its monitoring label.", "A felügyeleti címkéje alapján kizárva."],
      policy_exception: ["Excluded by an explicit monitoring exception.", "Kifejezett felügyeleti kivétel alapján kizárva."],
      update_available: ["A newer version is available.", "Újabb verzió érhető el."],
      up_to_date: ["No newer version is reported.", "Nem jelez újabb verziót."],
      installing: ["An update is being installed.", "Frissítés telepítése van folyamatban."],
      problem_signal: ["The integration's problem sensor is active.", "Az integráció hibajelzője aktív."],
      persistent_notification: ["This notification is still present in Home Assistant.", "Ez az értesítés még jelen van a Home Assistantban."],
      repair_issue: ["Open Home Assistant Repairs for the next steps.", "A további lépések a Home Assistant Javítások oldalán találhatók."],
      integration_error: ["The integration could not start and may be retrying.", "Az integráció nem tudott elindulni; lehet, hogy újrapróbálkozik."],
      latest_event_only: ["A recorded event; it does not establish a current fault.", "Korábbi esemény; önmagában nem jelent jelenleg fennálló hibát."],
      adapter_unavailable: ["Home Assistant could not provide this data source.", "Nem sikerült beolvasni ezt a Home Assistant adatforrást."],
      covered_by_stronger_rule: ["A more severe alert already covers this condition.", "Ezt az állapotot már lefedi egy súlyosabb jelzés."],
      policy_unavailable: ["The monitoring configuration could not be loaded.", "A felügyeleti beállításokat nem sikerült betölteni."],
    };
    return labels[row.reason] ? this.t(...labels[row.reason]) : row.reason;
  }
  private description(row: AttentionEntry) {
    if (["unavailable", "excluded", "pending", "inactive"].includes(row.status)) return this.reason(row);
    if (row.kind === "integration" || row.reason === "policy_unavailable") return this.reason(row);
    return row.message === row.name ? this.kind(row) : row.message;
  }
  private setFilter(filter: string) { this.filter = filter; this.limit = 50; }
  private open(row: AttentionEntry) { this.selected = row.id; this.error = ""; this.detailsOpen = true; }
  private row(row: AttentionEntry) {
    return html`<button class="item" style=${`--tone:${this.tone(row)}`} @click=${() => this.open(row)} aria-label=${`${row.name}: ${this.status(row)}`}>
      <span class="icon"><ha-icon icon=${this.icon(row)}></ha-icon></span>
      <span class="copy"><span class="name">${row.name}</span><span class="message">${this.description(row)}</span></span>
      <span class="pill">${this.status(row)}</span><ha-icon class="chevron" icon="mdi:chevron-right"></ha-icon>
    </button>`;
  }
  private summaryPill(filter: string, count: number, en: string, hu: string, icon: string, tone: string) {
    if (!count) return nothing;
    const label = `${count} ${this.t(en, hu)}`;
    return this.config?.mode === "diagnostics"
      ? html`<button class="pill" data-filter=${filter} style=${`--tone:${tone}`} aria-pressed=${String(this.filter === filter)} @click=${() => this.setFilter(filter)}><ha-icon icon=${icon}></ha-icon>${label}</button>`
      : html`<span class="pill" style=${`--tone:${tone}`}><ha-icon icon=${icon}></ha-icon>${label}</span>`;
  }
  private async unsnooze(row: AttentionEntry) {
    const id = attentionPolicy(this.config?.policy)?.acknowledgements_entity;
    if (!id || !this.hass || this.saving) return;
    const source = this.hass.states[id]; this.saving = true; this.error = "";
    try {
      await this.hass.callService("input_text", "set_value", {
        value: attentionAckValue(source?.state, row.key, null, Date.now() / 1000, Number(source?.attributes.max || 255)),
      }, { entity_id: id });
    } catch { this.error = this.t("Could not restore the alert. Try again.", "Nem sikerült visszaállítani a jelzést. Próbáld újra."); }
    finally { this.saving = false; }
  }
  private async dismissNotification(row: AttentionEntry) {
    if (!this.hass || !row.notificationId || this.saving) return;
    this.saving = true; this.error = "";
    try { await dismissAttentionNotification(this.hass, row.notificationId); this.detailsOpen = false; }
    catch { this.error = this.t("Could not dismiss the Home Assistant notification. Try again.", "Nem sikerült törölni a Home Assistant értesítését. Próbáld újra."); }
    finally { this.saving = false; }
  }
  private empty(missing: number) {
    const searching = !!this.query.trim();
    const attentionView = this.config?.mode !== "diagnostics" || this.filter === "active";
    const clear = !searching && attentionView && !missing;
    return html`<div class="empty" style=${`--tone:${clear ? "var(--success-color)" : "var(--secondary-text-color)"}`}>
      <span class="icon"><ha-icon icon=${searching ? "mdi:magnify" : clear ? "mdi:check-circle-outline" : "mdi:bell-outline"}></ha-icon></span>
      <strong>${searching ? this.t("No results", "Nincs találat") : clear ? this.config?.mode === "updates" ? this.t("Up to date", "Naprakész") : this.t("No active alerts", "Nincs aktív jelzés") : this.t("Nothing in this view", "Nincs ilyen jelzés")}</strong>
      <p>${searching ? this.t("Try another device name or clear the search.", "Próbálj más eszköznevet, vagy töröld a keresést.") : missing && attentionView ? this.t("Some sources have no current data. Check the data gaps before treating the system as clear.", "Néhány forrásról nincs aktuális adat. Ezek az Adathiány nézetben ellenőrizhetők.") : clear ? this.config?.mode === "updates" ? this.t("The monitored sources report no available updates.", "A felügyelt források jelenleg nem jeleznek elérhető frissítést.") : this.t("The monitored sources report no active conditions in this view.", "A felügyelt források ebben a nézetben nem jeleznek aktív problémát.") : this.t("Choose another status to see the other monitored sources.", "Másik állapot kiválasztásával a többi felügyelt forrás is megtekinthető.")}</p>
    </div>`;
  }
  private details(row: AttentionEntry) {
    const policy = attentionPolicy(this.config?.policy);
    const description = this.description(row), explanation = this.reason(row);
    return html`<div class="detail">
      <div class="detail-status"><span class="pill" style=${`--tone:${this.tone(row)}`}>${this.status(row)}</span>${row.snoozedUntil ? html`<span class="muted">${this.t("Until", "Eddig")}: ${new Date(row.snoozedUntil * 1000).toLocaleString(this.hass?.locale?.language)}</span>` : nothing}</div>
      <p class="detail-message">${description}</p>
      ${row.context?.length ? html`<div class="context">${row.context.map(item=>item.entity ? html`<button class="context-item" @click=${()=>runAction(this,this.hass!,{action:"more-info"},item.entity)}><span>${item.label}</span><strong>${item.value}</strong></button>` : html`<div class="context-item"><span>${item.label}</span><strong>${item.value}</strong></div>`)}</div>` : nothing}
      ${description !== explanation ? html`<p class="explanation">${explanation}</p>` : nothing}
      <div class="actions">
        ${row.notificationId ? html`<button class="action" ?disabled=${this.saving} @click=${() => this.dismissNotification(row)}><ha-icon icon="mdi:bell-remove-outline"></ha-icon>${this.t("Dismiss in Home Assistant", "Törlés a Home Assistantból")}</button>` : nothing}
        ${row.path && row.path !== policy?.diagnostics_path ? html`<button class="action" @click=${() => runAction(this, this.hass!, { action: "navigate", navigation_path: row.path! })}><ha-icon icon="mdi:arrow-top-right"></ha-icon>${this.t("Open details", "Részletes nézet")}</button>` : nothing}
        ${this.hass?.states[row.source] ? html`<button class="action secondary" @click=${() => runAction(this, this.hass!, { action: "more-info" }, row.source)}><ha-icon icon="mdi:chart-timeline-variant"></ha-icon>${this.t("Entity & history", "Entitás és előzmények")}</button>` : nothing}
        ${row.snoozedUntil ? html`<button class="action" ?disabled=${this.saving} @click=${() => this.unsnooze(row)}><ha-icon icon="mdi:bell-ring-outline"></ha-icon>${this.t("Show alert again", "Jelzés visszaállítása")}</button>` : nothing}
      </div>
      ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
      <details class="technical"><summary><ha-icon icon="mdi:tune-variant"></ha-icon>${this.t("Technical details", "Technikai részletek")}</summary><dl>
        <dt>${this.t("Source", "Forrás")}</dt><dd><code>${row.source}</code></dd>
        ${row.sourceState !== undefined ? html`<dt>${this.t("Source state", "Forrás állapota")}</dt><dd>${row.sourceState || "—"}</dd>` : nothing}
        <dt>${this.t("Rules", "Szabályok")}</dt><dd>${(row.affectedRules || [row.rule]).map(rule => html`<div><code>${rule}</code></div>`)}</dd>
        <dt>${this.t("Category", "Kategória")}</dt><dd>${row.category}</dd>
        ${row.message !== description ? html`<dt>${this.t("Source message", "Forrás jelzése")}</dt><dd>${row.message}</dd>` : nothing}
        <dt>${this.t("Policy", "Szabálykészlet")}</dt><dd>${policy?.revision || this.config?.policy}</dd>
      </dl></details>
    </div>`;
  }

  render() {
    if (!this.hass || !this.config) return nothing;
    const mode = this.config.mode;
    const all = policyRows(this.config.policy, this.hass).filter(row => !this.config?.scope || row.scope === this.config.scope || row.scope === "system");
    const relevant = attentionCoverageRows(all.filter(row => mode === "diagnostics" || (mode === "updates" ? row.kind === "update" || row.scope === "system" : row.kind !== "update")), this.hass);
    const active = activeAttention(relevant, undefined, true), missing = relevant.filter(row => row.status === "unavailable");
    const snoozed = new Set(relevant.filter(row => row.snoozedUntil).map(row => row.key)).size;
    let rows = mode === "diagnostics" ? relevant : mode === "updates" ? relevant.filter(row => ["active", "installing", "unavailable"].includes(row.status)) : attentionSummaries(relevant, undefined, true);
    if (mode === "diagnostics") rows = rows.filter(row => this.filter === "all" || (this.filter === "snoozed" ? !!row.snoozedUntil : this.filter === "active" ? ["active", "installing"].includes(row.status) : row.status === this.filter));
    const query = this.query.trim().toLowerCase();
    if (query) rows = rows.filter(row => `${row.name} ${row.source} ${row.rule} ${row.affectedRules?.join(" ") || ""} ${row.category} ${row.message} ${row.reason}`.toLowerCase().includes(query));
    const selected = relevant.find(row => row.id === this.selected);
    const title = this.config.title || (mode === "updates" ? this.t("Updates", "Frissítések") : mode === "diagnostics" ? this.t("Monitored notifications", "Felügyelt jelzések") : this.t("Needs attention", "Figyelmet kér"));
    const icon = mode === "updates" ? "mdi:package-up" : mode === "diagnostics" ? "mdi:bell-cog-outline" : "mdi:bell-outline";
    const categories = [...new Set(rows.map(row => row.category))];
    return html`<ha-card class=${this.config.embedded ? "embedded" : ""}>
      ${!this.config.embedded || active.length || missing.length || snoozed ? html`<div class="header">
        ${!this.config.embedded ? html`<div class="header-main"><span class="icon"><ha-icon icon=${icon}></ha-icon></span><span><div class="title">${title}</div><div class="subtitle">${mode === "diagnostics" ? this.t("Sources, data gaps and snoozed alerts", "Források, adathiányok és szüneteltetett jelzések") : mode === "updates" ? this.t("Software & device firmware", "Szoftverek és eszközök firmware-e") : this.t("Current conditions across your monitored systems", "A felügyelt rendszerek aktuális jelzései")}</div></span></div>` : nothing}
        <div class="summary" aria-label=${this.t("Notification summary", "Jelzések összesítése")}>
          ${this.summaryPill("active", active.length, "active", "aktív", "mdi:bell-outline", active.some(row => row.tone === "error") ? "var(--error-color)" : "var(--warning-color)")}
          ${this.summaryPill("unavailable", missing.length, "data gaps", "adatkimaradás", "mdi:cloud-question-outline", "var(--secondary-text-color)")}
          ${this.summaryPill("snoozed", snoozed, "snoozed", "szüneteltetve", "mdi:bell-sleep-outline", "var(--secondary-text-color)")}
        </div>
      </div>` : nothing}
      ${mode === "diagnostics" ? html`<div class="toolbar">
        <label class="field search"><ha-icon icon="mdi:magnify"></ha-icon><input aria-label=${this.t("Search sources", "Források keresése")} placeholder=${this.t("Search devices and notifications", "Eszköz vagy jelzés keresése")} .value=${this.query} @input=${(event: Event) => { this.query = (event.target as HTMLInputElement).value; this.limit = 50; }}></label>
        <label class="field view"><ha-icon icon="mdi:filter-variant"></ha-icon><select aria-label=${this.t("Status filter", "Állapotszűrő")} .value=${this.filter} @change=${(event: Event) => this.setFilter((event.target as HTMLSelectElement).value)}>
          ${[["active", "Needs attention", "Figyelmet kér"], ["unavailable", "Data gaps", "Adathiány"], ["snoozed", "Snoozed", "Szüneteltetve"], ["pending", "Waiting", "Megfigyelés alatt"], ["inactive", "Clear", "Rendben"], ["excluded", "Excluded", "Kizárva"], ["event", "Events", "Események"], ["all", "All sources", "Összes forrás"]].map(([value, en, hu]) => html`<option value=${value}>${this.t(en, hu)}</option>`)}
        </select></label>
      </div>` : nothing}
      ${mode === "updates" ? html`${categories.map(category => html`<div class="group-header">${rows.find(row => row.category === category)?.message}</div><div class="updates">${repeat(rows.filter(row => row.category === category), row => row.id, row => row.status === "unavailable" || row.kind !== "update" ? this.row(row) : html`<luma-update-card .hass=${this.hass} ${ref(node => { const card = node as HTMLElement & LovelaceCard; if (card && card.dataset.entity !== row.source) { card.setConfig({ type: "custom:luma-update-card", entity: row.source }); card.dataset.entity = row.source; } })}></luma-update-card>`)}</div>`)}` : html`<div class="list">${repeat(rows.slice(0, this.limit), row => row.id, row => this.row(row))}</div>`}
      ${!rows.length ? this.empty(missing.length) : nothing}
      ${mode !== "updates" && rows.length > this.limit ? html`<button class="action secondary more" @click=${() => this.limit += 50}>${this.t("Show more", "Továbbiak")} (${rows.length - this.limit})<ha-icon icon="mdi:chevron-down"></ha-icon></button>` : nothing}
    </ha-card>
    <luma-bottom-sheet .open=${this.detailsOpen && !!selected} .heading=${selected?.name || ""} .subtitle=${selected ? this.kind(selected) : ""} .icon=${selected ? this.icon(selected) : icon} .maxWidth=${640} .closeLabel=${this.t("Close", "Bezárás")}
      @sheet-dismiss=${() => this.detailsOpen = false} @sheet-closed=${() => { if (!this.detailsOpen) this.selected = undefined; }}>
      ${selected ? this.details(selected) : nothing}
    </luma-bottom-sheet>`;
  }
}
