import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { AttentionSubscription, attentionPolicy, householdRuntime, refreshHousehold } from '../attention-runtime';
import { callHouseholdScript, householdRules, currentHouseholdEvaluations, type HouseholdRule } from '../household-context';
import { localized } from '../localize';
import { lumaTokens } from '../styles';
import type { HomeAssistant, LovelaceCard } from '../types';
interface Config {type:string;policy:string;title?:string;embedded?:boolean}

/** A durable rule catalogue/editor, separate from incident acknowledgement. */
@customElement('luma-household-context-card')
export class LumaHouseholdContextCard extends LitElement implements LovelaceCard {
  @property({attribute:false}) hass?:HomeAssistant;
  @state() private config?:Config;
  @state() private editing?:HouseholdRule;
  @state() private search='';
  @state() private confirming?:{operation:'upsert'|'set_enabled';approve?:boolean;enabled?:boolean;rule:HouseholdRule;revision:number};
  @state() private busy=false;
  @state() private message='';
  @state() private error='';
  private subscription=new AttentionSubscription(()=>this.requestUpdate());
  static styles=[lumaTokens,css`
    :host{display:block;min-width:0;container-type:inline-size}
    ha-card{padding:20px;border:1px solid var(--luma-border);border-radius:var(--luma-radius-card);background:var(--luma-surface);box-shadow:var(--luma-shadow)}
    ha-card.embedded{padding:0;border:0;background:transparent;box-shadow:none}
    h2{font-size:var(--luma-text-lg);margin:0 0 8px}h3{font-size:var(--luma-text-md);margin:0;line-height:1.5}p{margin:8px 0;font-size:var(--luma-text-sm);line-height:1.65;overflow-wrap:anywhere}.muted,small{color:var(--luma-muted)}
    .header,.actions,.tags{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.header{justify-content:space-between;margin-bottom:12px}.cards{display:grid;gap:12px}.rule,.editor,.confirm{padding:16px;border:1px solid var(--luma-border);border-radius:var(--luma-radius-control);min-width:0}.editor{margin-top:16px}.confirm{margin-top:14px;background:color-mix(in srgb,var(--primary-color) 6%,transparent)}.tags{margin:10px 0}.tag{font-size:11px;color:var(--primary-color);background:color-mix(in srgb,var(--primary-color) 10%,transparent);border-radius:999px;padding:5px 9px}.tag.muted{color:var(--luma-muted);background:color-mix(in srgb,var(--primary-text-color) 5%,transparent)}
    button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:44px;padding:9px 14px;border:1px solid var(--luma-border);border-radius:999px;color:var(--primary-color);background:color-mix(in srgb,var(--primary-color) 7%,transparent);font:inherit;font-size:var(--luma-text-sm);font-weight:650;cursor:pointer}button.secondary{background:transparent;color:var(--luma-muted)}button:disabled{opacity:.5;cursor:default}ha-icon{--mdc-icon-size:18px}
    label{display:grid;gap:7px;margin:14px 0;font-size:var(--luma-text-sm);font-weight:650}input,select,textarea{box-sizing:border-box;min-width:0;width:100%;min-height:44px;padding:11px;border:1px solid var(--luma-border);border-radius:var(--luma-radius-control);font:inherit;font-weight:400;background:var(--luma-surface);color:var(--primary-text-color)}textarea{min-height:110px;resize:vertical}.fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px}.fields>.wide{grid-column:1/-1}code{font-size:11px;overflow-wrap:anywhere}summary{min-height:44px;display:flex;align-items:center;cursor:pointer;font-size:var(--luma-text-sm);color:var(--luma-muted)}details{margin-top:12px}ul{margin:6px 0;padding-left:20px;font-size:var(--luma-text-sm);line-height:1.7}.error{color:var(--error-color)}.history{border-top:1px solid var(--luma-border);padding:12px 0}.history strong{font-size:var(--luma-text-sm)}.empty{padding:16px 0}
    button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible{outline:2px solid var(--primary-color);outline-offset:3px}
    @container(max-width:580px){ha-card{padding:16px}.fields{grid-template-columns:1fr}.rule,.editor,.confirm{padding:13px}.actions button{flex:1 1 auto}}
  `];
  setConfig(config:Config){if(!config.policy)throw Error('Household policy required');this.config=config;}
  getCardSize(){return 5;}
  connectedCallback(){super.connectedCallback();this.subscription.connect();}
  disconnectedCallback(){this.subscription.disconnect();super.disconnectedCallback();}
  protected updated(){this.subscription.update(this.hass,this.config?.policy);}
  private t(en:string,hu:string){return localized(this.hass,en,hu);}
  private get binding(){return attentionPolicy(this.config?.policy)?.household;}
  private get revision(){return Number(this.binding && this.hass?.states[this.binding.entity]?.attributes.revision);}
  private name(entity:string){return String(this.hass?.states[entity]?.attributes.friendly_name || entity);}
  private status(rule:HouseholdRule){
    if(rule.status!=='approved')return this.t('Draft · not applied','Piszkozat · nem érvényesül');
    if(!rule.enabled)return this.t('Disabled','Kikapcsolva');
    const result=householdRuntime().snapshot?.evaluations.find(e=>e.id===rule.id);
    if(result?.status==='applies' && this.binding && !currentHouseholdEvaluations(this.hass!,this.binding,householdRuntime().snapshot).some(e=>e.id===rule.id))return this.t('Checking applicability','Érvényesség ellenőrzése');
    const labels:Record<string,[string,string]>={applies:['Applies now','Most érvényesül'],does_not_apply:['Condition not present','A feltétel most nem áll fenn'],insufficient_data:['Insufficient evidence','Nincs elég adat a feltételhez'],expired:['Expired','Lejárt']};
    return result && labels[result.status] ? this.t(...labels[result.status]) : this.t('Checking applicability','Érvényesség ellenőrzése');
  }
  private edit(rule?:HouseholdRule){
    if(this.busy)return;
    this.editing=rule ? JSON.parse(JSON.stringify(rule)) : {id:`context_${Date.now().toString(36)}`,title:'',explanation:'',effect:'context',targets:[],target_states:['unknown','unavailable'],when:[],enabled:true,status:'draft',evidence:'user_context'};
    this.confirming=undefined;this.error='';this.message='';this.search='';
    void this.updateComplete.then(()=>this.renderRoot.querySelector<HTMLElement>('.editor input')?.focus());
  }
  private change(update:Partial<HouseholdRule>){if(this.editing)this.editing={...this.editing,...update};this.confirming=undefined;}
  private prepare(approve:boolean){
    const r=this.editing;if(!r||!this.hass)return;
    if(!r.title.trim()||!r.explanation.trim()||!r.targets.length||r.targets.some(id=>!this.hass?.states[id])){this.error=this.t('Choose known entities and enter a title and explanation.','Válassz létező entitást, és adj meg címet és magyarázatot.');return;}
    if(r.effect==='expected_unavailable' && ((!r.when.length && r.evidence!=='unsupported_capability') || r.target_states.some(s=>!['unknown','unavailable'].includes(s)) || !r.target_states.length)){this.error=this.t('An exception needs a verified condition and may cover only unknown/unavailable states.','A kivételhez igazolható feltétel kell, és csak unknown/unavailable állapotra vonatkozhat.');return;}
    this.error='';this.confirming={operation:'upsert',approve,rule:JSON.parse(JSON.stringify(r)),revision:this.revision};
  }
  private async save(){
    const c=this.confirming,config=this.binding;if(!c||!config?.manage_script||!this.hass||this.busy)return;
    this.busy=true;this.error='';this.message='';
    try {
      const result=await callHouseholdScript(this.hass,config.manage_script,{operation:c.operation,record:c.operation==='upsert'?c.rule:undefined,rule_id:c.rule.id,enabled:c.enabled,approve:c.approve,expected_revision:c.revision,confirmed:true});
      if(result.ok!==true){
        const messages:Record<string,[string,string]>={revision_conflict:['Someone changed the rules meanwhile. Review the current version before saving again.','Közben megváltozott a szabálytár. Mentés előtt nézd át az aktuális verziót.'],save_unconfirmed:['The write was sent but its confirmation is missing. Check the current revision before retrying.','Az írás elküldve, de a visszaigazolás hiányzik. Újrapróbálás előtt ellenőrizd az aktuális verziót.'],unsafe_exception:['This exception is too broad. Add reliable evidence and restrict it to missing measurements.','Ez a kivétel túl tág. Adj megbízható feltételt, és korlátozd hiányzó mérésekre.'],protected_target:['This safety source cannot be excluded by a household rule.','Ezt a biztonsági forrást háztartási szabállyal nem lehet kizárni.']};
        this.error=messages[String(result.error)]?this.t(...messages[String(result.error)]):this.t('The rule was not saved. Review the fields and try again.','A szabály nem lett mentve. Ellenőrizd a mezőket, majd próbáld újra.');this.confirming=undefined;return;
      }
      this.editing=undefined;this.confirming=undefined;
      this.message=this.t(`Saved · revision ${result.revision}`,`Mentve · ${result.revision}. verzió`);
      await refreshHousehold(this.hass,attentionPolicy(this.config?.policy),true);
    }catch{this.error=this.t('Could not save the rule. No success was confirmed.','Nem sikerült menteni a szabályt. Sikeres módosítás nem igazolt.');}
    finally{this.busy=false;}
  }
  private conditions(rule:HouseholdRule){return html`<ul>${rule.when.length?rule.when.map(c=>html`<li>${this.name(c.entity)}: ${c.states.join(' / ')}${c.max_age_minutes ? this.t(` · updated within ${c.max_age_minutes} min`,` · legfeljebb ${c.max_age_minutes} perces adat`) : ''}</li>`):html`<li>${this.t('No additional state condition','Nincs további állapotfeltétel')}</li>`}<li>${this.t('Target state','Érintett állapot')}: ${rule.target_states.join(' / ') || this.t('any','bármelyik')}</li></ul>`;}
  private editor(){
    const r=this.editing;if(!r||!this.hass)return nothing;
    const entities=Object.values(this.hass.states).filter(e=>`${e.entity_id} ${e.attributes.friendly_name||''}`.toLocaleLowerCase().includes(this.search.toLocaleLowerCase())).slice(0,80);
    const updateGuard=(entity:string,state:string)=>this.change({when:entity ? [{...r.when[0],entity,states:state.split(',').map(s=>s.trim()).filter(Boolean)},...r.when.slice(1)] : []});
    return html`<section class="editor" aria-label=${this.t('Edit household rule','Háztartási szabály szerkesztése')}><h3>${this.t('Rule and evidence','Szabály és indoklás')}</h3><div class="fields">
      <label class="wide">${this.t('Title','Cím')}<input data-field="title" maxlength="120" .value=${r.title} @input=${(e:Event)=>this.change({title:(e.target as HTMLInputElement).value})}></label>
      <label class="wide">${this.t('Household knowledge','Háztartási háttértudás')}<textarea data-field="explanation" maxlength="1000" .value=${r.explanation} @input=${(e:Event)=>this.change({explanation:(e.target as HTMLTextAreaElement).value})}></textarea></label>
      <label>${this.t('Find entity','Entitás keresése')}<input type="search" .value=${this.search} @input=${(e:Event)=>this.search=(e.target as HTMLInputElement).value} placeholder=${this.t('Device or entity name','Eszköz vagy entitás neve')}></label>
      <label>${this.t('Primary entity','Elsődleges entitás')}<select data-field="target" .value=${r.targets[0]||''} @change=${(e:Event)=>this.change({targets:[(e.target as HTMLSelectElement).value,...r.targets.slice(1)]})}><option value="" .selected=${!r.targets[0]}>${this.t('Select…','Válassz…')}</option>${[...new Set([...r.targets,...entities.map(e=>e.entity_id)])].map(id=>html`<option value=${id} .selected=${r.targets[0]===id}>${this.name(id)}</option>`)}</select></label>
    </div><details class="advanced" ?open=${r.effect!=="context"||r.when.length>0}><summary>${this.t('Conditions, effect & limitations','Feltételek, hatás és korlátok')}</summary><div class="fields">
      <label>${this.t('Effect','Hatás')}<select data-field="effect" .value=${r.effect} @change=${(e:Event)=>this.change({effect:(e.target as HTMLSelectElement).value as HouseholdRule['effect'],target_states:['unknown','unavailable']})}><option value="context">${this.t('Explanation only · no suppression','Csak magyarázat · nem rejt el jelzést')}</option><option value="expected_unavailable">${this.t('Expected missing measurement','Várt adathiány')}</option></select></label>
      <label>${this.t('Target states (comma separated)','Érintett állapotok (vesszővel)')}<input data-field="states" .value=${r.target_states.join(', ')} @input=${(e:Event)=>this.change({target_states:(e.target as HTMLInputElement).value.split(',').map(s=>s.trim()).filter(Boolean)})}></label>
      <label>${this.t('Only if this entity… (optional)','Csak ha ez az entitás… (opcionális)')}<input data-field="guard" .value=${r.when[0]?.entity||''} @change=${(e:Event)=>updateGuard((e.target as HTMLInputElement).value,r.when[0]?.states.join(',')||'')}></label>
      <label>${this.t('…has this state','…ebben az állapotban van')}<input data-field="guard-state" .value=${r.when[0]?.states.join(', ')||''} @change=${(e:Event)=>updateGuard(r.when[0]?.entity||'',(e.target as HTMLInputElement).value)}></label>
      <label class="wide">${this.t('Limits of this knowledge','A háttértudás korlátai')}<textarea data-field="limitation" maxlength="1000" .value=${r.limitation||''} @input=${(e:Event)=>this.change({limitation:(e.target as HTMLTextAreaElement).value})}></textarea></label>
    </div></details><p class="muted">${this.t('An inactive program flag alone does not prove power-off. Unknown or stale evidence never satisfies a condition.','Az inaktív programjelző önmagában nem bizonyít kikapcsolást. Ismeretlen vagy előírt frissességűnél régebbi adat nem teljesíti a feltételt.')}</p>
    ${r.targets.length>1||r.when.length>1?html`<details><summary>${this.t('All linked sources and conditions','Összes kapcsolódó forrás és feltétel')}</summary><p>${r.targets.map(id=>this.name(id)).join(' · ')}</p>${this.conditions(r)}</details>`:nothing}
    <div class="actions"><button ?disabled=${this.busy} @click=${()=>this.prepare(true)}>${this.t('Review & approve','Áttekintés és jóváhagyás')}</button><button class="secondary" ?disabled=${this.busy} @click=${()=>this.prepare(false)}>${this.t('Save draft','Piszkozat mentése')}</button><button class="secondary" ?disabled=${this.busy} @click=${()=>{this.editing=undefined;this.confirming=undefined;}}>${this.t('Cancel','Mégse')}</button></div></section>`;
  }
  render(){
    if(!this.hass||!this.config)return nothing;
    const config=this.binding,source=config&&this.hass.states[config.entity],rules=householdRules(this.hass,config),ready=source&&source.attributes.schema_version===1&&!['unknown','unavailable'].includes(source.state);
    const history=Array.isArray(source?.attributes.history)?source.attributes.history as Array<{revision:number;at:string;operation:string;rule_id:string;before?:HouseholdRule;after?:HouseholdRule}>:[];
    return html`<ha-card class=${this.config.embedded?"embedded":""}><div class="header">${!this.config.embedded?html`<h2>${this.config.title||this.t('Household knowledge','Háztartási háttértudás')}</h2>`:nothing}${ready&&config?.manage_script?html`<button ?disabled=${this.busy} @click=${()=>this.edit()}><ha-icon icon="mdi:plus"></ha-icon>${this.t('Add knowledge','Háttértudás hozzáadása')}</button>`:nothing}</div>
      <p class="muted">${this.t('Approved, conditional rules shared by notifications and the daily report. Explanations and exceptions have different effects.','Jóváhagyott, feltételes szabályok a jelzésekhez és a napi jelentéshez. A magyarázat és az értékelést módosító kivétel külön hatás.')}</p>
      ${!ready?html`<p class="error" role="status">${this.t('The shared rule registry is unavailable. No new exception can be confirmed.','A közös szabálytár nem érhető el. Új kivétel érvényessége nem igazolható.')}</p>`:nothing}
      <div class="cards">${rules.map(r=>html`<article class="rule"><h3>${r.title}</h3><div class="tags"><span class="tag">${r.effect==='context'?this.t('Explanation only','Csak magyarázat'):this.t('Expected data gap','Várt adathiány')}</span><span class="tag muted">${this.status(r)}</span></div><p>${r.explanation}</p>${r.limitation?html`<p class="muted">${r.limitation}</p>`:nothing}<details><summary>${this.t('Scope, conditions & approval','Érintett kör, feltételek és jóváhagyás')}</summary><p>${r.targets.map(id=>this.name(id)).join(' · ')}</p>${this.conditions(r)}<p class="muted">${this.t('Approved','Jóváhagyva')}: ${r.approved_at?new Date(r.approved_at).toLocaleString(this.hass?.locale?.language):'—'} · <code>${r.id}</code></p></details>${config?.manage_script?html`<div class="actions"><button class="secondary" ?disabled=${this.busy} @click=${()=>this.edit(r)}>${this.t('Edit','Szerkesztés')}</button>${r.status==='approved'?html`<button class="secondary" ?disabled=${this.busy} @click=${()=>{this.confirming={operation:'set_enabled',rule:r,enabled:!r.enabled,revision:this.revision};this.error='';}}>${r.enabled?this.t('Disable rule','Szabály kikapcsolása'):this.t('Enable rule','Szabály bekapcsolása')}</button>`:nothing}</div>`:nothing}</article>`)}</div>
      ${ready&&!rules.length?html`<p class="empty muted">${this.t('No household rules yet.','Még nincs háztartási szabály.')}</p>`:nothing}
      ${this.editor()}
      ${this.confirming?html`<section class="confirm" aria-label=${this.t('Confirm rule change','Szabálymódosítás megerősítése')}><h3>${this.confirming.rule.title}</h3><p>${this.confirming.operation==='set_enabled'?this.confirming.enabled?this.t('Enable this approved rule?','Bekapcsolod ezt a jóváhagyott szabályt?'):this.t('Disable this rule? Its exception will stop applying.','Kikapcsolod ezt a szabályt? A hozzá tartozó kivétel nem fog érvényesülni.'):this.confirming.approve?this.confirming.rule.effect==='context'?this.t('Approve this explanation? It will not suppress alerts.','Jóváhagyod ezt a magyarázatot? Nem fog jelzést elrejteni.'):this.t('Approve this conditional exception? Matching missing measurements will be treated as expected; active faults remain visible.','Jóváhagyod ezt a feltételes kivételt? Az illeszkedő hiányzó mérés vártnak számít; az aktív hibajelzés látható marad.'):this.t('Save as a draft? It will not apply.','Piszkozatként mented? Nem fog érvényesülni.')}</p><p class="muted">${this.t('Applies to','Érintett kör')}: ${this.confirming.rule.targets.map(id=>this.name(id)).join(' · ')}</p>${this.conditions(this.confirming.rule)}<p>${this.confirming.rule.explanation}</p><div class="actions"><button ?disabled=${this.busy} @click=${()=>this.save()}>${this.busy?this.t('Saving…','Mentés…'):this.t('Confirm','Megerősítés')}</button><button class="secondary" ?disabled=${this.busy} @click=${()=>this.confirming=undefined}>${this.t('Back','Vissza')}</button></div></section>`:nothing}
      ${this.error?html`<p class="error" role="alert">${this.error}</p>`:nothing}${this.message?html`<p role="status">${this.message}</p>`:nothing}
      ${ready?html`<details><summary>${this.t('Rule change history','Szabálymódosítások előzményei')} · ${this.revision}</summary><p class="muted">${this.t('The last 20 rule changes; this is not an incident history.','Az utolsó húsz szabálymódosítás; ez nem a jelzések eseménytörténete.')}</p>${history.slice().reverse().map(item=>html`<div class="history"><strong>${item.revision}. ${item.operation==='migration'?this.t('Existing knowledge imported','Korábbi háttértudás átvétele'):item.after?.title||item.rule_id}</strong><p class="muted">${new Date(item.at).toLocaleString(this.hass?.locale?.language)}</p>${item.before?html`<details><summary>${this.t('Before','Előtte')}</summary><p>${item.before.explanation}</p><p>${item.before.targets.map(id=>this.name(id)).join(' · ')} · ${item.before.effect} · ${item.before.enabled?this.t('enabled','bekapcsolva'):this.t('disabled','kikapcsolva')}</p>${this.conditions(item.before)}</details>`:nothing}${item.after?html`<details><summary>${this.t('After','Utána')}</summary><p>${item.after.explanation}</p><p>${item.after.targets.map(id=>this.name(id)).join(' · ')} · ${item.after.effect} · ${item.after.enabled?this.t('enabled','bekapcsolva'):this.t('disabled','kikapcsolva')}</p>${this.conditions(item.after)}</details>`:nothing}</div>`)}</details>`:nothing}
    </ha-card>`;
  }
}
