import { LitElement, css, html, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { lumaTokens } from '../styles';

/** Native release-only range. Incoming state cannot overwrite an active drag. */
@customElement('luma-touch-range')
export class LumaTouchRange extends LitElement {
  @property({type:Number}) value?:number;
  @property({type:Number}) min=0;
  @property({type:Number}) max=100;
  @property({type:Number}) step=1;
  @property() label='';
  @property() unit='%';
  @property() track='';
  @property({type:Boolean}) disabled=false;
  @state() private draft?:number;
  @state() private pending?:number;
  private active=false;
  private cancelled=false;
  private timer?:ReturnType<typeof setTimeout>;
  static styles=[lumaTokens,css`
    :host{min-width:0}label{display:block;font-size:17px;font-weight:var(--luma-weight-medium)}
    .caption{display:flex;justify-content:space-between;gap:12px;margin-bottom:12px}output{font-variant-numeric:tabular-nums;color:var(--luma-muted)}
    input{display:block;appearance:none;-webkit-appearance:none;width:100%;height:64px;margin:0;border:1px solid var(--luma-border);border-radius:var(--luma-radius-control);background:var(--range-track,color-mix(in srgb,var(--primary-color) 20%,var(--luma-surface)));touch-action:none;cursor:ew-resize;}
    input::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:44px;height:64px;border:3px solid var(--primary-text-color);border-radius:var(--luma-radius-control);background:var(--luma-surface)}
    input::-moz-range-thumb{width:38px;height:58px;border:3px solid var(--primary-text-color);border-radius:var(--luma-radius-control);background:var(--luma-surface)}
    input:disabled{opacity:.4;cursor:default}input:focus-visible{outline:3px solid var(--primary-color);outline-offset:3px}
  `];
  protected updated(changed:PropertyValues<this>){
    if(this.disabled){this.active=false;this.draft=undefined;}
    if(changed.has('value')&&this.pending!==undefined&&this.value!==undefined&&Math.abs(this.value-this.pending)<=this.step){this.pending=undefined;clearTimeout(this.timer);}
    if(!this.active){const input=this.renderRoot.querySelector('input');if(input)input.value=String(this.pending??this.value??this.min);}
  }
  disconnectedCallback(){clearTimeout(this.timer);super.disconnectedCallback()}
  private cancel(){this.cancelled=true;this.active=false;this.draft=undefined;this.requestUpdate();}
  private commit(e:Event){
    if(this.cancelled||this.disabled)return;
    const value=Number((e.target as HTMLInputElement).value);
    this.active=false;this.draft=undefined;this.pending=value;clearTimeout(this.timer);
    this.timer=setTimeout(()=>this.pending=undefined,5000);
    this.dispatchEvent(new CustomEvent('value-commit',{detail:{value}}));
  }
  render(){const value=this.draft??this.pending??this.value;return html`<label><span class="caption"><span>${this.label}</span><output>${value===undefined?'—':`${Math.round(value)}${this.unit}`}</output></span>
    <input type="range" min=${this.min} max=${this.max} step=${this.step} aria-label=${this.label} ?disabled=${this.disabled} style=${this.track?`--range-track:${this.track}`:''}
    @pointerdown=${()=>{this.active=true;this.cancelled=false}} @keydown=${()=>{this.cancelled=false}}
    @input=${(e:Event)=>{if(!this.cancelled){this.active=true;this.draft=Number((e.target as HTMLInputElement).value)}}}
    @change=${this.commit} @pointercancel=${this.cancel} @touchcancel=${this.cancel} @blur=${()=>{this.active=false;this.draft=undefined;this.requestUpdate()}}></label>`;}
}
