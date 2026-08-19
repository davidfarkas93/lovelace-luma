import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LovelaceCard } from "../types";

interface App { name: string; activity: string }
interface Config { type: string; remote_entity: string; media_entity: string; name?: string; apps?: App[] }

const utilityKeys = [
  ["mdi:power", "KEYCODE_POWER", "Be/ki"],
  ["mdi:volume-minus", "KEYCODE_VOLUME_DOWN", "Halkabb"],
  ["mdi:volume-off", "KEYCODE_MUTE", "Némítás"],
  ["mdi:volume-plus", "KEYCODE_VOLUME_UP", "Hangosabb"],
  ["mdi:home", "KEYCODE_HOME", "Kezdőlap"],
  ["mdi:magnify", "KEYCODE_SEARCH", "Keresés"],
];

@customElement("luma-remote-card")
export class LumaRemoteCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: Config;

  static styles = [lumaTokens, css`
    .wrap { display:grid; gap:13px; }
    .now { display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:17px; background:color-mix(in srgb,var(--luma-accent) 7%,var(--luma-surface)); }
    .dot { width:8px; height:8px; border-radius:50%; background:var(--success-color); box-shadow:0 0 0 4px color-mix(in srgb,var(--success-color) 12%,transparent); }
    .meta { min-width:0; }
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
    .app { font-size:var(--luma-text-sm); font-weight:var(--luma-weight-strong); }
    @media(max-width:599px) {
      .utility { grid-template-columns:repeat(3,1fr); }
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
  private app(activity: string) { return this.hass?.callService("remote", "turn_on", { activity }, { entity_id: this.config!.remote_entity }); }
  private button(icon: string, command: string, label: string, className = "") {
    return html`<button class=${`key ${className}`} title=${label} aria-label=${label} @click=${() => this.send(command)}><ha-icon icon=${icon}></ha-icon></button>`;
  }

  render() {
    if (!this.hass || !this.config) return nothing;
    const entity = this.hass.states[this.config.media_entity];
    const attrs = entity?.attributes || {};
    const detail = String(attrs.media_title || attrs.app_name || entity?.state || "Nem elérhető");
    const apps = this.config.apps || [
      { name: "YouTube", activity: "com.google.android.youtube.tv" },
      { name: "Netflix", activity: "com.netflix.ninja" },
      { name: "Spotify", activity: "com.spotify.tv.android" },
      { name: "Wholphin", activity: "com.github.damontecres.wholphin" },
    ];
    const online = entity && !["off", "unavailable", "unknown"].includes(entity.state);
    return html`<div class="wrap">
      <div class="now"><span class="dot" style=${online ? "" : "background:var(--luma-muted);box-shadow:none"}></span><div class="meta"><div class="name">${this.config.name || "TV"}</div><div class="state">${detail}</div></div></div>
      <div class="utility">${utilityKeys.map(([icon, command, label]) => this.button(icon, command, label))}</div>
      <div class="remote-body">
        <div class="nav">
          ${this.button("mdi:chevron-up", "KEYCODE_DPAD_UP", "Fel", "up")}
          ${this.button("mdi:chevron-left", "KEYCODE_DPAD_LEFT", "Balra", "left")}
          ${this.button("mdi:check", "KEYCODE_DPAD_CENTER", "OK", "ok")}
          ${this.button("mdi:chevron-right", "KEYCODE_DPAD_RIGHT", "Jobbra", "right")}
          ${this.button("mdi:chevron-down", "KEYCODE_DPAD_DOWN", "Le", "down")}
        </div>
        <div class="media">
          ${this.button("mdi:arrow-u-left-top", "KEYCODE_BACK", "Vissza")}
          ${this.button("mdi:skip-previous", "KEYCODE_MEDIA_PREVIOUS", "Előző")}
          ${this.button("mdi:play-pause", "KEYCODE_MEDIA_PLAY_PAUSE", "Lejátszás vagy szünet", "play")}
          ${this.button("mdi:rewind", "KEYCODE_MEDIA_REWIND", "Visszatekerés")}
          ${this.button("mdi:fast-forward", "KEYCODE_MEDIA_FAST_FORWARD", "Előretekerés")}
        </div>
      </div>
      <div class="label">Alkalmazások</div>
      <div class="apps">${apps.map(item => html`<button class="app" @click=${() => this.app(item.activity)}>${item.name}</button>`)}</div>
    </div>`;
  }
}
