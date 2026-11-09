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
import type { LumaBottomSheet } from "../components/luma-bottom-sheet";
import "../components/luma-bottom-sheet";

interface Config {
  type: string;
  policy: string;
  scope?: string;
  mode?: "incidents" | "updates" | "diagnostics";
  title?: string;
  /** The containing popup already supplies the surface and heading. */
  embedded?: boolean;
  /** One shared modal for list → detail → back, used by hero summaries. */
  panel?: boolean;
}

@customElement("luma-attention-card")
export class LumaAttentionCard extends LitElement implements LovelaceCard {
  @property({ type: Boolean }) open = false;
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: Config;
  @state() private query = "";
  @state() private filter = "active";
  @state() private selected?: string;
  @state() private detailsOpen = false;
  @state() private limit = 50;
  @state() private saving = false;
  @state() private error = "";
  @state() private confirming = false;
  @state() private actionSent = false;
  @state() private feedback = "";
  private listScroll = 0;
  private listScroller?: HTMLElement;
  private opener?: HTMLElement;
  private subscription = new AttentionSubscription(() => this.requestUpdate());

  static styles = [lumaTokens, css`
    :host{display:block;min-width:0;container-type:inline-size}
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
    .copy{min-width:0}.name{display:block;font-size:var(--luma-text-md);font-weight:var(--luma-weight-title);line-height:1.4;overflow-wrap:anywhere}.message{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;margin-top:4px;font-size:var(--luma-text-sm);color:var(--luma-muted);line-height:1.55;white-space:pre-line;overflow-wrap:anywhere}.chevron{--mdc-icon-size:17px;color:var(--luma-muted)}
    .group-header{display:flex;align-items:center;gap:10px;margin:22px 0 10px;font-size:var(--luma-text-sm);font-weight:var(--luma-weight-title);color:var(--luma-muted)}.group-header:first-child{margin-top:0}.group-header::after{content:"";height:1px;flex:1;background:var(--luma-border)}
    .updates{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .empty{display:grid;justify-items:center;gap:8px;padding:32px 18px;text-align:center}.empty>.icon{width:48px;height:48px;margin-bottom:4px}.empty strong{font-size:var(--luma-text-md);font-weight:var(--luma-weight-title)}.empty p{max-width:440px;margin:0;font-size:var(--luma-text-sm);line-height:1.6;color:var(--luma-muted)}
    .action{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:44px;padding:10px 15px;border:1px solid color-mix(in srgb,var(--primary-color) 18%,transparent);border-radius:999px;background:color-mix(in srgb,var(--primary-color) 9%,transparent);color:var(--primary-color);font:inherit;font-size:var(--luma-text-sm);font-weight:var(--luma-weight-strong);cursor:pointer}.action ha-icon{--mdc-icon-size:18px}.action.secondary{color:var(--luma-muted);background:transparent;border-color:var(--luma-border)}.action:disabled{opacity:.5;cursor:default}.more{margin-top:14px;width:100%}
    .detail{display:grid;gap:18px;min-width:0}.detail-status{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.detail-message{margin:0;font-size:var(--luma-text-md);line-height:1.7;white-space:pre-line;overflow-wrap:anywhere}.explanation{margin:0;padding:14px 16px;border-left:2px solid color-mix(in srgb,var(--primary-color) 35%,transparent);border-radius:0 var(--luma-radius-control) var(--luma-radius-control) 0;background:color-mix(in srgb,var(--primary-color) 4%,transparent);color:var(--luma-muted);font-size:var(--luma-text-sm);line-height:1.6}.actions{display:flex;gap:8px;flex-wrap:wrap}
    .context{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.context-item{min-width:0;padding:14px;border:1px solid var(--luma-border);border-radius:var(--luma-radius-control);background:color-mix(in srgb,var(--primary-color) 4%,transparent);color:var(--primary-text-color);font:inherit;text-align:left;overflow-wrap:anywhere}.context-item span{display:block;font-size:11px;color:var(--luma-muted);line-height:1.5}.context-item strong{display:block;margin-top:6px;font-size:var(--luma-text-md);font-weight:var(--luma-weight-strong);line-height:1.5}button.context-item{cursor:pointer;min-height:44px}
    .context>div{grid-column:1/-1}
    .technical{border-top:1px solid var(--luma-border);padding-top:14px}.technical summary{display:flex;align-items:center;gap:8px;min-height:44px;color:var(--luma-muted);font-size:var(--luma-text-sm);font-weight:var(--luma-weight-strong);cursor:pointer}.technical summary::after{content:"+";margin-left:auto;font-size:18px}.technical[open] summary::after{content:"−"}.technical summary ha-icon{--mdc-icon-size:18px}
    dl{display:grid;grid-template-columns:110px minmax(0,1fr);gap:10px 16px;margin:12px 0 0;font-size:var(--luma-text-sm);line-height:1.6}dt{color:var(--luma-muted)}dd{margin:0;min-width:0;overflow-wrap:anywhere}dd code{font-size:11px}.error{margin:0;color:var(--error-color);font-size:var(--luma-text-sm);line-height:1.6}
    [hidden]{display:none!important}.back{margin-bottom:16px}.loading{margin:0 0 14px;color:var(--luma-muted);font-size:var(--luma-text-sm);line-height:1.6}.section-title{margin:18px 0 10px;font-size:var(--luma-text-sm);font-weight:var(--luma-weight-strong)}.confirmation{padding:14px;border:1px solid var(--luma-border);border-radius:var(--luma-radius-control);line-height:1.6}.confirmation p{margin:0 0 12px}.members{display:grid;gap:8px}.member{padding:12px;border:1px solid var(--luma-border);border-radius:var(--luma-radius-control);overflow-wrap:anywhere}.member p{margin:5px 0 0;white-space:pre-line;color:var(--luma-muted);font-size:var(--luma-text-sm);line-height:1.6}
    button:focus-visible,summary:focus-visible{outline:2px solid var(--primary-color);outline-offset:3px}
    @container(max-width:1000px){.updates{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @container(max-width:580px){ha-card{padding:16px}.updates{grid-template-columns:1fr}.header{gap:12px}.summary{width:100%}.view{flex:1 1 150px}.item{grid-template-columns:36px minmax(0,1fr) 16px;gap:10px;padding:12px}.item>.icon{width:36px;height:36px;border-radius:12px}.item>.pill{grid-column:2;justify-self:start;padding:3px 8px;font-size:10px}.item>.chevron{grid-column:3;grid-row:1}.name{font-size:13px}dl{grid-template-columns:1fr;gap:3px}dd{margin-bottom:9px}.empty{padding:26px 10px}}
  `];

  setConfig(config: Config) {
    if (!config?.policy) throw Error("Attention policy required");
    if (config.mode && !["incidents", "updates", "diagnostics"].includes(config.mode)) throw Error("Unknown attention mode");
    this.config = { mode: "incidents", ...config };
    this.query = ""; this.filter = "active"; this.limit = 50;
    this.detailsOpen = false; this.selected = undefined; this.confirming = false; this.actionSent = false;
  }
  getCardSize() { return 4; }
  connectedCallback() { super.connectedCallback(); this.subscription.connect(); }
  disconnectedCallback() { super.disconnectedCallback(); this.subscription.disconnect(); this.detailsOpen = false; }
  protected updated() { this.subscription.update(this.hass, this.config?.policy); }
  private t(en: string, hu: string) { return localized(this.hass, en, hu); }

  private tone(row: AttentionEntry) {
    if (row.snoozedUntil) return "var(--secondary-text-color)";
    if (row.status === "active" && row.kind === "update") return "var(--primary-color)";
    if (row.status === "active") return row.tone === "error" ? "var(--error-color)" : "var(--warning-color)";
    if (row.status === "installing") return "var(--info-color,var(--primary-color))";
    if (row.status === "inactive") return "var(--success-color)";
    return "var(--secondary-text-color)";
  }
  private status(row: AttentionEntry) {
    if (row.snoozedUntil) return this.t("Snoozed", "Szüneteltetve");
    if (row.kind === "update" && row.status === "active") return this.t("Update available", "Frissíthető");
    const labels: Record<string, [string, string]> = {
      loading: ["Checking", "Ellenőrzés folyamatban"],
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
      household_expected: ["Approved household context explains this missing measurement; it is not a healthy measurement.","Jóváhagyott háztartási szabály magyarázza ezt az adathiányt; ez nem egészséges mérési érték."],
      household_loading: ["Checking approved household rules.","A jóváhagyott háztartási szabályok ellenőrzése folyamatban."],
      household_unavailable: ["The shared household rule evaluator is unavailable. No new exception is applied.","A közös háttértudás-értékelő nem érhető el. Új kivétel nem érvényesül."],
      metadata_loading: ["Waiting for entity metadata; monitoring is not yet complete.", "Az entitásadatok betöltésére várunk; a felügyelet még nem teljes."],
      adapter_loading: ["This Home Assistant source is still being checked.", "Ennek a Home Assistant adatforrásnak az ellenőrzése még folyamatban van."],
      metadata_unavailable: ["Entity information could not be read. Monitoring coverage cannot be confirmed.", "Az entitásadatokat nem sikerült beolvasni. A felügyelet teljessége nem igazolható."],
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
    if (["loading", "unavailable", "excluded", "pending", "inactive"].includes(row.status)) return this.reason(row);
    if (row.kind === "update") return row.summary || this.updateDescription(row);
    if (row.kind === "integration" || row.reason === "policy_unavailable") return this.reason(row);
    return row.message === row.name ? this.kind(row) : row.message;
  }
  private updateDescription(row: AttentionEntry) {
    const a=this.hass?.states[row.source]?.attributes;
    return String(a?.release_summary || `${a?.installed_version || "—"} → ${a?.latest_version || "—"}`);
  }
  private sheet(){return this.renderRoot.querySelector<LumaBottomSheet>("luma-bottom-sheet")}
  private scrollContainer() {
    if(this.config?.panel)return this.sheet()?.shadowRoot?.querySelector<HTMLElement>(".content") || undefined;
    for(let node:HTMLElement | undefined=this;node;){
      if(node.scrollHeight>node.clientHeight && /auto|scroll/.test(getComputedStyle(node).overflowY))return node;
      const root=node.getRootNode();
      node=node.assignedSlot || node.parentElement || (root instanceof ShadowRoot ? root.host as HTMLElement : undefined) || undefined;
    }
    return document.scrollingElement as HTMLElement | undefined;
  }
  private back() {
    if(this.saving)return;
    this.selected=undefined;this.confirming=false;this.actionSent=false;this.feedback="";this.error="";
    void this.updateComplete.then(()=>{this.listScroller?.scrollTo({top:this.listScroll});this.opener?.focus({preventScroll:true});});
  }
  private close() {
    if(this.saving)return;
    this.open=false;this.detailsOpen=false;this.selected=undefined;this.confirming=false;
    this.dispatchEvent(new CustomEvent("attention-close"));
  }
  private setFilter(filter: string) { this.filter = filter; this.limit = 50; }
  private select(row: AttentionEntry, event:Event) {
    this.opener=event.currentTarget as HTMLElement;this.listScroller=this.scrollContainer();this.listScroll=this.listScroller?.scrollTop || 0;
    this.selected=row.id;this.error="";this.feedback="";this.confirming=false;this.actionSent=false;this.detailsOpen=true;
    void this.updateComplete.then(()=>{this.listScroller?.scrollTo({top:0});(this.sheet()?.shadowRoot?.querySelector('button[aria-label]') as HTMLElement | null)?.focus({preventScroll:true});});
  }
  private async snooze(row:AttentionEntry, days:number) {
    const id=attentionPolicy(this.config?.policy)?.acknowledgements_entity;
    if(!id||!this.hass||this.saving||row.tone==="error"||!row.dismissible)return;
    this.saving=true;this.error="";
    try {const source=this.hass.states[id];await this.hass.callService("input_text","set_value",{value:attentionAckValue(source?.state || "",row.key,Date.now()/1000+days*86400,Date.now()/1000,Number(source?.attributes.max || 255))},{entity_id:id});}
    catch{this.error=this.t("Could not snooze the alert.","Nem sikerült szüneteltetni a jelzést.");}
    finally{this.saving=false;}
  }
  private async complete(row:AttentionEntry) {
    if(!row.completion||!this.hass||this.saving)return;
    this.saving=true;this.error="";
    try{await runAction(this,this.hass,row.completion.action);this.confirming=false;this.actionSent=true;}
    catch{this.error=this.t("The action failed. The task remains open.","A művelet nem sikerült. A feladat nyitva marad.");}
    finally{this.saving=false;}
  }
  private row(row: AttentionEntry) {
    return html`<button class="item" style=${`--tone:${this.tone(row)}`} @click=${(event:Event) => this.select(row,event)} aria-label=${`${row.name}: ${this.status(row)}`}>
      <span class="icon"><ha-icon icon=${this.icon(row)}></ha-icon></span>
      <span class="copy"><span class="name">${row.name}</span><span class="message">${this.description(row)}</span></span>
      <span class="pill">${this.status(row)}</span><ha-icon class="chevron" icon="mdi:chevron-right"></ha-icon>
    </button>`;
  }
  private summaryPill(filter: string, count: number, en: string, hu: string, icon: string, tone: string) {
    if (!count) return nothing;
    const label = `${count} ${this.t(count===1 ? en==="issues" ? "issue" : en==="updatable components" ? "updatable component" : en==="data gaps" ? "data gap" : en : en, hu)}`;
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
    try { await dismissAttentionNotification(this.hass, row.notificationId); this.feedback=this.t("The HA notification was dismissed. The task state was not changed.","A HA-értesítés törölve. A feladat állapota nem változott."); }
    catch { this.error = this.t("Could not dismiss the Home Assistant notification. Try again.", "Nem sikerült törölni a Home Assistant értesítését. Próbáld újra."); }
    finally { this.saving = false; }
  }
  private empty(missing: number, loading = false) {
    const searching = !!this.query.trim();
    const attentionView = this.config?.mode !== "diagnostics" || this.filter === "active";
    const clear = !searching && attentionView && !missing && !loading;
    return html`<div class="empty" style=${`--tone:${clear ? "var(--success-color)" : "var(--secondary-text-color)"}`}>
      <span class="icon"><ha-icon icon=${searching ? "mdi:magnify" : clear ? "mdi:check-circle-outline" : "mdi:bell-outline"}></ha-icon></span>
      <strong>${searching ? this.t("No results", "Nincs találat") : loading ? this.t("Checking sources…", "Adatforrások ellenőrzése…") : clear ? this.config?.mode === "updates" ? this.t("Up to date", "Naprakész") : this.t("No active alerts", "Nincs aktív jelzés") : this.t("Nothing in this view", "Nincs ilyen jelzés")}</strong>
      <p>${searching ? this.t("Try another device name or clear the search.", "Próbálj más eszköznevet, vagy töröld a keresést.") : loading ? this.t("The check is not complete yet. This is not an all-clear.","Az ellenőrzés még nem teljes. Ez még nem jelent hibamentes állapotot.") : missing && attentionView ? this.t("Some sources have no current data. Check the data gaps before treating the system as clear.", "Néhány forrásról nincs aktuális adat. Ezek az Adathiány nézetben ellenőrizhetők.") : clear ? this.config?.mode === "updates" ? this.t("The monitored sources report no available updates.", "A felügyelt források jelenleg nem jeleznek elérhető frissítést.") : this.t("The monitored sources report no active conditions in this view.", "A felügyelt források ebben a nézetben nem jeleznek aktív problémát.") : this.t("Choose another status to see the other monitored sources.", "Másik állapot kiválasztásával a többi felügyelt forrás is megtekinthető.")}</p>
    </div>`;
  }
  private details(row: AttentionEntry, all:AttentionEntry[]) {
    const policy = attentionPolicy(this.config?.policy);
    const description = this.description(row), explanation = this.reason(row);
    const members=all.filter(item=>item.key===row.key && ["active","installing"].includes(item.status));
    const notifications=row.relatedNotifications || (row.notificationId ? [{id:row.notificationId,title:row.name,message:row.message}] : []);
    return html`<div class="detail">
      <div class="detail-status"><span class="pill" style=${`--tone:${this.tone(row)}`}>${this.status(row)}</span>${row.snoozedUntil ? html`<span class="muted">${this.t("Until", "Eddig")}: ${new Date(row.snoozedUntil * 1000).toLocaleString(this.hass?.locale?.language)}</span>` : nothing}</div>
      <p class="detail-message">${description}</p>
      ${row.kind === "update" && members.length > 1 ? html`<div class="members">${members.map(member=>html`<div class="member"><strong>${member.name}</strong><p>${this.updateDescription(member)}</p><button class="action secondary" @click=${()=>runAction(this,this.hass!,{action:"more-info"},member.source)}>${this.t("Entity & history", "Entitás és előzmények")}</button></div>`)}</div>` : nothing}
      ${row.context?.length ? html`<div class="context">${row.context.map(item=>item.entity ? html`<button class="context-item" @click=${()=>runAction(this,this.hass!,{action:"more-info"},item.entity)}><span>${item.label}</span><strong>${item.value}</strong></button>` : html`<div class="context-item"><span>${item.label}</span><strong>${item.value}</strong></div>`)}</div>` : nothing}
      ${description !== explanation ? html`<p class="explanation">${explanation}</p>` : nothing}
      ${row.completion ? html`<div class="actions"><button class="action" ?disabled=${this.saving || this.actionSent} @click=${()=>this.confirming=true}><ha-icon icon="mdi:check-circle-outline"></ha-icon>${row.completion.label}</button></div>` : nothing}
      ${this.confirming && row.completion ? html`<div class="confirmation" role="group" aria-label=${row.completion.label}><p>${row.completion.confirmation}</p><div class="actions"><button class="action" ?disabled=${this.saving} @click=${()=>this.complete(row)}>${this.t("Confirm", "Megerősítés")}</button><button class="action secondary" ?disabled=${this.saving} @click=${()=>this.confirming=false}>${this.t("Cancel", "Mégse")}</button></div>${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}</div>` : nothing}
      ${this.actionSent ? html`<p class="muted" role="status">${this.t("Action sent. The source state determines whether the task is still active.","A művelet elküldve. A feladat fennállását a forrás állapota határozza meg.")}</p>` : nothing}
      <div class="actions">
        ${row.notificationId ? html`<button class="action" ?disabled=${this.saving} @click=${() => this.dismissNotification(row)}><ha-icon icon="mdi:bell-remove-outline"></ha-icon>${this.t("Dismiss in Home Assistant", "Törlés a Home Assistantból")}</button>` : nothing}
        ${row.path && row.path !== policy?.diagnostics_path ? html`<button class="action" @click=${() => runAction(this, this.hass!, { action: "navigate", navigation_path: row.path! })}><ha-icon icon="mdi:arrow-top-right"></ha-icon>${this.t("Open related dashboard", "Kapcsolódó oldal megnyitása")}</button>` : nothing}
        ${this.hass?.states[row.source] && members.length <= 1 ? html`<button class="action secondary" @click=${() => runAction(this, this.hass!, { action: "more-info" }, row.source)}><ha-icon icon="mdi:chart-timeline-variant"></ha-icon>${this.t("Entity & history", "Entitás és előzmények")}</button>` : nothing}
        ${row.dismissible && row.tone !== "error" && !row.snoozedUntil && policy?.acknowledgements_entity ? html`<button class="action secondary" ?disabled=${this.saving} @click=${()=>this.snooze(row,1)}>${this.t("Remind me tomorrow", "Emlékeztess holnap")}</button><button class="action secondary" ?disabled=${this.saving} @click=${()=>this.snooze(row,7)}>${this.t("Snooze for 7 days", "Szüneteltetés 7 napra")}</button>` : nothing}
        ${row.snoozedUntil ? html`<button class="action" ?disabled=${this.saving} @click=${() => this.unsnooze(row)}><ha-icon icon="mdi:bell-ring-outline"></ha-icon>${this.t("Show alert again", "Jelzés visszaállítása")}</button>` : nothing}
      </div>
      ${notifications.length ? html`<p class="muted">${this.t("Dismissing a notification only removes that delivery channel; it does not complete the task.","Az értesítés törlése csak az üzenetcsatornát törli; a feladatot nem zárja le.")}</p>${notifications.filter(n=>n.id!==row.notificationId).map(n=>html`<button class="action secondary" ?disabled=${this.saving} @click=${()=>this.dismissNotification({...row,notificationId:n.id})}>${this.t("Dismiss HA notification", "HA-értesítés törlése")}: ${n.title}</button>`)}` : nothing}
      ${row.dismissible && row.tone!=="error" ? html`<p class="muted">${this.t("Snoozing changes visibility only. It does not fix the source condition.","A szüneteltetés csak a megjelenítést módosítja. A forrás állapotát nem javítja meg.")}</p>` : nothing}
      ${this.feedback ? html`<p class="muted" role="status">${this.feedback}</p>` : nothing}
      ${this.error && !this.confirming ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
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
    const loading = all.some(row=>row.status==="loading");
    const active = activeAttention(relevant, undefined, true), missing = relevant.filter(row => row.status === "unavailable");
    const snoozed = new Set(relevant.filter(row => row.snoozedUntil).map(row => row.key)).size;
    let rows = mode === "diagnostics" ? relevant : mode === "updates" ? relevant.filter(row => ["active", "installing", "unavailable"].includes(row.status)) : attentionSummaries(relevant, undefined, true);
    if (mode === "diagnostics") rows = rows.filter(row => this.filter === "all" || (this.filter === "snoozed" ? !!row.snoozedUntil : this.filter === "active" ? ["active", "installing"].includes(row.status) : row.status === this.filter));
    const query = this.query.trim().toLowerCase();
    if (query) rows = rows.filter(row => `${row.name} ${row.source} ${row.rule} ${row.affectedRules?.join(" ") || ""} ${row.category} ${row.message} ${row.reason}`.toLowerCase().includes(query));
    const sourceSelected = relevant.find(row => row.id === this.selected);
    const selected = sourceSelected ? {...sourceSelected, name:sourceSelected.summaryName || sourceSelected.name, message:sourceSelected.summary || sourceSelected.message} : undefined;
    const title = this.config.title || (mode === "updates" ? this.t("Updates", "Frissítések") : mode === "diagnostics" ? this.t("Monitored notifications", "Felügyelt jelzések") : this.t("Needs attention", "Figyelmet kér"));
    const icon = mode === "updates" ? "mdi:package-up" : mode === "diagnostics" ? "mdi:bell-cog-outline" : "mdi:bell-outline";
    const categories = [...new Set(rows.map(row => row.category))];
    const list = html`<div ?hidden=${!!this.selected && (this.config.panel || this.config.embedded)}><ha-card class=${this.config.embedded || this.config.panel ? "embedded" : ""}>
      ${loading ? html`<p class="loading" role="status">${this.t("Checking monitoring sources…", "Felügyeleti adatforrások ellenőrzése…")}</p>` : nothing}
      ${!this.config.embedded || active.length || missing.length || snoozed ? html`<div class="header">
        ${!this.config.embedded && !this.config.panel ? html`<div class="header-main"><span class="icon"><ha-icon icon=${icon}></ha-icon></span><span><div class="title">${title}</div><div class="subtitle">${mode === "diagnostics" ? this.t("Sources, data gaps and snoozed alerts", "Források, adathiányok és szüneteltetett jelzések") : mode === "updates" ? this.t("Software & device firmware", "Szoftverek és eszközök firmware-e") : this.t("Current conditions across your monitored systems", "A felügyelt rendszerek aktuális jelzései")}</div></span></div>` : nothing}
        <div class="summary" aria-label=${this.t("Notification summary", "Jelzések összesítése")}>
          ${this.summaryPill("active", new Set(active.filter(row=>row.kind!=="update").map(row=>row.key)).size, "issues", "ügy", "mdi:bell-outline", active.some(row => row.tone === "error") ? "var(--error-color)" : "var(--warning-color)")}
          ${this.summaryPill("active", new Set(active.filter(row=>row.kind==="update").map(row=>row.source)).size, "updatable components", "frissíthető összetevő", "mdi:package-up", "var(--primary-color)")}
          ${this.summaryPill("unavailable", missing.length, "data gaps", "adatkimaradás", "mdi:cloud-question-outline", "var(--secondary-text-color)")}
          ${this.summaryPill("snoozed", snoozed, "snoozed", "szüneteltetve", "mdi:bell-sleep-outline", "var(--secondary-text-color)")}
        </div>
      </div>` : nothing}
      ${mode === "diagnostics" ? html`<div class="toolbar">
        <label class="field search"><ha-icon icon="mdi:magnify"></ha-icon><input aria-label=${this.t("Search sources", "Források keresése")} placeholder=${this.t("Search devices and notifications", "Eszköz vagy jelzés keresése")} .value=${this.query} @input=${(event: Event) => { this.query = (event.target as HTMLInputElement).value; this.limit = 50; }}></label>
        <label class="field view"><ha-icon icon="mdi:filter-variant"></ha-icon><select aria-label=${this.t("Status filter", "Állapotszűrő")} .value=${this.filter} @change=${(event: Event) => this.setFilter((event.target as HTMLSelectElement).value)}>
          ${[["active", "Needs attention", "Figyelmet kér"], ["unavailable", "Data gaps", "Adathiány"], ["snoozed", "Snoozed", "Szüneteltetve"], ["pending", "Waiting", "Megfigyelés alatt"], ["inactive", "Clear", "Rendben"], ["excluded", "Excluded", "Kizárva"], ["event", "Events", "Események"], ["loading", "Checking", "Ellenőrzés"], ["all", "All sources", "Összes forrás"]].map(([value, en, hu]) => html`<option value=${value}>${this.t(en, hu)}</option>`)}
        </select></label>
      </div>` : nothing}
      ${mode === "updates" ? html`${categories.map(category => html`<div class="group-header">${rows.find(row => row.category === category)?.message}</div><div class="updates">${repeat(rows.filter(row => row.category === category), row => row.id, row => row.status === "unavailable" || row.kind !== "update" ? this.row(row) : this.config?.embedded || this.config?.panel ? this.row(row) : html`<luma-update-card .hass=${this.hass} ${ref(node => { const card = node as HTMLElement & LovelaceCard; if (card && card.dataset.entity !== row.source) { card.setConfig({ type: "custom:luma-update-card", entity: row.source }); card.dataset.entity = row.source; } })}></luma-update-card>`)}</div>`)}` : html`<div class="list">${rows.some(row=>row.kind!=="update") && rows.some(row=>row.kind==="update") ? html`<div class="section-title">${this.t("Needs attention", "Figyelmet kér")}</div>` : nothing}${repeat(rows.filter(row=>row.kind!=="update").slice(0,this.limit),row=>row.id,row=>this.row(row))}${rows.some(row=>row.kind==="update") ? html`<div class="section-title">${this.t("Planned maintenance · available updates", "Tervezhető karbantartás · elérhető frissítések")}</div>` : nothing}${repeat((this.config.panel && this.filter==="active" ? attentionSummaries(rows.filter(row=>row.kind==="update"),undefined,true) : rows.filter(row=>row.kind==="update")).slice(0,this.limit),row=>row.id,row=>this.row(row))}</div>`}
      ${!rows.length ? this.empty(missing.length, loading) : nothing}
      ${mode !== "updates" && rows.length > this.limit ? html`<button class="action secondary more" @click=${() => this.limit += 50}>${this.t("Show more", "Továbbiak")} (${rows.length - this.limit})<ha-icon icon="mdi:chevron-down"></ha-icon></button>` : nothing}
    </ha-card></div>`;
    const detail = this.selected ? html`<div>${selected ? this.details(selected,relevant) : html`<p class="explanation">${this.t("This condition is no longer in the current snapshot. This alone does not prove who resolved it.","Ez a jelzés már nem szerepel az aktuális állapotban. Ebből önmagában nem állapítható meg, ki vagy mi szüntette meg.")}</p>`}</div>` : nothing;
    const backLabel=this.t("Back to notifications", "Vissza a jelzésekhez");
    if(this.config.embedded && !this.config.panel)return html`${this.selected ? html`<button class="action secondary back" @click=${()=>this.back()}><ha-icon icon="mdi:arrow-left"></ha-icon>${backLabel}</button>` : nothing}${list}${detail}`;
    if(!this.config.panel)return html`${list}<luma-bottom-sheet .open=${this.detailsOpen} .heading=${selected?.name || this.t("Notification changed", "A jelzés megváltozott")} .subtitle=${selected ? this.kind(selected) : ""} .icon=${selected ? this.icon(selected) : icon} .maxWidth=${720} .closeLabel=${this.t("Close", "Bezárás")} @sheet-dismiss=${()=>this.close()}>${detail}</luma-bottom-sheet>`;
    return html`<luma-bottom-sheet .open=${this.open} .heading=${this.selected ? selected?.name || this.t("Notification changed", "A jelzés megváltozott") : title} .subtitle=${this.selected && selected ? this.kind(selected) : this.t("Issues, maintenance and monitoring coverage", "Jelzések, karbantartás és felügyeleti lefedettség")} .backLabel=${this.selected ? backLabel : ""} .icon=${selected ? this.icon(selected) : icon} .maxWidth=${760} .closeLabel=${this.t("Close", "Bezárás")} @sheet-back=${()=>this.back()} @sheet-dismiss=${()=>this.close()}>${list}${detail}</luma-bottom-sheet>`;
  }
}
