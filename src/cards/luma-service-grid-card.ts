import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { entityName, runAction } from '../helpers';
import { localize, localized } from '../localize';
import { lumaTokens } from '../styles';
import { discoverServices, serviceAvailable, serviceHealth, serviceNumber, serviceRunning,
  type ServiceGridConfig, type ServiceItem } from '../services';
import type { HassEntity, HomeAssistant, LovelaceCard } from '../types';

interface Operation { entity: string; service: string; name: string; confirm: string; allowed: boolean }
interface Pending { key: string; state: string; operation: Operation; expires: number }

@customElement('luma-service-grid-card')
export class LumaServiceGridCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: ServiceGridConfig;
  @state() private selected?: string;
  @state() private pending?: Pending;
  @state() private busy?: string;
  @state() private error = '';
  @state() private feedback = '';
  @state() private drag = 0;
  @query('dialog') private dialog?: HTMLDialogElement;
  private confirmTimer?: number;
  private dragStartY?: number;
  private previewOpened = false;
  private cachedHass?: HomeAssistant;
  private cachedItems: ServiceItem[] = [];

  static styles = [lumaTokens, css`
    :host{container-type:inline-size;min-width:0}
    .grid{display:grid;grid-template-columns:repeat(var(--columns,3),minmax(0,1fr));gap:12px}
    .group-title{margin:26px 0 12px;font-size:16px;font-weight:700}
    .service{display:flex;flex-direction:column;gap:13px;width:100%;min-width:0;min-height:150px;padding:18px;text-align:left;font:inherit;color:var(--primary-text-color);border:1px solid color-mix(in srgb,var(--tone) 16%,var(--luma-border));border-radius:20px;background:linear-gradient(135deg,color-mix(in srgb,var(--tone) 9%,var(--luma-surface)),var(--luma-surface) 78%);box-shadow:0 7px 22px rgba(0,0,0,.035);cursor:pointer;transition:transform .16s,border-color .16s,box-shadow .16s}
    .service:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--tone) 42%,transparent);box-shadow:var(--luma-shadow)}
    .top{display:grid;grid-template-columns:40px minmax(0,1fr) 18px;gap:11px;align-items:center;width:100%}
    .icon{display:grid;place-items:center;width:40px;height:40px;border-radius:13px;background:color-mix(in srgb,var(--tone) 12%,transparent);color:var(--tone)}
    .icon ha-icon{--mdc-icon-size:22px}.chevron{--mdc-icon-size:18px;color:var(--luma-muted)}
    .name{font-size:15px;font-weight:720;line-height:1.3;overflow-wrap:anywhere}.kind{font-size:11px;color:var(--luma-muted);margin-top:3px}
    .signals{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}
    .pill{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:99px;font-size:11px;font-weight:650;line-height:1.4;color:var(--signal,var(--tone));background:color-mix(in srgb,var(--signal,var(--tone)) 10%,transparent)}
    .dot{width:6px;height:6px;flex:0 0 6px;border-radius:50%;background:currentColor}
    .metrics{display:flex;flex-wrap:wrap;gap:5px 14px;margin-top:auto;color:var(--luma-muted);font-size:11px;line-height:1.5}
    .metrics strong{color:var(--primary-text-color);font-weight:650}.issue{font-size:11px;line-height:1.5;overflow-wrap:anywhere;color:var(--warning-color)}
    .empty{padding:16px;color:var(--luma-muted)}
    dialog{position:fixed;inset:auto 0 0;margin:0 auto;padding:0;border:1px solid var(--luma-border);border-bottom:0;border-radius:28px 28px 0 0;width:min(760px,calc(100vw - 24px));max-width:none;max-height:calc(100dvh - 24px);color:var(--primary-text-color);background:var(--card-background-color,#f7f7fb);box-shadow:0 -16px 70px rgba(0,0,0,.25);overflow:hidden}
    dialog::backdrop{background:rgba(12,13,18,.55)}
    .sheet{display:flex;flex-direction:column;max-height:calc(100dvh - 26px);transform:translateY(var(--drag,0px))}
    .handle{display:grid;place-items:center;min-height:27px;cursor:grab;touch-action:none}.handle:after{content:'';width:38px;height:4px;border-radius:9px;background:color-mix(in srgb,var(--primary-text-color) 22%,transparent)}
    .header{display:grid;grid-template-columns:42px minmax(0,1fr) 40px;gap:12px;align-items:center;padding:0 22px 18px}.header .name{font-size:21px}.body{overflow:auto;overscroll-behavior:contain;padding:0 22px max(24px,env(safe-area-inset-bottom));min-height:0}
    .close,.info{display:grid;place-items:center;width:38px;height:38px;border:0;border-radius:50%;background:color-mix(in srgb,var(--primary-text-color) 6%,transparent);color:var(--luma-muted);cursor:pointer}.close ha-icon,.info ha-icon{--mdc-icon-size:19px}
    h3{margin:24px 0 11px;font-size:13px;font-weight:720}.notice{font-size:12px;line-height:1.55;color:var(--luma-muted);overflow-wrap:anywhere;margin:12px 0}.error{color:var(--error-color)}
    .detail-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:12px}.metric{padding:14px;border:1px solid var(--luma-border);border-radius:16px;background:color-mix(in srgb,var(--primary-color) 4%,var(--luma-surface));color:inherit;font:inherit;text-align:left;cursor:pointer}.metric span{display:block;font-size:11px;color:var(--luma-muted)}.metric strong{display:block;font-size:22px;margin-top:5px;font-weight:690}
    .rows{display:grid;gap:8px}.row{display:grid;grid-template-columns:30px minmax(0,1fr) auto 36px;gap:10px;align-items:center;padding:12px;border:1px solid var(--luma-border);border-radius:16px;background:color-mix(in srgb,var(--row-tone,var(--primary-color)) 5%,var(--luma-surface))}.row>ha-icon{--mdc-icon-size:22px;color:var(--row-tone,var(--luma-muted))}.row .name{font-size:13px}.row .kind{overflow-wrap:anywhere}.row .info{width:34px;height:34px}
    .actions{display:flex;flex-wrap:wrap;gap:9px}.action{min-height:40px;padding:9px 14px;border:1px solid color-mix(in srgb,var(--action-tone,var(--primary-color)) 20%,transparent);border-radius:99px;font:inherit;font-size:12px;font-weight:680;color:var(--action-tone,var(--primary-color));background:color-mix(in srgb,var(--action-tone,var(--primary-color)) 10%,transparent);cursor:pointer}.action.confirm{--action-tone:var(--warning-color)}.action:disabled{cursor:default;opacity:.5}.action ha-icon{--mdc-icon-size:17px;margin-right:6px}.confirmation{padding:12px;border-radius:14px;background:color-mix(in srgb,var(--warning-color) 10%,transparent);color:var(--primary-text-color)}
    button:focus-visible,a:focus-visible{outline:2px solid var(--primary-color);outline-offset:3px}a.action{text-decoration:none;display:inline-flex;align-items:center}
    @container(max-width:960px){.grid{grid-template-columns:repeat(var(--tablet-columns,2),minmax(0,1fr))}}
    @container(max-width:560px){.grid{grid-template-columns:repeat(var(--mobile-columns,1),minmax(0,1fr))}.service{min-height:140px;padding:15px}}
    @media(max-width:599px){dialog{width:100%;border-left:0;border-right:0;max-height:calc(100dvh - 10px)}.sheet{max-height:calc(100dvh - 12px)}.header{padding:0 16px 16px}.body{padding-left:16px;padding-right:16px}.row{gap:7px;padding:10px;grid-template-columns:24px minmax(0,1fr) auto 32px}.row .action{padding:8px 10px;font-size:11px}}
  `];
  setConfig(config: ServiceGridConfig) {
    if (!config.stacks && !config.monitors) throw Error('Services require stacks or monitors discovery selectors.');
    this.config = { columns:3, tablet_columns:2, mobile_columns:1, ...config };
    this.cachedHass = undefined;
    this.close();
  }
  getCardSize() { return 5; }
  disconnectedCallback() { clearTimeout(this.confirmTimer); this.dialog?.close(); super.disconnectedCallback(); }
  protected updated(changed: PropertyValues<this>) {
    if (this.selected && !this.items.find(x => x.entity === this.selected)) this.close();
    if (!this.previewOpened && this.config?.show_details && this.hass?.editMode) {
      this.previewOpened = true; void this.open(this.config.show_details);
    }
    if (changed.has('hass') && this.pending && this.hass?.states[this.pending.operation.entity]?.state !== this.pending.state) this.clearPending();
  }
  private get items() {
    if (!this.hass || !this.config) return [];
    if (this.cachedHass !== this.hass) { this.cachedItems = discoverServices(this.hass, this.config); this.cachedHass = this.hass; }
    return this.cachedItems;
  }
  private t(en: string, hu: string) { return localized(this.hass, en, hu); }
  private tone(name: string) { return name === 'muted' ? 'var(--secondary-text-color)' : `var(--${name}-color)`; }
  private monitorLabel(item: ServiceItem) {
    const status = serviceHealth(item).monitorState;
    return status === 'up' ? this.t('Available','Elérhető') : status === 'down' ? this.t('Unavailable','Nem elérhető') :
      status === 'unmonitored' ? this.t('No monitor','Nincs monitor') : this.t('Monitor unknown','Monitor: nincs adat');
  }
  private containersLabel(item: ServiceItem) {
    const h = serviceHealth(item);
    return h.total ? `${h.running}/${h.total} ${this.t('running','fut')}` : this.t('No container data','Nincs konténeradat');
  }
  private signals(item: ServiceItem) {
    const h = serviceHealth(item);
    return html`<div class="signals"><span class="pill" style=${`--signal:${this.tone(h.monitorState === 'up' ? 'success' : h.monitorState === 'down' ? 'error' : 'muted')}`}><span class="dot"></span>${this.monitorLabel(item)}</span>
      ${item.stack ? html`<span class="pill" style=${`--signal:${this.tone(h.attention ? 'warning' : 'muted')}`}>${this.containersLabel(item)}</span>` : nothing}
      ${h.updateCount ? html`<span class="pill" style="--signal:var(--warning-color)">${h.updateCount} ${this.t('updates','frissítés')}</span>` : nothing}</div>`;
  }
  private async open(id: string) {
    this.selected = id; this.error = ''; this.feedback = ''; this.clearPending();
    await this.updateComplete;
    if (this.selected === id && this.dialog && !this.dialog.open) this.dialog.showModal();
  }
  private close() { this.dialog?.close(); this.selected = undefined; this.drag = 0; this.clearPending(); }
  private clearPending() { this.pending = undefined; clearTimeout(this.confirmTimer); }
  private info(entity: string) { this.close(); void runAction(this, this.hass!, {action:'more-info'}, entity); }
  private operationKey(op: Operation) { return `${op.entity}:${op.service}`; }
  private async execute(op: Operation) {
    if (!this.hass || this.busy || !op.allowed || !serviceAvailable(this.hass.states[op.entity])) return;
    const key = this.operationKey(op), currentState = this.hass.states[op.entity].state;
    if (!this.pending || this.pending.key !== key || this.pending.expires < Date.now() || this.pending.state !== currentState) {
      this.clearPending(); this.error = ''; this.feedback = '';
      this.pending = { key, state:currentState, operation:op, expires:Date.now()+6000 };
      this.confirmTimer = window.setTimeout(() => this.clearPending(), 6000); return;
    }
    this.clearPending(); this.busy = key;
    try {
      const [domain, service] = op.service.split('.');
      await this.hass.callService(domain, service, {}, {entity_id:op.entity});
      this.feedback = this.t('Request completed. Status follows the integration.','Kérés végrehajtva. Az állapotot az integráció frissíti.');
    } catch (error) { this.error = error instanceof Error ? error.message : String(error); }
    finally { this.busy = undefined; }
  }
  private action(op: Operation, icon?: string) {
    const key = this.operationKey(op), pending = this.pending?.key === key;
    return html`<button class=${`action ${pending ? 'confirm' : ''}`} ?disabled=${!op.allowed || Boolean(this.busy)} @click=${() => this.execute(op)}>${icon ? html`<ha-icon icon=${icon}></ha-icon>` : nothing}${this.busy === key ? this.t('Working…','Folyamatban…') : pending ? localize(this.hass,'confirm') : op.name}</button>`;
  }
  private tile(item: ServiceItem) {
    const h = serviceHealth(item), latency = serviceNumber(item.latency), uptime = serviceNumber(item.uptime);
    const failed = item.containers.filter(e => !serviceRunning(e));
    const issue = item.alerts[0]?.state || (failed.length ? failed.map(e => entityName(e,e.entity_id)).join(', ') : h.attention ? item.stack?.state : '');
    return html`<button class="service" style=${`--tone:${this.tone(h.tone)}`} @click=${() => this.open(item.entity)} aria-label=${`${item.name}: ${this.monitorLabel(item)}. ${localize(this.hass,'details')}`}>
      <span class="top"><span class="icon"><ha-icon icon=${item.icon}></ha-icon></span><span><span class="name">${item.name}</span><div class="kind">${item.stack ? this.t('Application','Alkalmazás') : this.t('Monitor','Felügyelet')}</div></span><ha-icon class="chevron" icon="mdi:chevron-right"></ha-icon></span>
      ${this.signals(item)}${issue ? html`<span class="issue">${issue}</span>` : nothing}
      <span class="metrics">${latency !== undefined ? html`<span><strong>${Math.round(latency)} ms</strong> · ${this.t('response','válaszidő')}</span>` : nothing}${uptime !== undefined ? html`<span><strong>${uptime.toFixed(2)}%</strong> · ${this.config?.uptime_label || this.t('availability','rendelkezésre állás')}</span>` : nothing}</span>
    </button>`;
  }
  private metric(entity: HassEntity | undefined, name: string, unit: string, decimals = 0) {
    const value = serviceNumber(entity);
    return value !== undefined && entity ? html`<button class="metric" @click=${() => this.info(entity.entity_id)}><span>${name}</span><strong>${value.toFixed(decimals)} ${unit}</strong></button>` : nothing;
  }
  private container(entity: HassEntity) {
    const running = serviceRunning(entity), available = serviceAvailable(entity) && ['on','off'].includes(entity.state);
    const name = entityName(entity,entity.entity_id), verb = running ? localize(this.hass,'stop') : localize(this.hass,'start');
    const op: Operation = { entity:entity.entity_id,service:running ? 'switch.turn_off' : 'switch.turn_on',name:verb,confirm:`${verb}: ${name}?`,allowed:available };
    return html`<div class="row" style=${`--row-tone:${this.tone(running?'success':'warning')}`}><ha-icon icon="mdi:cube-outline"></ha-icon><div><div class="name">${name}</div><div class="kind">${running ? this.t('Running','Fut') : entity.state === 'off' ? this.t('Stopped','Leállítva') : this.t('No state data','Nincs állapotadat')}</div></div>${this.action(op)}<button class="info" aria-label=${`${name} · ${localize(this.hass,'details')}`} @click=${() => this.info(entity.entity_id)}><ha-icon icon="mdi:information-outline"></ha-icon></button></div>`;
  }
  private updateRow(entity: HassEntity) {
    const a=entity.attributes, name=entityName(entity,entity.entity_id), installing=a.in_progress===true || typeof a.in_progress==='number';
    const versions = a.installed_version && a.installed_version !== '0' && a.latest_version && a.latest_version !== '0' ? `${a.installed_version} → ${a.latest_version}` : '';
    const op: Operation = {entity:entity.entity_id,service:'update.install',name:localize(this.hass,'install'),confirm:`${localize(this.hass,'install')}: ${name}?`,allowed:entity.state==='on' && Boolean(Number(a.supported_features)&1) && !installing};
    return html`<div class="row"><ha-icon icon="mdi:package-up"></ha-icon><div><div class="name">${name}</div><div class="kind">${installing ? localize(this.hass,'installing') : versions || (entity.state==='on' ? this.t('Update available','Frissítés elérhető') : this.t('No update reported','Nincs jelzett frissítés'))}</div></div>${entity.state==='on'||installing ? this.action(op) : nothing}<button class="info" aria-label=${`${name} · ${localize(this.hass,'details')}`} @click=${() => this.info(entity.entity_id)}><ha-icon icon="mdi:information-outline"></ha-icon></button></div>`;
  }
  private details(item: ServiceItem) {
    return html`<div class="sheet" style=${`--drag:${this.drag}px;--tone:${this.tone(serviceHealth(item).tone)}`}>
      <div class="handle" @pointerdown=${(e:PointerEvent) => {this.dragStartY=e.clientY;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);}} @pointermove=${(e:PointerEvent) => {if(this.dragStartY!==undefined)this.drag=Math.max(0,e.clientY-this.dragStartY);}} @pointerup=${() => {this.dragStartY=undefined;if(this.drag>85)this.close();this.drag=0;}} @pointercancel=${() => {this.dragStartY=undefined;this.drag=0;}}></div>
      <header class="header"><span class="icon"><ha-icon icon=${item.icon}></ha-icon></span><div><div class="name">${item.name}</div><div class="kind">${this.t('Availability & workload details','Elérhetőség és szolgáltatásrészletek')}</div></div><button class="close" aria-label=${localize(this.hass,'close')} @click=${() => this.close()}><ha-icon icon="mdi:close"></ha-icon></button></header>
      <div class="body">${this.signals(item)}<div class="detail-metrics">${this.metric(item.latency,this.t('Response time','Válaszidő'),'ms')}${this.metric(item.uptime,this.config?.uptime_label || this.t('Availability','Rendelkezésre állás'),'%',2)}</div>
        ${item.alerts.map(e => html`<p class="notice error">${e.state}</p>`)}
        <p class="notice">${item.monitorConfigured ? this.t('Availability is measured by the configured monitor. Running containers alone do not prove application health.','Az elérhetőséget a hozzárendelt monitor méri. A futó konténerek önmagukban nem bizonyítják az alkalmazás hibátlan működését.') : this.t('No availability monitor is linked. Only workload state is known.','Nincs hozzárendelt elérhetőségi monitor. Csak a konténerek futási állapota ismert.')}</p>
        <div class="actions">${item.url ? html`<a class="action" href=${item.url} target="_blank" rel="noopener noreferrer"><ha-icon icon="mdi:open-in-new"></ha-icon>${this.t('Open service','Szolgáltatás megnyitása')}</a>` : nothing}${item.monitor ? html`<button class="action" @click=${() => this.info(item.monitor!.entity_id)}>${localize(this.hass,'history')}</button>` : nothing}${item.stack ? html`<button class="action" @click=${() => this.info(item.entity)}>${this.t('Stack state','Stack állapota')}</button>` : nothing}</div>
        ${item.stack ? html`<h3>${this.t('Containers','Konténerek')} · ${this.containersLabel(item)}</h3><div class="rows">${repeat(item.containers,e=>e.entity_id,e=>this.container(e))}</div>` : nothing}
        ${item.operations.length ? html`<h3>${this.t('Stack operations','Stack-műveletek')}</h3><div class="actions">${item.operations.map(({config:op,entity}) => this.action({entity:entity.entity_id,service:op.service,name:op.name,confirm:op.confirm,allowed:serviceAvailable(entity)&&(!op.state||op.state.includes(entity.state))},op.icon))}</div>` : nothing}
        ${this.pending ? html`<p class="notice confirmation" role="status">${this.pending.operation.confirm} ${this.t('Click the same button again to confirm.','A megerősítéshez kattints újra ugyanarra a gombra.')}</p>` : nothing}
        ${this.error ? html`<p class="notice error" role="alert">${this.error}</p>` : nothing}${this.feedback ? html`<p class="notice" role="status">${this.feedback}</p>` : nothing}
        ${item.updates.length ? html`<h3>${this.t('Updates','Frissítések')}</h3><div class="rows">${repeat(item.updates,e=>e.entity_id,e=>this.updateRow(e))}</div>` : nothing}
      </div></div>`;
  }
  render() {
    if (!this.hass || !this.config) return nothing;
    const items = this.items, groups = [...new Set(items.map(item=>item.group))].sort((a,b)=>!a?-1:!b?1:a.localeCompare(b));
    const selected = items.find(item=>item.entity===this.selected);
    return html`<div style=${`--columns:${this.config.columns};--tablet-columns:${this.config.tablet_columns};--mobile-columns:${this.config.mobile_columns}`}>
      ${groups.map(group=>html`${group ? html`<h2 class="group-title">${group}</h2>` : nothing}<div class="grid">${repeat(items.filter(item=>item.group===group),item=>item.entity,item=>this.tile(item))}</div>`)}
      ${!items.length ? html`<div class="empty">${this.t('No services discovered.','Nincs felfedezett szolgáltatás.')}</div>` : nothing}</div>
      <dialog aria-label=${selected?.name || localize(this.hass,'details')} @cancel=${() => this.close()} @click=${(event:MouseEvent) => {if(event.target===this.dialog)this.close();}}>${selected ? this.details(selected) : nothing}</dialog>`;
  }
}
