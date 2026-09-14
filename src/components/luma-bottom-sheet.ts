import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { lumaTokens } from '../styles';

/** Shared modal shell for configured popups and dynamically discovered details. */
@customElement('luma-bottom-sheet')
export class LumaBottomSheet extends LitElement {
  @property({type:Boolean}) open=false;
  @property() heading='';
  @property() subtitle='';
  @property() icon='mdi:lightning-bolt-outline';
  @property() closeLabel='Close';
  @property({type:Number}) maxWidth=720;
  @state() private visible=false;
  @state() private dragY=0;
  @state() private dragging=false;
  @query('dialog') private dialog?:HTMLDialogElement;
  private closeTimer?:number;
  private openFrame?:number;
  private dragStartY=0;
  private dragStartTime=0;
  static styles=[lumaTokens,css`
    :host{display:block;height:0;min-height:0}
      .layer {
        position: fixed;
        inset: 0;
        z-index: 1000;
        margin: 0; padding: 0; border: 0; width: 100%; height: 100%;
        max-width: none; max-height: none; background: transparent; overflow: hidden;
        align-items: end;
        justify-items: center;
        pointer-events: none;
        visibility: hidden;
      }
      .layer[open] { display: grid; pointer-events: auto; visibility: visible; }
      .layer::backdrop { background: transparent; }
      .scrim {
        position: absolute;
        inset: 0;
        background: rgba(12, 13, 18, 0.58);
        opacity: 0;
        transition: opacity 0.22s ease;
      }
      .open .scrim {
        opacity: calc(1 - var(--drag-progress, 0));
      }
      .sheet {
        position: relative;
        isolation: isolate;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        width: min(var(--sheet-width), calc(100vw - 32px));
        max-height: min(860px, calc(100dvh - 28px));
        border: 1px solid
          color-mix(in srgb, var(--primary-text-color) 11%, transparent);
        border-radius: 28px 28px 0 0;
        color: var(--primary-text-color);
        background:
          radial-gradient(
            circle at 8% 0,
            color-mix(in srgb, var(--primary-color) 10%, transparent),
            transparent 31%
          ),
          var(
            --md-sys-color-surface-container-high,
            var(--primary-background-color, #fafafa)
          );
        box-shadow: 0 -16px 60px rgba(0, 0, 0, 0.34);
        overflow: hidden;
        transform: translateY(calc(100% + 32px));
        opacity: 0.8;
        transition:
          transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1),
          opacity 0.22s ease;
      }
      .open .sheet {
        transform: translateY(var(--drag-y, 0));
        opacity: 1;
      }
      .dragging .sheet {
        transition: none;
      }
      .handle-zone {
        position: absolute;
        z-index: 3;
        top: 0;
        left: 0;
        width: 100%;
        height: 28px;
        cursor: grab;
        touch-action: none;
      }
      .dragging .handle-zone {
        cursor: grabbing;
      }
      .handle {
        position: absolute;
        top: 9px;
        left: 50%;
        width: 34px;
        height: 4px;
        border-radius: 99px;
        background: color-mix(
          in srgb,
          var(--primary-text-color) 28%,
          transparent
        );
        transform: translateX(-50%);
      }
      header {
        display: grid;
        grid-template-columns: 42px minmax(0, 1fr) 40px;
        align-items: center;
        gap: 12px;
        padding: 25px 20px 14px;
        border-bottom: 1px solid
          color-mix(in srgb, var(--primary-text-color) 7%, transparent);
        background: transparent;
      }
      .icon {
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        border-radius: 14px;
        color: var(--primary-color);
        background: color-mix(in srgb, var(--primary-color) 12%, transparent);
      }
      .icon ha-icon {
        --mdc-icon-size: 22px;
      }
      .title {
        font-size: 18px;
        font-weight: 730;
        line-height: 1.15;
      }
      .subtitle {
        margin-top: 3px;
        color: var(--luma-muted);
        font-size: 11px;
      }
      .close {
        display: grid;
        place-items: center;
        width: 40px;
        height: 40px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        color: var(--primary-text-color);
        background: color-mix(
          in srgb,
          var(--primary-text-color) 7%,
          transparent
        );
      }
      .close ha-icon {
        --mdc-icon-size: 19px;
      }
      .content {
        display: grid;
        align-content: start;
        gap: 14px;
        min-height: 0;
        padding: 16px 20px calc(22px + env(safe-area-inset-bottom));
        background: transparent;
        overflow: auto;
        overscroll-behavior: contain;
      }
      @media (min-width: 700px) {
        .layer {
          padding-bottom: 18px;
        }
        .sheet {
          border-radius: 28px;
          max-height: calc(100dvh - 56px);
        }
      }
      @media (max-width: 699px) {
        .sheet {
          width: 100%;
          max-height: calc(100dvh - 8px);
          border-right: 0;
          border-bottom: 0;
          border-left: 0;
        }
        .content {
          padding-right: 16px;
          padding-left: 16px;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .scrim,
        .sheet {
          transition-duration: 0.01ms;
        }
      }
    .title,.subtitle{overflow-wrap:anywhere}
    header>span{min-width:0}
    .close{cursor:pointer}
    .close:focus-visible{outline:2px solid var(--primary-color);outline-offset:3px}
  `];
  protected updated(changed:PropertyValues<this>){
    if(!changed.has('open'))return;
    clearTimeout(this.closeTimer);cancelAnimationFrame(this.openFrame||0);
    this.dragY=0;this.dragging=false;
    if(this.open){
      if(this.dialog&&!this.dialog.open)this.dialog.showModal();
      // Commit the off-screen position before starting the enter transition.
      this.dialog?.getBoundingClientRect();
      this.openFrame=requestAnimationFrame(()=>{this.visible=this.open});
    }else{
      this.visible=false;
      const delay=matchMedia('(prefers-reduced-motion: reduce)').matches?0:340;
      this.closeTimer=window.setTimeout(()=>{if(!this.open){this.dialog?.close();this.dispatchEvent(new CustomEvent('sheet-closed'));}},delay);
    }
  }
  connectedCallback(){super.connectedCallback();if(this.hasUpdated)this.requestUpdate('open',!this.open)}
  disconnectedCallback(){clearTimeout(this.closeTimer);cancelAnimationFrame(this.openFrame||0);this.visible=false;this.dialog?.close();super.disconnectedCallback()}
  private dismiss(){this.dispatchEvent(new CustomEvent('sheet-dismiss'))}
  private dragStart(event:PointerEvent){
    if(event.button!==0)return;
    this.dragging=true;this.dragStartY=event.clientY;this.dragStartTime=performance.now();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  private dragMove(event:PointerEvent){if(this.dragging)this.dragY=Math.max(0,event.clientY-this.dragStartY)}
  private dragEnd(event:PointerEvent){
    if(!this.dragging)return;
    const dismiss=event.type!=='pointercancel'&&(this.dragY>110||this.dragY/Math.max(1,performance.now()-this.dragStartTime)>.65);
    const target=event.currentTarget as HTMLElement;
    if(target.hasPointerCapture(event.pointerId))target.releasePointerCapture(event.pointerId);
    this.dragging=false;
    if(dismiss)this.dismiss();else this.dragY=0;
  }
  render(){return html`<dialog class=${`layer ${this.visible?'open':''} ${this.dragging?'dragging':''}`}
    aria-label=${this.heading} style=${`--drag-y:${this.dragY}px;--drag-progress:${Math.min(.75,this.dragY/420)}`}
    @cancel=${(event:Event)=>{event.preventDefault();this.dismiss()}}>
    <div class="scrim" @click=${()=>this.dismiss()}></div>
    <section class="sheet" style=${`--sheet-width:${this.maxWidth}px`}>
      <div class="handle-zone" @pointerdown=${this.dragStart} @pointermove=${this.dragMove} @pointerup=${this.dragEnd} @pointercancel=${this.dragEnd}><div class="handle"></div></div>
      <header><span class="icon"><ha-icon icon=${this.icon}></ha-icon></span><span><div class="title">${this.heading}</div>${this.subtitle?html`<div class="subtitle">${this.subtitle}</div>`:nothing}</span><button class="close" aria-label=${this.closeLabel} @click=${()=>this.dismiss()}><ha-icon icon="mdi:close"></ha-icon></button></header>
      <div class="content"><slot></slot></div>
    </section>
  </dialog>`}
}
