import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { lumaTokens } from "../styles";
import "../components/luma-bottom-sheet";
import { localize, localized } from "../localize";
import type { HomeAssistant, LovelaceCard } from "../types";
interface Config {
  type: string;
  hash: string;
  name: string;
  subtitle?: string;
  icon?: string;
  cards?: Record<string, unknown>[];
  max_width?: number;
}
type ChildCard = HTMLElement & { hass?: HomeAssistant };
@customElement("luma-popup-card")
export class LumaPopupCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property({ type: Boolean }) preview = false;
  @property({ type: Boolean }) editMode = false;
  @state() private config?: Config;
  @state() private open = false;
  @query(".content") private content?: HTMLElement;
  private childCards: ChildCard[] = [];
  private locationChanged = () => this.syncLocation();
  static styles = [
    lumaTokens,
    css`
      :host {
        display: block;
        height: 0;
        min-height: 0;
      }
      .edit-preview {
        display: grid;
        grid-template-columns: 42px minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px;
        padding: 13px;
        border: 1px dashed
          color-mix(in srgb, var(--primary-color) 28%, transparent);
        border-radius: 18px;
        background: color-mix(
          in srgb,
          var(--primary-color) 6%,
          var(--luma-surface)
        );
      }
      .preview-icon {
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        border-radius: 13px;
        color: var(--primary-color);
        background: color-mix(in srgb, var(--primary-color) 13%, transparent);
      }
      .preview-icon ha-icon {
        --mdc-icon-size: 22px;
      }
      .preview-title {
        font-size: 13px;
        font-weight: 720;
      }
      .preview-meta {
        margin-top: 3px;
        color: var(--luma-muted);
        font-size: 10px;
      }
      .preview-open {
        min-height: 34px;
        padding: 7px 11px;
        border: 0;
        border-radius: 999px;
        color: var(--primary-color);
        background: color-mix(in srgb, var(--primary-color) 12%, transparent);
        font: inherit;
        font-size: 10px;
        font-weight: 720;
      }
      .content { display:grid;gap:14px;min-width:0; }
      .loading { min-height:160px;display:grid;place-items:center;color:var(--luma-muted); }
    `,
  ];
  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("hashchange", this.locationChanged);
    window.addEventListener("location-changed", this.locationChanged);
    this.syncLocation();
  }
  disconnectedCallback() {
    window.removeEventListener("hashchange", this.locationChanged);
    window.removeEventListener("location-changed", this.locationChanged);
    super.disconnectedCallback();
  }
  setConfig(c: Config) {
    if (!c?.hash || !c?.name)
      throw new Error("Luma popup requires hash and name.");
    this.config = { cards: [], max_width: 720, ...c };
    this.childCards = [];
    this.syncLocation();
  }
  getCardSize() {
    return this.isEditing ? 1 : 0;
  }
  protected updated(changed: PropertyValues<this>) {
    if (changed.has("config" as never)) void this.mountCards();
    if (changed.has("hass"))
      for (const card of this.childCards) card.hass = this.hass;
  }
  private get isEditing() {
    return (
      this.preview ||
      this.editMode ||
      Boolean(this.hass?.editMode) ||
      Boolean(this.closest("hui-card-edit-mode,hui-card-preview"))
    );
  }
  private syncLocation() {
    if (!this.config) return;
    const expected = this.config.hash.startsWith("#")
      ? this.config.hash
      : "#" + this.config.hash;
    this.open = window.location.hash === expected;
  }
  private navigate(hash = "") {
    const oldURL = window.location.href;
    history.pushState(
      null,
      "",
      window.location.pathname + window.location.search + hash,
    );
    window.dispatchEvent(new Event("location-changed"));
    window.dispatchEvent(
      new HashChangeEvent("hashchange", {
        oldURL,
        newURL: window.location.href,
      }),
    );
  }
  private openPreview() {
    if (this.config)
      this.navigate(
        this.config.hash.startsWith("#")
          ? this.config.hash
          : "#" + this.config.hash,
      );
  }
  private close() {
    this.navigate();
  }
  private async mountCards() {
    if (!this.config || !this.content) return;
    const helpers = await window.loadCardHelpers?.();
    if (!helpers) return;
    this.childCards = (this.config.cards || []).map(
      (config) => helpers.createCardElement(config) as ChildCard,
    );
    for (const card of this.childCards) {
      card.hass = this.hass;
      card.style.width = "100%";
    }
    this.content.replaceChildren(...this.childCards);
  }
  render() {
    if (!this.config) return nothing;
    return html`${this.isEditing && !this.open
        ? html`<ha-card class="edit-preview"
            ><span class="preview-icon"
              ><ha-icon
                icon=${this.config.icon || "mdi:application-brackets-outline"}
              ></ha-icon></span
            ><span
              ><div class="preview-title">${this.config.name}</div>
              <div class="preview-meta">
                ${this.config.hash} · ${this.config.cards?.length || 0}
                ${localized(this.hass,"content cards","tartalmi kártya")}
              </div></span
            ><button class="preview-open" @click=${() => this.openPreview()}>
              ${localize(this.hass, "open_item")}
            </button></ha-card
          >`
        : nothing}
      <luma-bottom-sheet .open=${this.open} .heading=${this.config.name}
        .subtitle=${this.config.subtitle||''} .icon=${this.config.icon||'mdi:lightning-bolt-outline'}
        .maxWidth=${this.config.max_width} .closeLabel=${localize(this.hass,'dismiss')}
        @sheet-dismiss=${()=>this.close()}>
        <div class="content"><div class="loading">${localize(this.hass,'loading')}</div></div>
      </luma-bottom-sheet>`;
  }
}
