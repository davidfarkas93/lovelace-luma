import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { entityIcon, entityState, itemIsVisible, relevantEntityIds, runAction } from "../helpers";
import { localized } from "../localize";
import { lumaTokens, lumaInteractionStyles } from "../styles";
import type { HomeAssistant, LumaAction, LumaEntityItem, LovelaceCard } from "../types";

interface Config {
  type:string;
  name:string;
  icon:string;
  path?:string;
  subtitle?:string;
  temperature_entity?:string;
  humidity_entity?:string;
  light_entity?:string;
  cover_entity?:string;
  items?:LumaEntityItem[];
  accent_color?:string;
  tap_action?:LumaAction;
}

@customElement("luma-room-card")
export class LumaRoomCard extends LitElement implements LovelaceCard {
  @property({attribute:false}) hass?:HomeAssistant;
  @state() private config?:Config;

  static styles=[lumaTokens,lumaInteractionStyles,css`
    .card{min-height:118px;padding:15px;border:1px solid color-mix(in srgb,var(--accent) 15%,transparent);border-radius:20px;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 12%,var(--luma-surface)),color-mix(in srgb,var(--accent) 5%,var(--luma-surface)) 48%,var(--luma-surface));box-shadow:0 14px 34px color-mix(in srgb,var(--accent) 8%,transparent);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}.card:has(.top.interactive:hover){transform:translateY(-2px);border-color:color-mix(in srgb,var(--accent) 25%,transparent);box-shadow:0 18px 42px color-mix(in srgb,var(--accent) 12%,transparent)}
    .top{width:100%;padding:0;border:0;background:transparent;text-align:left;border-radius:var(--luma-radius-control);display:grid;grid-template-columns:44px minmax(0,1fr) 17px;align-items:center;gap:11px}.icon{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;color:var(--tone);background:color-mix(in srgb,var(--tone) 15%,transparent)}.icon ha-icon{--mdc-icon-size:23px}.name{font-size:14px;font-weight:700;line-height:1.15}.env{margin-top:4px;color:var(--luma-muted);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.arrow{color:color-mix(in srgb,var(--primary-text-color) 38%,transparent);--mdc-icon-size:17px}
    .pills{display:flex;flex-wrap:wrap;gap:6px;margin-top:13px}.pill{display:inline-flex;align-items:center;gap:5px;min-width:0;padding:6px 8px;border:0;border-radius:999px;color:var(--pill-color);background:color-mix(in srgb,var(--pill-color) 12%,transparent);font:inherit;font-size:10px;font-weight:700;line-height:1;white-space:nowrap}.pill-control{min-height:44px;white-space:normal;flex-wrap:wrap;border:1px solid var(--luma-border);border-radius:var(--luma-radius-control);background:color-mix(in srgb,var(--primary-text-color) 4%,var(--luma-surface))}.pill-control:hover{border-color:var(--pill-color)}.pill-status{padding:4px 0;background:transparent}.pill-control .pill-state{max-width:none;overflow:visible;white-space:normal}.pill ha-icon{--mdc-icon-size:13px}.pill-state{max-width:92px;overflow:hidden;text-overflow:ellipsis}.empty{color:var(--luma-muted);font-size:10px;font-weight:650}
    @media(max-width:420px){.card{padding:14px}.pill{padding:6px 7px}.pill-state{max-width:72px}}
  `];

  setConfig(c:Config){if(!c?.name||!c?.icon)throw new Error("Luma room requires a name and icon.");this.config={items:[],...c}}
  getCardSize(){return 2}
  protected shouldUpdate(changed:PropertyValues<this>){if(!changed.has("hass"))return true;const old=changed.get("hass")as HomeAssistant|undefined;if(!old||old.locale?.language!==this.hass?.locale?.language)return true;return this.ids.some(id=>old.states[id]!==this.hass?.states[id])}
  private get ids(){if(!this.config)return[];const legacy=[this.config.temperature_entity,this.config.humidity_entity,this.config.light_entity,this.config.cover_entity].filter(Boolean)as string[];const l=this.hass?.states[this.config.light_entity||""];const children=(l?.attributes.group_entities||l?.attributes.entity_id||[])as string[];return[...legacy,...relevantEntityIds(this.config.items),...children]}
  private number(id?:string){const value=Number(id?this.hass?.states[id]?.state:NaN);return Number.isFinite(value)?value:null}
  private legacyItems(c:Config):LumaEntityItem[]{const out:LumaEntityItem[]=[];if(c.light_entity)out.push({entity:c.light_entity,name:localized(this.hass,"Light","Fény"),icon:"mdi:lightbulb-outline",show_state:true,tap_action:{action:"toggle"}});if(c.cover_entity)out.push({entity:c.cover_entity,name:localized(this.hass,"Cover","Redőny"),icon:"mdi:window-shutter",show_state:true,tap_action:{action:"more-info"}});return out}
  private active(item:LumaEntityItem){const e=this.hass?.states[item.entity],domain=item.entity.split(".")[0];if(!e)return false;if(domain==="cover")return !["closed","unavailable","unknown"].includes(e.state);if(domain==="media_player")return !["off","idle","standby","unavailable","unknown"].includes(e.state);if(domain==="climate")return !["off","unavailable","unknown"].includes(e.state)&&e.attributes.restored!==true&&["heating","cooling","drying","fan","defrosting"].includes(String(e.attributes.hvac_action));return ["on","open","opening","playing","heat","cool"].includes(e.state)}
  private tone(item:LumaEntityItem,active:boolean){if(item.color)return item.color;const domain=item.entity.split(".")[0];if(!active)return "var(--secondary-text-color)";if(domain==="light")return "var(--warning-color)";if(domain==="fan")return "var(--success-color)";if(domain==="cover")return "var(--info-color,var(--primary-color))";if(domain==="media_player")return "#7c78d8";return "var(--primary-color)"}

  render(){
    if(!this.hass||!this.config)return nothing;
    const c=this.config,t=this.number(c.temperature_entity),h=this.number(c.humidity_entity);
    const environment=c.subtitle||[t==null?"":`${t.toFixed(1)}°C`,h==null?"":`${Math.round(h)}% ${localized(this.hass,"humidity","pára")}`].filter(Boolean).join(" · ")||localized(this.hass,"Details and controls","Részletek és vezérlés");
    const items=[...(c.items||[]),...((c.items?.length||0)?[]:this.legacyItems(c))].filter(item=>itemIsVisible(this.hass!,item));
    const anyActive=items.some(item=>this.active(item));
    const tone=anyActive?"var(--primary-color)":"var(--secondary-text-color)";
    const action=c.tap_action||(c.path?{action:"navigate",navigation_path:c.path}as LumaAction:undefined);
    const interactive=action && action.action!=="none";
    const summary=html`<span class="icon"><ha-icon icon=${c.icon}></ha-icon></span><span><span class="name">${c.name}</span><span class="env" style="display:block">${environment}</span></span>${interactive?html`<ha-icon class="arrow" aria-hidden="true" icon=${["navigate","url","more-info"].includes(action.action)?"mdi:chevron-right":"mdi:gesture-tap"}></ha-icon>`:nothing}`;
    return html`<ha-card class="card" style=${`--accent:${c.accent_color||"var(--primary-color)"};--tone:${tone}`}>
      ${interactive?html`<button class="top interactive" @click=${()=>runAction(this,this.hass!,action)}>${summary}</button>`:html`<div class="top">${summary}</div>`}
      <div class="pills">${items.length?items.map(item=>{
        const e=this.hass!.states[item.entity],active=this.active(item),tone=this.tone(item,active),itemAction=item.tap_action||{action:"more-info"} as LumaAction;
        const content=html`<ha-icon aria-hidden="true" icon=${item.icon||entityIcon(e)}></ha-icon><span>${item.name||localized(this.hass,"Status","Állapot")}</span>${item.show_state!==false?html`<span class="pill-state">${entityState(this.hass!,e,item.state_map)}</span>`:nothing}`;
        return itemAction.action==="none"?html`<span class="pill pill-status" style=${`--pill-color:${tone}`}>${content}</span>`:html`<button class="pill pill-control" aria-pressed=${itemAction.action==="toggle"?String(active):nothing} style=${`--pill-color:${tone}`} @click=${()=>runAction(this,this.hass!,itemAction,item.entity)}>${content}<ha-icon class="action-cue" aria-hidden="true" icon=${["more-info","navigate","url"].includes(itemAction.action)?"mdi:chevron-right":"mdi:gesture-tap"}></ha-icon></button>`;
      }):html`<span class="empty">${localized(this.hass,"No active quick controls","Nincs aktív gyorsvezérlő")}</span>`}</div>
    </ha-card>`;
  }
}
