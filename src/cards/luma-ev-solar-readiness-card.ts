import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { runAction } from "../helpers";
import { localized } from "../localize";
import { lumaTokens } from "../styles";
import type { HassEntity, HomeAssistant, LovelaceCard } from "../types";

interface Config {
  type: string;
  readiness_entity: string;
  reason_entity: string;
  window_active_entity: string;
  window_start_entity: string;
  window_end_entity: string;
  window_remaining_entity: string;
  expected_charge_entity: string;
  ocpp_connected_entity?: string;
  telemetry_stale_entity?: string;
  controller_state_entity?: string;
  controller_reason_entity?: string;
  restart_inhibited_entity?: string;
  title?: string;
  show_reason?: boolean;
}

type Presentation = { icon: string; tone: string; label: string; detail: string; source: string };

@customElement("luma-ev-solar-readiness-card")
export class LumaEvSolarReadinessCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: Config;

  static styles = [lumaTokens, css`
    ha-card{display:grid;gap:16px;padding:18px;border:1px solid color-mix(in srgb,var(--tone) 16%,var(--luma-border));border-radius:var(--luma-radius-hero);background:linear-gradient(140deg,color-mix(in srgb,var(--tone) 8%,var(--luma-surface)),var(--luma-surface) 68%);box-shadow:var(--luma-shadow)}
    .hero{appearance:none;display:grid;grid-template-columns:52px minmax(0,1fr) auto;grid-template-areas:"icon eyebrow badge" "icon label badge" "icon detail badge";align-items:center;gap:2px 13px;width:100%;min-width:0;padding:0;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
    .hero-icon{grid-area:icon;display:grid;place-items:center;width:52px;height:52px;border-radius:17px;color:var(--tone);background:color-mix(in srgb,var(--tone) 14%,transparent)}.hero-icon ha-icon{--mdc-icon-size:27px}
    .eyebrow{grid-area:eyebrow;color:var(--luma-muted);font-size:9px;font-weight:760;letter-spacing:.065em;text-transform:uppercase}.label{grid-area:label;font-size:22px;font-weight:780;letter-spacing:-.025em;line-height:1.15}.detail{grid-area:detail;margin-top:2px;color:var(--luma-muted);font-size:11px;line-height:1.4}
    .badge{grid-area:badge;display:flex;align-items:center;gap:6px;min-height:30px;padding:6px 10px;border-radius:999px;background:color-mix(in srgb,var(--tone) 11%,transparent);color:var(--tone);font-size:10px;font-weight:740;white-space:nowrap}.badge ha-icon{--mdc-icon-size:15px}
    .window{display:grid;gap:9px;padding:14px;border-radius:17px;background:color-mix(in srgb,var(--primary-text-color) 3.5%,transparent)}
    .window-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.window-title{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:720}.window-title ha-icon{--mdc-icon-size:17px;color:var(--tone)}.window-state{display:flex;align-items:center;gap:5px;color:var(--luma-muted);font-size:9px;font-weight:680}.window-state::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--tone);box-shadow:0 0 0 3px color-mix(in srgb,var(--tone) 12%,transparent)}
    .timeline{position:relative;min-height:72px;padding:25px 0 20px}.rail{position:relative;height:16px;border-radius:999px;background:color-mix(in srgb,var(--primary-text-color) 8%,transparent);box-shadow:inset 0 1px 2px rgba(0,0,0,.08);overflow:visible}.rail::before{content:"";position:absolute;inset:0;border-radius:inherit;background:repeating-linear-gradient(90deg,transparent 0,transparent calc(25% - 1px),color-mix(in srgb,var(--primary-text-color) 10%,transparent) calc(25% - 1px),color-mix(in srgb,var(--primary-text-color) 10%,transparent) 25%);pointer-events:none}.solar-band{position:absolute;z-index:1;top:0;bottom:0;left:var(--window-start);width:var(--window-width);min-width:3px;border:1px solid color-mix(in srgb,var(--success-color) 38%,transparent);border-radius:inherit;background:linear-gradient(90deg,color-mix(in srgb,var(--warning-color) 42%,transparent),color-mix(in srgb,var(--success-color) 36%,transparent));overflow:hidden}.solar-elapsed{display:block;height:100%;width:var(--window-progress);background:linear-gradient(90deg,color-mix(in srgb,var(--warning-color) 82%,white),var(--success-color));transition:width .35s ease}.now-marker{position:absolute;z-index:3;top:-7px;bottom:-7px;left:var(--now);width:2px;border-radius:2px;background:var(--primary-text-color);transform:translateX(-1px);box-shadow:0 0 0 2px color-mix(in srgb,var(--luma-surface) 80%,transparent)}.now-marker::before{content:"";position:absolute;top:-3px;left:50%;width:8px;height:8px;border:2px solid var(--luma-surface);border-radius:50%;background:var(--primary-text-color);transform:translate(-50%,-50%)}
    .edge{position:absolute;top:0;left:var(--edge);display:grid;gap:1px;transform:translateX(-50%);white-space:nowrap;text-align:center}.edge strong{font-size:11px;font-weight:760}.edge small{color:var(--luma-muted);font-size:8px;font-weight:650}.axis{position:absolute;right:0;bottom:0;left:0;display:flex;justify-content:space-between;color:var(--luma-muted);font-size:8px;font-weight:650}.empty-window{position:absolute;inset:0;display:grid;place-items:center;color:var(--luma-muted);font-size:10px;font-weight:680}
    .metric span{display:block;color:var(--luma-muted);font-size:9px;font-weight:680}
    .metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.metric{appearance:none;display:grid;grid-template-columns:34px minmax(0,1fr);grid-template-areas:"metric-icon metric-label" "metric-icon metric-value";align-items:center;gap:1px 9px;min-width:0;padding:9px;border:0;border-radius:14px;background:color-mix(in srgb,var(--tone) 6%,transparent);color:inherit;font:inherit;text-align:left}.metric.interactive{cursor:pointer}.metric-icon{grid-area:metric-icon;display:grid;place-items:center;width:34px;height:34px;border-radius:11px;color:var(--tone);background:color-mix(in srgb,var(--tone) 12%,transparent)}.metric-icon ha-icon{--mdc-icon-size:18px}.metric span{grid-area:metric-label;align-self:end}.metric strong{grid-area:metric-value;align-self:start;overflow:hidden;font-size:13px;font-weight:750;text-overflow:ellipsis;white-space:nowrap}
    button{outline:none}button:focus-visible{outline:2px solid var(--tone);outline-offset:2px}
    @media(max-width:599px){ha-card{gap:13px;padding:15px}.hero{grid-template-columns:46px minmax(0,1fr);grid-template-areas:"icon eyebrow" "icon label" "icon detail" "badge badge";gap:2px 11px}.hero-icon{width:46px;height:46px;border-radius:15px}.hero-icon ha-icon{--mdc-icon-size:24px}.label{font-size:18px}.badge{justify-self:start;margin-top:8px}.detail{font-size:10px}.window{padding:12px}.timeline{min-height:68px}.edge small{display:none}.metrics{grid-template-columns:1fr 1fr}}
  `];

  setConfig(config: Config) {
    const required: Array<keyof Config> = [
      "readiness_entity", "reason_entity", "window_active_entity", "window_start_entity",
      "window_end_entity", "window_remaining_entity", "expected_charge_entity",
    ];
    if (!config || required.some((key) => !config[key])) throw Error("EV Solar readiness entities required");
    this.config = config;
  }

  getCardSize() { return 4; }
  private entity(id?: string): HassEntity | undefined { return id ? this.hass?.states[id] : undefined; }
  private valid(entity?: HassEntity) { return Boolean(entity && !["unknown", "unavailable", ""].includes(entity.state)); }
  private moreInfo(entity: string) { void runAction(this, this.hass!, { action: "more-info" }, entity); }

  private readinessPresentation(): Presentation {
    const config = this.config!;
    const readiness = this.entity(config.readiness_entity)?.state || "telemetry_unavailable";
    const reason = this.entity(config.reason_entity)?.state || localized(this.hass, "No recommendation is available", "Nem érhető el ajánlás");
    const controllerReason = this.entity(config.controller_reason_entity)?.state || reason;
    const controllerState = this.entity(config.controller_state_entity)?.state;
    if (config.ocpp_connected_entity && this.entity(config.ocpp_connected_entity)?.state !== "on") return {
      icon: "mdi:ev-station-off", tone: "var(--error-color)", label: localized(this.hass, "Charger unavailable", "Töltő nem elérhető"),
      detail: localized(this.hass, "The charger has no OCPP connection", "A töltőnek nincs OCPP-kapcsolata"), source: config.ocpp_connected_entity,
    };
    if (config.telemetry_stale_entity && this.entity(config.telemetry_stale_entity)?.state === "on") return {
      icon: "mdi:alert-circle-outline", tone: "var(--error-color)", label: localized(this.hass, "No fresh energy telemetry", "Nincs friss energiamérés"),
      detail: reason, source: config.telemetry_stale_entity,
    };
    if (controllerState === "FAULT") return {
      icon: "mdi:alert-octagon-outline", tone: "var(--error-color)", label: localized(this.hass, "Charger fault", "Töltőhiba"),
      detail: controllerReason, source: config.controller_state_entity || config.readiness_entity,
    };
    if (config.restart_inhibited_entity && this.entity(config.restart_inhibited_entity)?.state === "on") return {
      icon: "mdi:restart-off", tone: "var(--warning-color)", label: localized(this.hass, "Restart inhibited", "Újraindítás tiltva"),
      detail: config.show_reason === false ? localized(this.hass, "Unplug and reconnect the car before another automatic start", "Új automatikus indításhoz húzd ki, majd dugd vissza az autót") : controllerReason, source: config.restart_inhibited_entity,
    };
    const map: Record<string, Omit<Presentation, "detail" | "source">> = {
      ready_now: { icon: "mdi:solar-power", tone: "var(--success-color)", label: localized(this.hass, "Worth connecting now", "Érdemes most rádugni") },
      connect_and_wait: { icon: "mdi:clock-outline", tone: "var(--primary-color)", label: localized(this.hass, "Connect and wait", "Rádughatod, később indulhat") },
      marginal: { icon: "mdi:weather-partly-cloudy", tone: "var(--warning-color)", label: localized(this.hass, "Uncertain — waiting", "Most bizonytalan – várakozás") },
      too_late_today: { icon: "mdi:weather-sunset-down", tone: "var(--secondary-text-color)", label: localized(this.hass, "No useful Solar charge expected today", "Ma már nem várható érdemi Solar töltés") },
      learning: { icon: "mdi:chart-timeline-variant-shimmer", tone: "var(--primary-color)", label: localized(this.hass, "The system is still learning", "A rendszer még tanul") },
      telemetry_unavailable: { icon: "mdi:alert-circle-outline", tone: "var(--error-color)", label: localized(this.hass, "No fresh energy telemetry", "Nincs friss energiamérés") },
    };
    const summaries: Record<string, string> = {
      ready_now: localized(this.hass, "Solar conditions are good right now", "Most megfelelőek a Solar töltés feltételei"),
      connect_and_wait: localized(this.hass, "A useful Solar period is expected later today", "Ma később várható megfelelő Solar-időszak"),
      marginal: localized(this.hass, "The Solar window is active, but conditions are not good enough yet", "A Solar-időablak aktív, de még nem elég jók a feltételek"),
      too_late_today: localized(this.hass, "Check again tomorrow", "Holnap érdemes újra megnézni"),
      learning: localized(this.hass, "More Solar history is needed for a reliable recommendation", "Még több napenergia-adat kell a biztos ajánláshoz"),
      telemetry_unavailable: localized(this.hass, "Fresh energy measurements are required", "Friss energiamérés szükséges az ajánláshoz"),
    };
    return { ...(map[readiness] || map.telemetry_unavailable), detail: config.show_reason === false ? (summaries[readiness] || summaries.telemetry_unavailable) : reason, source: config.readiness_entity };
  }

  private date(entity?: HassEntity): Date | undefined {
    if (!this.valid(entity)) return undefined;
    const date = new Date(entity!.state);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  private time(date?: Date) {
    return date ? new Intl.DateTimeFormat(this.hass?.locale?.language || undefined, { hour: "2-digit", minute: "2-digit" }).format(date) : "—";
  }
  private progress(start?: Date, end?: Date, active = false) {
    if (!active || !start || !end || end <= start) return 0;
    return Math.max(0, Math.min(100, (Date.now() - start.getTime()) / (end.getTime() - start.getTime()) * 100));
  }
  private timeline(start?: Date, end?: Date) {
    const anchor = start || new Date();
    const dayStart = new Date(anchor); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
    const total = dayEnd.getTime() - dayStart.getTime();
    const position = (date?: Date) => date ? Math.max(0, Math.min(100, (date.getTime() - dayStart.getTime()) / total * 100)) : 0;
    const windowStart = position(start);
    const windowEnd = position(end);
    const now = new Date();
    const nowVisible = now >= dayStart && now <= dayEnd;
    return { windowStart, windowWidth: Math.max(0, windowEnd - windowStart), now: position(now), nowVisible };
  }
  private value(entity: HassEntity | undefined, fallback = "—") {
    if (!this.valid(entity)) return fallback;
    return this.hass?.formatEntityState?.(entity!) || `${entity!.state}${entity!.attributes.unit_of_measurement ? ` ${entity!.attributes.unit_of_measurement}` : ""}`;
  }
  private duration(entity?: HassEntity) {
    if (!this.valid(entity)) return "—";
    const raw = Number(entity!.state);
    if (!Number.isFinite(raw)) return this.value(entity);
    const unit = String(entity!.attributes.unit_of_measurement || "min").toLowerCase();
    const minutes = Math.max(0, Math.round(unit === "s" ? raw / 60 : unit === "h" ? raw * 60 : raw));
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (!hours) return `${rest} min`;
    return localized(this.hass, `${hours} h${rest ? ` ${rest} min` : ""}`, `${hours} ó${rest ? ` ${rest} p` : ""}`);
  }

  render() {
    if (!this.hass || !this.config) return nothing;
    const presentation = this.readinessPresentation();
    const active = this.entity(this.config.window_active_entity)?.state === "on";
    const start = this.date(this.entity(this.config.window_start_entity));
    const end = this.date(this.entity(this.config.window_end_entity));
    const remaining = this.entity(this.config.window_remaining_entity);
    const expected = this.entity(this.config.expected_charge_entity);
    const usefulLabel = active ? localized(this.hass, "Time remaining", "Hátralévő hasznos idő") : localized(this.hass, "Expected useful duration", "Várható hasznos idő");
    const timeline = this.timeline(start, end);
    const now = new Date();
    return html`<ha-card style=${`--tone:${presentation.tone}`}>
      <button class="hero interactive" @click=${() => this.moreInfo(presentation.source)}>
        <span class="hero-icon"><ha-icon icon=${presentation.icon}></ha-icon></span>
        <span class="eyebrow">${this.config.title || localized(this.hass, "Solar recommendation", "Solar ajánlás")}</span>
        <strong class="label">${presentation.label}</strong>
        <span class="detail">${presentation.detail}</span>
        <span class="badge"><ha-icon icon=${active ? "mdi:weather-sunny" : "mdi:calendar-clock"}></ha-icon>${active ? localized(this.hass, "Window active", "Aktív időablak") : localized(this.hass, "Current / next window", "Aktuális / következő ablak")}</span>
      </button>
      <div class="window">
        <div class="window-head"><span class="window-title"><ha-icon icon="mdi:timeline-clock-outline"></ha-icon>${localized(this.hass, "Today's Solar window", "Mai Solar-időablak")}</span><span class="window-state">${start && end ? `${localized(this.hass, "Now", "Most")} ${this.time(now)} · ${active ? localized(this.hass, "in progress", "folyamatban") : localized(this.hass, "forecast", "előrejelzés")}` : localized(this.hass, "none today", "ma már nincs")}</span></div>
        <div class="timeline">
          ${start && end ? html`
            <span class="edge" style=${`--edge:${timeline.windowStart}%`}><strong>${this.time(start)}</strong><small>${localized(this.hass, "Start", "Kezdés")}</small></span>
            <span class="edge" style=${`--edge:${timeline.windowStart + timeline.windowWidth}%`}><strong>${this.time(end)}</strong><small>${localized(this.hass, "End", "Vége")}</small></span>
          ` : nothing}
          <div class="rail">
            ${start && end ? html`<span class="solar-band" style=${`--window-start:${timeline.windowStart}%;--window-width:${timeline.windowWidth}%;--window-progress:${this.progress(start, end, active)}%`}><span class="solar-elapsed"></span></span>` : html`<span class="empty-window">${localized(this.hass, "No more useful Solar window today", "Ma már nincs további hasznos Solar-időablak")}</span>`}
            ${timeline.nowVisible ? html`<span class="now-marker" style=${`--now:${timeline.now}%`} title=${`${localized(this.hass, "Now", "Most")} ${this.time(now)}`}></span>` : nothing}
          </div>
          <div class="axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
        </div>
      </div>
      <div class="metrics">
        ${this.metric(this.config.window_remaining_entity, "mdi:timer-sand", usefulLabel, this.duration(remaining))}
        ${this.metric(this.config.expected_charge_entity, "mdi:battery-charging-medium", localized(this.hass, "Estimated Solar energy", "Becsült Solar energia"), this.value(expected))}
      </div>
    </ha-card>`;
  }

  private metric(entity: string, icon: string, label: string, value: string) {
    return html`<button class="metric interactive" @click=${() => this.moreInfo(entity)}><span class="metric-icon"><ha-icon icon=${icon}></ha-icon></span><span>${label}</span><strong>${value}</strong></button>`;
  }
}
