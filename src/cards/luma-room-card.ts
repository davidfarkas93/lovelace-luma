import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { entityIcon, itemIsVisible, relevantEntityIds, runAction } from "../helpers";
import { localized } from "../localize";
import { lumaTokens, lumaInteractionStyles, lumaSurfaceStyles } from "../styles";
import type { HomeAssistant, LumaAction, LumaEntityItem, LovelaceCard } from "../types";

import {entityAvailable,entityMeasurement,formatNumber,presentedState} from "../presentation";

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
    :host{display:grid;height:100%;min-width:0;container-type:inline-size}
    .card{display:flex;flex-direction:column;min-height:118px;padding:15px;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
    .top{width:100%;padding:0;border:0;background:transparent;text-align:left;border-radius:var(--luma-radius-control);display:grid;grid-template-columns:44px minmax(0,1fr) 17px;align-items:center;gap:11px}.icon{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,transparent)}.icon ha-icon{--mdc-icon-size:23px}.name{font-size:14px;font-weight:700;line-height:1.15}.env{margin-top:4px;color:var(--luma-muted);font-size:11px;white-space:normal;overflow-wrap:anywhere}.arrow{color:color-mix(in srgb,var(--primary-text-color) 38%,transparent);--mdc-icon-size:17px}
    .pills{display:flex;flex-wrap:wrap;gap:6px;margin-top:auto;padding-top:13px}.pill{display:inline-flex;align-items:center;gap:5px;min-width:0;padding:6px 8px;border:0;border-radius:999px;color:var(--pill-color);background:color-mix(in srgb,var(--pill-color) 12%,transparent);font:inherit;font-size:10px;font-weight:700;line-height:1;white-space:nowrap}.pill-control{min-height:44px;white-space:normal;flex-wrap:wrap;border:1px solid var(--luma-border);border-radius:var(--luma-radius-control);background:color-mix(in srgb,var(--primary-text-color) 4%,var(--luma-surface))}.pill-control:hover{border-color:var(--pill-color)}.pill-status{padding:4px 0;background:transparent}.pill-control .pill-state{max-width:none;overflow:visible;white-space:normal}.pill ha-icon{--mdc-icon-size:13px}.pill-state{max-width:92px;overflow:hidden;text-overflow:ellipsis}.empty{color:var(--luma-muted);font-size:10px;font-weight:650}
    @media(max-width:420px){.card{padding:14px}.pill{padding:6px 7px}.pill-state{max-width:72px}}
    @container(max-width:240px){
      .card{padding:12px}.top{grid-template-columns:34px minmax(0,1fr) 14px;gap:8px;min-height:64px;align-content:start}.icon{width:34px;height:34px;border-radius:11px}.icon ha-icon{--mdc-icon-size:20px}.room-copy{display:contents}.name{font-size:13px;line-height:1.3;overflow-wrap:anywhere}.env{grid-column:1/-1;grid-row:2;margin-top:0;line-height:1.4}.arrow{grid-column:3;grid-row:1;--mdc-icon-size:14px}
      .pills{display:grid;grid-template-columns:minmax(0,1fr);gap:6px;padding-top:10px}.pill-control{width:100%;display:flex;flex-wrap:nowrap;gap:7px;padding:8px;min-height:44px;text-align:left}.pill-control .pill-state{font-size:11px;line-height:1.3;min-width:0;overflow-wrap:anywhere}.pill-control ha-icon{flex-shrink:0}.pill-control .action-cue{margin-left:auto}.pill-control[aria-pressed]::after{margin-left:auto;flex-shrink:0}.legacy .control-name{display:none}.pill-control:not(.legacy){flex-wrap:wrap}
    }
  `,lumaSurfaceStyles,css`ha-card {background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 11%,var(--luma-surface)),color-mix(in srgb,var(--accent) 3%,var(--luma-surface)));}`];

  setConfig(c:Config){if(!c?.name||!c?.icon)throw new Error("Luma room requires a name and icon.");this.config={items:[],...c}}
  getCardSize(){return 2}
  protected shouldUpdate(changed:PropertyValues<this>){if([...changed.keys()].some(key=>key!=="hass"))return true;const old=changed.get("hass")as HomeAssistant|undefined;if(!old||old.locale!==this.hass?.locale)return true;return this.ids.some(id=>old.states[id]!==this.hass?.states[id])}
  private get ids(){if(!this.config)return[];const legacy=[this.config.temperature_entity,this.config.humidity_entity,this.config.light_entity,this.config.cover_entity].filter(Boolean)as string[];const l=this.hass?.states[this.config.light_entity||""];const children=(l?.attributes.group_entities||l?.attributes.entity_id||[])as string[];return[...legacy,...relevantEntityIds(this.config.items),...children]}
  private number(id?:string){return entityMeasurement(id?this.hass?.states[id]:undefined)}
  private legacyItems(c:Config):LumaEntityItem[]{const out:LumaEntityItem[]=[];if(c.light_entity)out.push({entity:c.light_entity,name:localized(this.hass,"Light","Fény"),icon:"mdi:lightbulb-outline",show_state:true,tap_action:{action:"toggle"}});if(c.cover_entity)out.push({entity:c.cover_entity,name:localized(this.hass,"Cover","Redőny"),icon:"mdi:window-shutter",show_state:true,tap_action:{action:"more-info"}});return out}
  private active(item:LumaEntityItem){const e=this.hass?.states[item.entity],domain=item.entity.split(".")[0];if(!entityAvailable(e))return false;if(domain==="cover")return !["closed","unavailable","unknown"].includes(e.state);if(domain==="media_player")return !["off","idle","standby","unavailable","unknown"].includes(e.state);if(domain==="climate")return !["off","unavailable","unknown"].includes(e.state)&&e.attributes.restored!==true&&["heating","cooling","drying","fan","defrosting"].includes(String(e.attributes.hvac_action));return ["on","open","opening","playing","heat","cool"].includes(e.state)}
  private tone(item:LumaEntityItem,active:boolean){
    if(item.color)return item.color;
    if(!active)return "var(--luma-state-neutral)";
    // A stationary open cover is a normal position, not an active process.
    if(item.entity.startsWith("cover.")&&!["opening","closing"].includes(this.hass?.states[item.entity]?.state||""))return "var(--luma-state-neutral)";
    return "var(--luma-state-active)";
  }

  render(){
    if(!this.hass||!this.config)return nothing;
    const c=this.config,t=this.number(c.temperature_entity),h=this.number(c.humidity_entity);
    const environment=c.subtitle||[t==null?(c.temperature_entity?localized(this.hass,"Temperature: no data","Hőmérséklet: nincs adat"):""):`${formatNumber(this.hass,t,1)} ${this.hass.states[c.temperature_entity!]?.attributes.unit_of_measurement||"°C"}`,h==null?(c.humidity_entity?localized(this.hass,"Humidity: no data","Páratartalom: nincs adat"):""):`${formatNumber(this.hass,h,0)}%`].filter(Boolean).join(" · ")||localized(this.hass,"Details and controls","Részletek és vezérlés");
    const items=[...(c.items||[]),...((c.items?.length||0)?[]:this.legacyItems(c))].filter(item=>itemIsVisible(this.hass!,item));
    const action=c.tap_action||(c.path?{action:"navigate",navigation_path:c.path}as LumaAction:undefined);
    const interactive=action && action.action!=="none";
    const summary=html`<span class="icon"><ha-icon icon=${c.icon}></ha-icon></span><span class="room-copy"><span class="name">${c.name}</span><span class="env" style="display:block">${environment}</span></span>${interactive?html`<ha-icon class="arrow" aria-hidden="true" icon=${["navigate","url","more-info"].includes(action.action)?"mdi:chevron-right":"mdi:gesture-tap"}></ha-icon>`:nothing}`;
    return html`<ha-card class="card" style=${`--accent:${c.accent_color||"var(--primary-color)"}`}>
      ${interactive?html`<button class="top interactive" @click=${()=>runAction(this,this.hass!,action)}>${summary}</button>`:html`<div class="top">${summary}</div>`}
      <div class="pills">${items.length?items.map(item=>{
        const e=this.hass!.states[item.entity],active=this.active(item),tone=this.tone(item,active),itemAction=item.tap_action||{action:"more-info"} as LumaAction;
        const content=html`<ha-icon aria-hidden="true" icon=${item.icon||entityIcon(e)}></ha-icon><span class="control-name">${item.name||localized(this.hass,"Status","Állapot")}</span>${item.show_state!==false?html`<span class="pill-state">${presentedState(this.hass!,e,item.state_map)}</span>`:nothing}`;
        return itemAction.action==="none"?html`<span class="pill pill-status" style=${`--pill-color:${tone}`}>${content}</span>`:html`<button class=${`pill pill-control ${!c.items?.length?"legacy":""}`} aria-label=${`${item.name||localized(this.hass,"Status","Állapot")}: ${presentedState(this.hass!,e,item.state_map)}`} title=${`${item.name||localized(this.hass,"Status","Állapot")}: ${presentedState(this.hass!,e,item.state_map)}`} ?disabled=${!["more-info","navigate","url"].includes(itemAction.action)&&!entityAvailable(e)} aria-pressed=${itemAction.action==="toggle"&&entityAvailable(e)?String(active):nothing} style=${`--pill-color:${tone}`} @click=${()=>runAction(this,this.hass!,itemAction,item.entity)}>${content}<ha-icon class="action-cue" aria-hidden="true" icon=${["more-info","navigate","url"].includes(itemAction.action)?"mdi:chevron-right":"mdi:gesture-tap"}></ha-icon></button>`;
      }):html`<span class="empty">${localized(this.hass,"No active quick controls","Nincs aktív gyorsvezérlő")}</span>`}</div>
    </ha-card>`;
  }
}
