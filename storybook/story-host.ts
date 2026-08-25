import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { LovelaceCard } from "../src/types";
import { createMockHass, type EntityDefinition, type ServiceCall } from "./mock-hass";

@customElement("luma-story-host")
export class LumaStoryHost extends LitElement {
  @property({ attribute: false }) cardType = "";
  @property({ attribute: false }) config: Record<string, unknown> = {};
  @property({ attribute: false }) entities: Record<string, EntityDefinition> = {};
  @property({ type: Number }) width = 620;
  @state() private calls: ServiceCall[] = [];

  static styles = css`
    :host { display: block; width: min(var(--preview-width, 620px), calc(100vw - 48px)); max-width: 100%; }
    .stage { box-sizing: border-box; width: 100%; padding: 28px; border: 1px solid rgba(94, 99, 125, .12); border-radius: 30px; background: var(--primary-background-color); box-shadow: 0 24px 70px rgba(42, 46, 70, .08); }
    .canvas { width: 100%; }
    .canvas > * { display: block; width: 100%; }
    .log { margin-top: 14px; padding: 12px 14px; border-radius: 14px; color: var(--secondary-text-color); background: color-mix(in srgb, var(--primary-text-color) 5%, transparent); font: 11px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; }
    .log strong { color: var(--primary-text-color); }
  `;

  protected firstUpdated(): void {
    this.syncPreviewWidth();
    this.mountCard();
  }

  protected updated(changed: Map<PropertyKey, unknown>): void {
    if (changed.has("width")) this.syncPreviewWidth();
    if (changed.has("cardType") || changed.has("config") || changed.has("entities")) this.mountCard();
  }

  private syncPreviewWidth(): void {
    this.style.setProperty("--preview-width", `${this.width}px`);
  }

  private mountCard(): void {
    const canvas = this.renderRoot.querySelector<HTMLElement>(".canvas");
    if (!canvas || !this.cardType) return;
    canvas.replaceChildren();
    const element = document.createElement(this.cardType.replace("custom:", "")) as LovelaceCard;
    element.setConfig({ type: this.cardType, ...this.config });
    element.hass = createMockHass(this.entities, (call) => {
      this.calls = [call, ...this.calls].slice(0, 4);
    });
    canvas.append(element);
  }

  render() {
    return html`
      <div class="stage">
        <div class="canvas"></div>
        ${this.calls.length
          ? html`<div class="log"><strong>Home Assistant action</strong><br>${this.calls.map((call) => html`${call.domain}.${call.service} ${JSON.stringify(call.target || call.data || {})}<br>`)}</div>`
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "luma-story-host": LumaStoryHost;
  }
}
