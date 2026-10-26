import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { runAction } from "../helpers";
import { localized, localizedMap } from "../localize";
import { lumaTokens } from "../styles";
import type { HassEntity, HomeAssistant, LovelaceCard } from "../types";

interface Config {
  type: string;
  controller_state_entity: string;
  controller_reason_entity: string;
  charging_power_entity: string;
  base_mode_entity: string;
  readiness_entity: string;
  readiness_reason_entity: string;
  window_active_entity: string;
  window_start_entity: string;
  window_end_entity: string;
  window_remaining_entity: string;
  expected_charge_entity?: string;
  ownership_entity?: string;
  charge_now_active_entity?: string;
  charge_now_armed_entity?: string;
  charge_now_remaining_entity?: string;
  pv_power_entity?: string;
  grid_power_entity?: string;
  ocpp_connected_entity?: string;
  telemetry_stale_entity?: string;
  restart_inhibited_entity?: string;
  title?: string;
}

interface Presentation {
  icon: string;
  tone: string;
  eyebrow: string;
  title: string;
  detail: string;
  source: string;
  kind: "charging" | "waiting" | "attention" | "offline";
}

@customElement("luma-ev-overview-card")
export class LumaEvOverviewCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: Config;

  static styles = [lumaTokens, css`
    :host{display:block;min-width:0}
    ha-card{display:grid;gap:16px;padding:18px;border:1px solid color-mix(in srgb,var(--tone) 18%,var(--luma-border));border-radius:var(--luma-radius-hero);background:radial-gradient(circle at 94% 3%,color-mix(in srgb,var(--tone) 11%,transparent),transparent 37%),linear-gradient(145deg,color-mix(in srgb,var(--tone) 6%,var(--luma-surface)),var(--luma-surface) 70%);box-shadow:var(--luma-shadow);overflow:hidden}
    .hero{appearance:none;display:grid;grid-template-columns:52px minmax(0,1fr) auto;grid-template-areas:"icon eyebrow chips" "icon title chips" "icon detail chips";align-items:center;gap:2px 13px;width:100%;min-width:0;padding:0;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}.icon{grid-area:icon;display:grid;place-items:center;width:52px;height:52px;border-radius:17px;color:var(--tone);background:color-mix(in srgb,var(--tone) 14%,transparent)}.icon ha-icon{--mdc-icon-size:27px}.eyebrow{grid-area:eyebrow;color:var(--luma-muted);font-size:9px;font-weight:760;letter-spacing:.065em;text-transform:uppercase}.title{grid-area:title;font-size:22px;font-weight:780;letter-spacing:-.025em;line-height:1.15}.detail{grid-area:detail;margin-top:2px;color:var(--luma-muted);font-size:11px;line-height:1.4}.chips{grid-area:chips;display:flex;justify-content:flex-end;gap:7px;flex-wrap:wrap}.chip{display:flex;align-items:center;gap:5px;min-height:29px;padding:5px 9px;border-radius:999px;background:color-mix(in srgb,var(--tone) 10%,transparent);color:var(--tone);font-size:9px;font-weight:720;white-space:nowrap}.chip.secondary{background:color-mix(in srgb,var(--primary-text-color) 5%,transparent);color:var(--luma-muted)}.chip ha-icon{--mdc-icon-size:14px}
    .facts{display:grid;grid-template-columns:repeat(var(--fact-count),minmax(0,1fr));gap:9px}.fact{appearance:none;display:grid;grid-template-columns:34px minmax(0,1fr);grid-template-areas:"fact-icon fact-label" "fact-icon fact-value";align-items:center;gap:1px 9px;min-width:0;padding:9px;border:0;border-radius:14px;background:color-mix(in srgb,var(--tone) 6%,transparent);color:inherit;font:inherit;text-align:left;cursor:pointer}.fact-icon{grid-area:fact-icon;display:grid;place-items:center;width:34px;height:34px;border-radius:11px;color:var(--fact-tone,var(--tone));background:color-mix(in srgb,var(--fact-tone,var(--tone)) 13%,transparent)}.fact-icon ha-icon{--mdc-icon-size:18px}.fact-label{grid-area:fact-label;align-self:end;overflow:hidden;color:var(--luma-muted);font-size:9px;font-weight:680;text-overflow:ellipsis;white-space:nowrap}.fact strong{grid-area:fact-value;align-self:start;overflow:hidden;font-size:13px;font-weight:750;text-overflow:ellipsis;white-space:nowrap}
    .visual{display:grid;gap:9px;padding:13px 14px;border-radius:17px;background:color-mix(in srgb,var(--primary-text-color) 3.5%,transparent)}.visual-head{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:10px}.visual-title{display:flex;align-items:center;gap:7px;font-weight:720}.visual-title ha-icon{--mdc-icon-size:17px;color:var(--tone)}.visual-note{color:var(--luma-muted);font-size:9px;font-weight:680}.rail{position:relative;display:flex;height:12px;padding:3px;border-radius:999px;background:color-mix(in srgb,var(--primary-text-color) 8%,transparent);overflow:hidden}.segment{height:100%;min-width:0;border-radius:999px;background:var(--segment);transition:flex-basis .35s ease}.segment+.segment{margin-left:3px}.mix-labels{display:flex;justify-content:space-between;gap:12px;color:var(--luma-muted);font-size:9px;font-weight:680}.mix-labels span{display:flex;align-items:center;gap:5px}.dot{width:7px;height:7px;border-radius:50%;background:var(--dot)}
    .timeline{position:relative;height:39px;padding-top:18px}.day-rail{position:relative;height:10px;border-radius:999px;background:color-mix(in srgb,var(--primary-text-color) 8%,transparent)}.window{position:absolute;top:0;bottom:0;left:var(--start);width:var(--width);min-width:3px;border-radius:999px;background:linear-gradient(90deg,color-mix(in srgb,var(--warning-color) 78%,white),var(--success-color))}.now{position:absolute;top:-5px;bottom:-5px;left:var(--now);width:2px;border-radius:2px;background:var(--primary-text-color);transform:translateX(-1px)}.edge{position:absolute;top:0;left:var(--edge);transform:translateX(-50%);font-size:9px;font-weight:720;white-space:nowrap}.axis{position:absolute;right:0;bottom:0;left:0;display:flex;justify-content:space-between;color:var(--luma-muted);font-size:7px;font-weight:650}
    button:focus-visible{outline:2px solid var(--tone);outline-offset:2px}
    @media(max-width:700px){ha-card{gap:13px;padding:15px}.hero{grid-template-columns:46px minmax(0,1fr);grid-template-areas:"icon eyebrow" "icon title" "icon detail" "chips chips";gap:2px 11px}.icon{width:46px;height:46px;border-radius:15px}.icon ha-icon{--mdc-icon-size:24px}.title{font-size:18px}.detail{font-size:10px}.chips{justify-content:flex-start;margin-top:8px}.facts{grid-template-columns:repeat(2,minmax(0,1fr))}.fact:last-child:nth-child(odd){grid-column:1/-1}.visual{padding:12px}.mix-labels{flex-wrap:wrap}}
  `];

  setConfig(config: Config) {
    const required: Array<keyof Config> = [
      "controller_state_entity", "controller_reason_entity", "charging_power_entity",
      "base_mode_entity", "readiness_entity", "readiness_reason_entity",
      "window_active_entity", "window_start_entity", "window_end_entity",
      "window_remaining_entity",
    ];
    if (!config || required.some((key) => !config[key])) throw Error("EV overview entities required");
    this.config = config;
  }

  getCardSize() { return 4; }
  private entity(id?: string): HassEntity | undefined { return id ? this.hass?.states[id] : undefined; }
  private stateOf(id?: string) { return this.entity(id)?.state || "unknown"; }
  private valid(entity?: HassEntity) { return Boolean(entity && !["unknown", "unavailable", ""].includes(entity.state)); }
  private isOn(id?: string) { return this.stateOf(id) === "on"; }
  private numeric(id?: string): number | undefined {
    const entity = this.entity(id);
    if (!this.valid(entity)) return undefined;
    const value = Number(entity!.state);
    return Number.isFinite(value) ? Math.max(0, value) : undefined;
  }
  private moreInfo(entity: string) { void runAction(this, this.hass!, { action: "more-info" }, entity); }

  private baseMode() {
    return localizedMap(this.hass,
      { Off: "Off", Solar: "Solar", Always: "Always charge" },
      { Off: "Kikapcsolva", Solar: "Napelemes", Always: "Mindig tölts" },
      this.stateOf(this.config?.base_mode_entity));
  }

  private presentation(): Presentation {
    const config = this.config!;
    const controller = this.stateOf(config.controller_state_entity);
    const reason = this.stateOf(config.controller_reason_entity);
    const readiness = this.stateOf(config.readiness_entity);
    const baseMode = this.stateOf(config.base_mode_entity);
    const power = this.numeric(config.charging_power_entity) || 0;
    const active = power >= 100 || ["CHARGING", "CHARGE_NOW", "LOW_PV_GRACE"].includes(controller);
    const common = { eyebrow: config.title || localized(this.hass, "Current charging state", "Jelenlegi töltési állapot") };
    if (config.ocpp_connected_entity && !this.isOn(config.ocpp_connected_entity)) return { ...common, kind:"offline", icon:"mdi:ev-station-off", tone:"var(--error-color)", title:localized(this.hass,"Charger unavailable","A töltő nem elérhető"), detail:localized(this.hass,"There is no OCPP connection to the charger","Nincs OCPP-kapcsolat a töltővel"), source:config.ocpp_connected_entity };
    if (config.telemetry_stale_entity && this.isOn(config.telemetry_stale_entity)) return { ...common, kind:"offline", icon:"mdi:alert-circle-outline", tone:"var(--error-color)", title:localized(this.hass,"No fresh energy data","Nincs friss energiamérés"), detail:localized(this.hass,"Charging automation is waiting for reliable telemetry","A töltésvezérlés megbízható mérési adatra vár"), source:config.telemetry_stale_entity };
    if (controller === "FAULT") return { ...common, kind:"offline", icon:"mdi:alert-octagon-outline", tone:"var(--error-color)", title:localized(this.hass,"Charging fault","Töltési hiba"), detail:reason, source:config.controller_state_entity };
    if (config.restart_inhibited_entity && this.isOn(config.restart_inhibited_entity)) return { ...common, kind:"attention", icon:"mdi:check-circle-outline", tone:"var(--warning-color)", title:localized(this.hass,"Charging has finished","A töltés befejeződött"), detail:localized(this.hass,"Unplug the vehicle before another automatic start","Új automatikus indításhoz húzd ki az autót"), source:config.restart_inhibited_entity };
    if (config.charge_now_armed_entity && this.isOn(config.charge_now_armed_entity)) return { ...common, kind:"waiting", icon:"mdi:timer-sand", tone:"var(--warning-color)", title:localized(this.hass,"Charge Now is armed","A Töltés most élesítve"), detail:localized(this.hass,"Waiting for the vehicle; the timer has not started","Az autóra vár; az időzítő még nem indult el"), source:config.charge_now_armed_entity };
    if (active) {
      const chargeNow = config.charge_now_active_entity && this.isOn(config.charge_now_active_entity);
      const solar = this.stateOf(config.ownership_entity) === "solar";
      return { ...common, kind:"charging", icon:chargeNow ? "mdi:flash" : solar ? "mdi:solar-power" : "mdi:car-electric", tone:"var(--success-color)", title:chargeNow ? localized(this.hass,"Charge Now is running","Töltés most folyamatban") : solar ? localized(this.hass,"Solar charging is running","Napelemes töltés folyamatban") : localized(this.hass,"Charging is running","Töltés folyamatban"), detail:controller === "LOW_PV_GRACE" ? localized(this.hass,"Temporary low-PV grace period is active","Ideiglenes alacsony-PV türelmi idő aktív") : localized(this.hass,"The charger is delivering power to the vehicle","A töltő energiát ad az autónak"), source:config.controller_state_entity };
    }
    if (controller === "START_PENDING") return { ...common, kind:"waiting", icon:"mdi:progress-clock", tone:"var(--primary-color)", title:localized(this.hass,"Charging is starting","A töltés indul"), detail:localized(this.hass,"Waiting for physical charging confirmation","A tényleges töltés visszaigazolására vár"), source:config.controller_state_entity };
    if (controller === "STOP_PENDING") return { ...common, kind:"waiting", icon:"mdi:stop-circle-outline", tone:"var(--warning-color)", title:localized(this.hass,"Charging is stopping","A töltés leáll"), detail:reason, source:config.controller_state_entity };
    if (baseMode === "Off") return { ...common, kind:"waiting", icon:"mdi:power", tone:"var(--luma-muted)", title:localized(this.hass,"Automatic charging is off","Az automatikus töltés ki van kapcsolva"), detail:this.readinessSummary(readiness), source:config.base_mode_entity };
    if (baseMode === "Always") return { ...common, kind:"waiting", icon:"mdi:ev-plug-type2", tone:"var(--primary-color)", title:localized(this.hass,"Waiting for the vehicle","Az autóra vár"), detail:localized(this.hass,"Charging starts automatically after connection","Csatlakoztatás után a töltés automatikusan elindul"), source:config.base_mode_entity };
    const readinessMap: Record<string, Pick<Presentation,"icon"|"tone"|"title">> = {
      ready_now:{icon:"mdi:solar-power",tone:"var(--success-color)",title:localized(this.hass,"Worth connecting now","Érdemes most rádugni")},
      connect_and_wait:{icon:"mdi:clock-outline",tone:"var(--primary-color)",title:localized(this.hass,"You can connect it now","Most már rádughatod")},
      marginal:{icon:"mdi:weather-partly-cloudy",tone:"var(--warning-color)",title:localized(this.hass,"Waiting for better conditions","Jobb feltételekre vár")},
      too_late_today:{icon:"mdi:weather-sunset-down",tone:"var(--luma-muted)",title:localized(this.hass,"No more useful Solar charging today","Ma már nem várható érdemi Solar töltés")},
      learning:{icon:"mdi:chart-timeline-variant-shimmer",tone:"var(--primary-color)",title:localized(this.hass,"The system is still learning","A rendszer még tanul")},
      telemetry_unavailable:{icon:"mdi:alert-circle-outline",tone:"var(--error-color)",title:localized(this.hass,"No Solar recommendation","Nincs Solar ajánlás")},
    };
    const item = readinessMap[readiness] || readinessMap.telemetry_unavailable;
    return { ...common, kind:"waiting", ...item, detail:this.readinessSummary(readiness), source:config.readiness_entity };
  }

  private readinessSummary(readiness: string) {
    const summaries: Record<string,string> = {
      ready_now:localized(this.hass,"Solar conditions are suitable right now","Most megfelelőek a Solar töltés feltételei"),
      connect_and_wait:localized(this.hass,"A useful Solar period is expected later today","Ma később várható megfelelő Solar-időszak"),
      marginal:localized(this.hass,"The daily window is active, but live conditions are not sufficient yet","A napi időablak aktív, de a pillanatnyi feltételek még nem elegendők"),
      too_late_today:localized(this.hass,"Today's learned Solar window has ended","A mai tanult Solar-időablak lezárult"),
      learning:localized(this.hass,"More production history is needed for a reliable recommendation","Még több termelési adat kell a megbízható ajánláshoz"),
      telemetry_unavailable:localized(this.hass,"Fresh energy measurements are required","Friss energiamérés szükséges"),
    };
    return summaries[readiness] || this.stateOf(this.config?.readiness_reason_entity);
  }

  private formatPower(value?: number) {
    if (value === undefined) return "—";
    return value >= 1000 ? `${(value / 1000).toLocaleString(this.hass?.locale?.language || undefined,{minimumFractionDigits:1,maximumFractionDigits:1})} kW` : `${Math.round(value)} W`;
  }
  private formatDurationSeconds(value?: number) {
    if (value === undefined) return "—";
    const minutes = Math.max(0,Math.ceil(value / 60));
    const hours = Math.floor(minutes / 60), rest = minutes % 60;
    if (!hours) return localized(this.hass, `${rest} min`, `${rest} p`);
    return localized(this.hass, `${hours} h${rest ? ` ${rest} min` : ""}`, `${hours} ó${rest ? ` ${rest} p` : ""}`);
  }
  private time(date?: Date) { return date ? new Intl.DateTimeFormat(this.hass?.locale?.language || undefined,{hour:"2-digit",minute:"2-digit"}).format(date) : "—"; }
  private date(id?: string) {
    const entity = this.entity(id);
    if (!this.valid(entity)) return undefined;
    const value = new Date(entity!.state);
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  private timeline(start: Date,end: Date) {
    const dayStart = new Date(start); dayStart.setHours(0,0,0,0);
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate()+1);
    const total = dayEnd.getTime()-dayStart.getTime();
    const pos=(value:Date)=>Math.max(0,Math.min(100,(value.getTime()-dayStart.getTime())/total*100));
    return {start:pos(start),width:Math.max(0,pos(end)-pos(start)),now:pos(new Date())};
  }

  render() {
    if (!this.hass || !this.config) return nothing;
    const presentation = this.presentation();
    const power = this.numeric(this.config.charging_power_entity);
    const charging = presentation.kind === "charging";
    const start = this.date(this.config.window_start_entity), end = this.date(this.config.window_end_entity);
    return html`<ha-card style=${`--tone:${presentation.tone}`}>
      <button class="hero" @click=${()=>this.moreInfo(presentation.source)}>
        <span class="icon"><ha-icon icon=${presentation.icon}></ha-icon></span>
        <span class="eyebrow">${presentation.eyebrow}</span><strong class="title">${presentation.title}</strong><span class="detail">${presentation.detail}</span>
        <span class="chips"><span class="chip"><ha-icon icon="mdi:tune-variant"></ha-icon>${this.baseMode()}</span>${charging ? html`<span class="chip secondary"><ha-icon icon="mdi:flash"></ha-icon>${this.formatPower(power)}</span>` : nothing}</span>
      </button>
      ${charging ? this.chargingBody() : presentation.kind === "waiting" && start && end ? this.solarBody(start,end) : nothing}
    </ha-card>`;
  }

  private chargingBody() {
    const pv = this.numeric(this.config!.pv_power_entity), grid = this.numeric(this.config!.grid_power_entity);
    const total = (pv || 0)+(grid || 0), pvPct = total > 0 ? (pv || 0)/total*100 : 0, gridPct = total > 0 ? (grid || 0)/total*100 : 0;
    const chargeNow = this.config!.charge_now_active_entity && this.isOn(this.config!.charge_now_active_entity);
    const remaining = this.numeric(this.config!.charge_now_remaining_entity);
    const ownership = this.stateOf(this.config!.ownership_entity);
    const owner = chargeNow ? localized(this.hass,"Charge Now","Töltés most") : ownership === "solar" ? localized(this.hass,"Solar control","Solar vezérlés") : localized(this.hass,"External session","Külső session");
    return html`
      <div class="facts" style="--fact-count:2">${this.fact(this.config!.charging_power_entity,"mdi:flash",localized(this.hass,"Charging power","Töltési teljesítmény"),this.formatPower(this.numeric(this.config!.charging_power_entity)),"var(--success-color)")}${this.fact(this.config!.ownership_entity || this.config!.controller_state_entity,"mdi:account-key-outline",localized(this.hass,"Control","Vezérlés"),owner,"var(--primary-color)")}${chargeNow && remaining !== undefined ? this.fact(this.config!.charge_now_remaining_entity!,"mdi:timer-sand",localized(this.hass,"Time remaining","Hátralévő idő"),this.formatDurationSeconds(remaining),"var(--warning-color)") : nothing}</div>
      ${pv !== undefined && grid !== undefined ? html`<div class="visual"><div class="visual-head"><span class="visual-title"><ha-icon icon="mdi:chart-donut"></ha-icon>${localized(this.hass,"Current charging source","Pillanatnyi töltési forrás")}</span><span class="visual-note">${Math.round(pvPct)}% ${localized(this.hass,"Solar","napenergia")}</span></div><div class="rail"><span class="segment" style=${`--segment:#58b984;flex-basis:${pvPct}%`}></span><span class="segment" style=${`--segment:#f4a62a;flex-basis:${gridPct}%`}></span></div><div class="mix-labels"><span><i class="dot" style="--dot:#58b984"></i>${localized(this.hass,"Solar","Napenergia")} · ${this.formatPower(pv)}</span><span><i class="dot" style="--dot:#f4a62a"></i>${localized(this.hass,"Grid","Hálózat")} · ${this.formatPower(grid)}</span></div></div>` : nothing}
    `;
  }

  private solarBody(start:Date,end:Date) {
    const timeline=this.timeline(start,end), active=this.isOn(this.config!.window_active_entity), expired=new Date()>=end;
    const remaining=this.numeric(this.config!.window_remaining_entity), expected=this.config!.expected_charge_entity ? this.entity(this.config!.expected_charge_entity) : undefined;
    const expectedValue=this.valid(expected) ? (this.hass?.formatEntityState?.(expected!) || `${expected!.state} kWh`) : "—";
    return html`<div class="visual"><div class="visual-head"><span class="visual-title"><ha-icon icon="mdi:timeline-clock-outline"></ha-icon>${localized(this.hass,"Today's Solar window","Mai Solar-időablak")}</span><span class="visual-note">${expired ? localized(this.hass,"ended","lezárult") : active ? localized(this.hass,"active","aktív") : `${this.time(start)}–${this.time(end)}`}</span></div><div class="timeline"><span class="edge" style=${`--edge:${timeline.start}%`}>${this.time(start)}</span><span class="edge" style=${`--edge:${timeline.start+timeline.width}%`}>${this.time(end)}</span><div class="day-rail"><span class="window" style=${`--start:${timeline.start}%;--width:${timeline.width}%`}></span><span class="now" style=${`--now:${timeline.now}%`}></span></div><div class="axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div></div><div class="facts" style=${`--fact-count:${this.config!.expected_charge_entity ? 2 : 1}`}>
      ${this.fact(this.config!.window_remaining_entity,"mdi:timer-sand",expired ? localized(this.hass,"Window status","Időablak állapota") : localized(this.hass,"Useful time remaining","Hátralévő hasznos idő"),expired ? localized(this.hass,"Finished today","Ma befejeződött") : `${Math.round(remaining || 0)} p`,"var(--warning-color)")}
      ${this.config!.expected_charge_entity ? this.fact(this.config!.expected_charge_entity,"mdi:battery-charging-medium",localized(this.hass,"Estimated Solar energy","Becsült Solar energia"),expectedValue,"var(--success-color)") : nothing}
    </div></div>`;
  }

  private fact(entity:string,icon:string,label:string,value:string,tone:string) {
    return html`<button class="fact" style=${`--fact-tone:${tone}`} @click=${()=>this.moreInfo(entity)}><span class="fact-icon"><ha-icon icon=${icon}></ha-icon></span><span class="fact-label">${label}</span><strong>${value}</strong></button>`;
  }
}
