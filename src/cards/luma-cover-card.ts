import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { entityName } from "../helpers";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LovelaceCard } from "../types";

interface Config { type:string; entity:string; name?:string; icon?:string; open_count_entity?:string; confirm_open?:boolean; confirm_close?:boolean; variant?:"master"|"group"|"compact" }
const labels:Record<string,string>={open:"Nyitva",closed:"Zárva",opening:"Nyílik",closing:"Záródik",unavailable:"Nem elérhető"};

@customElement("luma-cover-card")
export class LumaCoverCard extends LitElement implements LovelaceCard {
  @property({attribute:false}) hass?:HomeAssistant;
  @state() private config?:Config;
  @state() private pending="";
  private timer?:number;
  static styles=[lumaTokens,css`
    ha-card{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto auto;grid-template-areas:"icon title meta open stop close" "bar bar bar bar bar bar";align-items:center;gap:10px;padding:16px 17px;border:1px solid color-mix(in srgb,var(--tone) 18%,transparent);border-radius:20px;background:linear-gradient(145deg,color-mix(in srgb,var(--tone) var(--mix),var(--luma-surface)),var(--luma-surface) 75%);box-shadow:0 14px 38px color-mix(in srgb,var(--tone) 8%,transparent)}
    ha-card.master{padding:19px 20px;border-radius:22px;box-shadow:0 17px 44px color-mix(in srgb,var(--tone) 10%,transparent)}ha-card.master .title{font-size:17px;font-weight:720}ha-card.master .bar{height:8px;margin-top:3px}
    ha-card.compact{grid-template-columns:18px minmax(0,1fr) auto auto auto;grid-template-areas:"icon title open stop close" "meta meta meta meta meta" "bar bar bar bar bar";gap:7px;padding:10px 11px;border-radius:15px;box-shadow:none}ha-card.compact .title{font-size:12px;font-weight:620}ha-card.compact .meta{font-size:9px}ha-card.compact .btn{width:29px;height:29px;border-radius:10px}ha-card.compact .bar{height:4px;margin-top:0}
    .icon{grid-area:icon;color:var(--tone)}.icon ha-icon{--mdc-icon-size:18px}.title{grid-area:title;min-width:0;font-size:var(--luma-text-md);font-weight:var(--luma-weight-strong);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.meta{grid-area:meta;color:var(--luma-muted);font-size:var(--luma-text-sm);white-space:nowrap}.btn{display:grid;place-items:center;width:34px;height:34px;padding:0;border:1px solid color-mix(in srgb,var(--tone) 12%,transparent);border-radius:12px;color:var(--primary-text-color);background:color-mix(in srgb,var(--tone) 7%,transparent)}.btn ha-icon{--mdc-icon-size:17px}.btn.confirm{color:var(--tone);background:color-mix(in srgb,var(--tone) 18%,transparent)}.bar{grid-area:bar;height:7px;margin-top:2px;border-radius:999px;overflow:hidden;background:color-mix(in srgb,var(--primary-text-color) 9%,transparent)}.fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--tone),var(--primary-color));transition:width .2s ease}
    @media(max-width:480px){ha-card:not(.compact){grid-template-columns:auto minmax(0,1fr) auto auto auto;grid-template-areas:"icon title open stop close" "meta meta meta meta meta" "bar bar bar bar bar";gap:8px;padding:14px}.meta{font-size:10px}.btn{width:31px;height:31px}}
  `];
  setConfig(c:Config){if(!c?.entity)throw Error("entity required");this.config={variant:"group",...c}}
  getCardSize(){return this.config?.variant==="compact"?1:2}
  private async act(id:string,service:string,confirm=false){if(confirm&&this.pending!==id){this.pending=id;clearTimeout(this.timer);this.timer=window.setTimeout(()=>this.pending="",3000);return}this.pending="";await this.hass?.callService("cover",service,undefined,{entity_id:this.config!.entity})}
  render(){if(!this.hass||!this.config)return nothing;const e=this.hass.states[this.config.entity];if(!e)return nothing;const s=e.state,p=Math.max(0,Math.min(100,Number(e.attributes.current_position)||0)),tone=s==="opening"?"var(--success-color)":s==="closing"?"var(--warning-color)":"var(--info-color,var(--primary-color))",count=this.config.open_count_entity?this.hass.states[this.config.open_count_entity]?.state:undefined,meta=`${labels[s]||s} • ${p}%${count!==undefined?` • ${count} nyitva`:""}`,b=(id:string,icon:string,service:string,confirm=false)=>html`<button class=${`btn ${this.pending===id?"confirm":""}`} @click=${()=>this.act(id,service,confirm)}><ha-icon icon=${this.pending===id?"mdi:check":icon}></ha-icon></button>`;return html`<ha-card class=${this.config.variant||"group"} style=${`--tone:${tone};--mix:${p>0?"8%":"3%"}`}><span class="icon"><ha-icon icon=${this.config.icon||"mdi:window-shutter"}></ha-icon></span><span class="title">${this.config.name||entityName(e,this.config.entity)}</span><span class="meta">${meta}</span>${b("open","mdi:arrow-up","open_cover",this.config.confirm_open)}${b("stop","mdi:stop","stop_cover")}${b("close","mdi:arrow-down","close_cover",this.config.confirm_close)}<div class="bar"><div class="fill" style=${`width:${p}%`}></div></div></ha-card>`}
}
