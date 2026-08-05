import{LitElement,css,html,nothing,type PropertyValues}from"lit";
import{customElement,property,query,state}from"lit/decorators.js";
import{lumaTokens}from"../styles";
import type{HomeAssistant,LovelaceCard}from"../types";
interface Tab{name:string;icon?:string;card:Record<string,unknown>}
interface Config{type:string;tabs:Tab[];initial_tab?:number}
type ChildCard=HTMLElement&{hass?:HomeAssistant};
@customElement("luma-tab-card")
export class LumaTabCard extends LitElement implements LovelaceCard{
 @property({attribute:false})hass?:HomeAssistant;
 @state()private config?:Config;
 @state()private active=0;
 @query(".content")private content?:HTMLElement;
 private cards=new Map<number,ChildCard>();
 private renderToken=0;
 static styles=[lumaTokens,css`
  .shell{padding:4px;border:1px solid color-mix(in srgb,var(--primary-color) 13%,transparent);border-radius:22px;background:linear-gradient(145deg,color-mix(in srgb,var(--primary-color) 7%,var(--luma-surface)),color-mix(in srgb,var(--primary-color) 2%,var(--luma-surface)) 45%,var(--luma-surface));box-shadow:0 14px 34px color-mix(in srgb,var(--primary-color) 6%,transparent);overflow:hidden}
  .tabs{display:grid;grid-template-columns:repeat(var(--tab-count),minmax(0,1fr));gap:4px;padding:3px;border-radius:17px;background:color-mix(in srgb,var(--primary-text-color) 5%,transparent)}
  button{display:flex;align-items:center;justify-content:center;gap:7px;min-width:0;min-height:40px;padding:8px 12px;border:0;border-radius:14px;color:var(--luma-muted);background:transparent;font:inherit;font-size:12px;font-weight:680;transition:.18s ease}
  button:hover{color:var(--primary-text-color);background:color-mix(in srgb,var(--primary-text-color) 4%,transparent)}
  button.active{color:var(--primary-text-color);background:var(--luma-surface);box-shadow:0 5px 14px rgba(0,0,0,.07)}
  button ha-icon{--mdc-icon-size:17px;color:var(--primary-color)}
  .content{min-height:120px;padding:12px 10px 8px}
  .loading{display:grid;place-items:center;min-height:150px;color:var(--luma-muted);font-size:12px}
  @media(max-width:599px){.shell{border-radius:19px}.tabs{border-radius:15px}button{min-height:38px;padding:7px 8px;font-size:11px}.content{padding:10px 5px 5px}}
 `];
 setConfig(c:Config){if(!c?.tabs?.length)throw new Error("Luma tabs require at least one tab.");this.config=c;this.active=Math.min(c.initial_tab||0,c.tabs.length-1);this.cards.clear()}
 getCardSize(){return 5}
 protected updated(changed:PropertyValues<this>){if(changed.has("config" as never)||changed.has("active" as never))void this.mountActive();if(changed.has("hass"))for(const card of this.cards.values())card.hass=this.hass}
 private async mountActive(){if(!this.config||!this.content)return;const token=++this.renderToken;let card=this.cards.get(this.active);if(!card){const helpers=await window.loadCardHelpers?.();if(!helpers||token!==this.renderToken)return;card=helpers.createCardElement(this.config.tabs[this.active].card)as ChildCard;card.style.setProperty("--ha-card-background","transparent");card.style.setProperty("--ha-card-border-width","0");card.style.setProperty("--ha-card-box-shadow","none");this.cards.set(this.active,card)}if(token!==this.renderToken)return;card.hass=this.hass;this.content.replaceChildren(card)}
 render(){if(!this.config)return nothing;return html`<ha-card class="shell" style=${`--tab-count:${this.config.tabs.length}`}><div class="tabs" role="tablist">${this.config.tabs.map((tab,index)=>html`<button class=${index===this.active?"active":""} role="tab" aria-selected=${index===this.active} @click=${()=>this.active=index}>${tab.icon?html`<ha-icon icon=${tab.icon}></ha-icon>`:nothing}<span>${tab.name}</span></button>`)}</div><div class="content"><div class="loading">Betöltés…</div></div></ha-card>`}
}
