import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { runAction } from "../helpers";
import { localized } from "../localize";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LumaAction, LovelaceCard } from "../types";

interface Config { type:string; name?:string; icon?:string; tap_action?:LumaAction }

@customElement("luma-homelab-hero-card")
export class LumaHomelabHeroCard extends LitElement implements LovelaceCard {
  @property({attribute:false}) hass?:HomeAssistant;
  @state() private config?:Config;
  static styles=[lumaTokens,css`
    ha-card{display:grid;grid-template-columns:58px minmax(0,1fr) auto;grid-template-areas:"icon title badge" "icon subtitle badge";align-items:center;gap:4px 17px;padding:25px;border:1px solid color-mix(in srgb,var(--tone) 22%,transparent);border-radius:24px;background:linear-gradient(135deg,color-mix(in srgb,var(--tone) 14%,var(--luma-surface)),var(--luma-surface) 62%);box-shadow:0 18px 50px rgba(0,0,0,.075);transition:.18s ease}ha-card:hover{transform:translateY(-2px);box-shadow:0 22px 56px color-mix(in srgb,var(--tone) 12%,transparent)}
    .icon{grid-area:icon;display:grid;place-items:center;width:58px;height:58px;border-radius:19px;color:var(--tone);background:color-mix(in srgb,var(--tone) 15%,transparent)}.icon ha-icon{--mdc-icon-size:30px}.title{grid-area:title;align-self:end;font-size:clamp(21px,4vw,27px);font-weight:740;letter-spacing:-.035em}.subtitle{grid-area:subtitle;align-self:start;color:var(--luma-muted);font-size:12px}.badge{grid-area:badge;padding:7px 11px;border-radius:999px;color:var(--tone);background:color-mix(in srgb,var(--tone) 13%,transparent);font-size:11px;font-weight:720;white-space:nowrap}
    @media(max-width:600px){ha-card{grid-template-columns:50px minmax(0,1fr);grid-template-areas:"icon title" "icon subtitle" "badge badge";padding:19px}.icon{width:50px;height:50px;border-radius:16px}.badge{justify-self:start;margin-top:10px}.subtitle{white-space:normal}}
  `];
  setConfig(config:Config){this.config=config}
  getCardSize(){return 2}
  private summary(){
    const states=this.hass?.states||{},ids=Object.keys(states);
    const urls=ids.filter(id=>id.startsWith("sensor.")&&id.endsWith("_felugyelt_url"));
    const kuma=urls.map(id=>id.replace("_felugyelt_url","_allapot")).filter(id=>states[id]&&String(states[id].state).toLowerCase()!=="up").length;
    const komodo=ids.filter(id=>/^sensor\..*_alerts$/.test(id)&&!["","0","unknown","unavailable","none"].includes(String(states[id].state).toLowerCase())).length;
    const critical=["binary_sensor.tower_array_started","binary_sensor.tower_parity_valid","binary_sensor.tower_disks_missing"].filter((id,index)=>states[id]&&((index===0&&states[id].state!=="on")||(index>0&&states[id].state==="on"))).length;
    const warning=ids.filter(id=>/^sensor\.tower_disk_.*_usage$/.test(id)&&Number(states[id].state)>=80).length+(Number(states["sensor.tower_cpu_temperature"]?.state)>=80?1:0)+(Number(states["sensor.tower_ram_usage"]?.state)>=90?1:0);
    const total=kuma+komodo+critical+warning,parts=[] as string[];
    if(kuma)parts.push(`${kuma} Kuma`);if(komodo)parts.push(`${komodo} Komodo`);if(critical+warning)parts.push(`${critical+warning} ${localized(this.hass,"infrastructure","infrastruktúra")}`);
    return{total,tone:kuma+critical>0?"var(--error-color)":total>0?"var(--warning-color)":"var(--success-color)",subtitle:total?`${parts.join(" · ")} ${localized(this.hass,"need attention","figyelmet kér")}`:`${urls.length} ${localized(this.hass,"services monitored · all systems operational","szolgáltatás felügyelve · minden rendszer működik")}`};
  }
  render(){if(!this.hass||!this.config)return nothing;const status=this.summary();return html`<ha-card class="interactive" style=${`--tone:${status.tone}`} @click=${()=>runAction(this,this.hass!,this.config?.tap_action)}><span class="icon"><ha-icon icon=${this.config.icon||"mdi:server-security"}></ha-icon></span><span class="title">${this.config.name||"Homelab Control Center"}</span><span class="subtitle">${status.subtitle}</span><span class="badge">${status.total?`${status.total} ${localized(this.hass,"incidents","incidens")}`:localized(this.hass,"ALL GOOD","RENDBEN")}</span></ha-card>`}
}
