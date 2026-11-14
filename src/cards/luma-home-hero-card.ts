import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  activeEntities,
  entityState,
  itemIsVisible,
  runAction,
} from "../helpers";
import {
  applianceDuration,
  applianceFinishTime,
  applianceSeconds,
} from "../appliance";
import { localize, localized, localizedMap } from "../localize";
import {entityAvailable,finiteMeasurement,formatNumber,missingLabel,presentedState} from "../presentation";
import { lumaTokens, lumaSurfaceStyles, lumaInteractionStyles } from "../styles";
import { glob, incidentSourceIds, matchingIncidentIds } from "../incidents";
import { attentionAckValue, attentionSummaries, attentionOverview } from "../attention";
import "./luma-attention-card";
import "../components/luma-weather-advice";
import { ref } from "lit/directives/ref.js";
import { AttentionSubscription, attentionPolicy, dismissAttentionNotification, policyRows } from "../attention-runtime";
import type {
  HassEntity,
  HomeAssistant,
  LumaAction,
  LumaActiveConfig,
  LumaBannerConfig,
  LumaIncidentRule,
  LumaIncidentTone,
  LovelaceCard,
} from "../types";

interface LumaHomeHeroConfig {
  type: string;
  name?: string;
  weather_entity: string;
  weather_advice_entity?: string;
  alarm_entity?: string;
  alarm_action?: LumaAction;
  alarm_popover?: boolean;
  alarm_modes?: Array<{
    mode: "away" | "night" | "home" | "disarm";
    name: string;
    icon?: string;
  }>;
  notifications_entity?: string;
  acknowledgements_entity?: string;
  irrigation_entity?: string;
  irrigation_remaining_entity?: string;
  irrigation_zone_entities?: Array<string | { entity: string; name?: string }>;
  irrigation_path?: string;
  waste_entity?: string;
  waste_ack_entity?: string;
  waste_path?: string;
  waste_days?: number;
  waste_items?: Array<{ entity: string; name: string }>;
  appliances?: Array<{
    entity: string;
    name: string;
    active_entity?: string;
    remaining_entity?: string;
    path?: string;
    icon?: string;
    idle_states?: string[];
    state_map?: Record<string, string>;
  }>;
  wind_threshold?: number;
  active_action?: LumaAction;
  active_label?: string;
  active_exclude?: string[];
  active?: LumaActiveConfig;
  incidents?: LumaIncidentRule[];
  attention_policy?: string;
  banners?: LumaBannerConfig[];
  banner_collapse_threshold?: number;
  tap_action?: LumaAction;
}

interface Incident {
  key: string;
  message: string;
  tone: LumaIncidentTone;
  path?: string;
  entity?: string;
  dismissible: boolean;
  notificationId?: string;
}

const weatherLabelsHu: Record<string, string> = {
  sunny: "Napos",
  "clear-night": "Derült éjszaka",
  cloudy: "Felhős",
  partlycloudy: "Részben felhős",
  rainy: "Esős",
  pouring: "Szakadó eső",
  lightning: "Zivatar",
  "lightning-rainy": "Zivatar és eső",
  snowy: "Havazás",
  fog: "Ködös",
  windy: "Szeles",
};
const weatherLabelsEn:Record<string,string>={sunny:"Sunny","clear-night":"Clear night",cloudy:"Cloudy",partlycloudy:"Partly cloudy",rainy:"Rainy",pouring:"Pouring rain",lightning:"Thunderstorms","lightning-rainy":"Thunderstorms with rain",snowy:"Snowy",fog:"Fog",windy:"Windy"};

const weatherIcons: Record<string, string> = {
  sunny: "mdi:weather-sunny",
  "clear-night": "mdi:weather-night",
  cloudy: "mdi:weather-cloudy",
  partlycloudy: "mdi:weather-partly-cloudy",
  rainy: "mdi:weather-rainy",
  pouring: "mdi:weather-pouring",
  lightning: "mdi:weather-lightning",
  "lightning-rainy": "mdi:weather-lightning-rainy",
  snowy: "mdi:weather-snowy",
  fog: "mdi:weather-fog",
  windy: "mdi:weather-windy",
};

const listed = (
  expected: string | string[] | undefined,
  actual: string,
): boolean =>
  expected === undefined
    ? false
    : (Array.isArray(expected) ? expected : [expected])
        .map((value) => value.toLocaleLowerCase())
        .includes(actual.toLocaleLowerCase());

@customElement("luma-home-hero-card")
export class LumaHomeHeroCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: LumaHomeHeroConfig;
  @state() private detailsOpen = false;
  @state() private dismissingNotification?: string;
  @state() private notificationError = "";
  @state() private alarmPopoverOpen = false;
  @state() private alarmPending?: "away" | "night" | "home" | "disarm";
  private alarmTimer?: number;
  @state() private alarmBusy=false;
  @state() private alarmError="";

  static styles = [
    lumaTokens,
    css`
      .hero {
        position: relative;
        isolation: isolate;
        padding: 26px;
        overflow: hidden;
        border: 1px solid
          color-mix(in srgb, var(--luma-accent) 20%, transparent);
        border-radius: var(--luma-radius-hero);
        background: linear-gradient(
          135deg,
          color-mix(in srgb, var(--luma-accent) 16%, var(--luma-surface)),
          color-mix(in srgb, var(--luma-accent) 3%, var(--luma-surface)) 68%
        );
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.08);
        transition:
          transform 0.2s ease,
          box-shadow 0.2s ease,
          border-color 0.2s ease;
      }
      .hero.interactive:hover {
        transform: translateY(-2px);
        border-color: color-mix(in srgb, var(--luma-accent) 30%, transparent);
        box-shadow: 0 23px 58px rgba(0, 0, 0, 0.11);
      }
      .content {
        position: relative;
        z-index: 2;
      }
      .top {
        display: grid;
        grid-template-columns: 58px minmax(0, 1fr) minmax(280px, 420px);
        grid-template-areas: "icon title status" "icon subtitle status" "icon advice status";
        align-items: center;
        gap: 0 17px;
      }
      .weather-icon {
        grid-area: icon;
        display: grid;
        place-items: center;
        width: 58px;
        height: 58px;
        border-radius: 19px;
        color: var(--luma-accent);
        background: color-mix(in srgb, var(--luma-accent) 15%, transparent);
      }
      .weather-icon ha-icon {
        --mdc-icon-size: 31px;
      }
      h2 {
        grid-area: title;
        align-self: end;
        margin: 0;
        font-size: clamp(20px, 4vw, 27px);
        line-height: 1.12;
        font-weight: 730;
      }
      .subtitle {
        grid-area: subtitle;
        align-self: start;
        margin-top: 5px;
        color: var(--luma-muted);
        font-size: 13px;
        line-height: 1.35;
      }
      luma-weather-advice{grid-area:advice;min-width:0}
      button {
        font: inherit;
      }
      .status {
        grid-area: status;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        flex-wrap: wrap;
        gap: 7px;
        min-width: 0;
      }
      .alarm,
      .attention,
      .active {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-height: 34px;
        padding: 7px 11px;
        border: 0;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 680;
        line-height: 1;
        transition:
          transform 0.16s ease,
          background 0.16s ease;
      }
      .alarm:hover,
      .attention:hover,
      .active:hover {
        transform: translateY(-1px);
        filter: saturate(1.08);
      }
      .alarm {
        color: var(--alarm-color);
        background: color-mix(in srgb, var(--alarm-color) 12%, transparent);
      }
      .alarm ha-icon,
      .attention ha-icon,
      .active ha-icon {
        --mdc-icon-size: 16px;
      }
      .attention {
        max-width:100%;
        color: var(--attention-color);
        background: color-mix(in srgb, var(--attention-color) 12%, transparent);
      }
      .active {
        position: relative;
        overflow: visible;
        color: var(--active-color);
        background: color-mix(in srgb, var(--active-color) 12%, transparent);
      }
      .panel {
        display: grid;
        gap: 8px;
        margin-top: 13px;
      }
      .coverage-link{display:grid;grid-template-columns:36px minmax(0,1fr) 18px;align-items:center;gap:10px;width:100%;padding:12px;border:1px solid var(--luma-border);border-radius:var(--luma-radius-control);background:color-mix(in srgb,var(--primary-color) 5%,transparent);color:var(--primary-text-color);font:inherit;font-size:var(--luma-text-sm);text-align:left;cursor:pointer}
      .coverage-link>ha-icon:first-child{box-sizing:border-box;padding:8px;width:36px;height:36px;border-radius:12px;--mdc-icon-size:20px;color:var(--primary-color);background:color-mix(in srgb,var(--primary-color) 10%,transparent)}
      .coverage-link strong{display:block;font-weight:var(--luma-weight-strong)}.coverage-link small{display:block;margin-top:3px;color:var(--luma-muted);font-size:11px}.coverage-link>ha-icon:last-child{--mdc-icon-size:18px;color:var(--luma-muted)}.coverage-link:focus-visible{outline:2px solid var(--primary-color);outline-offset:3px}
      .issue {
        display: grid;
        grid-template-columns: 18px minmax(0, 1fr) auto;
        align-items: center;
        gap: 8px;
        min-height: 42px;
        padding: 8px 11px;
        border: 1px solid color-mix(in srgb, var(--issue-color) 17%, transparent);
        border-radius: 14px;
        color: var(--issue-color);
        background: color-mix(in srgb, var(--issue-color) 10%, transparent);
      }
      .issue ha-icon {
        --mdc-icon-size: 18px;
      }
      .issue-text {
        min-width: 0;
        color: var(--primary-text-color);
        font-size: 12px;
        font-weight: 620;
      }
      .issue-actions {
        display: flex;
        gap: 5px;
      }
      .issue-actions button {
        min-height: 27px;
        padding: 4px 8px;
        border: 0;
        border-radius: 999px;
        color: var(--issue-color);
        background: color-mix(in srgb, var(--issue-color) 12%, transparent);
        font-size: 9px;
        font-weight: 780;
        cursor: pointer;
        transition:
          color 140ms ease,
          background-color 140ms ease,
          box-shadow 140ms ease,
          transform 140ms ease;
      }
      .issue-actions button:hover {
        color: var(--card-background-color);
        background: var(--issue-color);
        box-shadow: 0 5px 14px
          color-mix(in srgb, var(--issue-color) 24%, transparent);
        transform: translateY(-1px);
      }
      .issue-actions button:active {
        box-shadow: none;
        transform: translateY(0) scale(0.97);
      }
      .issue-actions button:focus-visible {
        outline: 2px solid var(--issue-color);
        outline-offset: 2px;
      }
      .banners {
        display: grid;
        gap: 8px;
        margin-top: 13px;
      }
      .banner-group {
        margin-top: 13px;
        color: var(--info-color, var(--primary-color));
      }
      .banner-summary {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 44px;
        padding: 10px 12px;
        border: 1px solid color-mix(in srgb, currentColor 17%, transparent);
        border-radius: 14px;
        background: color-mix(in srgb, currentColor 10%, transparent);
        cursor: pointer;
        list-style: none;
      }
      .banner-summary::-webkit-details-marker { display: none; }
      .banner-summary:hover {
        background: color-mix(in srgb, currentColor 15%, transparent);
      }
      .banner-summary:focus-visible {
        outline: 2px solid currentColor;
        outline-offset: 3px;
      }
      .banner-summary-text {
        flex: 1;
        min-width: 0;
        color: var(--primary-text-color);
        font-size: 12px;
        font-weight: 720;
      }
      .banner-summary-icons { display: flex; gap: 6px; }
      .banner-summary ha-icon { --mdc-icon-size: 18px; }
      .banner-group[open] .banner-chevron { transform: rotate(180deg); }
      .banner-group .banners { margin-top: 8px; }
      .banner {
        display: grid;
        grid-template-columns: 22px auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 8px;
        width: 100%;
        min-height: 42px;
        padding: 8px 11px;
        border: 1px solid color-mix(in srgb, var(--item-color) 17%, transparent);
        border-radius: 14px;
        color: var(--item-color);
        background: color-mix(in srgb, var(--item-color) 10%, transparent);
        text-align: left;
        transition:
          background 0.18s ease,
          border-color 0.18s ease,
          transform 0.18s ease;
      }
      .banner:hover {
        transform: translateY(-1px);
        border-color: color-mix(in srgb, var(--item-color) 25%, transparent);
        background: color-mix(in srgb, var(--item-color) 15%, transparent);
      }
      .banner ha-icon {
        --mdc-icon-size: 18px;
      }
      .banner-label {
        font-size: 11px;
        font-weight: 720;
      }
      .banner-state {
        overflow: hidden;
        color: var(--primary-text-color);
        font-size: 11px;
        font-weight: 620;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .banner-action {
        padding: 5px 8px;
        border: 0;
        border-radius: 999px;
        color: var(--item-color);
        background: color-mix(in srgb, var(--item-color) 14%, transparent);
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.05em;
      }
      .sky {
        position: absolute;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        opacity: 0.58;
      }
      .sun,
      .moon {
        position: absolute;
        right: 23%;
        top: -45px;
        width: 160px;
        height: 160px;
        border-radius: 50%;
      }
      .sun {
        background: radial-gradient(
          circle,
          #e9ad35 0 31%,
          color-mix(in srgb, #ffd36a 34%, transparent) 33% 53%,
          transparent 55%
        );
        animation: breathe 6s ease-in-out infinite;
      }
      .moon {
        width: 120px;
        height: 120px;
        top: -24px;
        right: 24%;
        background: transparent;
        box-shadow: -25px 18px 0 color-mix(in srgb, #aab6ff 32%, transparent);
      }
      .cloud {
        position: absolute;
        right: 20%;
        top: 30px;
        width: 125px;
        height: 40px;
        border-radius: 99px;
        background: color-mix(
          in srgb,
          var(--primary-text-color) 13%,
          transparent
        );
        animation: drift 9s ease-in-out infinite;
      }
      .cloud::before,
      .cloud::after {
        content: "";
        position: absolute;
        bottom: 0;
        border-radius: 50%;
        background: inherit;
      }
      .cloud::before {
        left: 18px;
        width: 54px;
        height: 54px;
      }
      .cloud::after {
        right: 18px;
        width: 42px;
        height: 42px;
      }
      .wind-lines {
        position: absolute;
        right: calc(20% + 105px);
        top: 8px;
        width: 112px;
        height: 76px;
        overflow: visible;
        fill: none;
        stroke: var(--primary-text-color);
        stroke-width: 3;
        stroke-linecap: round;
        opacity: 0.2;
      }
      .wind-lines path {
        stroke-dasharray: 100;
        stroke-dashoffset: 0;
        animation: wind-curl 7s ease-in-out infinite;
      }
      .wind-lines path:nth-child(2) { animation-delay: -2.3s; }
      .wind-lines path:nth-child(3) { animation-delay: -4.6s; }
      @keyframes wind-curl {
        0% { stroke-dashoffset: 100; opacity: 0; transform: translateX(-5px); }
        25%, 55% { stroke-dashoffset: 0; opacity: 1; transform: translateX(0); }
        85%, 100% { stroke-dashoffset: -100; opacity: 0; transform: translateX(5px); }
      }
      @container(max-width:720px) {
        .sun, .cloud, .moon { right: -25px; opacity: 0.4; }
        .wind-lines { right: 85px; top: 6px; width: 94px; height: 64px; }
      }
      @keyframes breathe {
        50% {
          transform: scale(1.12);
          opacity: 0.48;
        }
      }
      @keyframes drift {
        0%,
        100% {
          transform: translateX(-8px);
        }
        50% {
          transform: translateX(10px);
        }
      }
      @media (max-width: 900px) {
        .top {
          grid-template-columns: 58px minmax(0, 1fr);
          grid-template-areas: "icon title" "icon subtitle" "advice advice" "status status";
          gap: 0 14px;
        }
        .status {
          justify-content: flex-start;
          margin-top: 12px;
        }
      }
      @media (max-width: 599px) {
        .hero {
          padding: 18px;
        }
        .top {
          grid-template-columns: 46px minmax(0, 1fr);
          grid-template-areas: "icon title" "icon subtitle" "advice advice" "status status";
          gap: 0 12px;
        }
        .weather-icon {
          width: 46px;
          height: 46px;
          border-radius: 15px;
        }
        .weather-icon ha-icon {
          --mdc-icon-size: 25px;
        }
        .subtitle {
          font-size: 12px;
        }
        .status {
          justify-content: flex-start;
          margin-top: 10px;
        }
        .alarm,
        .attention,
        .active {
          min-height: 34px;
          padding: 7px 11px;
          font-size: 11px;
        }
        .banner {
          grid-template-columns: 20px minmax(0, auto) minmax(0, 1fr) auto;
          column-gap: 6px;
        }
        .banner-label {
          max-width: 100px;
          overflow-wrap: anywhere;
        }
        .banner-state {
          white-space: normal;
          overflow-wrap: anywhere;
        }
        .issue {
          grid-template-columns: 18px minmax(0, 1fr);
        }
        .issue-actions {
          grid-column: 2;
          justify-content: flex-start;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .sky .sun, .sky .cloud, .sky .wind-lines path {
          animation: none;
        }
      }
    `,lumaSurfaceStyles,lumaInteractionStyles,css`
      :host{container-type:inline-size;min-width:0}
      .hero{padding:18px;border-color:var(--luma-border);background:linear-gradient(135deg,color-mix(in srgb,var(--luma-accent) 9%,var(--luma-surface)),color-mix(in srgb,var(--luma-accent) 2%,var(--luma-surface)) 80%);box-shadow:var(--luma-shadow)}
      .top{grid-template-columns:44px minmax(0,1fr);grid-template-areas:"icon title" "icon subtitle" "advice advice" "status status";gap:0 12px}
      .weather-icon{width:44px;height:44px;border-radius:14px}.weather-icon ha-icon{--mdc-icon-size:24px}h2{font-size:20px;font-weight:650;line-height:1.25}
      .weather-link{display:flex;align-items:center;gap:5px;justify-self:start;min-height:44px;margin:0;padding:4px 0;border:0;border-radius:8px;background:transparent;text-align:left;font-size:12px;line-height:1.4;color:var(--luma-muted);cursor:pointer}.weather-link ha-icon{--mdc-icon-size:15px;flex-shrink:0}.weather-link:hover{color:var(--primary-text-color)}
      .status{justify-content:flex-start;gap:6px 12px;margin-top:8px}.alarm,.attention,.active{justify-content:flex-start;min-height:44px;padding:8px 10px;border-radius:10px;background:color-mix(in srgb,var(--primary-text-color) 4%,transparent);color:var(--primary-text-color);font-size:12px;font-weight:560;line-height:1.4;text-align:left;white-space:normal}
      .active ha-icon{color:var(--luma-muted)}.alarm ha-icon{color:var(--alarm-color)}.attention ha-icon{color:var(--attention-color)}.alarm:hover,.attention:hover,.active:hover{transform:none;filter:none;background:var(--luma-hover-surface)}
      .needs-attention .attention{order:-1;background:color-mix(in srgb,var(--attention-color) 9%,transparent)}
      .banner-group,.banners{margin-top:10px}.banner,.banner-summary{background:color-mix(in srgb,var(--item-color,var(--primary-text-color)) 5%,transparent);border-color:var(--luma-border)}.banner:hover{transform:none}.banner-action,.issue-actions button{min-height:44px;font-size:11px;letter-spacing:0;font-weight:560;border-radius:10px}.banner-label,.banner-state{font-weight:560}.banner-summary-text{font-weight:600}
      .alarm-actions{display:grid;grid-template-columns:repeat(var(--alarm-count),minmax(0,1fr));padding:0;background:transparent;border-radius:0;gap:8px}.alarm-mode{display:flex;align-items:center;gap:6px;min-width:0;border:0;min-height:48px;padding:8px;justify-content:center;border-radius:12px;background:var(--luma-control-surface);color:var(--primary-text-color);font-size:12px;white-space:normal}.alarm-mode ha-icon{--mdc-icon-size:17px;flex-shrink:0}.alarm-mode:not(:disabled):hover{background:var(--luma-hover-surface)}.alarm-mode span{min-width:0;white-space:normal;overflow-wrap:anywhere}.alarm-mode.selected{background:color-mix(in srgb,var(--primary-color) 10%,transparent)}.alarm-mode.confirm{background:color-mix(in srgb,var(--warning-color) 15%,transparent);color:var(--primary-text-color)}.alarm-details{min-height:44px;margin-top:12px;border:0;background:transparent;color:var(--luma-muted);font:inherit;font-size:12px;cursor:pointer}.alarm-error{font-size:12px;color:var(--error-color)}
      @container(min-width:720px){.top{grid-template-columns:44px minmax(0,1fr) minmax(240px,auto);grid-template-areas:"icon title status" "icon subtitle status" "advice advice advice"}.status{justify-content:flex-end;margin-top:0;max-width:460px}}
      @container(max-width:420px){.hero{padding:14px}h2{font-size:18px}.status{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.attention{grid-column:1/-1}.alarm,.attention,.active{padding:8px;font-size:11px}.banner{grid-template-columns:18px minmax(0,1fr) auto}.banner-label{grid-column:2}.banner-state{grid-column:2;grid-row:2}.banner-action{grid-column:3;grid-row:1/3}.banner>ha-icon{grid-row:1/3}}
    `,
  ];

  setConfig(config: LumaHomeHeroConfig): void {
    if (!config?.weather_entity)
      throw new Error("Luma home hero requires weather_entity.");
    this.config = {
      banners: [],
      waste_days: 2,
      wind_threshold: 20,
      alarm_popover: true,
      ...config,
      incidents: config.incidents || [],
    };
  }
  getCardSize(): number {
    return 4;
  }

  protected updated(): void {
    this.attentionSubscription.update(this.hass,this.config?.attention_policy);
  }

  private attentionSubscription = new AttentionSubscription(()=>this.requestUpdate());
  private get acknowledgementsEntity() { return this.config?.acknowledgements_entity || attentionPolicy(this.config?.attention_policy)?.acknowledgements_entity; }
  connectedCallback() { super.connectedCallback(); this.attentionSubscription.connect(); }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.attentionSubscription.disconnect();
    clearTimeout(this.alarmTimer);
  }

  private toggleAlarmPopover() {
    this.alarmPopoverOpen=!this.alarmPopoverOpen;
    this.alarmPending=undefined;this.alarmError="";clearTimeout(this.alarmTimer);
  }
  private closeAlarm(){this.alarmPopoverOpen=false;this.alarmPending=undefined;clearTimeout(this.alarmTimer);}
  private async activateAlarm(mode:"away"|"night"|"home"|"disarm",disabled:boolean){
    if(!this.hass||!this.config?.alarm_entity||disabled||this.alarmBusy||!entityAvailable(this.hass.states[this.config.alarm_entity]))return;
    if(this.alarmPending!==mode){this.alarmPending=mode;clearTimeout(this.alarmTimer);this.alarmTimer=window.setTimeout(()=>this.alarmPending=undefined,3400);return;}
    clearTimeout(this.alarmTimer);this.alarmPending=undefined;this.alarmBusy=true;this.alarmError="";
    try{await this.hass.callService("alarm_control_panel",mode==="disarm"?"alarm_disarm":`alarm_arm_${mode}`,undefined,{entity_id:this.config.alarm_entity});this.closeAlarm();}
    catch{this.alarmError=localized(this.hass,"The command failed. Please try again.","A parancs sikertelen. Próbáld újra.");}
    finally{this.alarmBusy=false;}
  }

  protected shouldUpdate(changed: PropertyValues<this>): boolean {
    if ([...changed.keys()].some(key=>key!=="hass")) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this.hass || old.locale !== this.hass.locale) return true;
    if (this.config?.attention_policy || old.entities !== this.hass.entities) return true;
    return this.watchedIds.some(
      (id) => old.states[id] !== this.hass!.states[id],
    );
  }

  private get watchedIds(): string[] {
    if (!this.hass || !this.config) return [];
    const fixed = [
      this.config.weather_entity,
      this.config.weather_advice_entity,
      this.config.alarm_entity,
      this.config.notifications_entity,
      this.acknowledgementsEntity,
      this.config.irrigation_entity,
      ...(this.config.irrigation_zone_entities || []).map((item) =>
        typeof item === "string" ? item : item.entity,
      ),
      this.config.waste_entity,
      this.config.waste_ack_entity,
      ...(this.config.waste_items || []).map((item) => item.entity),
      ...(this.config.appliances || []).flatMap((item) => [
        item.entity,
        item.active_entity,
        item.remaining_entity,
      ]),
    ];
    const patterns = (this.config.incidents || []).flatMap((rule) =>
      [rule.entity_pattern, ...(rule.entity_patterns || [])]
        .filter(Boolean)
        .map((pattern) => ({ rule, pattern: pattern! })),
    );
    const dynamic = Object.keys(this.hass.states).filter((id) =>
      patterns.some(({ pattern }) => glob(pattern, id)),
    );
    const related = dynamic.map((id) => {
      const r = patterns.find(({ pattern }) => glob(pattern, id))?.rule;
      return r?.related_suffix
        ? id.replace(r.related_suffix.from, r.related_suffix.to)
        : id;
    });
    const active = Object.keys(this.hass.states).filter((id) =>
      ["light", "media_player", "climate"].includes(id.split(".")[0]),
    );
    return [
      ...new Set([
        ...(fixed.filter(Boolean) as string[]),
        ...dynamic,
        ...related,
        ...(this.config.incidents || []).flatMap(rule=>[rule.entity,...incidentSourceIds(this.hass!,rule)]).filter(Boolean) as string[],
        ...active,
        ...(this.config.banners || []).map((b) => b.entity),
      ]),
    ];
  }

  private greeting(): string {
    const h = new Date().getHours(),
      user = this.config?.name || this.hass?.user?.name || "",
      first = user.trim().split(/\s+/)[0],
      name = first ? `, ${first}` : "";
    return `${h >= 18 ? localized(this.hass,"Good evening","Jó estét") : h >= 12 ? localized(this.hass,"Good afternoon","Szép délutánt") : h >= 5 ? localized(this.hass,"Good morning","Jó reggelt") : localized(this.hass,"Hello","Szia")}${name}!`;
  }
  private wasteSummary(): string {
    if (!this.hass || !this.config) return "";
    const items = (this.config.waste_items || [])
      .map((item) => ({
        name: item.name,
        days: Number(this.hass!.states[item.entity]?.attributes.daysTo),
      }))
      .filter((item) => Number.isFinite(item.days))
      .sort((a, b) => a.days - b.days);
    if (!items.length) return "";
    const days = items[0].days,
      names = items
        .filter((item) => item.days === days)
        .map((item) => item.name)
        .join(" + "),
      when = days === 0 ? localized(this.hass,"Today","Ma") : days === 1 ? localized(this.hass,"Tomorrow","Holnap") : localized(this.hass,`In ${days} days`,`${days} nap múlva`);
    return `${when} · ${names}`;
  }

  private activeCount(): number {
    return this.hass
      ? activeEntities(
          this.hass,
          this.config?.active,
          this.config?.active_exclude,
        ).length
      : 0;
  }

  private irrigationSummary(): string {
    if (!this.hass || !this.config) return "";
    const program = this.config.irrigation_entity
      ? this.hass.states[this.config.irrigation_entity]?.state || ""
      : "";
    if (
      program &&
      !listed(["Nincs", "none", "unknown", "unavailable", ""], program)
    )
      return program;
    const active = (this.config.irrigation_zone_entities || []).filter(
      (item) =>
        this.hass!.states[typeof item === "string" ? item : item.entity]
          ?.state === "on",
    );
    return active
      .map((item) =>
        typeof item === "string"
          ? String(this.hass!.states[item]?.attributes.friendly_name || item)
          : item.name ||
            String(
              this.hass!.states[item.entity]?.attributes.friendly_name ||
                item.entity,
            ),
      )
      .join(" + ");
  }

  private accent(
    state: string,
    temperature: number,
    issues: Incident[],
  ): string {
    if (issues.some((issue) => issue.tone === "error"))
      return "var(--error-color)";
    if (issues.length) return "var(--warning-color)";
    if (["lightning", "lightning-rainy", "pouring"].includes(state))
      return "var(--error-color)";
    if (["rainy", "snowy", "snowy-rainy", "fog"].includes(state))
      return "var(--info-color, var(--primary-color))";
    if (Number.isFinite(temperature) && temperature >= 35) return "#e27d35";
    if (state === "sunny") return "#e6a126";
    if (
      state === "clear-night" ||
      new Date().getHours() < 6 ||
      new Date().getHours() >= 20
    )
      return "#6d78c5";
    return "var(--primary-color)";
  }

  private ackMap(): Record<string, number> {
    const raw = this.acknowledgementsEntity
      ? this.hass?.states[this.acknowledgementsEntity]?.state || ""
      : "";
    const result: Record<string, number> = {};
    for (const item of raw.split(",")) {
      const p = item.lastIndexOf(":");
      if (p > 0) result[item.slice(0, p)] = Number(item.slice(p + 1)) || 0;
    }
    return result;
  }

  private incidentKey(message: string, path = "", identity = ""): string {
    const base = `${path}|${message}`
      .toLowerCase()
      .replace(/\d+/g, "#")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9|#]/g, "")
      .slice(0, identity ? 52 : 64);
    if (!identity) return base;
    let hash = 2166136261;
    for (let index = 0; index < identity.length; index += 1) {
      hash ^= identity.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `${base}|${(hash >>> 0).toString(36)}`;
  }

  private incidentCandidates(): Incident[] {
    if (!this.hass || !this.config) return [];
    if (this.config.attention_policy) return attentionSummaries(policyRows(this.config.attention_policy,this.hass)).map(row=>({
      key:row.key,message:row.message,tone:row.tone,path:row.path,entity:this.hass!.states[row.source]?row.source:undefined,dismissible:row.dismissible,notificationId:row.notificationId,
    })).sort((a,b)=>Number(b.tone==="error")-Number(a.tone==="error"));
    const found: Incident[] = [];
    for (const rule of this.config.incidents || []) {
      const matches = matchingIncidentIds(this.hass, rule);
      if (!matches.length) continue;
      const matchIdentity =
        rule.ack_scope === "matches"
          ? matches
              .map((id) => {
                const entity = this.hass!.states[id];
                return `${id}@${String(entity?.attributes.latest_version || "")}`;
              })
              .sort()
              .join(",")
          : "";
      if (rule.aggregate) {
        const message = rule.message.replace("{count}", String(matches.length));
        found.push({
          key: this.incidentKey(message, rule.navigation_path, matchIdentity),
          message,
          tone: rule.tone || "warning",
          path: rule.navigation_path,
          dismissible: rule.dismissible !== false,
        });
      } else
        for (const id of matches) {
          const entity = this.hass.states[id];
          const message = rule.message
            .replace("{name}", String(entity?.attributes.friendly_name || id))
            .replace("{count}", "1");
          found.push({
            key: this.incidentKey(
              message,
              rule.navigation_path,
              rule.ack_scope === "matches"
                ? `${id}@${String(entity?.attributes.latest_version || "")}`
                : "",
            ),
            message,
            tone: rule.tone || "warning",
            path: rule.navigation_path,
            entity: id,
            dismissible: rule.dismissible !== false,
          });
        }
    }
    return found.sort(
        (a, b) => (b.tone === "error" ? 1 : 0) - (a.tone === "error" ? 1 : 0),
      );
  }

  private incidents(): Incident[] {
    if(this.config?.attention_policy)return this.incidentCandidates();
    const ack = this.ackMap(),
      now = Date.now() / 1000;
    return this.incidentCandidates().filter(
      (issue) => !issue.dismissible || issue.tone === "error" || !(ack[issue.key] > now),
    );
  }

  private async dismissNotification(issue: Incident, event: Event) {
    event.stopPropagation();
    if (!this.hass || !issue.notificationId || this.dismissingNotification) return;
    this.dismissingNotification = issue.notificationId; this.notificationError = "";
    try { await dismissAttentionNotification(this.hass, issue.notificationId); }
    catch { this.notificationError = localized(this.hass,"Could not dismiss the Home Assistant notification. Try again.","Nem sikerült törölni a Home Assistant értesítését. Próbáld újra."); }
    finally { this.dismissingNotification = undefined; }
  }

  private async dismiss(
    issue: Incident,
    days: number,
    event: Event,
  ): Promise<void> {
    event.stopPropagation();
    if (issue.notificationId) return;
    if (!this.hass || !this.acknowledgementsEntity) return;
    if (this.config?.attention_policy) {
      const entity=this.hass.states[this.acknowledgementsEntity];
      const now=Date.now()/1000;
      const value=attentionAckValue(entity?.state,issue.key,Math.round(now+days*86400),now,Number(entity?.attributes.max||255));
      await this.hass.callService("input_text","set_value",{value},{entity_id:this.acknowledgementsEntity});
      return;
    }
    const now = Date.now() / 1000;
    const validKeys = new Set(this.incidentCandidates().map((item) => item.key));
    const ack = Object.fromEntries(
      Object.entries(this.ackMap()).filter(
        ([key, expiry]) => validKeys.has(key) && expiry > now,
      ),
    );
    ack[issue.key] = Math.floor(now + days * 86400);

    const maxLength = Number(
      this.hass.states[this.acknowledgementsEntity]?.attributes.max ||
        255,
    );
    const ordered = Object.entries(ack).sort(([keyA, expiryA], [keyB, expiryB]) =>
      keyA === issue.key
        ? -1
        : keyB === issue.key
          ? 1
          : expiryB - expiryA,
    );
    const stored: string[] = [];
    for (const [key, expiry] of ordered) {
      const entry = `${key}:${expiry}`;
      const candidate = [...stored, entry].join(",");
      if (candidate.length <= maxLength) stored.push(entry);
    }
    const value = stored.join(",");
    await this.hass.callService(
      "input_text",
      "set_value",
      { value },
      { entity_id: this.acknowledgementsEntity },
    );
  }

  private renderWeatherFx(state: string, wind: number) {
    if(state==="unknown"||state==="unavailable")return nothing;
    const h = new Date().getHours();
    const cloudy = [
      "cloudy", "partlycloudy", "fog", "rainy", "pouring",
      "lightning-rainy", "snowy", "snowy-rainy", "windy-variant",
    ].includes(state);
    const windy = wind >= (this.config?.wind_threshold ?? 20);
    const sky = cloudy
      ? html`<div class="cloud"></div>`
      : state === "clear-night" || h < 6 || h >= 20
        ? html`<div class="moon"></div>`
        : html`<div class="sun"></div>`;
    return html`<div class=${windy ? "sky wind" : "sky"} aria-hidden="true">
      ${sky}${windy ? html`<svg class="wind-lines" viewBox="0 0 112 76" focusable="false">
        <path pathLength="100" d="M12 24 H64 C82 24 82 6 70 6 C62 6 60 12 63 16" />
        <path pathLength="100" d="M4 38 H88 C107 38 107 17 94 17 C85 17 83 24 87 28" />
        <path pathLength="100" d="M20 52 H68 C86 52 86 70 74 70 C66 70 64 64 67 60" />
      </svg>` : nothing}
    </div>`;
  }

  private renderBanners(items: LumaBannerConfig[]) {
    const visible = items.filter((item) => itemIsVisible(this.hass!, item));
    if (!visible.length) return nothing;
    const content = html`<div class="banners">
      ${visible.map((item) => this.renderBanner(item))}
    </div>`;
    const threshold = this.config?.banner_collapse_threshold ?? 3;
    if (threshold <= 0 || visible.length < threshold) return content;
    const icons = [...new Set(visible.map((item) => item.icon || "mdi:information-outline"))].slice(0, 4);
    return html`<details class="banner-group" @click=${(event: Event) => event.stopPropagation()}>
      <summary class="banner-summary">
        <span class="banner-summary-icons" aria-hidden="true">
          ${icons.map((icon) => html`<ha-icon .icon=${icon}></ha-icon>`)}
        </span>
        <span class="banner-summary-text">${localized(this.hass,
          `${visible.length} activity updates`,
          `${visible.length} állapotjelzés`)}</span>
        <ha-icon class="banner-chevron" icon="mdi:chevron-down" aria-hidden="true"></ha-icon>
      </summary>
      ${content}
    </details>`;
  }

  private renderBanner(item: LumaBannerConfig) {
    if (!this.hass || !itemIsVisible(this.hass, item)) return nothing;
    const entity = this.hass.states[item.entity],
      color = item.color || "var(--luma-accent)";
    return html`<div
      class="banner interactive"
      role="button"
      tabindex="0"
      @keydown=${(event:KeyboardEvent)=>{if(event.target===event.currentTarget&&["Enter"," "].includes(event.key)){event.preventDefault();event.stopPropagation();void runAction(this,this.hass!,item.tap_action,item.entity);}}}
      style=${`--item-color:${color}`}
      @click=${(e: Event) => {
        e.stopPropagation();
        void runAction(this, this.hass!, item.tap_action, item.entity);
      }}
    >
      <ha-icon icon=${item.icon || "mdi:information-outline"}></ha-icon
      ><span class="banner-label">${item.label || item.name}</span
      ><span class="banner-state"
        >${item.state_label ||
        entityState(this.hass, entity, item.state_map)}</span
      ><button
        class="banner-action"
        @click=${(e: Event) => {
          e.stopPropagation();
          void runAction(
            this,
            this.hass!,
            item.secondary_action || item.tap_action,
            item.entity,
          );
        }}
      >
        ${item.secondary_label || item.name || localize(this.hass, "open_item")}
      </button>
    </div>`;
  }

  private clothingAdvice(){
    return this.config?.weather_advice_entity?html`<luma-weather-advice .hideUnavailable=${true} .hass=${this.hass} .entityId=${this.config.weather_advice_entity} .weatherEntity=${this.config.weather_entity}></luma-weather-advice>`:nothing;
  }

  render() {
    if (!this.hass || !this.config) return nothing;
    const weather = this.hass.states[this.config.weather_entity],
      weatherAvailable = entityAvailable(weather),
      state = weatherAvailable ? weather.state : "unknown",
      a = weatherAvailable ? weather.attributes : {},
      temperature = finiteMeasurement(a.temperature),
      wind = finiteMeasurement(a.wind_speed);
    const windFactor:Record<string,number>={"km/h":1,"m/s":3.6,"mph":1.609344,"kn":1.852,"knots":1.852,"ft/s":1.09728};
    const windKmh=wind===null?null:wind*(windFactor[String(a.wind_speed_unit||"km/h")]??NaN);
    const attentionRows = this.config.attention_policy ? policyRows(this.config.attention_policy,this.hass) : [];
    const overview = this.config.attention_policy ? attentionOverview(attentionRows,this.hass) : undefined;
    const snoozed = new Set(attentionRows.filter(x=>x.snoozedUntil).map(x=>x.key)).size;
    const missing = new Set([...attentionRows.filter(x=>x.status==="unavailable").map(x=>x.source),...(!weatherAvailable?[this.config.weather_entity]:[]),...(this.config.alarm_entity&&!entityAvailable(this.hass.states[this.config.alarm_entity])?[this.config.alarm_entity]:[])]).size;
    const issues = this.incidents(),
      critical = issues.some((x) => x.tone === "error"),
      attentionColor = overview?.loading && !overview.issues && !missing ? "var(--secondary-text-color)" : overview && !overview.issues && !missing && overview.updates ? "var(--primary-color)" : critical
        ? "var(--error-color)"
        : (overview ? overview.issues || missing : issues.length || missing)
          ? "var(--warning-color)"
          : "var(--success-color)",
      active = this.activeCount(),
      accent = this.accent(state, temperature ?? NaN, issues);
    const subtitle = [
      weatherAvailable?localizedMap(this.hass,weatherLabelsEn,weatherLabelsHu,state):missingLabel(this.hass,weather),
      temperature !== null
        ? `${formatNumber(this.hass,temperature)} ${a.temperature_unit || "°C"}`
        : "",
      wind !== null && windKmh !== null && windKmh >= (this.config.wind_threshold ?? 20) ? `${localized(this.hass,"wind","szél")} ${formatNumber(this.hass,wind)} ${a.wind_speed_unit || "km/h"}` : "",

    ]
      .filter(Boolean)
      .join(" • ");
    const alarm = this.config.alarm_entity
        ? this.hass.states[this.config.alarm_entity]
        : undefined,
      alarmColor = !entityAvailable(alarm) ? "var(--secondary-text-color)" : alarm.state === "triggered" ? "var(--error-color)" : ["arming","pending"].includes(alarm.state) ? "var(--warning-color)" : "var(--secondary-text-color)";
    const banners = [...(this.config.banners || [])];
    const irrigation = this.irrigationSummary();
    const irrigationRemainingEntity = this.config.irrigation_remaining_entity
        ? this.hass.states[this.config.irrigation_remaining_entity]
        : undefined,
      irrigationRemaining = applianceSeconds(irrigationRemainingEntity),
      irrigationFinish = irrigationRemaining != null && irrigationRemaining > 0
        ? new Intl.DateTimeFormat(this.hass.locale?.language || undefined, {
            hour: "2-digit",
            minute: "2-digit",
          }).format(Date.now() + irrigationRemaining * 1000)
        : "";
    if (irrigation)
      banners.push({
        entity:
          this.config.irrigation_entity ||
          String(
            typeof this.config.irrigation_zone_entities?.[0] === "string"
              ? this.config.irrigation_zone_entities[0]
              : this.config.irrigation_zone_entities?.[0]?.entity || "",
          ),
        label: localized(this.hass,"Active irrigation","Aktív öntözés"),
        state_label: [
          irrigation,
          irrigationRemaining != null && irrigationRemaining > 0
            ? `${applianceDuration(irrigationRemaining,this.hass)} ${localized(this.hass,"left","hátra")}`
            : "",
          irrigationFinish
            ? `${localized(this.hass,"ends","vége")} ${irrigationFinish}`
            : "",
        ].filter(Boolean).join(" · "),
        name: localize(this.hass, "open_item"),
        icon: "mdi:sprinkler-variant",
        color: "var(--info-color, var(--primary-color))",
        tap_action: this.config.irrigation_path
          ? { action: "navigate", navigation_path: this.config.irrigation_path }
          : { action: "more-info" },
      });
    if (
      this.config.waste_entity &&
      this.hass.states[this.config.waste_ack_entity || ""]?.state !== "on"
    )
      banners.push({
        entity: this.config.waste_entity,
        label: localized(this.hass,"Waste","Hulladék"),
        state_label: this.wasteSummary() || undefined,
        name: localize(this.hass, "open_item"),
        icon: "mdi:trash-can-outline",
        color: Number(this.hass.states[this.config.waste_entity]?.state)<=1?"var(--warning-color)":"var(--secondary-text-color)",
        below: (this.config.waste_days || 2) + 0.01,
        tap_action: this.config.waste_path
          ? { action: "navigate", navigation_path: this.config.waste_path }
          : { action: "more-info" },
        secondary_label: localize(this.hass, "done"),
        secondary_action: this.config.waste_ack_entity
          ? {
              action: "perform-action",
              perform_action: "input_boolean.turn_on",
              target: { entity_id: this.config.waste_ack_entity },
            }
          : undefined,
      });
    for (const item of this.config.appliances || []) {
      const appliance = this.hass.states[item.entity],
        state = appliance?.state.toLowerCase() || "unavailable",
        idle = item.idle_states || [
          "off",
          "power_off",
          "idle",
          "end",
          "complete",
          "completed",
          "unknown",
          "unavailable",
        ],
        active = item.active_entity
          ? this.hass.states[item.active_entity]?.state === "on"
          : !idle.includes(state),
        remainingEntity = item.remaining_entity
          ? this.hass.states[item.remaining_entity]
          : undefined,
        remaining = applianceSeconds(remainingEntity),
        finish = applianceFinishTime(remainingEntity,this.hass);
      if (active)
        banners.push({
          entity: item.entity,
          label: item.name,
          state_label: [
            entityState(this.hass, appliance, item.state_map),
            remaining != null ? `${applianceDuration(remaining,this.hass)} ${localized(this.hass,"left","hátra")}` : "",
            finish ? `${localized(this.hass,"done","kész")} ${finish}` : "",
          ]
            .filter(Boolean)
            .join(" · "),
          name: localize(this.hass, "open_item"),
          icon: item.icon || "mdi:washing-machine",
          color: "var(--info-color, var(--primary-color))",
          tap_action: item.path
            ? { action: "navigate", navigation_path: item.path }
            : { action: "more-info" },
        });
    }
    const alarmModes = this.config.alarm_modes || [
      {mode:"away",name:localized(this.hass,"Away","Távol"),icon:"mdi:shield-lock"},
      {mode:"night",name:localized(this.hass,"Night","Éjszaka"),icon:"mdi:shield-moon"},
      {mode:"disarm",name:localized(this.hass,"Disarm","Kikapcsolás"),icon:"mdi:shield-off-outline"},
    ],
      alarmUnavailable = !entityAvailable(alarm),
      alarmStateMap: Record<string, string> = {
        away: "armed_away",
        night: "armed_night",
        home: "armed_home",
        disarm: "disarmed",
      },
      alarmModeIcons: Record<string, string> = {
        away: "mdi:shield-lock",
        night: "mdi:shield-moon",
        home: "mdi:shield-home",
        disarm: "mdi:shield-off-outline",
      };
    return html`<ha-card
        class="hero"
        style=${`--luma-accent:${accent};--tone:${accent}`}
        >${this.renderWeatherFx(state, windKmh ?? 0)}
        <div class="content">
          <div class="top">
            <div class="weather-icon">
              <ha-icon
                icon=${weatherIcons[state] || "mdi:home-heart"}
              ></ha-icon>
            </div>
            <h2>${this.greeting()}</h2>
            <button class="subtitle weather-link" aria-label=${localized(this.hass,`Weather: ${subtitle}`,`Időjárás: ${subtitle}`)} @click=${()=>runAction(this,this.hass!,this.config?.tap_action||{action:"more-info"},this.config?.weather_entity)}>${subtitle}<ha-icon icon="mdi:chevron-right" aria-hidden="true"></ha-icon></button>
            ${this.clothingAdvice()}
            <div class=${`status ${critical||missing||issues.length?"needs-attention":""}`}>
              <button
                class="active interactive"
                style="--active-color:var(--secondary-text-color)"
                ?disabled=${!this.config.active_action||this.config.active_action.action==="none"}
                @click=${(e: Event) => {
                  e.stopPropagation();
                  void runAction(this, this.hass!, this.config?.active_action);
                }}
              >
                <ha-icon icon="mdi:lightning-bolt-outline"></ha-icon
                ><span>${active} ${this.config.active_label||localized(this.hass,"active devices","aktív eszköz")}</span></button
              >${this.config.alarm_entity
                ? html`<button
                    class="alarm interactive"
                    aria-label=${`${localized(this.hass,"Alarm","Riasztó")}: ${presentedState(this.hass,alarm)}`}
                    aria-haspopup=${this.config.alarm_popover
                      ? "dialog"
                      : "false"}
                    aria-expanded=${this.alarmPopoverOpen}
                    style=${`--alarm-color:${alarmColor}`}
                    @click=${(e: Event) => {
                      e.stopPropagation();
                      this.config?.alarm_popover && entityAvailable(alarm)
                        ? this.toggleAlarmPopover()
                        : void runAction(
                            this,
                            this.hass!,
                            this.config?.alarm_action || {
                              action: "more-info",
                            },
                            this.config?.alarm_entity,
                          );
                    }}
                  >
                    <ha-icon icon="mdi:shield-home-outline"></ha-icon
                    ><span>${presentedState(this.hass, alarm)}</span>
                  </button>`
                : nothing}<button
                class="attention interactive"
                aria-expanded=${this.detailsOpen}
                style=${`--attention-color:${attentionColor}`}
                @click=${(e: Event) => {
                  e.stopPropagation();
                  this.detailsOpen = !this.detailsOpen;
                }}
              >
                <ha-icon
                  icon=${overview?.loading && !issues.length ? "mdi:progress-clock" : overview && !overview.issues && overview.updates ? "mdi:package-up" : critical
                    ? "mdi:alert-octagon"
                    : issues.length
                      ? "mdi:alert-circle-outline"
                      : missing ? "mdi:cloud-question-outline" : "mdi:check-circle-outline"}
                ></ha-icon
                ><span
                  >${critical ? `${issues.find(issue=>issue.tone==="error")!.message}${issues.length>1?` · +${issues.length-1}`:""}` : overview ? `${overview.text}${missing?localized(this.hass,` • ${missing} data sources unavailable`,` • ${missing} adatforrás nem elérhető`):""}` : issues.length
                    ? localized(this.hass,`${issues.length} notices`,`${issues.length} jelzés`)
                    : missing ? localized(this.hass,`${missing} data gaps`,`${missing} adatkimaradás`) : localized(this.hass,"No active alerts","Nincs aktív jelzés")}</span
                >
              </button>
            </div>
          </div>
          ${!this.config.attention_policy && this.detailsOpen && (issues.length || snoozed || missing)
            ? html`<div class="panel">
                ${issues.map(
                  (issue) =>
                    html`<div
                      class="issue"
                      style=${`--issue-color:${issue.tone === "error" ? "var(--error-color)" : "var(--warning-color)"}`}
                    >
                      <ha-icon
                        icon=${issue.tone === "error"
                          ? "mdi:alert-octagon-outline"
                          : "mdi:alert-outline"}
                      ></ha-icon
                      ><span
                        class="issue-text"
                        @click=${() =>
                          issue.path
                            ? runAction(this, this.hass!, {
                                action: "navigate",
                                navigation_path: issue.path,
                              })
                            : issue.entity
                              ? runAction(
                                  this,
                                  this.hass!,
                                  { action: "more-info" },
                                  issue.entity,
                                )
                              : undefined}
                        >${issue.message}</span
                      >${issue.notificationId ? html`<span class="issue-actions"><button ?disabled=${!!this.dismissingNotification} title=${localized(this.hass,"Dismiss this notification in Home Assistant","Az értesítés törlése a Home Assistantból")} @click=${(event: Event) => this.dismissNotification(issue,event)}>${localized(this.hass,"Dismiss","Elvetés")}</button></span>` : issue.dismissible && issue.tone !== "error"
                        ? html`<span class="issue-actions"
                            ><button
                              @click=${(e: Event) => this.dismiss(issue, 7, e)}
                            >
                              ${localized(this.hass,"7 days","7 nap")}</button
                            ><button
                              @click=${(e: Event) => this.dismiss(issue, 30, e)}
                            >
                              ${localized(this.hass,"30 days","30 nap")}
                            </button></span
                          >`
                        : nothing}
                    </div>`,
                )}
                ${this.notificationError ? html`<div role="alert" style="color:var(--error-color);font-size:12px">${this.notificationError}</div>` : nothing}
                ${this.config.attention_policy && (snoozed || missing) ? html`<button class="coverage-link" @click=${()=>runAction(this,this.hass!,{action:"navigate",navigation_path:attentionPolicy(this.config!.attention_policy)?.diagnostics_path||"/config"})}><ha-icon icon="mdi:bell-cog-outline"></ha-icon><span><strong>${localized(this.hass,"Notification coverage","Jelzések áttekintése")}</strong><small>${[missing?localized(this.hass,`${missing} data gaps`,`${missing} adatkimaradás`):"",snoozed?localized(this.hass,`${snoozed} snoozed`,`${snoozed} szüneteltetve`):""].filter(Boolean).join(" · ")}</small></span><ha-icon icon="mdi:chevron-right"></ha-icon></button>` : nothing}
              </div>`
            : nothing}${this.renderBanners(banners)}
        </div></ha-card
      >${this.config.attention_policy ? html`<luma-attention-card .hass=${this.hass} .open=${this.detailsOpen} @attention-close=${()=>this.detailsOpen=false} ${ref(node=>{const card=node as HTMLElement & LovelaceCard;if(card && card.dataset.policy!==this.config?.attention_policy){card.setConfig({type:"custom:luma-attention-card",policy:this.config!.attention_policy,mode:"diagnostics",panel:true,title:localized(this.hass,"Notifications","Jelzések")});card.dataset.policy=this.config!.attention_policy;}})}></luma-attention-card>` : nothing}
      <luma-bottom-sheet .open=${this.alarmPopoverOpen&&!!alarm} .heading=${localized(this.hass,"Alarm","Riasztó")} .subtitle=${alarm?presentedState(this.hass,alarm):""} icon="mdi:shield-home-outline" .maxWidth=${480} .closeLabel=${localize(this.hass,"dismiss")} @sheet-dismiss=${()=>this.closeAlarm()}>
        <div class="alarm-actions" style=${`--alarm-count:${alarmModes.length}`}>
        ${alarmModes.map(mode=>{
          const active=alarm?.state===alarmStateMap[mode.mode];
          const disabled=this.alarmBusy||active||alarmUnavailable||((alarm?.state==="triggered"||["arming","pending"].includes(alarm?.state||""))&&mode.mode!=="disarm");
          const confirming=this.alarmPending===mode.mode;
          return html`<button class=${`alarm-mode ${active?"selected":""} ${confirming?"confirm":""}`} ?disabled=${disabled} aria-pressed=${active} @click=${()=>this.activateAlarm(mode.mode,disabled)}><ha-icon icon=${confirming?"mdi:check":mode.icon||alarmModeIcons[mode.mode]}></ha-icon><span>${confirming?localize(this.hass,"confirm"):mode.name}</span></button>`;
        })}</div>
        ${this.alarmError?html`<p class="alarm-error" role="alert">${this.alarmError}</p>`:nothing}
        <button class="alarm-details" @click=${()=>{this.closeAlarm();void runAction(this,this.hass!,this.config?.alarm_action||{action:"more-info"},this.config?.alarm_entity)}}>${localize(this.hass,"settings")}</button>
      </luma-bottom-sheet>`;
  }
}
