import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { localized, localizedMap } from "../localize";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LovelaceCard } from "../types";

interface Session {
  session_id?: string;
  started_at?: string;
  ended_at?: string;
  energy_kwh?: number;
  pv_energy_kwh?: number;
  grid_energy_kwh?: number;
  unclassified_energy_kwh?: number;
  pv_share_pct?: number;
  duration_s?: number;
  charging_s?: number;
  mode?: string;
  ownership?: string;
  stop_reason?: string;
  transaction_id?: number;
}

interface Config {
  type: string;
  history_entity: string;
  event_entity?: string;
  title?: string;
  subtitle?: string;
  days_to_show?: number;
  max_sessions?: number;
}

type HistoryRecord = { state?: string; s?: string; attributes?: Record<string, unknown>; a?: Record<string, unknown> };

@customElement("luma-session-browser-card")
export class LumaSessionBrowserCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: Config;
  @state() private sessions: Session[] = [];
  @state() private page = 0;
  @state() private loading = true;
  @state() private error = "";
  private sourceKey = "";
  private dragStart?: number;
  private refreshTimer?: number;

  static styles = [lumaTokens, css`
    ha-card{padding:17px;border:1px solid color-mix(in srgb,var(--primary-color) 13%,transparent);border-radius:22px;background:linear-gradient(145deg,color-mix(in srgb,var(--primary-color) 5%,var(--luma-surface)),var(--luma-surface) 70%);box-shadow:var(--luma-shadow);touch-action:pan-y;user-select:none}.head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px}.copy{min-width:0}.title{font-size:14px;font-weight:var(--luma-weight-title)}.subtitle{margin-top:2px;color:var(--luma-muted);font-size:10px}.pager{display:flex;align-items:center;gap:5px}.count{min-width:42px;color:var(--luma-muted);font-size:10px;text-align:center}.arrow{display:grid;place-items:center;width:30px;height:30px;border:0;border-radius:10px;background:color-mix(in srgb,var(--primary-color) 8%,transparent);color:var(--primary-color);cursor:pointer;transition:.17s ease}.arrow:hover:not(:disabled){background:color-mix(in srgb,var(--primary-color) 15%,transparent);transform:translateY(-1px)}.arrow:disabled{cursor:default;opacity:.35}.arrow ha-icon{--mdc-icon-size:18px}
    .session{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:14px}.mix{padding:14px;border-radius:18px;background:color-mix(in srgb,var(--primary-color) 5%,transparent)}.mix-top{display:flex;align-items:center;justify-content:space-between;gap:12px}.when{min-width:0}.date{font-size:13px;font-weight:720}.time{margin-top:2px;color:var(--luma-muted);font-size:10px}.energy{text-align:right}.energy strong{display:block;font-size:23px;line-height:1}.energy span{color:var(--luma-muted);font-size:8px;font-weight:700;text-transform:uppercase}.rail{display:flex;height:12px;margin:15px 0 10px;padding:3px;border-radius:999px;overflow:hidden;background:color-mix(in srgb,var(--primary-text-color) 7%,transparent)}.rail span{min-width:0;height:100%;border-radius:999px;box-shadow:inset 0 0 0 1px color-mix(in srgb,white 18%,transparent)}.rail span+span{margin-left:3px}.pv{background:#58b984}.grid{background:#f4a62a}.unknown{background:color-mix(in srgb,var(--primary-text-color) 13%,transparent)}.sources{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.source{display:grid;grid-template-columns:28px minmax(0,1fr);grid-template-areas:"i l" "i v";align-items:center;gap:1px 7px;padding:8px;border-radius:13px;background:color-mix(in srgb,var(--tone) 8%,transparent)}.source .i{grid-area:i;display:grid;place-items:center;width:28px;height:28px;border-radius:9px;background:color-mix(in srgb,var(--tone) 14%,transparent);color:var(--tone)}.source ha-icon{--mdc-icon-size:16px}.source .label{grid-area:l;color:var(--luma-muted);font-size:8px}.source .value{grid-area:v;font-size:12px;font-weight:720}
    .details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.detail{display:grid;align-content:center;min-height:65px;padding:10px;border-radius:15px;background:color-mix(in srgb,var(--primary-color) 4%,transparent)}.detail .label{color:var(--luma-muted);font-size:9px}.detail .value{margin-top:3px;overflow:hidden;font-size:14px;font-weight:720;text-overflow:ellipsis;white-space:nowrap}.hint{display:none;margin-top:9px;color:var(--luma-muted);font-size:9px;text-align:center}.empty{display:grid;place-items:center;min-height:140px;color:var(--luma-muted);font-size:11px}
    @media(max-width:650px){ha-card{padding:13px}.session{grid-template-columns:1fr}.head{align-items:flex-start}.mix{padding:12px}.hint{display:block}}
  `];

  setConfig(config: Config) {
    if (!config?.history_entity) throw Error("history_entity required");
    this.config = { days_to_show: 365, max_sessions: 100, ...config };
    this.sourceKey = "";
    void this.load();
  }
  getCardSize() { return 3; }
  connectedCallback() { super.connectedCallback(); this.refreshTimer = window.setInterval(()=>void this.load(true),300000); }
  disconnectedCallback() { super.disconnectedCallback(); clearInterval(this.refreshTimer); }
  updated() {
    if (!this.hass || !this.config) return;
    const source = this.hass.states[this.config.history_entity];
    const key = `${source?.state}|${source?.last_updated}`;
    if (key !== this.sourceKey) { this.sourceKey = key; void this.load(true); }
  }

  private fallback(): Session[] {
    const raw = this.hass?.states[this.config!.history_entity]?.attributes.sessions;
    return Array.isArray(raw) ? raw.filter((item):item is Session=>Boolean(item&&typeof item==="object")) : [];
  }
  private groups(raw: unknown): HistoryRecord[] {
    if (Array.isArray(raw)) {
      if (raw.length && Array.isArray(raw[0])) return (raw as unknown[][]).flat() as HistoryRecord[];
      return raw as HistoryRecord[];
    }
    if (raw && typeof raw === "object") return Object.values(raw as Record<string, HistoryRecord[]>).flat();
    return [];
  }
  private eventSession(record: HistoryRecord): Session | undefined {
    const attributes = record.attributes || record.a;
    if (!attributes || attributes.event_type !== "completed") return undefined;
    const session = { ...attributes } as unknown as Session & { event_type?: string };
    delete session.event_type;
    return session.session_id ? session : undefined;
  }
  private async load(silent=false) {
    if (!this.hass || !this.config) return;
    if (!silent) this.loading = true;
    const all = new Map<string,Session>();
    for (const session of this.fallback()) if (session.session_id) all.set(session.session_id,session);
    try {
      if (this.config.event_entity && this.hass.callWS) {
        const end = new Date();
        const start = new Date(end.getTime()-(this.config.days_to_show||365)*86400000);
        const raw = await this.hass.callWS<unknown>({type:"history/history_during_period",start_time:start.toISOString(),end_time:end.toISOString(),entity_ids:[this.config.event_entity],minimal_response:false,no_attributes:false,significant_changes_only:false});
        for (const record of this.groups(raw)) {
          const session = this.eventSession(record);
          if (session?.session_id) all.set(session.session_id,session);
        }
      }
      this.sessions=[...all.values()].sort((a,b)=>new Date(b.ended_at||b.started_at||0).getTime()-new Date(a.ended_at||a.started_at||0).getTime()).slice(0,this.config.max_sessions);
      this.page=Math.min(this.page,Math.max(0,this.sessions.length-1));
      this.error="";
    } catch(error) {
      this.sessions=[...all.values()];
      this.error=error instanceof Error?error.message:localized(this.hass,"History could not be loaded","Az előzmények nem tölthetők be");
    } finally { this.loading=false; }
  }
  private select(page:number){this.page=Math.max(0,Math.min(page,this.sessions.length-1));}
  private pointerDown(event:PointerEvent){this.dragStart=event.clientX;}
  private pointerUp(event:PointerEvent){if(this.dragStart===undefined)return;const delta=event.clientX-this.dragStart;this.dragStart=undefined;if(Math.abs(delta)>45)this.select(this.page+(delta<0?1:-1));}
  private n(value:unknown){const number=Number(value);return Number.isFinite(number)?number:0;}
  private date(value?:string){const date=new Date(value||"");return Number.isNaN(date.getTime())?"—":date.toLocaleDateString(this.hass?.locale?.language||undefined,{month:"short",day:"numeric",weekday:"short"});}
  private time(value?:string){const date=new Date(value||"");return Number.isNaN(date.getTime())?"—":date.toLocaleTimeString(this.hass?.locale?.language||undefined,{hour:"2-digit",minute:"2-digit",hour12:false});}
  private duration(value?:number){const seconds=this.n(value),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60);return hours?`${hours} ${localized(this.hass,"h","ó")} ${minutes} ${localized(this.hass,"min","p")}`:`${minutes} ${localized(this.hass,"min","p")}`;}
  private mode(value?:string){return localizedMap(this.hass,{Solar:"Solar","Charge now":"Charge now"},{Solar:"Napelemes","Charge now":"Kézi töltés"},value||"—");}
  private stop(value?:string){return localizedMap(this.hass,{Remote:"Controller",Local:"Local",EVDisconnected:"EV disconnected"},{Remote:"Vezérlő",Local:"Helyi",EVDisconnected:"Autó lecsatlakoztatva"},value||"—");}

  render(){
    if(!this.config)return nothing;
    const session=this.sessions[this.page];
    return html`<ha-card @pointerdown=${this.pointerDown} @pointerup=${this.pointerUp}>
      <div class="head"><div class="copy"><div class="title">${this.config.title||localized(this.hass,"Charging sessions","Töltési sessionök")}</div><div class="subtitle">${this.config.subtitle||localized(this.hass,"Recorder history with a recent-session fallback","Recorder előzmények, gyors session fallbackkel")}</div></div>${this.sessions.length?html`<div class="pager"><button class="arrow" aria-label="Previous" ?disabled=${this.page>=this.sessions.length-1} @click=${()=>this.select(this.page+1)}><ha-icon icon="mdi:chevron-left"></ha-icon></button><span class="count">${this.page+1} / ${this.sessions.length}</span><button class="arrow" aria-label="Next" ?disabled=${this.page<=0} @click=${()=>this.select(this.page-1)}><ha-icon icon="mdi:chevron-right"></ha-icon></button></div>`:nothing}</div>
      ${this.loading&&!session?html`<div class="empty">${localized(this.hass,"Loading sessions…","Sessionök betöltése…")}</div>`:!session?html`<div class="empty">${this.error||localized(this.hass,"No completed sessions yet","Még nincs befejezett session")}</div>`:this.renderSession(session)}
    </ha-card>`;
  }
  private renderSession(session:Session){
    const total=this.n(session.energy_kwh),pv=this.n(session.pv_energy_kwh),grid=this.n(session.grid_energy_kwh),unknown=Math.max(0,this.n(session.unclassified_energy_kwh));
    const base=Math.max(total,pv+grid+unknown,0),pvPct=base?pv/base*100:0,gridPct=base?grid/base*100:0,unknownPct=Math.max(0,100-pvPct-gridPct);
    return html`<div class="session">
      <div class="mix"><div class="mix-top"><div class="when"><div class="date">${this.date(session.started_at)}</div><div class="time">${this.time(session.started_at)} – ${this.time(session.ended_at)}</div></div><div class="energy"><strong>${total.toFixed(2)} kWh</strong><span>${localized(this.hass,"total","összesen")}</span></div></div><div class="rail"><span class="pv" style=${`width:${pvPct}%`}></span><span class="grid" style=${`width:${gridPct}%`}></span><span class="unknown" style=${`width:${unknownPct}%`}></span></div><div class="sources">${this.source("mdi:solar-power",localized(this.hass,"Solar","Napenergia"),`${pv.toFixed(2)} kWh · ${pvPct.toFixed(0)}%`,"#58b984")}${this.source("mdi:transmission-tower-import",localized(this.hass,"Grid","Hálózat"),`${grid.toFixed(2)} kWh · ${gridPct.toFixed(0)}%`,"#f4a62a")}</div></div>
      <div class="details">${this.detail(localized(this.hass,"Mode","Mód"),this.mode(session.mode))}${this.detail(localized(this.hass,"Duration","Időtartam"),this.duration(session.duration_s))}${this.detail(localized(this.hass,"Stop reason","Leállítás oka"),this.stop(session.stop_reason))}${this.detail(localized(this.hass,"Transaction","Tranzakció"),session.transaction_id===undefined?"—":`#${session.transaction_id}`)}</div>
    </div><div class="hint">${localized(this.hass,"Swipe to browse sessions","Lapozz a sessionök között")}</div>`;
  }
  private source(icon:string,label:string,value:string,tone:string){return html`<div class="source" style=${`--tone:${tone}`}><span class="i"><ha-icon icon=${icon}></ha-icon></span><span class="label">${label}</span><span class="value">${value}</span></div>`;}
  private detail(label:string,value:string){return html`<div class="detail"><span class="label">${label}</span><span class="value">${value}</span></div>`;}
}
