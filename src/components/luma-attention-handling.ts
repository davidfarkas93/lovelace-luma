import {LitElement,css,html,nothing} from 'lit';
import {customElement,property,state} from 'lit/decorators.js';
import type {AttentionEntry} from '../attention';
import {attentionEpisode,recordAttentionHandling,refreshAttentionBackend,type AttentionHandlingOperation,type EpisodeEvent,type EpisodeHistory} from '../attention-runtime';
import {localized} from '../localize';
import {lumaTokens} from '../styles';
import type {HomeAssistant} from '../types';

/** Metadata inside the existing detail surface; never controls source devices. */
@customElement('luma-attention-handling')
export class LumaAttentionHandling extends LitElement {
 @property({attribute:false}) hass?:HomeAssistant;
 @property() policy='';
 @property({attribute:false}) entries:AttentionEntry[]=[];
 @state() private confirming=false;
 @state() private editing=false;
 @state() private note='';
 @state() private busy=false;
 @state() private error='';
 @state() private message='';
 private histories=new Map<string,EpisodeHistory>();
 private loading=new Set<string>();
 private historyErrors=new Set<string>();
 private selection='';private revisions='';private generation=0;
 static styles=[lumaTokens,css`
  :host{display:block;min-width:0;border-top:1px solid var(--luma-border);padding-top:16px}
  h3{font-size:var(--luma-text-sm);margin:0 0 10px}p{font-size:var(--luma-text-sm);line-height:1.65;margin:8px 0;overflow-wrap:anywhere}.muted{color:var(--luma-muted)}.actions{display:flex;gap:8px;flex-wrap:wrap}
  button{min-height:44px;padding:9px 14px;border:1px solid var(--luma-border);border-radius:999px;font:inherit;font-size:var(--luma-text-sm);font-weight:650;color:var(--primary-color);background:color-mix(in srgb,var(--primary-color) 7%,transparent);cursor:pointer}button:disabled{opacity:.5;cursor:default}
  .review{margin-top:12px;padding:14px;border:1px solid var(--luma-border);border-radius:var(--luma-radius-control);background:color-mix(in srgb,var(--primary-color) 4%,transparent)}label{display:grid;gap:7px;font-size:var(--luma-text-sm);margin:12px 0}textarea{box-sizing:border-box;width:100%;min-height:84px;padding:11px;border:1px solid var(--luma-border);border-radius:var(--luma-radius-control);background:var(--luma-surface);color:var(--primary-text-color);font:inherit;resize:vertical}
  details{margin-top:12px}summary{min-height:44px;display:flex;align-items:center;gap:6px;cursor:pointer;font-size:var(--luma-text-sm);color:var(--luma-muted)}ol{list-style:none;padding:0;margin:0}.event{border-left:2px solid var(--luma-border);padding:0 0 12px 12px;font-size:var(--luma-text-sm);line-height:1.6}.event p{white-space:pre-wrap;margin:4px 0}.event small{display:block;color:var(--luma-muted);font-size:11px}.error{color:var(--error-color)}button:focus-visible,summary:focus-visible,textarea:focus-visible{outline:2px solid var(--primary-color);outline-offset:3px}
 `];
 private t(en:string,hu:string){return localized(this.hass,en,hu);}
 disconnectedCallback(){this.generation++;super.disconnectedCallback();}
 protected updated(){
  const key=this.entries.map(r=>r.episodeId).join('|'),revision=this.entries.map(r=>r.handling?.revision||0).join('|');
  if(key!==this.selection){this.generation++;this.selection=key;this.histories.clear();this.loading.clear();this.historyErrors.clear();this.confirming=false;this.editing=false;this.note='';this.error='';this.message='';this.busy=false;}
  else if(revision!==this.revisions)for(const row of this.entries)if(this.histories.has(row.episodeId!))void this.load(row);
  this.revisions=revision;
 }
 private date(at:number){return new Date(at*1000).toLocaleString(this.hass?.locale?.language);}
 private async load(row:AttentionEntry,more=false){
  const episode=row.episodeId;if(!episode||!this.hass||this.loading.has(episode))return;
  const epoch=this.generation;this.loading.add(episode);this.historyErrors.delete(episode);this.requestUpdate();
  try{
   const previous=this.histories.get(episode),result=await attentionEpisode(this.hass,this.policy,episode,more?previous?.next_before:undefined);
   if(epoch!==this.generation)return;
   if(result.episode_id!==episode||!Array.isArray(result.events))throw Error('Invalid history');
   this.histories.set(episode,{...result,events:more?[...(previous?.events||[]),...result.events]:result.events});
  }catch{if(epoch===this.generation)this.historyErrors.add(episode);}
  finally{if(epoch===this.generation){this.loading.delete(episode);this.requestUpdate();}}
 }
 private async record(operation:AttentionHandlingOperation){
  if(!this.hass||this.busy)return;
  const epoch=this.generation;this.busy=true;this.error='';this.message='';
  try{
   await recordAttentionHandling(this.hass,this.policy,this.entries,operation,{...(this.note.trim()?{note:this.note.trim()}:{})});
   if(epoch!==this.generation)return;
   this.confirming=false;this.editing=false;this.note='';this.message=this.t('Recorded. The source condition is unchanged.','Rögzítve. A forrás állapotát ez nem módosítja.');
   for(const row of this.entries)if(this.histories.has(row.episodeId!))void this.load(row);
  }catch{
   if(epoch!==this.generation)return;
   this.error=this.t('Recording was not confirmed. Refresh the history before retrying; another client or the source may have changed.','A rögzítés nem igazolt. Újrapróbálás előtt frissítsd az előzményeket; közben a forrás vagy egy másik kliens módosíthatta az állapotot.');
   void refreshAttentionBackend(this.hass,this.policy,true);
  }finally{if(epoch===this.generation)this.busy=false;}
 }
 private eventLabel(event:EpisodeEvent){
  const key=event.operation||event.type;
  const labels:Record<string,[string,string]>={seen:['Marked as read','Elolvasottnak jelölve'],claimed_fixed:['User reported a fix','Javítást jelzett'],snooze:['Snoozed','Szüneteltette'],unsnooze:['Alert restored','Jelzés visszaállítva'],note:['Note added','Megjegyzés'],attention_first_observed:['First observed · actual start unknown','Első észlelés · a valódi kezdet ismeretlen'],attention_started:['Condition detected','Jelzés észlelve'],attention_condition_cleared:['Source condition cleared','A forrás rendeződött'],attention_notification_removed:['HA notification removed · resolution unconfirmed','HA-értesítés eltávolítva · a megoldás nem igazolt'],attention_observation_lost:['Observation lost','Megfigyelés megszakadt'],attention_observation_restored:['Observation restored','Megfigyelés helyreállt'],attention_excluded:['Excluded from evaluation','Kizárva az értékelésből'],attention_pending:['Waiting for confirmation','Megfigyelés alatt'],attention_superseded:['Replaced by a new source version','Új forrásverzió váltotta fel'],attention_no_longer_monitored:['No longer monitored','Már nem felügyelt forrás'],attention_changed:['Observed state changed','Megfigyelt állapotváltozás']};
  return labels[key]?this.t(...labels[key]):this.t('Journal event','Naplóbejegyzés');
 }
 render(){
  const entries=this.entries.filter(r=>r.episodeId);if(!entries.length)return nothing;
  const writable=entries.every(r=>r.canHandle),allFixed=entries.every(r=>r.handling?.claimed_fixed_at);
  return html`<h3>${this.t('Handling & history','Kezelés és előzmények')}</h3>
   ${entries.length>1?html`<p class="muted">${this.t(`Group handling: all ${entries.length} components.`,`Csoportos kezelés: mind a ${entries.length} összetevő.`)}</p>`:nothing}

   ${allFixed?html`<p class="muted">${this.t('A fix was reported. Actual recovery is determined by the source.','Javítás jelezve. A tényleges rendeződést a forrás állapota igazolja.')}</p>`:nothing}
   ${writable?html`<div class="actions"><button data-handling="claimed_fixed" ?disabled=${this.busy||!!allFixed} @click=${()=>{this.confirming=true;this.editing=false;this.error='';}}>${this.t('I fixed it','Megoldottam')}</button><button data-handling="note" ?disabled=${this.busy} @click=${()=>{this.editing=true;this.confirming=false;this.error='';}}>${this.t('Add note','Megjegyzés')}</button></div>`:nothing}
   ${this.confirming||this.editing?html`<section class="review" role="group" aria-label=${this.t('Record handling','Kezelés rögzítése')}>
    ${this.confirming?html`<p>${this.t('Record that you performed a fix? This does not close the episode. An active source alert remains visible.','Rögzítjük, hogy javítást végeztél? Ez nem zárja le az epizódot. Az aktív forrásjelzés látható marad.')}</p>`:nothing}
    <label>${this.t('Note','Megjegyzés')}${this.confirming?this.t(' (optional)',' (opcionális)'):''}<textarea maxlength="1000" .value=${this.note} @input=${(e:Event)=>this.note=(e.target as HTMLTextAreaElement).value}></textarea></label>
    <p class="muted">${this.t('A note is not an automatic exception. Use household knowledge for approved conditional rules.','A megjegyzés nem automatikus kivétel. Jóváhagyott, feltételes szabályhoz a háztartási háttértudást használd.')}</p>
    <div class="actions"><button data-handling="confirm" ?disabled=${this.busy||!this.confirming&&!this.note.trim()} @click=${()=>this.record(this.confirming?'claimed_fixed':'note')}>${this.busy?this.t('Saving…','Mentés…'):this.t('Record','Rögzítés')}</button><button ?disabled=${this.busy} @click=${()=>{this.confirming=false;this.editing=false;this.note='';}}>${this.t('Cancel','Mégse')}</button></div>
   </section>`:nothing}
   ${this.message?html`<p role="status" class="muted">${this.message}</p>`:nothing}${this.error?html`<p role="alert" class="error">${this.error}</p>`:nothing}
   ${entries.map(row=>{const id=row.episodeId!,history=this.histories.get(id),loading=this.loading.has(id);return html`<details class="history" @toggle=${(e:Event)=>{if((e.target as HTMLDetailsElement).open)void this.load(row);}}><summary>${this.t('History','Előzmények')}${entries.length>1?` · ${row.name}`:''}</summary>
    ${loading&&!history?html`<p role="status" class="muted">${this.t('Reading history…','Előzmények betöltése…')}</p>`:nothing}
    ${this.historyErrors.has(id)?html`<p role="alert" class="error">${this.t('History could not be read.','Az előzmények nem olvashatók.')}</p><button @click=${()=>this.load(row)}>${this.t('Retry','Újrapróbálás')}</button>`:nothing}
    ${history?html`<ol>${history.events.map(event=>html`<li class="event"><strong>${this.eventLabel(event)}</strong><small>${this.date(event.observed)}${event.actor_name?` · ${event.actor_name}`:''}</small>${event.until?html`<p class="muted">${this.t('Until','Eddig')}: ${this.date(event.until)}</p>`:nothing}${event.note?html`<p>${event.note}</p>`:nothing}</li>`)}</ol>${!history.events.length?html`<p class="muted">${this.t('No journal entries.','Nincs naplóbejegyzés.')}</p>`:nothing}${history.has_more?html`<button ?disabled=${loading} @click=${()=>this.load(row,true)}>${this.t('Earlier entries','Korábbi bejegyzések')}</button>`:nothing}`:nothing}
   </details>`;})}`;
 }
}
