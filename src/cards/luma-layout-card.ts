import{LitElement,css,html,nothing,type PropertyValues}from"lit";
import{customElement,property,query,state}from"lit/decorators.js";
import{lumaTokens}from"../styles";
import type{HomeAssistant,LovelaceCard}from"../types";
interface Config{type:string;cards:Record<string,unknown>[];columns?:number;desktop_template?:string;tablet_columns?:number;mobile_columns?:number;gap?:number}
type Child=HTMLElement&{hass?:HomeAssistant};
@customElement("luma-layout-card")export class LumaLayoutCard extends LitElement implements LovelaceCard{
 @property({attribute:false})hass?:HomeAssistant;@state()private config?:Config;@query(".grid")private grid?:HTMLElement;private childCards:Child[]=[];private token=0;
 static styles=[lumaTokens,css`:host{display:block}.grid{display:grid;grid-template-columns:var(--desktop-template,repeat(var(--desktop),minmax(0,1fr)));align-items:start;gap:var(--gap)}@media(max-width:1023px){.grid{grid-template-columns:repeat(var(--tablet),minmax(0,1fr))}}@media(max-width:599px){.grid{grid-template-columns:repeat(var(--mobile),minmax(0,1fr))}}`];
 setConfig(c:Config){if(!c?.cards?.length)throw Error("cards required");this.config={columns:2,tablet_columns:1,mobile_columns:1,gap:12,...c};this.childCards=[]}
 getCardSize(){return 4}
 protected updated(changed:PropertyValues<this>){if(changed.has("config" as never))void this.mount();if(changed.has("hass"))for(const child of this.childCards)child.hass=this.hass}
 private async mount(){if(!this.config||!this.grid)return;const token=++this.token,helpers=await window.loadCardHelpers?.();if(!helpers||token!==this.token)return;this.childCards=this.config.cards.map(c=>helpers.createCardElement(c)as Child);for(const child of this.childCards)child.hass=this.hass;this.grid.replaceChildren(...this.childCards)}
 render(){if(!this.config)return nothing;return html`<div class="grid" style=${`--desktop:${this.config.columns};${this.config.desktop_template?`--desktop-template:${this.config.desktop_template};`:""}--tablet:${this.config.tablet_columns};--mobile:${this.config.mobile_columns};--gap:${this.config.gap}px`}><span></span></div>`}
}
