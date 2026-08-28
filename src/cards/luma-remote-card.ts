import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { localized } from "../localize";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LovelaceCard } from "../types";

interface App { name: string; activity: string }
interface Config { type: string; remote_entity: string; media_entity: string; name?: string; apps?: App[]; artwork?: boolean }

const utilityKeys = [
  ["mdi:power", "KEYCODE_POWER", "Power", "Be/ki"],
  ["mdi:volume-minus", "KEYCODE_VOLUME_DOWN", "Volume down", "Halkabb"],
  ["mdi:volume-off", "KEYCODE_MUTE", "Mute", "Némítás"],
  ["mdi:volume-plus", "KEYCODE_VOLUME_UP", "Volume up", "Hangosabb"],
  ["mdi:home", "KEYCODE_HOME", "Home", "Kezdőlap"],
  ["mdi:magnify", "KEYCODE_SEARCH", "Search", "Keresés"],
];

@customElement("luma-remote-card")
export class LumaRemoteCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: Config;
  @state() private launching?: string;
  @state() private launchResult?: "success" | "error";

  static styles = [lumaTokens, css`
    .wrap { display:grid; gap:13px; }
    .now { position:relative; isolation:isolate; display:flex; align-items:center; gap:10px; min-height:42px; padding:12px 14px; overflow:hidden; border-radius:17px; background:color-mix(in srgb,var(--luma-accent) 7%,var(--luma-surface)); }
    .now.has-art { min-height:62px; padding:11px; }
    .backdrop { position:absolute; z-index:-2; inset:-22px; width:calc(100% + 44px); height:calc(100% + 44px); object-fit:cover; filter:blur(20px) saturate(1.15); opacity:.2; transform:scale(1.06); }
    .now.has-art::after { content:""; position:absolute; z-index:-1; inset:0; background:linear-gradient(90deg,color-mix(in srgb,var(--luma-surface) 90%,transparent),color-mix(in srgb,var(--luma-surface) 67%,transparent)); }
    .art { flex:0 0 auto; width:58px; height:58px; object-fit:cover; border-radius:14px; box-shadow:0 7px 18px rgba(0,0,0,.16); }
    .dot { width:8px; height:8px; border-radius:50%; background:var(--success-color); box-shadow:0 0 0 4px color-mix(in srgb,var(--success-color) 12%,transparent); }
    .meta { min-width:0; }
    .eyebrow { display:flex; align-items:center; gap:7px; margin-bottom:3px; color:var(--luma-muted); font-size:9px; font-weight:720; letter-spacing:.055em; text-transform:uppercase; }
    .eyebrow .dot { width:6px; height:6px; box-shadow:none; }
    .name { font-size:var(--luma-text-sm); font-weight:var(--luma-weight-strong); }
    .state { overflow:hidden; color:var(--luma-muted); font-size:var(--luma-text-xs); text-overflow:ellipsis; white-space:nowrap; }
    button { font:inherit; cursor:pointer; -webkit-tap-highlight-color:transparent; }
    .utility { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:7px; }
    .key,.app { display:grid; place-items:center; min-width:0; min-height:46px; padding:0; border:0; border-radius:14px; color:var(--primary-text-color); background:color-mix(in srgb,var(--primary-text-color) 6%,transparent); transition:transform .14s ease,background .14s ease; }
    .key:active,.app:active { transform:scale(.94); background:color-mix(in srgb,var(--luma-accent) 17%,transparent); }
    .key ha-icon { --mdc-icon-size:21px; }
    .remote-body { width:min(100%,390px); margin:auto; padding:13px; border:1px solid color-mix(in srgb,var(--primary-text-color) 8%,transparent); border-radius:30px; background:linear-gradient(155deg,color-mix(in srgb,var(--primary-text-color) 5%,var(--luma-surface)),color-mix(in srgb,var(--luma-accent) 5%,var(--luma-surface))); box-shadow:inset 0 1px 0 color-mix(in srgb,#fff 28%,transparent); }
    .nav { display:grid; grid-template-columns:repeat(3,68px); grid-template-rows:repeat(3,62px); place-content:center; gap:5px; }
    .nav .key { min-height:62px; border-radius:21px; background:color-mix(in srgb,var(--primary-text-color) 7%,transparent); }
    .nav .key ha-icon { --mdc-icon-size:28px; }
    .nav .up { grid-column:2; }
    .nav .left { grid-column:1; grid-row:2; }
    .nav .ok { grid-column:2; grid-row:2; color:var(--luma-accent); background:color-mix(in srgb,var(--luma-accent) 17%,transparent); box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--luma-accent) 13%,transparent); }
    .nav .right { grid-column:3; grid-row:2; }
    .nav .down { grid-column:2; grid-row:3; }
    .media { display:grid; grid-template-columns:repeat(5,1fr); gap:5px; margin-top:10px; padding-top:10px; border-top:1px solid color-mix(in srgb,var(--primary-text-color) 8%,transparent); }
    .media .key { min-height:47px; border-radius:16px; background:transparent; }
    .media .play { color:var(--luma-accent); background:color-mix(in srgb,var(--luma-accent) 14%,transparent); }
    .label { padding:0 2px; color:var(--luma-muted); font-size:var(--luma-text-xs); font-weight:var(--luma-weight-strong); letter-spacing:.04em; text-transform:uppercase; }
    .apps { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
    .app { display:flex; align-items:center; justify-content:center; gap:7px; text-align:center; font-size:var(--luma-text-sm); font-weight:var(--luma-weight-strong); }
    .app ha-icon { --mdc-icon-size:16px; }
    .app.success { color:var(--success-color); background:color-mix(in srgb,var(--success-color) 11%,transparent); }
    .app.error { color:var(--error-color); background:color-mix(in srgb,var(--error-color) 11%,transparent); }
    .app.loading ha-icon { animation:spin .8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    @media(max-width:599px) {
      .utility { grid-template-columns:repeat(3,1fr); }
      .now.has-art { min-height:56px; }
      .art { width:52px; height:52px; border-radius:13px; }
      .key,.app { min-height:48px; }
      .remote-body { box-sizing:border-box; border-radius:27px; }
      .nav { grid-template-columns:repeat(3,64px); grid-template-rows:repeat(3,59px); }
      .nav .key { min-height:59px; }
    }
  `];

  setConfig(config: Config) {
    if (!config?.remote_entity || !config?.media_entity) throw Error("remote_entity and media_entity required");
    this.config = config;
  }
  getCardSize() { return 6; }
  private send(command: string) { return this.hass?.callService("remote", "send_command", { command }, { entity_id: this.config!.remote_entity }); }
  private async app(activity: string) {
    if (!this.hass || this.launching) return;
    this.launching = activity;
    this.launchResult = undefined;
    try {
      try {
        await this.hass.callService("remote", "turn_on", { activity }, { entity_id: this.config!.remote_entity });
      } catch {
        await this.hass.callService("media_player", "play_media", {
          media_content_type: "app",
          media_content_id: activity,
        }, { entity_id: this.config!.media_entity });
      }
      this.launchResult = "success";
    } catch {
      this.launchResult = "error";
    } finally {
      window.setTimeout(() => {
        this.launching = undefined;
        this.launchResult = undefined;
      }, 1400);
    }
  }
  private button(icon: string, command: string, label: string, className = "") {
    return html`<button class=${`key ${className}`} title=${label} aria-label=${label} @click=${() => this.send(command)}><ha-icon icon=${icon}></ha-icon></button>`;
  }

  render() {
    if (!this.hass || !this.config) return nothing;
    const entity = this.hass.states[this.config.media_entity];
    const attrs = entity?.attributes || {};
    const mediaTitle = String(attrs.media_title || "");
    const detail = String(attrs.media_artist || attrs.media_series_title || attrs.app_name || entity?.state || localized(this.hass,"Unavailable","Nem elérhető"));
    const artwork = this.config.artwork !== false
      ? String(attrs.entity_picture_local || attrs.entity_picture || "")
      : "";
    const apps = this.config.apps || [
      { name: "YouTube", activity: "https://www.youtube.com" },
      { name: "Netflix", activity: "netflix://" },
      { name: "Spotify", activity: "spotify://" },
      { name: "Wholphin", activity: "wholphin://search" },
    ];
    const online = entity && !["off", "unavailable", "unknown"].includes(entity.state);
    return html`<div class="wrap">
      <div class=${`now ${artwork ? "has-art" : ""}`}>
        ${artwork ? html`<img class="backdrop" src=${artwork} alt="" aria-hidden="true"><img class="art" src=${artwork} alt="">` : html`<span class="dot" style=${online ? "" : "background:var(--luma-muted);box-shadow:none"}></span>`}
        <div class="meta">
          ${artwork ? html`<div class="eyebrow"><span class="dot" style=${online ? "" : "background:var(--luma-muted)"}></span>${this.config.name || "TV"}</div>` : nothing}
          <div class="name">${mediaTitle || this.config.name || "TV"}</div>
          <div class="state">${detail}</div>
        </div>
      </div>
      <div class="utility">${utilityKeys.map(([icon, command, en, hu]) => this.button(icon, command, localized(this.hass,en,hu)))}</div>
      <div class="remote-body">
        <div class="nav">
          ${this.button("mdi:chevron-up", "KEYCODE_DPAD_UP", localized(this.hass,"Up","Fel"), "up")}
          ${this.button("mdi:chevron-left", "KEYCODE_DPAD_LEFT", localized(this.hass,"Left","Balra"), "left")}
          ${this.button("mdi:check", "KEYCODE_DPAD_CENTER", "OK", "ok")}
          ${this.button("mdi:chevron-right", "KEYCODE_DPAD_RIGHT", localized(this.hass,"Right","Jobbra"), "right")}
          ${this.button("mdi:chevron-down", "KEYCODE_DPAD_DOWN", localized(this.hass,"Down","Le"), "down")}
        </div>
        <div class="media">
          ${this.button("mdi:arrow-u-left-top", "KEYCODE_BACK", localized(this.hass,"Back","Vissza"))}
          ${this.button("mdi:skip-previous", "KEYCODE_MEDIA_PREVIOUS", localized(this.hass,"Previous","Előző"))}
          ${this.button("mdi:play-pause", "KEYCODE_MEDIA_PLAY_PAUSE", localized(this.hass,"Play or pause","Lejátszás vagy szünet"), "play")}
          ${this.button("mdi:rewind", "KEYCODE_MEDIA_REWIND", localized(this.hass,"Rewind","Visszatekerés"))}
          ${this.button("mdi:fast-forward", "KEYCODE_MEDIA_FAST_FORWARD", localized(this.hass,"Fast forward","Előretekerés"))}
        </div>
      </div>
      <div class="label">${localized(this.hass,"Apps","Alkalmazások")}</div>
      <div class="apps">${apps.map(item => {
        const current = this.launching === item.activity;
        const status = current ? this.launchResult : undefined;
        const icon = status === "success" ? "mdi:check" : status === "error" ? "mdi:alert-circle-outline" : "mdi:loading";
        return html`<button class=${`app ${current ? status || "loading" : ""}`} ?disabled=${Boolean(this.launching)} @click=${() => this.app(item.activity)}>${current ? html`<ha-icon icon=${icon}></ha-icon>` : nothing}${item.name}</button>`;
      })}</div>
    </div>`;
  }
}
