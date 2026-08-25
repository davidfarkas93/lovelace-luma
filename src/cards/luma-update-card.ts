import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { entityName, runAction } from "../helpers";
import { localize, localized } from "../localize";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LovelaceCard } from "../types";

interface Config { type:string; entity:string; name?:string; icon?:string }

@customElement("luma-update-card")
export class LumaUpdateCard extends LitElement implements LovelaceCard {
  @property({attribute:false}) hass?:HomeAssistant;
  @state() private config?:Config;
  @state() private pending=false;
  private confirmTimer?:number;

  static styles=[lumaTokens,css`
    ha-card{position:relative;padding:15px;border:1px solid color-mix(in srgb,var(--tone) 20%,transparent);border-radius:20px;background:linear-gradient(145deg,color-mix(in srgb,var(--tone) 10%,var(--luma-surface)),var(--luma-surface) 72%);box-shadow:var(--luma-shadow)}
    .row{display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:11px}.icon{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;color:var(--tone);background:color-mix(in srgb,var(--tone) 16%,transparent)}.icon ha-icon{--mdc-icon-size:22px}.installing .icon ha-icon{animation:spin 1.1s linear infinite}.name{min-width:0;overflow:hidden;font-size:14px;font-weight:720;text-overflow:ellipsis;white-space:nowrap}.sub{margin-top:3px;color:var(--luma-muted);font-size:10px}.action{padding:8px 11px;border:0;border-radius:999px;color:var(--tone);background:color-mix(in srgb,var(--tone) 15%,transparent);font-size:10px;font-weight:750;cursor:pointer}.action:disabled{cursor:default;opacity:.7}.track{height:6px;margin-top:13px;overflow:hidden;border-radius:99px;background:color-mix(in srgb,var(--primary-text-color) 9%,transparent)}.fill{height:100%;border-radius:inherit;background:var(--tone);transition:width .35s ease}.indeterminate{width:34%;animation:travel 1.2s ease-in-out infinite}@keyframes spin{to{transform:rotate(360deg)}}@keyframes travel{0%{transform:translateX(-110%)}100%{transform:translateX(300%)}}
    @media(max-width:599px){ha-card{padding:13px}.row{grid-template-columns:40px minmax(0,1fr) auto}.icon{width:40px;height:40px;border-radius:13px}.action{padding:7px 9px}}
  `];

  setConfig(c:Config){if(!c?.entity)throw Error("entity required");this.config=c}
  getCardSize(){return 2}
  protected shouldUpdate(changed:PropertyValues<this>){if(!changed.has("hass"))return true;const old=changed.get("hass") as HomeAssistant|undefined;return!old||old.states[this.config?.entity||""]!==this.hass?.states[this.config?.entity||""]}
  private install(e:Event){e.stopPropagation();if(!this.pending){this.pending=true;clearTimeout(this.confirmTimer);this.confirmTimer=window.setTimeout(()=>this.pending=false,3500);return}this.pending=false;void runAction(this,this.hass!,{action:"perform-action",perform_action:"update.install",target:{entity_id:this.config!.entity}},this.config!.entity)}
  render(){if(!this.hass||!this.config)return nothing;const entity=this.hass.states[this.config.entity],a=entity?.attributes||{},raw=a.in_progress,installing=raw===true||(typeof raw==="number"&&raw>=0),percentage=Number(a.update_percentage??(typeof raw==="number"?raw:NaN)),progress=Number.isFinite(percentage)?Math.max(0,Math.min(100,percentage)):undefined,installed=String(a.installed_version||""),latest=String(a.latest_version||""),available=entity?.state==="on",tone=installing?"var(--info-color,var(--primary-color))":available?"var(--warning-color)":"var(--success-color)",subtitle=installing?(progress!==undefined?`${localize(this.hass,"installing")} · ${Math.round(progress)}%`:localize(this.hass,"installing")):available?(installed&&latest?`${installed} → ${latest}`:localized(this.hass,"Update available","Frissítés elérhető")):localized(this.hass,"Up to date","Naprakész");return html`<ha-card class=${installing?"installing":""} style=${`--tone:${tone}`} @click=${()=>runAction(this,this.hass!,{action:"more-info"},this.config!.entity)}><div class="row"><span class="icon"><ha-icon icon=${installing?"mdi:progress-download":this.config.icon||"mdi:package-up"}></ha-icon></span><span><div class="name">${this.config.name||entityName(entity,this.config.entity)}</div><div class="sub">${subtitle}</div></span>${available||installing?html`<button class="action" ?disabled=${installing} @click=${this.install}>${installing?(progress!==undefined?`${Math.round(progress)}%`:localize(this.hass,"installing")):this.pending?localize(this.hass,"confirm"):localize(this.hass,"install")}</button>`:nothing}</div>${installing?html`<div class="track"><div class=${`fill ${progress===undefined?"indeterminate":""}`} style=${progress===undefined?"":`width:${progress}%`}></div></div>`:nothing}</ha-card>`}
}
