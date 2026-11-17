import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, eventOptions, property, state } from "lit/decorators.js";
import { entityName, runAction } from "../helpers";
import { localized } from "../localize";
import { HoldGesture } from "../hold-gesture";
import { lumaTokens, lumaInteractionStyles } from "../styles";
import type { HomeAssistant, LovelaceCard } from "../types";

export interface LightFaderConfig { type?: string; entity: string; name?: string; subtitle?: string; icon?: string }

/** A tall touch target, with one service call per completed gesture. */
@customElement("luma-light-fader-card")
export class LumaLightFaderCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property({ attribute: false }) config?: LightFaderConfig;
  @state() private busy = false;
  @state() private error = false;
  private draft?: number;
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
    this.reconcile(); this.paint();
  }
  disconnectedCallback() { this.reset(); this.press.cancel(); super.disconnectedCallback(); }
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
    this.endGesture();
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
    const track = this.renderRoot.querySelector<HTMLElement>(".track");
    if (!track) return;
    const value = this.draft ?? this.pending?.value ?? this.level;
    track.style.setProperty("--level", String(value / 100));
    track.setAttribute("aria-valuenow", String(value));
    const known = this.draft !== undefined || this.pending !== undefined || this.entity?.state === "off" || typeof this.entity?.attributes.brightness === "number" && Number.isFinite(this.entity.attributes.brightness);
    const label = !this.available ? "—" : !this.dimmable ? (this.entity?.state === "on" ? localized(this.hass,"On","Be") : localized(this.hass,"Off","Ki")) : known ? `${value}%` : "—";
    track.setAttribute("aria-valuetext", label);
    const output = track.querySelector(".value");
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
      e.preventDefault(); e.stopPropagation(); this.finishAt(e.clientY);
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
      if (t) this.finishAt(t.clientY);
    }) as EventListener);
    this.listen("touchcancel", (() => this.cancelGesture()) as EventListener);
  }
  private finishAt(y: number) {
    this.moveTo(y);
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
  private info() { if (this.hass && this.config) void runAction(this, this.hass, { action: "more-info" }, this.config.entity); }
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
    return html`<div class="card ${this.entity?.state === "on" ? "on" : ""}">
      <div class="top"><button class="power" aria-label=${name} aria-pressed=${this.entity?.state === "on"} ?disabled=${!this.available || this.busy}
        @pointerdown=${(e: PointerEvent) => this.press.start(e, () => this.info())} @click=${this.toggle}><ha-icon icon=${this.config.icon || "mdi:lightbulb-outline"}></ha-icon></button>
        <button class="details" aria-label=${localized(this.hass, "Details", "Részletek")} @click=${this.info}><ha-icon icon="mdi:dots-horizontal"></ha-icon></button></div>
      <div class="name">${name}</div><div class="subtitle">${this.config.subtitle || ""}</div>
      <div class="track" role="slider" tabindex=${disabled ? -1 : 0} aria-label=${name} aria-orientation="vertical" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${this.level} aria-disabled=${String(disabled)}
        @pointerdown=${this.start} @touchstart=${this.touchStart} @keydown=${this.key} @blur=${() => { if (this.keyTimer) { clearTimeout(this.keyTimer); this.keyTimer = undefined; void this.commit(this.draft!); } }}>
        <div class="fill"></div><span class="value"></span><div class="marker"></div></div>
      <div class="note ${this.error ? "error" : ""}" role="status">${this.error ? localized(this.hass, "Could not send", "Nem sikerült") : !this.available ? localized(this.hass, "Unavailable", "Nem elérhető") : this.busy ? localized(this.hass, "Sending…", "Küldés…") : this.pending ? localized(this.hass, "Waiting for device…", "Visszajelzésre vár…") : this.unconfirmed ? localized(this.hass, "Not confirmed", "Nincs visszaigazolás") : !this.dimmable ? localized(this.hass, "On / off only", "Csak be / ki") : ""}</div>
    </div>`;
  }
}
