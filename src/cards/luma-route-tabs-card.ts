import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { localized } from "../localize";
import { navigateRoute, routeIsActive, type NavigationRoute } from "../navigation";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LovelaceCard } from "../types";

interface Config { type: string; name?: string; routes: NavigationRoute[] }

@customElement("luma-route-tabs-card")
export class LumaRouteTabsCard extends LitElement implements LovelaceCard {
  @property({attribute: false}) hass?: HomeAssistant;
  @state() private config?: Config;
  @state() private path = window.location.pathname;
  private locationChanged = () => { this.path = window.location.pathname; };

  static styles = [lumaTokens, css`
    :host{min-width:0}
    nav{display:flex;gap:5px;padding:5px;overflow:auto;scrollbar-width:thin;border:1px solid var(--luma-border);border-radius:var(--luma-radius-card);background:color-mix(in srgb,var(--primary-text-color) 3%,var(--luma-surface))}
    a{display:flex;flex:1 0 auto;align-items:center;justify-content:center;gap:7px;min-height:44px;padding:9px 13px;border-radius:var(--luma-radius-control);color:var(--luma-muted);font-size:12px;font-weight:var(--luma-weight-strong);text-decoration:none;white-space:nowrap}
    a:hover{background:color-mix(in srgb,var(--primary-color) 7%,transparent)}
    a[aria-current=page]{color:var(--primary-color);background:var(--luma-surface);box-shadow:0 3px 10px rgba(0,0,0,.05)}
    a:focus-visible{outline:2px solid var(--primary-color);outline-offset:-2px}
    ha-icon{--mdc-icon-size:18px}
  `];

  setConfig(config: Config) {
    if (!config?.routes?.length || config.routes.some(route => !route.url || !route.label)) {
      throw new Error("Luma route tabs require labelled routes with URLs.");
    }
    this.config = config;
  }
  getCardSize() { return 1; }
  connectedCallback() {
    super.connectedCallback();
    for (const name of ["location-changed", "popstate", "hashchange"]) window.addEventListener(name, this.locationChanged);
    this.locationChanged();
  }
  disconnectedCallback() {
    for (const name of ["location-changed", "popstate", "hashchange"]) window.removeEventListener(name, this.locationChanged);
    super.disconnectedCallback();
  }
  protected updated(changed: Map<PropertyKey, unknown>) {
    if (!changed.has("path") && !changed.has("config")) return;
    // Keep the active page reachable when a long tab row scrolls on mobile.
    const active = this.renderRoot.querySelector<HTMLElement>('[aria-current="page"]');
    const nav = active?.parentElement;
    if (active && nav && nav.scrollWidth > nav.clientWidth) {
      nav.scrollLeft = Math.max(0, active.offsetLeft - nav.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2);
    }
  }
  render() {
    if (!this.config) return nothing;
    return html`<nav aria-label=${this.config.name || localized(this.hass, "Section pages", "Oldalak")}>
      ${this.config.routes.map(route => html`<a href=${route.url} aria-current=${routeIsActive(route, this.path) ? "page" : nothing}
        @click=${(event: MouseEvent) => navigateRoute(event, route.url)}>
        ${route.icon ? html`<ha-icon icon=${route.icon}></ha-icon>` : nothing}<span>${route.label}</span>
      </a>`)}
    </nav>`;
  }
}
