const iconGlyphs: Record<string, string> = {
  "mdi:flash": "⚡",
  "mdi:solar-power": "☀",
  "mdi:home-lightning-bolt": "⌂",
  "mdi:lightbulb": "◉",
  "mdi:window-shutter": "↕",
  "mdi:washing-machine": "◎",
  "mdi:battery-high": "▣",
  "mdi:arrow-up": "↑",
  "mdi:arrow-down": "↓",
  "mdi:stop": "■",
  "mdi:check": "✓",
};

class HaCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }).innerHTML = `
      <style>:host{display:block;box-sizing:border-box}</style>
      <slot></slot>
    `;
  }
}

class MockLovelaceCard extends HTMLElement {
  private config: Record<string, unknown> = {};
  hass?: unknown;
  setConfig(config: Record<string, unknown>): void { this.config = config; this.render(); }
  connectedCallback(): void { this.render(); }
  private render(): void {
    const title = String(this.config.title || this.config.name || this.config.entity || this.config.type || "Home Assistant card");
    this.innerHTML = `<ha-card style="display:block;padding:16px;border-radius:18px;background:var(--card-background-color);box-shadow:0 10px 28px rgba(0,0,0,.05)"><strong>${title}</strong><div style="margin-top:5px;color:var(--secondary-text-color);font-size:12px">Native card preview</div></ha-card>`;
  }
}

class HaIcon extends HTMLElement {
  static observedAttributes = ["icon"];

  constructor() {
    super();
    this.attachShadow({ mode: "open" }).innerHTML = `
      <style>:host{display:inline-grid;place-items:center;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);font-size:calc(var(--mdc-icon-size,24px)*.72);line-height:1}</style>
      <span></span>
    `;
  }

  connectedCallback(): void {
    this.render();
  }

  attributeChangedCallback(): void {
    this.render();
  }

  private render(): void {
    const icon = this.getAttribute("icon") || "mdi:circle-outline";
    this.setAttribute("aria-label", icon.replace("mdi:", "").replaceAll("-", " "));
    const glyph = this.shadowRoot?.querySelector("span");
    if (glyph) glyph.textContent = iconGlyphs[icon] || "●";
  }
}

class HaStateIcon extends HaIcon {}

if (!customElements.get("ha-card")) customElements.define("ha-card", HaCard);
if (!customElements.get("ha-icon")) customElements.define("ha-icon", HaIcon);
if (!customElements.get("ha-state-icon")) customElements.define("ha-state-icon", HaStateIcon);
if (!customElements.get("luma-mock-card")) customElements.define("luma-mock-card", MockLovelaceCard);

window.loadCardHelpers = async () => ({
  createCardElement: (config: Record<string, unknown>) => {
    const type = String(config.type || "");
    const tag = type.startsWith("custom:luma-") ? type.slice(7) : "luma-mock-card";
    const card = document.createElement(tag) as HTMLElement & { setConfig(config: Record<string, unknown>): void };
    card.setConfig(config);
    return card;
  },
});
