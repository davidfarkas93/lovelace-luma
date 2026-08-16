import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { runAction } from "../helpers";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LumaAction, LovelaceCard } from "../types";

interface Config {
  type:string;
  name:string;
  subtitle?:string;
  icon?:string;
  color?:string;
  tap_action:LumaAction;
  confirmation?:string;
  show_arrow?:boolean;
}

@customElement("luma-action-card")
export class LumaActionCard extends LitElement implements LovelaceCard {
  @property({attribute:false}) hass?:HomeAssistant;
  @state() private config?:Config;
  @state() private pending=false;
  private timer?:number;

  static styles=[lumaTokens,css`
    ha-card{display:grid;grid-template-columns:40px minmax(0,1fr) auto;grid-template-areas:"icon name arrow" "icon subtitle arrow";align-items:center;gap:2px 11px;min-height:66px;padding:12px 13px;border:1px solid color-mix(in srgb,var(--tone) 13%,transparent);border-radius:18px;background:linear-gradient(145deg,color-mix(in srgb,var(--tone) 7%,var(--luma-surface)),color-mix(in srgb,var(--tone) 2%,var(--luma-surface)) 72%);box-shadow:0 10px 28px color-mix(in srgb,var(--tone) 5%,transparent);transition:transform .17s ease,border-color .17s ease,box-shadow .17s ease}
    ha-card:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--tone) 22%,transparent);box-shadow:0 15px 34px color-mix(in srgb,var(--tone) 10%,transparent)}
    .icon{grid-area:icon;display:grid;place-items:center;width:40px;height:40px;border-radius:13px;color:var(--tone);background:color-mix(in srgb,var(--tone) 13%,transparent)}.icon ha-icon{--mdc-icon-size:20px}
    .name{grid-area:name;align-self:end;min-width:0;overflow:hidden;font-size:var(--luma-text-sm);font-weight:var(--luma-weight-strong);text-overflow:ellipsis;white-space:nowrap}.subtitle{grid-area:subtitle;align-self:start;min-width:0;overflow:hidden;color:var(--luma-muted);font-size:var(--luma-text-xs);text-overflow:ellipsis;white-space:nowrap}.arrow{grid-area:arrow;color:var(--luma-muted)}.arrow ha-icon{--mdc-icon-size:17px}
    ha-card.pending{--tone:var(--warning-color)}
  `];

  setConfig(c:Config){if(!c?.name||!c?.tap_action)throw Error("name and tap_action required");this.config={show_arrow:false,...c}}
  getCardSize(){return 1}
  private activate(){
    if(!this.config||!this.hass)return;
    if(this.config.confirmation&&!this.pending){this.pending=true;clearTimeout(this.timer);this.timer=window.setTimeout(()=>this.pending=false,3200);return}
    this.pending=false;
    void runAction(this,this.hass,this.config.tap_action);
  }
  render(){if(!this.config||!this.hass)return nothing;const c=this.config,tone=c.color||"var(--primary-color)";return html`<ha-card class=${`interactive ${this.pending?"pending":""}`} style=${`--tone:${tone}`} role="button" tabindex="0" @click=${()=>this.activate()} @keydown=${(e:KeyboardEvent)=>{if(e.key==="Enter"||e.key===" ")this.activate()}}><span class="icon"><ha-icon icon=${this.pending?"mdi:check":c.icon||"mdi:gesture-tap"}></ha-icon></span><span class="name">${this.pending?"Megerősítés":c.name}</span><span class="subtitle">${this.pending?c.confirmation:c.subtitle||"Koppints a végrehajtáshoz"}</span>${c.show_arrow?html`<span class="arrow"><ha-icon icon="mdi:arrow-right"></ha-icon></span>`:nothing}</ha-card>`}
}
