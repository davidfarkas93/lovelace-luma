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
  display?:"full"|"popover";
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
  @state() private popoverOpen=false;
  private timer?:number;
  private readonly reposition=()=>this.positionPopover();

  static styles=[lumaTokens,css`
    :host{display:block}ha-card{--tone:var(--secondary-text-color);display:grid;gap:13px;padding:15px;border:1px solid color-mix(in srgb,var(--tone) 15%,transparent);border-radius:21px;background:linear-gradient(145deg,color-mix(in srgb,var(--tone) 8%,var(--luma-surface)),color-mix(in srgb,var(--tone) 2%,var(--luma-surface)) 65%,var(--luma-surface));box-shadow:0 14px 38px color-mix(in srgb,var(--tone) 7%,transparent)}
    .summary{display:grid;grid-template-columns:46px minmax(0,1fr) auto;align-items:center;gap:12px;padding:0;border:0;color:inherit;background:transparent;font:inherit;text-align:left}
    .icon{display:grid;place-items:center;width:46px;height:46px;border-radius:15px;color:var(--tone);background:color-mix(in srgb,var(--tone) 15%,transparent)}
    .icon ha-icon{--mdc-icon-size:24px}.copy{display:block;min-width:0}.title{display:block;font-size:var(--luma-text-md);font-weight:var(--luma-weight-title)}.hint{display:block;margin-top:3px;color:var(--luma-muted);font-size:var(--luma-text-xs)}
    .status{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border-radius:999px;color:var(--tone);background:color-mix(in srgb,var(--tone) 12%,transparent);font-size:10px;font-weight:750;white-space:nowrap}.dot{width:6px;height:6px;border-radius:50%;background:currentColor}
    .actions{display:flex;gap:8px;padding:5px;border-radius:999px;background:color-mix(in srgb,var(--primary-text-color) 4.5%,transparent)}
    .action{display:inline-flex;flex:1;align-items:center;justify-content:center;gap:7px;min-width:0;min-height:40px;padding:0 14px;border:0;border-radius:999px;color:var(--primary-text-color);background:transparent;font:inherit;font-size:var(--luma-text-sm);font-weight:var(--luma-weight-strong);transition:transform .16s ease,background .16s ease,color .16s ease}
    .action ha-icon{--mdc-icon-size:18px}.action:hover{transform:translateY(-1px);background:color-mix(in srgb,var(--primary-text-color) 6%,transparent)}
    .action.primary{color:var(--tone);background:color-mix(in srgb,var(--tone) 13%,transparent)}.action.confirm{color:var(--warning-color);background:color-mix(in srgb,var(--warning-color) 16%,transparent)}
    ha-card.compact{display:block;padding:0;overflow:hidden;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}.compact:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--tone) 28%,transparent);box-shadow:0 17px 40px color-mix(in srgb,var(--tone) 14%,transparent)}
    .compact .summary{width:100%;grid-template-columns:46px minmax(0,1fr) auto;padding:16px;box-sizing:border-box;cursor:pointer}.compact .hint{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.compact .status{margin-left:3px}
    .scrim{position:fixed;inset:0;z-index:998;background:transparent;border:0;padding:0;cursor:default}.popover{position:fixed;z-index:999;display:grid;gap:13px;width:min(360px,calc(100vw - 24px));padding:15px;box-sizing:border-box;border:1px solid color-mix(in srgb,var(--tone) 22%,transparent);border-radius:22px;background:color-mix(in srgb,var(--luma-surface) 94%,transparent);box-shadow:0 24px 70px rgba(0,0,0,.22),0 4px 16px color-mix(in srgb,var(--tone) 10%,transparent);backdrop-filter:blur(22px) saturate(1.25);animation:appear .18s cubic-bezier(.2,.8,.2,1);transform-origin:top center}
    .popover-head{display:grid;grid-template-columns:38px minmax(0,1fr) 34px;align-items:center;gap:10px}.popover-head .icon{width:38px;height:38px;border-radius:13px}.popover-head .icon ha-icon{--mdc-icon-size:20px}.popover-title{font-size:var(--luma-text-md);font-weight:var(--luma-weight-title)}.popover-state{margin-top:2px;color:var(--tone);font-size:var(--luma-text-xs);font-weight:680}.close{display:grid;place-items:center;width:34px;height:34px;padding:0;border:0;border-radius:50%;color:var(--luma-muted);background:color-mix(in srgb,var(--primary-text-color) 5%,transparent);cursor:pointer}.close ha-icon{--mdc-icon-size:18px}
    .popover .actions{padding:5px}.popover .action{cursor:pointer}.popover .primary{min-height:44px;color:#fff;background:var(--tone)}.popover .primary:hover{background:color-mix(in srgb,var(--tone) 86%,#000)}.popover .action:disabled{opacity:.42;pointer-events:none}.details{border:0;background:transparent;color:var(--luma-muted);font:inherit;font-size:11px;font-weight:650;cursor:pointer}
    @keyframes appear{from{opacity:0;transform:translateY(-5px) scale(.97)}to{opacity:1;transform:none}}
    @media(max-width:420px){ha-card{padding:13px}.summary{grid-template-columns:42px minmax(0,1fr) auto;gap:10px}.icon{width:42px;height:42px;border-radius:14px}.actions{gap:5px}.action{padding:0 10px;font-size:12px}.action ha-icon{--mdc-icon-size:17px}}
    @media(max-width:420px){.compact .summary{grid-template-columns:42px minmax(0,1fr) auto;padding:13px}.popover{padding:13px}.popover .actions{display:grid;grid-template-columns:minmax(0,1fr) auto}.popover .action{padding:0 12px}}
    @media(prefers-reduced-motion:reduce){ha-card,.action,.popover{animation:none;transition:none}}
  `];

  setConfig(c:Config){if(!c?.entity)throw Error("entity required");this.config=c}
  getCardSize(){return 2}

  disconnectedCallback(){super.disconnectedCallback();this.detachPopoverListeners()}

  private toggleActionPopover(){
    this.popoverOpen=!this.popoverOpen;
    if(this.popoverOpen){
      window.addEventListener("resize",this.reposition);
      window.addEventListener("scroll",this.reposition,true);
      void this.updateComplete.then(()=>this.positionPopover());
    }else this.detachPopoverListeners();
  }
  private detachPopoverListeners(){window.removeEventListener("resize",this.reposition);window.removeEventListener("scroll",this.reposition,true)}
  private positionPopover(){
    if(!this.popoverOpen)return;
    const anchor=this.renderRoot.querySelector<HTMLElement>("ha-card.compact"),popover=this.renderRoot.querySelector<HTMLElement>(".popover");
    if(!anchor||!popover)return;
    const rect=anchor.getBoundingClientRect(),gap=8,pad=12,width=Math.min(Math.max(rect.width,300),window.innerWidth-pad*2);
    const left=Math.min(Math.max(rect.left,pad),window.innerWidth-width-pad);
    const below=rect.bottom+gap,top=below+popover.offsetHeight<=window.innerHeight-pad?below:Math.max(pad,rect.top-popover.offsetHeight-gap);
    Object.assign(popover.style,{left:`${left}px`,top:`${top}px`,width:`${width}px`});
  }

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

  private async execute(domain:string,service:string,target:string){
    this.popoverOpen=false;this.detachPopoverListeners();
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
    const unavailable=!e||["unknown","unavailable"].includes(s);
    const button=(id:string,label:string,buttonIcon:string,domain:string,service:string,target=c.entity,primaryButton=false,direct=false)=>{
      const confirming=this.pending===id;
      return html`<button class=${`action ${primaryButton?"primary":""} ${confirming?"confirm":""}`} ?disabled=${unavailable} @click=${()=>direct?this.execute(domain,service,target):this.act(id,domain,service,target)}><ha-icon icon=${confirming?"mdi:check":buttonIcon}></ha-icon><span>${confirming?"Megerősítés":label}</span></button>`;
    };
    if(c.display==="popover")return html`
      <ha-card class="compact" style=${`--tone:${tone}`}>
        <button class="summary" aria-haspopup="dialog" aria-expanded=${this.popoverOpen} @click=${()=>this.toggleActionPopover()}>
          <span class="icon"><ha-icon icon=${icon}></ha-icon></span>
          <span class="copy"><span class="title">${c.name||"Kapu"}</span><span class="hint">${moving?"Mozgásban · koppints a vezérléshez":"Koppints a vezérléshez"}</span></span>
          <span class="status"><span class="dot"></span>${stateLabels[s]||s}</span>
        </button>
      </ha-card>
      ${this.popoverOpen?html`<button class="scrim" aria-label="Bezárás" @click=${()=>this.toggleActionPopover()}></button><section class="popover" style=${`--tone:${tone}`} role="dialog" aria-label=${`${c.name||"Kapu"} vezérlés`}>
        <div class="popover-head"><span class="icon"><ha-icon icon=${icon}></ha-icon></span><div><div class="popover-title">${c.name||"Kapu"}</div><div class="popover-state">${stateLabels[s]||s}</div></div><button class="close" aria-label="Bezárás" @click=${()=>this.toggleActionPopover()}><ha-icon icon="mdi:close"></ha-icon></button></div>
        <div class="actions">${button(primary.id,moving?"Megállítás":`${primary.label} megerősítése`,primary.icon,primary.domain,primary.service,c.entity,true,true)}${c.pedestrian_entity?button("walk","Gyalogos","mdi:walk","button","press",c.pedestrian_entity,false,true):nothing}</div>
        <button class="details" @click=${()=>runAction(this,this.hass!,{action:"more-info"},c.state_entity||c.entity)}>Állapot és előzmények</button>
      </section>`:nothing}`;
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
