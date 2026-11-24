import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, eventOptions, property, state } from "lit/decorators.js";
import { entityName, runAction } from "../helpers";
import { localized } from "../localize";
import { HoldGesture } from "../hold-gesture";
import { HandleDrag } from "../handle-drag";
import { lumaTokens, lumaInteractionStyles } from "../styles";
import type { HomeAssistant, LovelaceCard } from "../types";

export interface LightFaderConfig { type?: string; entity: string; name?: string; subtitle?: string; icon?: string; orientation?: "vertical" | "horizontal"; interaction?: "native" | "handle"; touch_controls?: boolean; details?: "default" | "event" | "none" }

/** A tall touch target, with one service call per completed gesture. */
@customElement("luma-light-fader-card")
export class LumaLightFaderCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property({ attribute: false }) config?: LightFaderConfig;
  @state() private busy = false;
  @state() private error = false;
  private draft?: number;
  private nativeActive = false;
  private nativeCancelled = false;
  private nativeCommitted = false;
  private nativeInitial = 0;
  private nativeEndTimer?: ReturnType<typeof setTimeout>;
  @state() private pending?: { value: number; sequence: number };
  @state() private unconfirmed = false;
  private sequence = 0;
  private queued?: { value: number; sequence: number; entity: string };
  private sending = false;
  private acknowledgeTimer?: ReturnType<typeof setTimeout>;
  private settleTimer?: ReturnType<typeof setTimeout>;
  private gesture?: { kind: "pointer" | "touch"; id: number; bottom: number; height: number; track: HTMLElement };
  private removeGestureListeners: Array<() => void> = [];
  private frame = 0;
  private keyTimer?: ReturnType<typeof setTimeout>;
  private press = new HoldGesture();
  private handleDrag?: HandleDrag;
  private handleElement?: HTMLElement;

  static styles = [lumaTokens, lumaInteractionStyles, css`
    :host { display: flex; min-width: 0; min-height: 220px; height: 100%; --tone: var(--warning-color, #e9b875); }
    .card { display: flex; flex-direction: column; width: 100%; min-height: 0; padding: 10px; border: 1px solid var(--luma-border); border-radius: var(--luma-radius-card); background: var(--luma-surface); overflow: hidden; }
    .card.on { border-color: color-mix(in srgb,var(--tone) 28%,transparent); }
    .top { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
    button { border: 0; border-radius: var(--luma-radius-control); background: transparent; min-width: 44px; min-height: 44px; padding: 10px; }
    .power { background: color-mix(in srgb,var(--primary-text-color) 5%,transparent); }
    .on .power { color: var(--tone); background: color-mix(in srgb,var(--tone) 14%,transparent); }
    .details { color: var(--luma-muted); }
    ha-icon { --mdc-icon-size: 22px; }
    .name { font-size: clamp(13px,1.5vw,19px); font-weight: var(--luma-weight-strong); line-height: 1.2; margin: 12px 4px 3px; overflow-wrap: anywhere; }
    .subtitle { color: var(--luma-muted); font-size: 11px; margin: 0 4px; min-height: 14px; }
    .track { position: relative; flex: 1; min-height: 80px; margin-top: 12px; border-radius: var(--luma-radius-control); overflow: hidden; background: color-mix(in srgb,var(--primary-text-color) 5%,transparent); cursor: ns-resize; touch-action: none; user-select: none; -webkit-user-select: none; contain: layout paint; }
    .track:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
    .track[aria-disabled="true"] { cursor: default; opacity: .5; }
    .fill { position: absolute; inset: 0; background: color-mix(in srgb,var(--tone) 27%,var(--luma-surface)); transform: scaleY(var(--level,0)); transform-origin: bottom; pointer-events: none; }
    .marker { position: absolute; left: 8px; width: 6px; bottom: clamp(8px,calc(var(--level,0) * 100% - 2px),calc(100% - 12px)); height: 6px; border-radius: 50%; background: var(--tone); pointer-events: none; }
    .value { position: absolute; top: 16px; left: 0; right: 0; text-align: center; font-size: clamp(23px,3vw,38px); font-weight: var(--luma-weight-title); font-variant-numeric: tabular-nums; pointer-events: none; }
    .note { font-size: 11px; color: var(--luma-muted); min-height: 15px; margin: 8px 4px 0; }
    .card.horizontal { padding: 14px; }
    .horizontal .top { position: relative; }
    .horizontal .name { margin: 0 8px; flex: 1; }
    .horizontal .subtitle { margin: 4px 0 0 52px; min-height: 0; }
    .horizontal .track { flex: 1; min-height: 56px; max-height: 90px; margin-top: 12px; cursor: ew-resize; }
    .horizontal .fill { transform: scaleX(var(--level,0)); transform-origin: left; }
    .horizontal .value { position: static; min-width: 70px; font-size: 28px; text-align: right; }
    input[type="range"] { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; background: transparent; appearance: none; -webkit-appearance: none; touch-action: none; cursor: ew-resize; }
    input[type="range"]::-webkit-slider-runnable-track { height: 100%; background: transparent; }
    input[type="range"]::-webkit-slider-thumb { appearance: none; -webkit-appearance: none; width: 32px; height: 100%; border: 3px solid var(--tone); border-radius: var(--luma-radius-control); background: color-mix(in srgb,var(--tone) 35%,var(--luma-surface)); }
    input[type="range"]::-moz-range-track { height: 100%; background: transparent; }
    input[type="range"]::-moz-range-thumb { width: 26px; height: 90%; border: 3px solid var(--tone); border-radius: var(--luma-radius-control); background: var(--luma-surface); }
    input[type="range"]:focus-visible { outline: 2px solid var(--primary-color); outline-offset: -3px; }
    .handle-track { touch-action: auto; }
    .drag-handle { position: absolute; top: 0; bottom: 0; left: calc((100% - 44px) * var(--level,0)); width: 44px; box-sizing: border-box; border: 3px solid var(--tone); border-radius: var(--luma-radius-control); background: color-mix(in srgb,var(--tone) 35%,var(--luma-surface)); cursor: grab; }
    .drag-handle:focus-visible { outline: 2px solid var(--primary-color); outline-offset: -5px; }
    .horizontal.touch-controls { display:grid;grid-template-columns:76px minmax(0,1fr);grid-template-rows:auto minmax(56px,1fr) auto;column-gap:14px; }
    .touch-controls .top,.touch-controls .subtitle,.touch-controls .note { grid-column:1/-1; }
    .touch-controls .subtitle:empty { display:none; }
    .touch-controls > .power { grid-column:1;grid-row:2;min-height:64px;max-height:90px;margin-top:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;font-size:13px; }
    .touch-controls .track { grid-column:2;grid-row:2; }
    .touch-controls .details { min-width:56px;min-height:48px; }
    .touch-controls .name { margin-left:0; }
    .error { color: var(--error-color); }
  `];

  setConfig(config: LightFaderConfig) {
    if (!config?.entity?.startsWith("light.")) throw Error("Luma light fader requires a light entity.");
    this.reset(); this.config = { ...config };
  }
  getCardSize() { return 5; }
  private get entity() { return this.hass?.states[this.config?.entity || ""]; }
  private get available() { return !!this.entity && !this.entity.attributes.restored && !["unknown", "unavailable"].includes(this.entity.state); }
  private get dimmable() {
    const modes = this.entity?.attributes.supported_color_modes;
    return Array.isArray(modes) && modes.some(mode => !["onoff", "unknown"].includes(String(mode)));
  }
  private get level() {
    if (this.entity?.state !== "on") return 0;
    const brightness = this.entity.attributes.brightness;
    return typeof brightness === "number" && Number.isFinite(brightness) ? Math.max(0, Math.min(100, Math.round(brightness / 255 * 100))) : 0;
  }
  protected shouldUpdate(changed: PropertyValues<this>) {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    return !old || old.locale !== this.hass?.locale || old.states[this.config?.entity || ""] !== this.entity;
  }
  protected updated() {
    if (!this.available) { this.cancelGesture(); this.clearPending(); this.queued = undefined; }
    this.setupHandle();
    this.reconcile(); this.paint();
  }
  connectedCallback() { super.connectedCallback(); this.requestUpdate(); }
  disconnectedCallback() { this.handleDrag?.destroy(); this.handleDrag = undefined; this.handleElement = undefined; this.reset(); this.press.cancel(); super.disconnectedCallback(); }
  private setupHandle() {
    const handle = this.renderRoot.querySelector<HTMLElement>(".drag-handle") || undefined;
    if (handle === this.handleElement) return;
    this.handleDrag?.destroy(); this.handleDrag = undefined; this.handleElement = handle;
    if (handle) this.handleDrag = new HandleDrag(handle, {
      enabled: () => this.available && this.dimmable,
      value: () => this.draft ?? this.pending?.value ?? this.level,
      move: value => { this.draft = value; if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.paint(); }); },
      end: value => this.commit(value),
      cancel: () => { this.draft = undefined; this.paint(); },
    });
  }
  private clearPending() {
    clearTimeout(this.acknowledgeTimer); this.acknowledgeTimer = undefined;
    clearTimeout(this.settleTimer); this.settleTimer = undefined;
    this.pending = undefined;
  }
  private reset() { this.cancelGesture(); this.clearPending(); this.queued = undefined; this.sequence++; }
  private endGesture() {
    const g = this.gesture; this.gesture = undefined;
    for (const remove of this.removeGestureListeners.splice(0)) remove();
    if (g?.kind === "pointer" && g.track.hasPointerCapture?.(g.id)) g.track.releasePointerCapture(g.id);
    cancelAnimationFrame(this.frame); this.frame = 0;
  }
  private cancelGesture() {
    this.handleDrag?.cancel();
    this.endGesture(); this.nativeActive = false; clearTimeout(this.nativeEndTimer);
    clearTimeout(this.keyTimer); this.keyTimer = undefined; this.draft = undefined;
    this.paint();
  }
  private listen(type: string, handler: EventListener) {
    const doc = this.ownerDocument;
    doc.addEventListener(type, handler, { capture: true, passive: false });
    this.removeGestureListeners.push(() => doc.removeEventListener(type, handler, true));
  }
  // Keep the requested value visible while devices/group members report intermediate states.
  private reconcile() {
    if (!this.pending || this.sending || this.queued) return;
    const target = this.pending;
    const matches = this.available && (target.value === 0 ? this.entity?.state === "off" : this.entity?.state === "on" && typeof this.entity.attributes.brightness === "number" && Math.abs(this.level - target.value) <= 1);
    if (!matches) { clearTimeout(this.acknowledgeTimer); this.acknowledgeTimer = undefined; return; }
    if (!this.acknowledgeTimer) this.acknowledgeTimer = setTimeout(() => {
      if (this.pending?.sequence === target.sequence) { this.clearPending(); this.paint(); }
    }, 400);
  }
  private paint() {
    const track = this.renderRoot?.querySelector<HTMLElement>(".track");
    if (!track) return;
    const value = this.draft ?? this.pending?.value ?? this.level;
    track.style.setProperty("--level", String(value / 100));
    track.setAttribute("aria-valuenow", String(value));
    const known = this.draft !== undefined || this.pending !== undefined || this.entity?.state === "off" || typeof this.entity?.attributes.brightness === "number" && Number.isFinite(this.entity.attributes.brightness);
    const label = !this.available ? "—" : !this.dimmable ? (this.entity?.state === "on" ? localized(this.hass,"On","Be") : localized(this.hass,"Off","Ki")) : known ? `${value}%` : "—";
    track.setAttribute("aria-valuetext", label);
    const handle = track.querySelector(".drag-handle");
    handle?.setAttribute("aria-valuenow", String(value)); handle?.setAttribute("aria-valuetext", label);
    const input = track.querySelector<HTMLInputElement>("input");
    if (input && !this.nativeActive) input.value = String(value);
    const output = this.renderRoot.querySelector(".value");
    if (output) output.textContent = label;
  }
  private moveTo(y: number) {
    const g = this.gesture;
    if (!g) return;
    this.draft = Math.max(0, Math.min(100, Math.round((g.bottom - y) / g.height * 100)));
    if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.paint(); });
  }
  private begin(kind: "pointer" | "touch", id: number, track: HTMLElement, y: number) {
    this.endGesture(); clearTimeout(this.keyTimer); this.keyTimer = undefined;
    const rect = track.getBoundingClientRect();
    if (!rect.height) return;
    this.gesture = { kind, id, bottom: rect.bottom, height: rect.height, track };
    this.moveTo(y);
  }
  private start(event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0 || this.gesture || !this.available || !this.dimmable) return;
    event.preventDefault(); event.stopPropagation();
    const track = event.currentTarget as HTMLElement;
    this.begin("pointer", event.pointerId, track, event.clientY);
    if (!this.gesture) return;
    // Capture is an optimization, not the lifetime of the drag. Some WebViews lose it.
    try { track.setPointerCapture(event.pointerId); } catch { /* document listeners retain the drag */ }
    this.listen("pointermove", ((e: PointerEvent) => {
      if (this.gesture?.kind !== "pointer" || e.pointerId !== this.gesture.id) return;
      e.preventDefault(); e.stopPropagation(); this.moveTo(e.clientY);
    }) as EventListener);
    this.listen("pointerup", ((e: PointerEvent) => {
      if (this.gesture?.kind !== "pointer" || e.pointerId !== this.gesture.id) return;
      e.preventDefault(); e.stopPropagation(); this.finishGesture();
    }) as EventListener);
    this.listen("pointercancel", ((e: PointerEvent) => {
      if (this.gesture?.kind === "pointer" && e.pointerId === this.gesture.id) this.cancelGesture();
    }) as EventListener);
  }
  @eventOptions({ passive: false })
  private touchStart(event: TouchEvent) {
    if (!this.available || !this.dimmable) return;
    event.preventDefault(); event.stopPropagation();
    if (event.touches.length !== 1) { this.cancelGesture(); return; }
    const touch = event.touches[0];
    // Touch takes ownership of a preceding pointerdown; never commit both streams.
    this.begin("touch", touch.identifier, event.currentTarget as HTMLElement, touch.clientY);
    if (!this.gesture) return;
    this.listen("touchstart", ((e: TouchEvent) => { if (e.touches.length > 1) this.cancelGesture(); }) as EventListener);
    this.listen("touchmove", ((e: TouchEvent) => {
      if (this.gesture?.kind !== "touch") return;
      e.preventDefault(); e.stopPropagation();
      const t = Array.from(e.touches).find(t => t.identifier === this.gesture?.id);
      if (e.touches.length !== 1 || !t) { this.cancelGesture(); return; }
      this.moveTo(t.clientY);
    }) as EventListener);
    this.listen("touchend", ((e: TouchEvent) => {
      if (this.gesture?.kind !== "touch") return;
      e.preventDefault(); e.stopPropagation();
      const t = Array.from(e.changedTouches).find(t => t.identifier === this.gesture?.id);
      if (t) this.finishGesture();
    }) as EventListener);
    this.listen("touchcancel", (() => this.cancelGesture()) as EventListener);
  }
  private finishGesture() {
    // Commit the last sampled position. Embedded browsers may replay the initial
    // contact coordinates in pointerup/touchend; those must not undo the drag.
    const value = this.draft;
    this.endGesture();
    if (value !== undefined) this.commit(value);
  }
  private key(event: KeyboardEvent) {
    if (!this.available || !this.dimmable || this.gesture) return;
    const current = this.draft ?? this.pending?.value ?? this.level;
    const values: Record<string, number> = { ArrowUp: current + 5, ArrowRight: current + 5, ArrowDown: current - 5, ArrowLeft: current - 5, PageUp: current + 10, PageDown: current - 10, Home: 0, End: 100 };
    if (event.key === "Escape") { event.preventDefault(); this.cancelGesture(); return; }
    if (!(event.key in values)) return;
    event.preventDefault(); this.draft = Math.max(0, Math.min(100, values[event.key])); this.paint();
    clearTimeout(this.keyTimer);
    this.keyTimer = setTimeout(() => { this.keyTimer = undefined; void this.commit(this.draft!); }, 250);
  }
  private commit(value: number) {
    if (!this.hass || !this.config || !this.available || !Number.isFinite(value)) { this.cancelGesture(); return; }
    this.clearPending(); this.draft = undefined; this.error = false; this.unconfirmed = false;
    this.pending = { value, sequence: ++this.sequence };
    this.queued = { ...this.pending, entity: this.config.entity };
    this.paint(); void this.sendNext();
  }
  private async sendNext() {
    if (this.sending || !this.queued || !this.hass) return;
    const command = this.queued; this.queued = undefined;
    this.sending = true; this.busy = true;
    try {
      await this.hass.callService("light", command.value === 0 ? "turn_off" : "turn_on", command.value === 0 ? {} : { brightness_pct: command.value }, { entity_id: command.entity });
      if (this.pending?.sequence === command.sequence) {
        this.settleTimer = setTimeout(() => {
          if (this.pending?.sequence !== command.sequence) return;
          this.clearPending(); this.unconfirmed = true; this.paint();
        }, 5000);
      }
    } catch {
      // An older request must not roll back a newer completed gesture.
      if (this.pending?.sequence === command.sequence) { this.clearPending(); this.error = true; }
    } finally {
      this.sending = false; this.busy = false;
      this.reconcile(); this.paint();
      if (this.isConnected) void this.sendNext();
    }
  }
  private nativeStart(event: Event) {
    clearTimeout(this.nativeEndTimer);
    if (!this.nativeActive) this.nativeInitial = Number((event.currentTarget as HTMLInputElement).value);
    this.nativeCancelled = false; this.nativeCommitted = false; this.nativeActive = true;
  }
  private nativeInput(event: Event) {
    if (!this.available || !this.dimmable || this.nativeCancelled) return;
    this.nativeCommitted = false;
    this.draft = Number((event.currentTarget as HTMLInputElement).value);
    if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.paint(); });
  }
  private nativeChange(event: Event) {
    if (this.nativeCancelled || this.nativeCommitted || !this.available || !this.dimmable) return;
    this.nativeActive = false;
    this.nativeCommitted = true;
    clearTimeout(this.nativeEndTimer);
    this.commit(this.draft ?? Number((event.currentTarget as HTMLInputElement).value));
  }
  private nativeCancel() { this.nativeCancelled = true; this.cancelGesture(); }
  private nativeEnd() {
    // Keep the native value protected until release is resolved. Some WebViews
    // deliver change later (or omit it); painting HA state here would erase input.
    clearTimeout(this.nativeEndTimer);
    this.nativeEndTimer = setTimeout(() => {
      this.nativeActive = false;
      if (this.nativeCancelled || this.nativeCommitted) return;
      this.nativeCommitted = true;
      const value = this.draft;
      if (value !== undefined && value !== this.nativeInitial) this.commit(value);
      else { this.draft = undefined; this.paint(); }
    }, 0);
  }
  private info() {
    if(this.config?.details === "none")return;
    if(this.config?.details === "event") { this.dispatchEvent(new CustomEvent("luma-control-details",{detail:{entity:this.config.entity,name:this.config.name},bubbles:true,composed:true}));return; }
    if (this.hass && this.config) void runAction(this, this.hass, { action: "more-info" }, this.config.entity); }
  private async toggle(event: MouseEvent) {
    if (!this.press.allowsClick(event) || this.busy || !this.available || !this.hass || !this.config) return;
    this.cancelGesture(); this.clearPending(); this.sending = true; this.busy = true; this.error = false; this.unconfirmed = false;
    try { await this.hass.callService("light", "toggle", {}, { entity_id: this.config.entity }); }
    catch { this.error = true; }
    finally { this.sending = false; this.busy = false; if (this.isConnected) void this.sendNext(); }
  }
  render() {
    if (!this.config || !this.hass) return nothing;
    const name = this.config.name || entityName(this.entity, this.config.entity);
    const disabled = !this.available || !this.dimmable;
    const horizontal = this.config.orientation === "horizontal";
    const touch = horizontal && this.config.touch_controls;
    const power = html`<button class="power" aria-label=${`${name}: ${localized(this.hass,"On / off","Be / ki")}`} aria-pressed=${this.entity?.state === "on"} ?disabled=${!this.available || this.busy}
      @pointerdown=${(e:PointerEvent)=>this.press.start(e,()=>this.info())} @click=${this.toggle}><ha-icon icon=${touch?"mdi:power":this.config.icon || "mdi:lightbulb-outline"}></ha-icon>${touch?html`<span>${this.entity?.state === "on"?localized(this.hass,"On","Be"):localized(this.hass,"Off","Ki")}</span>`:nothing}</button>`;
    return html`<div class="card ${this.entity?.state === "on" ? "on" : ""} ${horizontal ? "horizontal" : ""} ${touch ? "touch-controls" : ""}">
      <div class="top">${touch?nothing:power}
        ${horizontal ? html`<div class="name">${name}</div><span class="value"></span>` : nothing}
        ${this.config.details === "none" ? nothing : html`<button class="details" aria-label=${localized(this.hass, "Details", "Részletek")} @click=${this.info}><ha-icon icon="mdi:dots-horizontal"></ha-icon></button>`}</div>
      ${horizontal ? nothing : html`<div class="name">${name}</div>`}<div class="subtitle">${this.config.subtitle || ""}</div>
      ${touch?power:nothing}
      ${horizontal && this.config.interaction === "handle" ? html`<div class="track handle-track" aria-disabled=${String(disabled)}><div class="fill"></div>
        <div class="drag-handle" role="slider" tabindex=${disabled ? -1 : 0} aria-label=${name} aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="100" aria-disabled=${String(disabled)} @keydown=${this.key}></div>
      </div>` : horizontal ? html`<div class="track" aria-disabled=${String(disabled)}><div class="fill"></div>
        <input type="range" min="0" max="100" step="1" aria-label=${name} aria-orientation="horizontal" ?disabled=${disabled}
          @pointerdown=${this.nativeStart} @touchstart=${this.nativeStart} @keydown=${this.nativeStart}
          @input=${this.nativeInput} @change=${this.nativeChange}
          @pointerup=${this.nativeEnd} @touchend=${this.nativeEnd} @keyup=${this.nativeEnd}
          @pointercancel=${this.nativeCancel} @touchcancel=${this.nativeCancel}>
      </div>` : html`
      <div class="track" role="slider" tabindex=${disabled ? -1 : 0} aria-label=${name} aria-orientation="vertical" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${this.level} aria-disabled=${String(disabled)}
        @pointerdown=${this.start} @touchstart=${this.touchStart} @keydown=${this.key} @blur=${() => { if (this.keyTimer) { clearTimeout(this.keyTimer); this.keyTimer = undefined; void this.commit(this.draft!); } }}>
        <div class="fill"></div><span class="value"></span><div class="marker"></div></div>`}
      <div class="note ${this.error ? "error" : ""}" role="status">${this.error ? localized(this.hass, "Could not send", "Nem sikerült") : !this.available ? localized(this.hass, "Unavailable", "Nem elérhető") : this.busy ? localized(this.hass, "Sending…", "Küldés…") : this.pending ? localized(this.hass, "Waiting for device…", "Visszajelzésre vár…") : this.unconfirmed ? localized(this.hass, "Not confirmed", "Nincs visszaigazolás") : !this.dimmable ? localized(this.hass, "On / off only", "Csak be / ki") : ""}</div>
    </div>`;
  }
}
