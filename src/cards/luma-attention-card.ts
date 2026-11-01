import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import { activeAttention, attentionAckValue, attentionSummaries, type AttentionEntry } from "../attention";
import { AttentionSubscription, attentionPolicy, policyRows } from "../attention-runtime";
import { localized } from "../localize";
import { runAction } from "../helpers";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LovelaceCard } from "../types";
import "./luma-update-card";
import "../components/luma-bottom-sheet";

interface Config { type:string; policy:string; scope?:string; mode?:"incidents"|"updates"|"diagnostics"; title?:string }
@customElement("luma-attention-card")
export class LumaAttentionCard extends LitElement implements LovelaceCard {
  @property({attribute:false}) hass?:HomeAssistant;
  @state() private config?:Config;
  @state() private query="";
  @state() private filter="active";
  @state() private selected?:string;
  @state() private limit=50;
  @state() private saving=false;
  @state() private error="";
  private subscription=new AttentionSubscription(()=>this.requestUpdate());
  static styles=[lumaTokens,css`
    :host{display:block;min-width:0;container-type:inline-size}ha-card{padding:16px;border:1px solid var(--luma-border);border-radius:var(--luma-radius-card);background:var(--luma-surface);box-shadow:var(--luma-shadow)}
    .header{display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px}.title{font-size:15px;font-weight:750}.muted{color:var(--luma-muted);font-size:12px;line-height:1.5}.filters{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}input,select{box-sizing:border-box;min-height:44px;min-width:0;padding:8px 10px;border:1px solid var(--luma-border);border-radius:var(--luma-radius-control);background:var(--luma-surface);color:var(--primary-text-color);font:inherit;font-size:13px}input{flex:1}
    .list{display:grid;gap:9px}.item{display:grid;grid-template-columns:36px minmax(0,1fr) auto;align-items:center;gap:10px;width:100%;min-height:64px;padding:10px;border:1px solid color-mix(in srgb,var(--tone) 16%,var(--luma-border));border-radius:var(--luma-radius-control);background:color-mix(in srgb,var(--tone) 5%,transparent);color:var(--primary-text-color);font:inherit;text-align:left;cursor:pointer}.item ha-icon{color:var(--tone);--mdc-icon-size:24px}.name{display:block;font-size:13px;font-weight:700;overflow-wrap:anywhere}.message{display:block;margin-top:3px;font-size:12px;color:var(--luma-muted);line-height:1.5;overflow-wrap:anywhere}.badge{font-size:11px;color:var(--tone);max-width:120px;text-align:right}.empty{padding:16px;font-size:13px;line-height:1.5;color:var(--luma-muted)}.group{font-size:13px;font-weight:720;margin:14px 0 8px}.updates{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.more,.action{min-height:44px;padding:9px 13px;border:1px solid var(--luma-border);border-radius:var(--luma-radius-control);background:color-mix(in srgb,var(--primary-color) 8%,var(--luma-surface));color:var(--primary-text-color);font:inherit;font-size:13px;cursor:pointer}.more{margin-top:12px}.detail{display:grid;gap:12px;line-height:1.6;font-size:13px;overflow-wrap:anywhere}.detail pre{white-space:pre-wrap;font:inherit;margin:0}.actions{display:flex;gap:8px;flex-wrap:wrap}.error{color:var(--error-color)}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--primary-color);outline-offset:2px}button:disabled{opacity:.5;cursor:default}
    @container(max-width:1000px){.updates{grid-template-columns:repeat(2,minmax(0,1fr))}}@container(max-width:580px){.updates{grid-template-columns:1fr}.item{grid-template-columns:28px minmax(0,1fr)}.badge{grid-column:2;text-align:left;max-width:none}.filters>*{width:100%}}
  `];
  setConfig(c:Config){if(!c?.policy)throw Error("Attention policy required");this.config={mode:"incidents",...c};this.query="";this.filter="active";this.limit=50;}
  getCardSize(){return 4}
  connectedCallback(){super.connectedCallback();this.subscription.connect()}
  disconnectedCallback(){super.disconnectedCallback();this.subscription.disconnect()}
  protected updated(){this.subscription.update(this.hass,this.config?.policy)}
  private status(row:AttentionEntry){
    if(row.snoozedUntil)return localized(this.hass,"Snoozed","Szüneteltetve");
    const labels:Record<string,[string,string]>={active:["Active","Aktív"],inactive:["Clear","Rendben"],pending:["Grace period","Türelmi idő"],unavailable:["Unavailable","Nem elérhető"],excluded:["Excluded","Kizárva"],installing:["Installing","Telepítés alatt"],event:["Latest event","Legutóbbi esemény"]};
    const [en,hu]=labels[row.status];return localized(this.hass,en,hu);
  }
  private reason(row:AttentionEntry){
    const labels:Record<string,[string,string]>={condition_not_met:["The alert condition is not met","A riasztási feltétel nem teljesül"],condition_met:["The alert condition is active","A riasztási feltétel fennáll"],grace_period:["Waiting for the condition to persist","A feltétel tartósságára vár"],source_unavailable:["No reliable state is available","Nincs megbízható állapotadat"],disabled:["Entity disabled in HA","Az entitás le van tiltva a HA-ban"],restored:["Restored entity without current telemetry","Visszaállított entitás, friss adat nélkül"],ignored_label:["Excluded by policy label","Policy-címke alapján kizárva"],policy_exception:["Explicit policy exception","Kifejezett policy-kivétel"],update_available:["A newer version is available","Újabb verzió érhető el"],up_to_date:["No newer version reported","Nem jelez újabb verziót"],installing:["An installation is in progress","Telepítés van folyamatban"],problem_signal:["Integration problem signal","Az integráció hibajelzője"],persistent_notification:["A retained HA notification","Fennmaradt HA-értesítés"],repair_issue:["Home Assistant repair issue","Home Assistant javítási feladat"],integration_error:["Integration setup failed or is retrying","Az integráció betöltése hibás vagy újrapróbálkozik"],latest_event_only:["Latest event, not an active fault count","Legutóbbi esemény, nem aktív hibaszám"],adapter_unavailable:["Could not read this source","Nem sikerült beolvasni ezt a forrást"],covered_by_stronger_rule:["Covered by a stronger alert","Súlyosabb riasztás már lefedi"],policy_unavailable:["Policy unavailable or incompatible","A policy nem elérhető vagy nem kompatibilis"]};
    const item=labels[row.reason];return item?localized(this.hass,...item):row.reason;
  }
  private row(row:AttentionEntry){
    const tone=row.status==="active"&&!row.snoozedUntil?(row.tone==="error"?"var(--error-color)":"var(--warning-color)"):row.status==="inactive"?"var(--success-color)":"var(--secondary-text-color)";
    return html`<button class="item" style=${`--tone:${tone}`} @click=${()=>this.selected=row.id}><ha-icon icon=${row.kind==="update"?"mdi:update":row.status==="inactive"?"mdi:check-circle-outline":"mdi:information-outline"}></ha-icon><span><span class="name">${row.name}</span><span class="message">${this.config?.mode==="diagnostics"?this.reason(row):row.message}</span></span><span class="badge">${this.status(row)}</span></button>`;
  }
  private async unsnooze(row:AttentionEntry){
    const id=attentionPolicy(this.config?.policy)?.acknowledgements_entity;if(!id||!this.hass)return;
    const source=this.hass.states[id];this.saving=true;this.error="";
    try{await this.hass.callService("input_text","set_value",{value:attentionAckValue(source?.state,row.key,null,Date.now()/1000,Number(source?.attributes.max||255))},{entity_id:id})}
    catch{this.error=localized(this.hass,"Could not restore the alert. Try again.","Nem sikerült visszaállítani a jelzést. Próbáld újra.")}
    finally{this.saving=false}
  }
  render(){
    if(!this.hass||!this.config)return nothing;
    const policy=attentionPolicy(this.config.policy),all=policyRows(this.config.policy,this.hass).filter(x=>!this.config?.scope||x.scope===this.config.scope||x.scope==="system");
    const mode=this.config.mode;
    const relevant=all.filter(x=>mode==="diagnostics"||(mode==="updates"?(x.kind==="update"||x.scope==="system"):x.kind!=="update"));
    const active=activeAttention(relevant,undefined,true),missing=relevant.filter(x=>x.status==="unavailable"),snoozed=relevant.filter(x=>x.snoozedUntil);
    const missingCount=new Set(missing.map(x=>x.source)).size;
    let rows=mode==="diagnostics"?relevant:mode==="updates"?relevant.filter(x=>["active","installing","unavailable"].includes(x.status)):attentionSummaries(relevant,undefined,true);
    if(mode==="diagnostics")rows=rows.filter(x=>this.filter==="all"?true:this.filter==="snoozed"?!!x.snoozedUntil:this.filter==="active"?["active","installing"].includes(x.status):x.status===this.filter);
    const query=this.query.trim().toLowerCase();if(query)rows=rows.filter(x=>`${x.name} ${x.source} ${x.rule} ${x.category} ${x.message} ${x.reason}`.toLowerCase().includes(query));
    const selected=all.find(x=>x.id===this.selected);
    const title=this.config.title||localized(this.hass,mode==="updates"?"Available updates":mode==="diagnostics"?"Notification coverage":"Incidents",mode==="updates"?"Elérhető frissítések":mode==="diagnostics"?"Értesítési lefedettség":"Incidensek");
    return html`<ha-card><div class="header"><span class="title">${title}</span><span class="muted">${active.length} ${localized(this.hass,"active sources","aktív forrás")} · ${missingCount} ${localized(this.hass,"unavailable","nem elérhető")} · ${new Set(snoozed.map(x=>x.key)).size} ${localized(this.hass,"snoozed","szüneteltetve")}</span></div>
      ${mode==="diagnostics"?html`<div class="filters"><input aria-label=${localized(this.hass,"Search sources","Források keresése")} placeholder=${localized(this.hass,"Search entity, rule or device","Entitás, szabály vagy eszköz keresése")} .value=${this.query} @input=${(e:Event)=>{this.query=(e.target as HTMLInputElement).value;this.limit=50}}><select aria-label=${localized(this.hass,"Status filter","Állapotszűrő")} .value=${this.filter} @change=${(e:Event)=>{this.filter=(e.target as HTMLSelectElement).value;this.limit=50}}>${[["active","Active","Aktív"],["snoozed","Snoozed","Szüneteltetett"],["unavailable","Unavailable","Nem elérhető"],["pending","Grace period","Türelmi idő"],["inactive","Clear","Rendben"],["excluded","Excluded","Kizárt"],["event","Events","Esemény"],["all","All","Összes"]].map(([value,en,hu])=>html`<option value=${value}>${localized(this.hass,en,hu)}</option>`)}</select></div>`:nothing}
      ${mode==="updates"?html`${[...new Set(rows.map(x=>x.category))].map(category=>html`<div class="group">${rows.find(x=>x.category===category)?.message}</div><div class="updates">${repeat(rows.filter(x=>x.category===category),x=>x.id,x=>x.status==="unavailable"||x.kind!=="update"?this.row(x):html`<luma-update-card .hass=${this.hass} ${ref(node=>{const card=node as HTMLElement&LovelaceCard;if(card&&card.dataset.entity!==x.source){card.setConfig({type:"custom:luma-update-card",entity:x.source});card.dataset.entity=x.source}})}></luma-update-card>`)}</div>`)}`:html`<div class="list">${repeat(rows.slice(0,this.limit),x=>x.id,x=>this.row(x))}</div>`}
      ${!rows.length?html`<div class="empty">${localized(this.hass,"No matching items.","Nincs a szűrésnek megfelelő elem.")}${missing.length?html` ${localized(this.hass,"Some sources are unavailable; check coverage.","Néhány forrás nem elérhető; ellenőrizd a lefedettséget.")}`:nothing}</div>`:nothing}
      ${mode!=="updates"&&rows.length>this.limit?html`<button class="more" @click=${()=>this.limit+=50}>${localized(this.hass,"Show more","Továbbiak")} (${rows.length-this.limit})</button>`:nothing}
      ${mode==="diagnostics"?html`<div class="muted">${policy?.revision||"—"} · ${all.length} ${localized(this.hass,"source/rule evaluations","forrás/szabály kiértékelés")}</div>`:nothing}
    </ha-card><luma-bottom-sheet .open=${!!selected} .heading=${selected?.name||""} .closeLabel=${localized(this.hass,"Close","Bezárás")} @sheet-dismiss=${()=>this.selected=undefined}>
      ${selected?html`<div class="detail"><strong>${this.status(selected)}</strong><pre>${selected.message}</pre><div>${this.reason(selected)}</div>${selected.snoozedUntil?html`<div>${localized(this.hass,"Snoozed until","Szüneteltetve eddig")}: ${new Date(selected.snoozedUntil*1000).toLocaleString(this.hass.locale?.language)}</div>`:nothing}<div class="muted">${selected.source}<br>${selected.rule} · ${selected.category}</div><div class="actions">${this.hass.states[selected.source]?html`<button class="action" @click=${()=>runAction(this,this.hass!,{action:"more-info"},selected.source)}>${localized(this.hass,"Entity history","Entitás és előzmények")}</button>`:nothing}${selected.snoozedUntil?html`<button class="action" ?disabled=${this.saving} @click=${()=>this.unsnooze(selected)}>${localized(this.hass,"Show alert again","Jelzés visszaállítása")}</button>`:nothing}${selected.path&&selected.path!==policy?.diagnostics_path?html`<button class="action" @click=${()=>runAction(this,this.hass!,{action:"navigate",navigation_path:selected.path!})}>${localized(this.hass,"Open details","Részletes nézet")}</button>`:nothing}</div>${this.error?html`<div class="error" role="alert">${this.error}</div>`:nothing}</div>`:nothing}
    </luma-bottom-sheet>`;
  }
}
