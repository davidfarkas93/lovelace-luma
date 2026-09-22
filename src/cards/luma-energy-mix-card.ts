import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { entityIcon, entityName, runAction } from "../helpers";
import { localized } from "../localize";
import { lumaTokens } from "../styles";
import type { HomeAssistant, LumaAction, LovelaceCard } from "../types";

interface MixSource {
  entity: string;
  name?: string;
  icon?: string;
  color?: string;
  tap_action?: LumaAction;
}

interface Config {
  type: string;
  title?: string;
  subtitle?: string;
  icon?: string;
  total_entity?: string;
  unit?: string;
  decimals?: number;
  total_label?: string;
  sources: MixSource[];
  tap_action?: LumaAction;
}

interface MixValue extends MixSource {
  value: number;
  percent: number;
  color: string;
}

@customElement("luma-energy-mix-card")
export class LumaEnergyMixCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: Config;

  static styles = [lumaTokens, css`
    :host{display:block;min-width:0}
    ha-card{position:relative;display:grid;gap:17px;min-height:158px;padding:18px;border:1px solid color-mix(in srgb,var(--primary-color) 13%,transparent);border-radius:22px;background:radial-gradient(circle at 92% 5%,color-mix(in srgb,var(--primary-color) 9%,transparent),transparent 35%),linear-gradient(145deg,color-mix(in srgb,var(--primary-color) 5%,var(--luma-surface)),var(--luma-surface) 68%);box-shadow:0 14px 38px rgba(0,0,0,.055);overflow:hidden}
    ha-card.interactive{cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
    ha-card.interactive:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--primary-color) 24%,transparent);box-shadow:0 18px 44px rgba(0,0,0,.085)}
    .head{display:grid;grid-template-columns:42px minmax(0,1fr) auto;grid-template-areas:"icon title total" "icon subtitle total";align-items:center;gap:2px 11px;min-width:0}
    .head-icon{grid-area:icon;display:grid;place-items:center;width:42px;height:42px;border-radius:14px;color:var(--primary-color);background:color-mix(in srgb,var(--primary-color) 12%,transparent)}
    .head-icon ha-icon{--mdc-icon-size:22px}.title{grid-area:title;align-self:end;min-width:0;font-size:14px;font-weight:740}.subtitle{grid-area:subtitle;align-self:start;min-width:0;overflow:hidden;color:var(--luma-muted);font-size:10px;text-overflow:ellipsis;white-space:nowrap}
    .total{grid-area:total;text-align:right}.total strong{display:block;font-size:22px;font-weight:760;line-height:1;letter-spacing:-.03em}.total span{display:block;margin-top:4px;color:var(--luma-muted);font-size:9px;font-weight:680;text-transform:uppercase;letter-spacing:.05em}
    .rail{display:flex;height:12px;padding:3px;border-radius:999px;background:color-mix(in srgb,var(--primary-text-color) 7%,transparent);overflow:hidden}
    .segment{min-width:0;height:100%;border-radius:999px;background:var(--source-color);box-shadow:inset 0 0 0 1px color-mix(in srgb,white 18%,transparent);transition:flex-basis .45s cubic-bezier(.2,.75,.2,1)}
    .segment+.segment{margin-left:3px}.rail.empty::after{content:"";width:100%;border-radius:999px;background:color-mix(in srgb,var(--primary-text-color) 9%,transparent)}
    .sources{display:grid;grid-template-columns:repeat(var(--source-count),minmax(0,1fr));gap:9px}.source{appearance:none;display:grid;grid-template-columns:34px minmax(0,1fr);grid-template-areas:"source-icon source-name" "source-icon source-value";align-items:center;gap:1px 9px;min-width:0;padding:8px 9px;border:0;border-radius:15px;background:color-mix(in srgb,var(--source-color) 7%,transparent);color:inherit;font:inherit;text-align:left}.source.interactive{cursor:pointer;transition:transform .16s ease,background .16s ease}.source.interactive:hover{transform:translateY(-1px);background:color-mix(in srgb,var(--source-color) 12%,transparent)}
    .source-icon{grid-area:source-icon;display:grid;place-items:center;width:34px;height:34px;border-radius:11px;color:var(--source-color);background:color-mix(in srgb,var(--source-color) 14%,transparent)}.source-icon ha-icon{--mdc-icon-size:18px}.source-name{grid-area:source-name;align-self:end;overflow:hidden;color:var(--luma-muted);font-size:9px;font-weight:700;text-overflow:ellipsis;white-space:nowrap}.source-value{grid-area:source-value;align-self:start;overflow:hidden;font-size:12px;font-weight:730;text-overflow:ellipsis;white-space:nowrap}.source-value small{margin-left:4px;color:var(--source-color);font-size:9px;font-weight:760}
    @media(max-width:599px){ha-card{gap:14px;min-height:0;padding:15px}.head{grid-template-columns:38px minmax(0,1fr) auto;gap:2px 9px}.head-icon{width:38px;height:38px;border-radius:13px}.head-icon ha-icon{--mdc-icon-size:20px}.total strong{font-size:18px}.sources{grid-template-columns:repeat(2,minmax(0,1fr))}.source{padding:7px}.subtitle{white-space:normal}}
  `];

  setConfig(config: Config) {
    if (!config?.sources?.length) throw Error("sources required");
    this.config = { decimals: 1, ...config };
  }

  getCardSize() { return 3; }

  protected shouldUpdate(changed: PropertyValues<this>) {
    if (!changed.has("hass")) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this.config) return true;
    const ids = [...this.config.sources.map((source) => source.entity), this.config.total_entity].filter(Boolean) as string[];
    return ids.some((id) => old.states[id] !== this.hass?.states[id]);
  }

  private number(entity: string) {
    const value = Number(this.hass?.states[entity]?.state);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  private format(value: number, entity?: string) {
    const decimals = this.config?.decimals ?? 1;
    const unit = this.config?.unit ?? (entity ? String(this.hass?.states[entity]?.attributes.unit_of_measurement || "") : "");
    return `${value.toLocaleString(this.hass?.locale?.language || undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${unit ? ` ${unit}` : ""}`;
  }

  private sourceValues() {
    const palette = ["#58b984", "#f4a62a", "#6d82d8", "#a171d2"];
    const raw = this.config!.sources.map((source, index) => ({ ...source, value: this.number(source.entity), color: source.color || palette[index % palette.length] }));
    const sum = raw.reduce((total, source) => total + source.value, 0);
    return raw.map((source) => ({ ...source, percent: sum > 0 ? source.value / sum * 100 : 0 })) as MixValue[];
  }

  render() {
    if (!this.hass || !this.config) return nothing;
    const values = this.sourceValues();
    const sum = values.reduce((total, source) => total + source.value, 0);
    const total = this.config.total_entity ? this.number(this.config.total_entity) : sum;
    const title = this.config.title || "Energy mix";
    return html`<ha-card class=${this.config.tap_action ? "interactive" : ""} @click=${() => runAction(this, this.hass!, this.config?.tap_action, this.config?.total_entity)}>
      <div class="head">
        <span class="head-icon"><ha-icon icon=${this.config.icon || "mdi:chart-donut"}></ha-icon></span>
        <span class="title">${title}</span>
        <span class="subtitle">${this.config.subtitle || values.map((source) => `${source.name || entityName(this.hass!.states[source.entity], source.entity)} ${Math.round(source.percent)}%`).join(" · ")}</span>
        <span class="total"><strong>${this.format(total, this.config.total_entity || values[0]?.entity)}</strong><span>${this.config.total_label || localized(this.hass, "Total", "Összesen")}</span></span>
      </div>
      <div class=${`rail ${sum <= 0 ? "empty" : ""}`}>
        ${sum > 0 ? values.filter((source) => source.value > 0).map((source) => html`<span class="segment" style=${`--source-color:${source.color};flex-basis:${source.percent}%`} title=${`${source.name || source.entity}: ${this.format(source.value, source.entity)}`}></span>`) : nothing}
      </div>
      <div class="sources" style=${`--source-count:${Math.min(values.length, 4)}`}>
        ${values.map((source) => {
          const entity = this.hass!.states[source.entity];
          const action = source.tap_action || { action: "more-info" } as const;
          return html`<button class="source interactive" style=${`--source-color:${source.color}`} @click=${(event: Event) => { event.stopPropagation(); void runAction(this, this.hass!, action, source.entity); }}>
            <span class="source-icon"><ha-icon icon=${source.icon || entityIcon(entity)}></ha-icon></span>
            <span class="source-name">${source.name || entityName(entity, source.entity)}</span>
            <span class="source-value">${this.format(source.value, source.entity)}<small>${Math.round(source.percent)}%</small></span>
          </button>`;
        })}
      </div>
    </ha-card>`;
  }
}
