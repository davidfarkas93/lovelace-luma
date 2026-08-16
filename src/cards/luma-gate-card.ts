import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { runAction } from "../helpers";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LovelaceCard } from "../types";

interface Config {
  type:string;
  entity:string;
  state_entity?:string;
  pedestrian_entity?:string;
  name?:string;
  kind?:"cover"|"switch";
}

const stateLabels:Record<string,string>={
  open:"Nyitva",opening:"Nyílik",closed:"Zárva",closing:"Záródik",
  on:"Nyitva",off:"Zárva",unavailable:"Nem elérhető",unknown:"Ismeretlen",
};

@customElement("luma-gate-card")
export class LumaGateCard extends LitElement implements LovelaceCard {
  @property({attribute:false}) hass?:HomeAssistant;
  @state() private config?:Config;
  @state() private pending="";
  private timer?:number;

  static styles=[lumaTokens,css`
    ha-card{--tone:var(--secondary-text-color);display:grid;gap:13px;padding:15px;border:1px solid color-mix(in srgb,var(--tone) 15%,transparent);border-radius:21px;background:linear-gradient(145deg,color-mix(in srgb,var(--tone) 8%,var(--luma-surface)),color-mix(in srgb,var(--tone) 2%,var(--luma-surface)) 65%,var(--luma-surface));box-shadow:0 14px 38px color-mix(in srgb,var(--tone) 7%,transparent)}
    .summary{display:grid;grid-template-columns:46px minmax(0,1fr) auto;align-items:center;gap:12px;padding:0;border:0;color:inherit;background:transparent;font:inherit;text-align:left}
    .icon{display:grid;place-items:center;width:46px;height:46px;border-radius:15px;color:var(--tone);background:color-mix(in srgb,var(--tone) 15%,transparent)}
    .icon ha-icon{--mdc-icon-size:24px}.copy{min-width:0}.title{font-size:var(--luma-text-md);font-weight:var(--luma-weight-title)}.hint{margin-top:3px;color:var(--luma-muted);font-size:var(--luma-text-xs)}
    .status{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border-radius:999px;color:var(--tone);background:color-mix(in srgb,var(--tone) 12%,transparent);font-size:10px;font-weight:750;white-space:nowrap}.dot{width:6px;height:6px;border-radius:50%;background:currentColor}
    .actions{display:flex;gap:8px;padding:5px;border-radius:999px;background:color-mix(in srgb,var(--primary-text-color) 4.5%,transparent)}
    .action{display:inline-flex;flex:1;align-items:center;justify-content:center;gap:7px;min-width:0;min-height:40px;padding:0 14px;border:0;border-radius:999px;color:var(--primary-text-color);background:transparent;font:inherit;font-size:var(--luma-text-sm);font-weight:var(--luma-weight-strong);transition:transform .16s ease,background .16s ease,color .16s ease}
    .action ha-icon{--mdc-icon-size:18px}.action:hover{transform:translateY(-1px);background:color-mix(in srgb,var(--primary-text-color) 6%,transparent)}
    .action.primary{color:var(--tone);background:color-mix(in srgb,var(--tone) 13%,transparent)}.action.confirm{color:var(--warning-color);background:color-mix(in srgb,var(--warning-color) 16%,transparent)}
    @media(max-width:420px){ha-card{padding:13px}.summary{grid-template-columns:42px minmax(0,1fr) auto;gap:10px}.icon{width:42px;height:42px;border-radius:14px}.actions{gap:5px}.action{padding:0 10px;font-size:12px}.action ha-icon{--mdc-icon-size:17px}}
  `];

  setConfig(c:Config){if(!c?.entity)throw Error("entity required");this.config=c}
  getCardSize(){return 2}

  private async act(id:string,domain:string,service:string,target:string){
    if(this.pending!==id){
      this.pending=id;
      clearTimeout(this.timer);
      this.timer=window.setTimeout(()=>this.pending="",3200);
      return;
    }
    this.pending="";
    await this.hass?.callService(domain,service,undefined,{entity_id:target});
  }

  render(){
    if(!this.hass||!this.config)return nothing;
    const c=this.config,e=this.hass.states[c.state_entity||c.entity],s=e?.state||"unavailable";
    const cover=(c.kind||"cover")==="cover";
    const open=["open","opening","on"].includes(s),moving=["opening","closing"].includes(s);
    const tone=moving?"var(--primary-color)":open?"var(--warning-color)":"var(--success-color)";
    const icon=cover?(open?"mdi:gate-open":"mdi:gate"):(open?"mdi:garage-open":"mdi:garage");
    const primary=moving
      ? {id:"stop",label:"Stop",icon:"mdi:stop",domain:"cover",service:"stop_cover"}
      : cover
        ? open
          ? {id:"close",label:"Zárás",icon:"mdi:gate",domain:"cover",service:"close_cover"}
          : {id:"open",label:"Nyitás",icon:"mdi:gate-open",domain:"cover",service:"open_cover"}
        : {id:"toggle",label:open?"Zárás":"Nyitás",icon:open?"mdi:garage":"mdi:garage-open",domain:"switch",service:"toggle"};
    const button=(id:string,label:string,buttonIcon:string,domain:string,service:string,target=c.entity,primaryButton=false)=>{
      const confirming=this.pending===id;
      return html`<button class=${`action ${primaryButton?"primary":""} ${confirming?"confirm":""}`} @click=${()=>this.act(id,domain,service,target)}><ha-icon icon=${confirming?"mdi:check":buttonIcon}></ha-icon><span>${confirming?"Megerősítés":label}</span></button>`;
    };
    return html`<ha-card style=${`--tone:${tone}`}>
      <button class="summary" @click=${()=>runAction(this,this.hass!,{action:"more-info"},c.state_entity||c.entity)}>
        <span class="icon"><ha-icon icon=${icon}></ha-icon></span>
        <span class="copy"><span class="title">${c.name||"Kapu"}</span><span class="hint">Koppints az állapot részleteihez</span></span>
        <span class="status"><span class="dot"></span>${stateLabels[s]||s}</span>
      </button>
      <div class="actions">
        ${button(primary.id,primary.label,primary.icon,primary.domain,primary.service,c.entity,true)}
        ${c.pedestrian_entity?button("walk","Gyalogos","mdi:walk","button","press",c.pedestrian_entity):nothing}
      </div>
    </ha-card>`;
  }
}
