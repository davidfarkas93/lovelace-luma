import{LitElement,css,html,nothing,type PropertyValues}from"lit";
import{customElement,property,query,state}from"lit/decorators.js";
import{localized}from"../localize";
import{lumaTokens,lumaSurfaceStyles,lumaInteractionStyles}from"../styles";
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
 static styles=[lumaTokens,lumaSurfaceStyles,lumaInteractionStyles,css`
  :host{container-type:inline-size;min-width:0}
  .shell{--tone:var(--primary-text-color);padding:0;overflow:hidden}
  .tabs{display:grid;grid-template-columns:repeat(var(--tab-count),minmax(0,1fr));gap:4px;margin:0 14px;border-bottom:1px solid var(--luma-border)}
  button{position:relative;display:flex;align-items:center;justify-content:center;gap:7px;min-width:0;min-height:48px;padding:10px 8px;border:0;border-radius:8px;color:var(--luma-muted);background:transparent;font:inherit;font-size:12px;font-weight:560;overflow-wrap:anywhere;cursor:pointer}
  button:hover{color:var(--primary-text-color);background:var(--luma-hover-surface)}
  button.active{color:var(--primary-text-color);font-weight:650}
  button.active::after{content:"";position:absolute;bottom:-1px;left:12px;right:12px;height:2px;border-radius:2px;background:var(--primary-color)}
  button ha-icon{--mdc-icon-size:17px;flex-shrink:0}button.active ha-icon{color:var(--primary-color)}
  .content{padding:10px 14px 14px;min-width:0;--mdc-typography-body1-font-size:14px;--mdc-typography-body2-font-size:12px}
  .loading{padding:16px 0;color:var(--luma-muted);font-size:12px}
  @container(max-width:360px){.tabs{margin:0 12px}.content{padding:8px 12px 12px}button{gap:6px}}
 `];
 setConfig(c:Config){
  if(!c?.tabs?.length||c.tabs.some(tab=>!tab.card?.type))throw new Error("Luma tabs require tabs with a card configuration.");
  this.config=c;this.active=Math.max(0,Math.min(Number.isInteger(c.initial_tab)?c.initial_tab!:0,c.tabs.length-1));this.cards.clear();++this.renderToken;
 }
 getCardSize(){return 3}
 protected updated(changed:PropertyValues<this>){if(changed.has("config" as never)||changed.has("active" as never))void this.mountActive();if(changed.has("hass"))for(const card of this.cards.values())card.hass=this.hass}
 private async mountActive(){
  if(!this.config||!this.content)return;
  const token=++this.renderToken,index=this.active;
  this.content.replaceChildren();this.content.setAttribute('aria-busy','true');
  try{
   let card=this.cards.get(index);
   if(!card){const helpers=await window.loadCardHelpers?.();if(token!==this.renderToken)return;if(!helpers)throw new Error('Card helpers unavailable');
    card=helpers.createCardElement(this.config.tabs[index].card)as ChildCard;
    card.style.setProperty("--ha-card-background","transparent");card.style.setProperty("--ha-card-border-width","0");card.style.setProperty("--ha-card-box-shadow","none");this.cards.set(index,card);
   }
   if(token!==this.renderToken)return;card.hass=this.hass;this.content.replaceChildren(card);
  }catch{if(token===this.renderToken)this.content.textContent=localized(this.hass,'Unable to load this tab.','A fül tartalma nem tölthető be.');}
  finally{if(token===this.renderToken)this.content.setAttribute('aria-busy','false');}
 }
 private async onKey(event:KeyboardEvent,index:number){
  const count=this.config!.tabs.length;
  const next=event.key==='ArrowRight'?(index+1)%count:event.key==='ArrowLeft'?(index+count-1)%count:event.key==='Home'?0:event.key==='End'?count-1:undefined;
  if(next===undefined)return;event.preventDefault();this.active=next;await this.updateComplete;this.renderRoot.querySelector<HTMLButtonElement>(`#tab-${next}`)?.focus();
 }
 render(){if(!this.config)return nothing;return html`<ha-card class="shell" style=${`--tab-count:${this.config.tabs.length}`}><div class="tabs" role="tablist" aria-label=${localized(this.hass,'Views','Nézetek')}>${this.config.tabs.map((tab,index)=>html`<button id=${`tab-${index}`} class=${index===this.active?"active":""} role="tab" tabindex=${index===this.active?0:-1} aria-selected=${index===this.active} aria-controls="tab-panel" @keydown=${(e:KeyboardEvent)=>this.onKey(e,index)} @click=${()=>this.active=index}>${tab.icon?html`<ha-icon aria-hidden="true" icon=${tab.icon}></ha-icon>`:nothing}<span>${tab.name}</span></button>`)}</div><div id="tab-panel" class="content" role="tabpanel" tabindex="0" aria-labelledby=${`tab-${this.active}`}><div class="loading">${localized(this.hass,"Loading…","Betöltés…")}</div></div></ha-card>`}
}
