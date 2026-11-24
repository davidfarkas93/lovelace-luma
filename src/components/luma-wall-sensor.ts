import { LitElement, css, html, nothing, svg, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized } from '../localize';
import { historyNumber } from '../history';
import { wallHistory } from '../wall-history';
import { lumaTokens, lumaInteractionStyles } from '../styles';
import type { HomeAssistant } from '../types';

/** One bounded-window history request on open/selection; no timer or subscriptions. */
@customElement('luma-wall-sensor')
export class LumaWallSensor extends LitElement {
  @property({attribute:false}) hass?:HomeAssistant;
  @property() entity='';
  @state() private hours=24;
  @state() private loading=false;
  @state() private error=false;
  @state() private data?:ReturnType<typeof wallHistory>;
  private start=0;
  private end=0;
  private serial=0;
  static styles=[lumaTokens,lumaInteractionStyles,css`
    .surface{border:1px solid var(--luma-border);border-radius:var(--luma-radius-card);background:var(--luma-surface);padding:24px;display:grid;gap:24px}
    .head{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap}.current{font-size:56px;font-weight:var(--luma-weight-title);font-variant-numeric:tabular-nums;letter-spacing:-.04em}.current small{font-size:24px;margin-left:8px;color:var(--luma-muted)}
    .label,.meta{font-size:14px;color:var(--luma-muted)}.periods{display:flex;gap:10px;flex-wrap:wrap}button{min-width:70px;min-height:56px;padding:12px 16px;border:1px solid var(--luma-border);border-radius:var(--luma-radius-control);background:transparent}
    button[aria-pressed=true]{border-color:var(--primary-color);background:color-mix(in srgb,var(--primary-color) 14%,transparent)}
    .chart{display:grid;grid-template-columns:44px minmax(0,1fr);gap:12px;height:280px}.axis{display:flex;flex-direction:column;justify-content:space-between;text-align:right;font-size:13px;color:var(--luma-muted);font-variant-numeric:tabular-nums}svg{width:100%;height:100%;overflow:visible}.line{stroke:var(--primary-color);stroke-width:3;fill:none;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}.grid{stroke:var(--luma-border);stroke-width:1;vector-effect:non-scaling-stroke}
    .times{display:flex;justify-content:space-between;margin-left:56px;color:var(--luma-muted);font-size:13px}.summary{display:flex;gap:32px;flex-wrap:wrap}.summary span{display:grid;gap:6px}.summary strong{font-size:22px;font-variant-numeric:tabular-nums}.empty{min-height:220px;display:grid;place-items:center;color:var(--luma-muted);text-align:center}
    @media(max-width:650px){.surface{padding:18px}.current{font-size:44px}.chart{height:220px}.head{gap:12px}.periods button{padding:10px;min-width:60px}}
  `];
  protected shouldUpdate(changed:PropertyValues<this>){
    if(!changed.has('hass')||changed.size>1)return true;
    const old=changed.get('hass') as HomeAssistant|undefined;
    return !old||old.locale!==this.hass?.locale||old.states[this.entity]!==this.hass?.states[this.entity];
  }
  protected updated(changed:PropertyValues){if(changed.has('entity')||changed.has('hours')||(!changed.get('hass')&&changed.has('hass')))void this.load();}
  disconnectedCallback(){this.serial++;super.disconnectedCallback()}
  private async load(){
    if(!this.entity||!this.hass)return;
    const serial=++this.serial,entity=this.entity,end=Date.now(),start=end-this.hours*3600000;
    this.loading=true;this.error=false;this.data=undefined;
    try{
      if(!this.hass.callWS)throw Error('History unavailable');
      const raw=await this.hass.callWS({type:'history/history_during_period',start_time:new Date(start).toISOString(),end_time:new Date(end).toISOString(),entity_ids:[entity],minimal_response:true,no_attributes:true,significant_changes_only:true});
      if(!this.isConnected||serial!==this.serial)return;
      this.data=wallHistory(raw,entity,{start,end});this.start=start;this.end=end;
    }catch{if(serial===this.serial)this.error=true;}
    finally{if(serial===this.serial)this.loading=false;}
  }
  render(){
    const e=this.hass?.states[this.entity],value=e?.attributes.restored?undefined:historyNumber(e?.state),unit=String(e?.attributes.unit_of_measurement||''),d=this.data;
    const t=(en:string,hu:string)=>localized(this.hass,en,hu),format=(n:number)=>new Intl.NumberFormat(this.hass?.locale?.language||'en',{maximumFractionDigits:1}).format(n);
    const time=(n:number)=>new Intl.DateTimeFormat(this.hass?.locale?.language||'en',{hour:'2-digit',minute:'2-digit',timeZone:this.hass?.config?.time_zone}).format(n);
    return html`<section class="surface"><div class="head"><div><div class="label">${t('Current','Jelenleg')}</div><div class="current">${value===undefined?'—':format(value)}<small>${unit}</small></div></div><div class="periods">${[6,24].map(hours=>html`<button aria-pressed=${hours===this.hours} @click=${()=>this.hours=hours}>${hours} ${t('hours','óra')}</button>`)}<button ?disabled=${this.loading} @click=${()=>this.load()}>${t('Refresh','Frissítés')}</button></div></div>
      ${this.loading||this.error||!d?.paths.length?html`<div class="empty" role="status">${this.loading?t('Loading history…','Előzmények betöltése…'):this.error?t('History could not be loaded. Try Refresh.','Az előzmények nem tölthetők be. Próbáld a Frissítést.'):t('No recorded data in this period','Ebben az időszakban nincs rögzített adat')}</div>`:html`
      <div class="summary"><span><small class="label">${t('Minimum','Minimum')}</small><strong>${format(d.min!)} ${unit}</strong></span><span><small class="label">${t('Maximum','Maximum')}</small><strong>${format(d.max!)} ${unit}</strong></span></div>
      <div class="chart"><div class="axis"><span>${format(d.high)}</span><span>${format((d.low+d.high)/2)}</span><span>${format(d.low)}</span></div><svg viewBox="0 0 1000 240" preserveAspectRatio="none" role="img" aria-label=${t('History chart','Előzmények grafikonja')}><path class="grid" d="M0 0H1000 M0 120H1000 M0 240H1000"></path>${d.paths.map(path=>svg`<path class="line" d=${path}></path>`)}</svg></div><div class="times"><span>${time(this.start)}</span><span>${time((this.start+this.end)/2)}</span><span>${time(this.end)}</span></div>`}
      ${this.end&&!this.loading&&!this.error?html`<div class="meta">${t('Updated','Frissítve')}: ${time(this.end)}</div>`:nothing}
    </section>`;
  }
}
