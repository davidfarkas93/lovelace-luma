import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { entityName, entityState, runAction } from "../helpers";
import { localized } from "../localize";
import { lumaTokens, lumaInteractionStyles } from "../styles";
import type { HomeAssistant, LumaAction, LovelaceCard } from "../types";
import { type LightFaderConfig } from "./luma-light-fader-card";
import "./luma-light-fader-card";
import "../components/luma-wall-controls";
import type { WallControlEntity } from "../components/luma-wall-controls";

interface Item { entity?: string; name: string; icon?: string; tap_action: LumaAction }
interface Metric { entity: string; name?: string; icon?: string }
interface PhysicalButton { entity: string; name: string; icon?: string; event_type: string }
interface Config {
  type: string; name?: string; lights: LightFaderConfig[]; metrics?: Metric[];
  scenes?: Item[]; shortcuts?: Item[]; cover?: { entity: string; name?: string };
  fullscreen?: boolean; viewport_offset?: number;
  touch_controls?: boolean; cover_entities?: WallControlEntity[];
  detail_groups?: {entities:WallControlEntity[]}[];
  light_orientation?: "vertical" | "horizontal";
  physical_buttons?: { side?: "left" | "right"; buttons: PhysicalButton[] };
}

/** Fixed work budget: explicit entities only; no history, polling or discovery. */
@customElement("luma-wall-panel-card")
export class LumaWallPanelCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: Config;
  @state() private detail?: {entity:string; items:WallControlEntity[]};
  @state() private busy = "";
  @state() private error = false;
  @state() private confirmation = "";
  private confirmTimer?: ReturnType<typeof setTimeout>;
  private tracked: string[] = [];
  @state() private pressed = new Set<string>();
  private flashTimers = new Map<string, ReturnType<typeof setTimeout>>();

  static styles = [lumaTokens, lumaInteractionStyles, css`
    :host { display: block; min-width: 0; }
    .panel { container-type: inline-size; display: grid; grid-template-rows: auto minmax(220px,1fr) auto auto; gap: 14px; padding: 18px; min-height: 540px; height: 680px; color: var(--primary-text-color); background: var(--primary-background-color); }
    .panel.fullscreen { height: calc(100vh - var(--offset,0px)); height: calc(100dvh - var(--offset,0px)); }
    .panel.hardware { grid-template-columns: minmax(0,1fr) 112px; grid-template-rows: auto minmax(220px,1fr) auto; grid-template-areas: "header legend" "lights legend" "bottom legend"; }
    .panel.hardware.left { grid-template-columns: 112px minmax(0,1fr); grid-template-areas: "legend header" "legend lights" "legend bottom"; }
    .hardware > header { grid-area: header; }
    .hardware > .lights { grid-area: lights; }
    .hardware > .bottom { grid-area: bottom; }
    .legend { grid-area: legend; display: grid; grid-template-rows: repeat(var(--buttons),minmax(0,1fr)); min-width: 0; border-left: 1px solid var(--luma-border); padding-left: 10px; }
    .left .legend { border-left: 0; border-right: 1px solid var(--luma-border); padding-left: 0; padding-right: 10px; }
    .legend-item { display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 9px; border-radius: var(--luma-radius-control); color: var(--luma-muted); padding: 10px 4px; text-align: center; pointer-events: none; }
    .legend-item .number { font-size: 10px; opacity: .65; font-variant-numeric: tabular-nums; }
    .legend-item .label { font-size: 12px; font-weight: var(--luma-weight-medium); overflow-wrap: anywhere; }
    .legend-item ha-icon { --mdc-icon-size: 24px; }
    .legend-item.pressed { color: var(--primary-text-color); background: color-mix(in srgb,var(--warning-color) 17%,transparent); }
    .legend-item.pressed ha-icon { color: var(--warning-color); }
    header { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; }
    h1 { font-size: clamp(22px,3vw,32px); font-weight: var(--luma-weight-title); margin: 0; letter-spacing: -.035em; }
    .metrics { display: flex; align-items: center; gap: 8px; }
    .metric { display: flex; gap: 6px; align-items: center; background: transparent; border: 0; min-height: 44px; padding: 6px 10px; font-size: 15px; font-variant-numeric: tabular-nums; }
    .metric ha-icon { color: var(--luma-muted); --mdc-icon-size: 19px; }
    .lights { display: grid; grid-template-columns: repeat(var(--count),minmax(0,1fr)); gap: 12px; min-height: 0; }
    luma-light-fader-card { min-height: 0; }
    .horizontal-lights .lights { grid-template-columns: repeat(2,minmax(0,1fr)); grid-auto-rows: minmax(160px,1fr); }
    @media (max-width: 599px) { .panel.hardware.horizontal-lights { min-height: 1460px; } .horizontal-lights .lights { grid-template-columns: minmax(0,1fr) !important; } }
    .scenes { display: grid; grid-template-columns: repeat(var(--scenes),minmax(0,1fr)); gap: 10px; }
    button { min-height: 52px; border: 1px solid var(--luma-border); border-radius: var(--luma-radius-control); background: var(--luma-surface); padding: 10px 14px; font-size: 14px; font-weight: var(--luma-weight-medium); }
    .scene,.shortcut { display: flex; align-items: center; justify-content: center; gap: 10px; }
    .scene ha-icon { color: var(--warning-color); }
    ha-icon { --mdc-icon-size: 22px; flex-shrink: 0; }
    .bottom { display: flex; gap: 12px; align-items: stretch; }
    .cover { display: flex; align-items: center; gap: 8px; flex: 1; padding: 8px 10px; border: 1px solid var(--luma-border); border-radius: var(--luma-radius-card); background: var(--luma-surface); }
    .cover-info { flex: 1; border: 0; background: transparent; text-align: left; padding: 4px 8px; }
    .cover-info small { display: block; font-weight: 400; color: var(--luma-muted); margin-top: 4px; }
    .cover-action { min-width: 52px; padding: 10px; background: color-mix(in srgb,var(--primary-text-color) 5%,transparent); border: 0; }
    .shortcuts { display: flex; gap: 8px; }
    .shortcut { flex-direction: column; gap: 5px; min-width: 74px; font-size: 12px; }
    .error { color: var(--error-color); font-size: 13px; }
    @container (max-width: 850px) {
      .lights { grid-template-columns: repeat(3,minmax(0,1fr)); }
      .bottom { flex-direction: column; }
      .shortcuts { display: grid; grid-template-columns: repeat(var(--shortcuts),minmax(0,1fr)); }
      .shortcut { flex-direction: row; min-width: 0; }
    }
    @media (max-width: 599px) {
      .panel { gap: 10px; padding: 10px; min-height: 780px; }
      .panel.hardware { grid-template-columns: minmax(0,1fr) 72px; min-height: 1080px; }
      .panel.hardware.left { grid-template-columns: 72px minmax(0,1fr); }
      .hardware .lights { grid-template-columns: repeat(2,minmax(0,1fr)); }
      .hardware header { flex-wrap: wrap; }
      .legend { padding-left: 4px; } .left .legend { padding-right: 4px; }
      .legend-item .label { font-size: 11px; }
      .hardware .cover { flex-wrap: wrap; justify-content: space-between; }
      .hardware .cover-info { flex-basis: 100%; }
      header { gap: 4px; } .metrics { gap: 0; } .metric { padding: 4px; font-size: 13px; }
      .lights { gap: 8px; } .scenes { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }
      .cover { gap: 5px; } .cover-action { min-width: 44px; }
      .shortcut { padding: 8px 4px; font-size: 11px; gap: 4px; }
    }
  `];
  setConfig(config: Config) {
    if (!config?.lights?.length || config.lights.length > 6 || config.lights.some(l => !l.entity?.startsWith("light."))) throw Error("Luma wall panel requires 1–6 light entities.");
    if (new Set(config.lights.map(l => l.entity)).size !== config.lights.length) throw Error("Light entities must be unique.");
    if (config.cover && !config.cover.entity.startsWith("cover.")) throw Error("cover.entity must be a cover.");
    const buttons = config.physical_buttons?.buttons;
    if (config.physical_buttons && (!buttons?.length || buttons.length > 6 || buttons.some(b => !b.entity?.startsWith("event.") || !b.name || !b.event_type) || new Set(buttons.map(b => b.entity)).size !== buttons.length)) throw Error("physical_buttons requires 1–6 unique event entities with name and event_type.");
    this.clearFlashes();
    this.config = { fullscreen: false, ...config, lights: config.lights.map(l => ({ ...l, orientation: config.light_orientation || l.orientation, touch_controls: config.touch_controls ?? l.touch_controls, details: config.touch_controls ? "event" : l.details })) };
    this.tracked = [...new Set([...config.lights.map(l => l.entity), ...(config.metrics || []).map(m => m.entity), ...(config.scenes || []).map(s => s.entity || ""), ...(config.shortcuts || []).map(s => s.entity || ""), ...(buttons || []).map(b => b.entity), config.cover?.entity || ""].filter(Boolean))];
  }
  getCardSize() { return 10; }
  protected shouldUpdate(changed: PropertyValues<this>) {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    return !!this.detail || !old || old.locale !== this.hass?.locale || this.tracked.some(id => old.states[id] !== this.hass?.states[id]);
  }
  private clearFlashes() {
    for (const timer of this.flashTimers.values()) clearTimeout(timer);
    this.flashTimers.clear(); this.pressed = new Set();
  }
  protected willUpdate(changed: PropertyValues<this>) {
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this.hass || old.connection !== this.hass.connection) return;
    for (const button of this.config?.physical_buttons?.buttons || []) {
      const before = old.states[button.entity], current = this.hass.states[button.entity];
      const age = Date.now() - Date.parse(current?.state || "");
      if (!before || !current || before.state === current.state || current.attributes.restored || current.attributes.event_type !== button.event_type || !Number.isFinite(age) || age < -1000 || age > 5000) continue;
      clearTimeout(this.flashTimers.get(button.entity));
      this.pressed = new Set([...this.pressed, button.entity]);
      this.flashTimers.set(button.entity, setTimeout(() => {
        this.pressed = new Set([...this.pressed].filter(id => id !== button.entity));
        this.flashTimers.delete(button.entity);
      }, 750));
    }
  }
  disconnectedCallback() { clearTimeout(this.confirmTimer); this.clearFlashes(); this.confirmation = ""; super.disconnectedCallback(); }
  private available(id?: string) { return !id || !!this.hass?.states[id] && !["unknown", "unavailable"].includes(this.hass.states[id].state); }
  private async action(key: string, action: LumaAction, entity?: string) {
    if (!this.hass || this.busy || !this.available(entity)) return;
    if(action.action === "more-info" && this.config?.touch_controls && entity && /^(light|cover|media_player|fan|humidifier|sensor)\./.test(entity||"")){this.info(entity);return;}
    if ("confirmation" in action && action.confirmation && this.confirmation !== key) {
      this.confirmation = key; clearTimeout(this.confirmTimer);
      this.confirmTimer = setTimeout(() => this.confirmation = "", 3500); return;
    }
    this.confirmation = ""; clearTimeout(this.confirmTimer); this.busy = key; this.error = false;
    try { await runAction(this, this.hass, action, entity); }
    catch { this.error = true; }
    finally { this.busy = ""; }
  }
  private info(entity: string) {
    if(this.config?.touch_controls && entity && /^(light|cover|media_player|fan|humidifier|sensor)\./.test(entity)) {
      const group=this.config.detail_groups?.find(g=>g.entities.some(i=>i.entity===entity));
      this.detail={entity,items:group?.entities || (entity.startsWith("light.")?this.config.lights:entity.startsWith("sensor.")?(this.config.metrics||[{entity}]):entity.startsWith("cover.")?[...(this.config.cover?[this.config.cover]:[]),...(this.config.cover_entities||[])]:[{entity}])};return;
    }
    if (this.hass) void runAction(this, this.hass, { action: "more-info" }, entity); }
  private items(items: Item[], kind: string) {
    return items.map((item, index) => {
      const key = `${kind}-${index}`;
      return html`<button class=${kind} ?disabled=${!!this.busy || !this.available(item.entity)} @click=${() => this.action(key, item.tap_action, item.entity)}>
        <ha-icon icon=${item.icon || "mdi:gesture-tap-button"}></ha-icon><span>${this.confirmation === key ? localized(this.hass, "Confirm", "Megerősítés") : item.name}</span></button>`;
    });
  }
  render() {
    if (!this.config || !this.hass) return nothing;
    const c = this.config, cover = c.cover && this.hass.states[c.cover.entity];
    const coverFeatures = Number(cover?.attributes.supported_features || 0);
    const hardware = c.physical_buttons;
    return html`<div class="panel ${c.fullscreen ? "fullscreen" : ""} ${c.light_orientation === "horizontal" ? "horizontal-lights" : ""} ${hardware ? `hardware ${hardware.side || "right"}` : ""}" style=${`--offset:${Math.max(0,c.viewport_offset || 0)}px;--count:${c.lights.length};--scenes:${Math.max(1,c.scenes?.length || 0)};--shortcuts:${Math.max(1,c.shortcuts?.length || 0)};--buttons:${hardware?.buttons.length || 1}`}>
      <header><h1>${c.name || localized(this.hass, "Room", "Szoba")}</h1><div class="metrics">${(c.metrics || []).map(m => html`<button class="metric" title=${m.name || entityName(this.hass?.states[m.entity],m.entity)} @click=${() => this.info(m.entity)}><ha-icon icon=${m.icon || "mdi:information-outline"}></ha-icon>${entityState(this.hass!,this.hass?.states[m.entity])}</button>`)}</div>${this.error ? html`<span class="error" role="alert">${localized(this.hass, "Action failed", "Nem sikerült")}</span>` : nothing}</header>
      <div class="lights" @luma-control-details=${(e:CustomEvent)=>this.info(e.detail.entity)}>${repeat(c.lights, l => l.entity, l => html`<luma-light-fader-card .config=${l} .hass=${this.hass}></luma-light-fader-card>`)}</div>
      ${hardware ? html`<aside class="legend" aria-label=${localized(this.hass,"Physical buttons, top to bottom","Fizikai gombok, felülről lefelé")}>${hardware.buttons.map((button,index) => html`<div class="legend-item ${this.pressed.has(button.entity) ? "pressed" : ""}" data-entity=${button.entity}><span class="number">${index + 1}</span><ha-icon icon=${button.icon || "mdi:gesture-tap-button"}></ha-icon><span class="label">${button.name}</span></div>`)}</aside>` : html`<div class="scenes">${this.items(c.scenes || [], "scene")}</div>`}
      <div class="bottom">${c.cover ? html`<div class="cover"><button class="cover-info" @click=${() => this.info(c.cover!.entity)}>${c.cover.name || localized(this.hass,"Shutters","Redőnyök")}<small>${entityState(this.hass,cover)}</small></button>
        ${([["open_cover","mdi:arrow-up",1,"Open","Fel"],["stop_cover","mdi:stop",8,"Stop","Állj"],["close_cover","mdi:arrow-down",2,"Close","Le"]] as const).map(([service,icon,flag,en,hu]) => html`<button class="cover-action" aria-label=${localized(this.hass,en,hu)} ?disabled=${!!this.busy || !this.available(c.cover?.entity) || !(coverFeatures & flag)} @click=${() => this.action(service,{action:"perform-action",perform_action:`cover.${service}`,target:{entity_id:c.cover!.entity}},c.cover!.entity)}><ha-icon icon=${icon}></ha-icon></button>`)}</div>` : nothing}
        <div class="shortcuts">${this.items(c.shortcuts || [], "shortcut")}</div></div>
    </div>${this.detail?html`<luma-wall-controls .hass=${this.hass} .entity=${this.detail.entity} .items=${this.detail.items} @controls-close=${()=>{this.detail=undefined}}></luma-wall-controls>`:nothing}`;
  }
}
