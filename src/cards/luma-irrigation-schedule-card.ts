import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { runAction } from "../helpers";
import { localized } from "../localize";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LovelaceCard } from "../types";
interface Config {
  type: string;
  name: string;
  icon?: string;
  color?: string;
  enabled_entity: string;
  start_entity: string;
  day_entities: string[];
  mode_entity?: string;
  interval_entity?: string;
  anchor_entity?: string;
}
@customElement("luma-irrigation-schedule-card")
export class LumaIrrigationScheduleCard
  extends LitElement
  implements LovelaceCard
{
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: Config;
  static styles = [
    lumaTokens,
    css`
      ha-card {
        padding: 17px;
        border: 1px solid color-mix(in srgb, var(--tone) 18%, transparent);
        border-radius: 20px;
        background: linear-gradient(
          145deg,
          color-mix(in srgb, var(--tone) 9%, var(--luma-surface)),
          var(--luma-surface) 68%
        );
        box-shadow: var(--luma-shadow);
      }
      .head {
        display: grid;
        grid-template-columns: 44px 1fr auto;
        align-items: center;
        gap: 11px;
      }
      .icon {
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        border-radius: 14px;
        color: var(--tone);
        background: color-mix(in srgb, var(--tone) 15%, transparent);
      }
      .name {
        font-size: 16px;
        font-weight: 720;
      }
      .time {
        color: var(--tone);
        font-size: 18px;
        font-weight: 760;
      }
      .enabled {
        margin-top: 2px;
        color: var(--luma-muted);
        font-size: 10px;
      }
      .mode {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        margin-top: 3px;
        padding: 0;
        border: 0;
        color: var(--luma-muted);
        background: transparent;
        font: inherit;
        font-size: 10px;
      }
      .mode ha-icon { --mdc-icon-size: 13px; }
      .days {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 5px;
        margin-top: 15px;
      }
      .day {
        display: grid;
        place-items: center;
        min-width: 0;
        height: 34px;
        padding: 0;
        border: 1px solid color-mix(in srgb, var(--tone) 14%, transparent);
        border-radius: 10px;
        color: var(--luma-muted);
        background: transparent;
        font-size: 11px;
        font-weight: 760;
      }
      .day.on {
        color: var(--tone);
        background: color-mix(in srgb, var(--tone) 15%, transparent);
        border-color: color-mix(in srgb, var(--tone) 28%, transparent);
      }
      .interval {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
        gap: 10px;
        margin-top: 15px;
        padding: 10px 12px;
        border-radius: 13px;
        background: color-mix(in srgb, var(--tone) 8%, transparent);
      }
      .interval-copy { min-width: 0; }
      .interval-title { padding: 0; border: 0; color: var(--tone); background: transparent; font: inherit; font-size: 13px; font-weight: 760; }
      .interval-next { margin-top: 2px; color: var(--luma-muted); font-size: 10px; }
      .anchor {
        padding: 7px 9px;
        border: 1px solid color-mix(in srgb, var(--tone) 16%, transparent);
        border-radius: 10px;
        color: var(--luma-muted);
        background: transparent;
        font-size: 10px;
        font-weight: 700;
      }
      button {
        cursor: pointer;
      }
      @media (max-width: 380px) {
        .days {
          gap: 3px;
        }
        .day {
          height: 32px;
          border-radius: 9px;
        }
      }
    `,
  ];
  setConfig(c: Config) {
    if (!c?.enabled_entity || c.day_entities?.length !== 7)
      throw Error("enabled_entity and seven day_entities required");
    this.config = c;
  }
  getCardSize() {
    return 2;
  }
  private toggle(id: string) {
    void runAction(this, this.hass!, { action: "toggle", entity: id }, id);
  }
  private setMode() {
    const c = this.config;
    if (!c?.mode_entity || !this.hass) return;
    const interval = this.hass.states[c.mode_entity]?.state === "Minden N. nap";
    void this.hass.callService("input_select", "select_option", {
      entity_id: c.mode_entity,
      option: interval ? "Heti napok" : "Minden N. nap",
    });
  }
  private nextIntervalLabel(anchor: string, interval: number, rawTime: string) {
    const [year, month, day] = anchor.split("-").map(Number);
    const [hour, minute] = rawTime.split(":").map(Number);
    if (![year, month, day, hour, minute].every(Number.isFinite)) return "—";
    const now = new Date();
    const anchorDay = Date.UTC(year, month - 1, day);
    const candidate = new Date(now);
    candidate.setHours(hour, minute, 0, 0);
    for (let i = 0; i <= Math.max(31, interval + 1); i++) {
      const candidateDay = Date.UTC(candidate.getFullYear(), candidate.getMonth(), candidate.getDate());
      const elapsed = Math.round((candidateDay - anchorDay) / 86400000);
      if (elapsed >= 0 && elapsed % interval === 0 && candidate > now) {
        return candidate.toLocaleDateString(this.hass?.locale?.language || "en", {
          weekday: "short", month: "short", day: "numeric",
        });
      }
      candidate.setDate(candidate.getDate() + 1);
    }
    return "—";
  }
  render() {
    if (!this.hass || !this.config) return nothing;
    const c = this.config,
      s = this.hass.states,
      on = s[c.enabled_entity]?.state === "on",
      raw = s[c.start_entity]?.state || "—",
      time = raw.length >= 5 ? raw.slice(0, 5) : raw,
      intervalMode = !!c.mode_entity && s[c.mode_entity]?.state === "Minden N. nap",
      interval = Math.max(1, Number(c.interval_entity ? s[c.interval_entity]?.state : 2) || 2),
      anchor = c.anchor_entity ? s[c.anchor_entity]?.state || "" : "",
      labels = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];
    return html`<ha-card style=${`--tone:${c.color || "var(--primary-color)"}`}
      ><div class="head">
        <button
          class="icon"
          @click=${() => this.toggle(c.enabled_entity)}
          aria-label=${localized(this.hass,"Toggle schedule","Ütemezés kapcsolása")}
        >
          <ha-icon icon=${c.icon || "mdi:calendar-clock"}></ha-icon></button
        ><span
          ><div class="name">${c.name}</div>
          <div class="enabled">${on ? localized(this.hass,"Automation enabled","Automatika bekapcsolva") : localized(this.hass,"Automation disabled","Automatika kikapcsolva")}</div>
          ${c.mode_entity ? html`<button class="mode" @click=${() => this.setMode()}><ha-icon icon=${intervalMode ? "mdi:calendar-range" : "mdi:calendar-week"}></ha-icon>${intervalMode ? localized(this.hass,"Every N days","Minden N. nap") : localized(this.hass,"Weekdays","Heti napok")}</button>` : nothing}</span
        ><button
          class="time"
          @click=${() =>
            runAction(
              this,
              this.hass!,
              { action: "more-info" },
              c.start_entity,
            )}
        >
          ${time}
        </button>
      </div>
      ${intervalMode && c.interval_entity && c.anchor_entity ? html`<div class="interval"><div class="interval-copy"><button class="interval-title" @click=${() => runAction(this, this.hass!, { action: "more-info" }, c.interval_entity)}>${localized(this.hass,`Every ${interval} days`,`Minden ${interval} nap`)}</button><div class="interval-next">${localized(this.hass,"Next","Következő")}: ${this.nextIntervalLabel(anchor, interval, raw)}</div></div><button class="anchor" @click=${() => runAction(this, this.hass!, { action: "more-info" }, c.anchor_entity)}>${localized(this.hass,"Start date","Kezdőnap")}</button></div>` : html`<div class="days">
        ${c.day_entities.map(
          (id, i) =>
            html`<button
              class=${`day ${s[id]?.state === "on" ? "on" : ""}`}
              @click=${() => this.toggle(id)}
            >
              ${labels[i]}
            </button>`,
        )}
      </div>`}</ha-card
    >`;
  }
}
