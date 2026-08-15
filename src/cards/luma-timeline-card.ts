import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LovelaceCard } from "../types";

interface TimelineEvent {
  id?: string;
  timestamp?: string;
  url?: string;
  snapshot?: string;
  type?: string;
}

interface TimelineConfig {
  type: string;
  entity: string;
  title?: string;
  subtitle?: string;
  icon?: string;
  events_attribute?: string;
  max_items?: number;
  columns?: number;
  exclude_types?: string[];
}

const EVENT_META: Record<string, { label: string; icon: string; color: string }> = {
  person: { label: "Személy", icon: "mdi:account", color: "var(--warning-color, #f59e0b)" },
  vehicle: { label: "Jármű", icon: "mdi:car", color: "var(--info-color, #3b82f6)" },
  animal: { label: "Állat", icon: "mdi:paw", color: "#8b5cf6" },
  package: { label: "Csomag", icon: "mdi:package-variant", color: "#10b981" },
  ring: { label: "Csengetés", icon: "mdi:doorbell-video", color: "#ef4444" },
  motion: { label: "Mozgás", icon: "mdi:motion-sensor", color: "var(--primary-color)" },
};

@customElement("luma-timeline-card")
export class LumaTimelineCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: TimelineConfig;
  @state() private selected?: TimelineEvent;
  @state() private signedUrls: Record<string, string> = {};
  private signingKey = "";

  static styles = [lumaTokens, css`
    :host{container-type:inline-size}
    ha-card{padding:18px;border:1px solid var(--luma-border);border-radius:var(--luma-radius-card);background:linear-gradient(145deg,color-mix(in srgb,var(--primary-color) 5%,var(--luma-surface)),var(--luma-surface) 72%);box-shadow:var(--luma-shadow)}
    .header{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:11px;margin-bottom:14px}.header-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:14px;color:var(--primary-color);background:color-mix(in srgb,var(--primary-color) 12%,transparent)}.header-icon ha-icon{--mdc-icon-size:22px}h2{margin:0;font-size:15px;font-weight:var(--luma-weight-title)}.subtitle{margin-top:2px;color:var(--luma-muted);font-size:10px}.count{padding:6px 9px;border-radius:999px;color:var(--primary-color);background:color-mix(in srgb,var(--primary-color) 10%,transparent);font-size:10px;font-weight:750}
    .timeline{display:grid;grid-template-columns:repeat(var(--columns),minmax(0,1fr));gap:10px}.event{position:relative;display:grid;grid-template-columns:116px minmax(0,1fr);min-height:98px;padding:0;border:1px solid color-mix(in srgb,var(--tone) 13%,transparent);border-radius:17px;overflow:hidden;color:var(--primary-text-color);background:color-mix(in srgb,var(--tone) 4%,var(--luma-surface));font:inherit;text-align:left;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease}.event:hover{transform:translateY(-2px);box-shadow:0 13px 30px color-mix(in srgb,var(--tone) 10%,transparent)}.snapshot{width:116px;height:100%;min-height:98px;object-fit:cover;background:color-mix(in srgb,var(--primary-text-color) 5%,transparent)}.details{display:flex;flex-direction:column;justify-content:center;min-width:0;padding:12px}.type{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:700}.type ha-icon{--mdc-icon-size:17px;color:var(--tone)}.time{margin-top:5px;color:var(--luma-muted);font-size:10px;line-height:1.35}.play{position:absolute;right:9px;bottom:9px;display:grid;place-items:center;width:27px;height:27px;border-radius:999px;color:var(--tone);background:color-mix(in srgb,var(--tone) 14%,var(--luma-surface));backdrop-filter:blur(8px)}.play ha-icon{--mdc-icon-size:15px}.empty{padding:36px 12px;text-align:center;color:var(--luma-muted);font-size:12px}
    .dialog{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:24px;background:rgba(10,12,18,.72);backdrop-filter:blur(12px)}.player{position:relative;width:min(920px,100%);overflow:hidden;border-radius:22px;background:#08090c;box-shadow:0 28px 90px rgba(0,0,0,.46)}video{display:block;width:100%;max-height:78vh;background:#000}.close{position:absolute;top:12px;right:12px;z-index:1;display:grid;place-items:center;width:38px;height:38px;border:0;border-radius:999px;color:white;background:rgba(0,0,0,.5);cursor:pointer}.close ha-icon{--mdc-icon-size:20px}
    @container(max-width:600px){ha-card{padding:14px}.timeline{grid-template-columns:minmax(0,1fr)}.event{grid-template-columns:105px minmax(0,1fr)}.snapshot{width:105px}.header{grid-template-columns:38px minmax(0,1fr)}.header-icon{width:38px;height:38px}.count{grid-column:2;justify-self:start}.dialog{padding:10px}.player{border-radius:18px}}
    @media(max-width:720px){.timeline{grid-template-columns:minmax(0,1fr)}}
  `];

  setConfig(config: TimelineConfig): void {
    if (!config?.entity) throw new Error("Luma timeline requires an entity.");
    this.config = { events_attribute: "events", max_items: 24, columns: 2, exclude_types: ["lowMemory"], ...config };
    this.signingKey = "";
  }

  getCardSize(): number { return 5; }

  protected shouldUpdate(changed: PropertyValues<this>): boolean {
    if (!changed.has("hass")) return true;
    const previous = changed.get("hass") as HomeAssistant | undefined;
    const id = this.config?.entity;
    return !previous || !id || previous.states[id] !== this.hass?.states[id];
  }

  protected updated(changed: PropertyValues<this>): void {
    if (changed.has("hass")) void this.signThumbnails();
  }

  private events(): TimelineEvent[] {
    if (!this.hass || !this.config) return [];
    const entity = this.hass.states[this.config.entity];
    const raw = entity?.attributes[this.config.events_attribute || "events"];
    const excluded = new Set(this.config.exclude_types || []);
    return (Array.isArray(raw) ? raw as TimelineEvent[] : [])
      .filter((event) => !excluded.has(event.type || ""))
      .slice(0, this.config.max_items);
  }

  private async signPath(path?: string, expires = 3600): Promise<string | undefined> {
    if (!path || !this.hass?.callWS) return path;
    if (!path.startsWith("/api/")) return path;
    try {
      const result = await this.hass.callWS<{ path?: string } | string>({ type: "auth/sign_path", path, expires });
      return typeof result === "string" ? result : result.path || path;
    } catch {
      return path;
    }
  }

  private async signThumbnails(): Promise<void> {
    const events = this.events();
    const key = events.map((event) => `${event.id || ""}:${event.snapshot || ""}`).join("|");
    if (!key || key === this.signingKey) return;
    this.signingKey = key;
    const pairs = await Promise.all(events.map(async (event) => {
      const source = event.snapshot;
      return source ? [source, await this.signPath(source)] as const : undefined;
    }));
    if (this.signingKey !== key) return;
    this.signedUrls = Object.fromEntries(pairs.filter((pair): pair is readonly [string, string] => Boolean(pair?.[1])));
  }

  private async openEvent(event: TimelineEvent): Promise<void> {
    if (!event.url) return;
    const url = await this.signPath(event.url, 600);
    const snapshot = event.snapshot ? this.signedUrls[event.snapshot] || await this.signPath(event.snapshot, 600) : undefined;
    this.selected = { ...event, url, snapshot };
  }

  private meta(type = "motion") {
    return EVENT_META[type] || { label: type.replaceAll("_", " "), icon: "mdi:motion-sensor", color: "var(--primary-color)" };
  }

  private formatTime(value?: string): string {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return "Ismeretlen időpont";
    return new Intl.DateTimeFormat(this.hass?.locale?.language || "hu-HU", {
      weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(date);
  }

  private close() { this.selected = undefined; }

  render() {
    if (!this.hass || !this.config) return nothing;
    const entity = this.hass.states[this.config.entity];
    const events = this.events();
    const title = this.config.title || entity?.attributes.friendly_name || "Kamera események";
    return html`
      <ha-card>
        <div class="header"><span class="header-icon"><ha-icon icon=${this.config.icon || "mdi:camera-burst"}></ha-icon></span><div><h2>${title}</h2><div class="subtitle">UniFi Protect · legutóbbi észlelések</div></div><span class="count">${events.length} esemény</span></div>
        ${events.length ? html`<div class="timeline" style=${`--columns:${this.config.columns}`}>
          ${events.map((event) => { const meta = this.meta(event.type); return html`
            <button class="event" style=${`--tone:${meta.color}`} @click=${() => void this.openEvent(event)}>
              ${event.snapshot ? html`<img class="snapshot" src=${this.signedUrls[event.snapshot] || ""} alt="" loading="lazy">` : html`<span class="snapshot"></span>`}
              <span class="details"><span class="type"><ha-icon icon=${meta.icon}></ha-icon>${meta.label}</span><span class="time">${this.formatTime(event.timestamp)}</span></span>
              ${event.url ? html`<span class="play"><ha-icon icon="mdi:play"></ha-icon></span>` : nothing}
            </button>`; })}
        </div>` : html`<div class="empty">Nincs megjeleníthető kameraesemény.</div>`}
      </ha-card>
      ${this.selected?.url ? html`<div class="dialog" role="dialog" aria-modal="true" @click=${(event: MouseEvent) => { if (event.target === event.currentTarget) this.close(); }}><div class="player"><button class="close" aria-label="Bezárás" @click=${this.close}><ha-icon icon="mdi:close"></ha-icon></button><video src=${this.selected.url} poster=${this.selected.snapshot || ""} controls autoplay playsinline></video></div></div>` : nothing}
    `;
  }
}
