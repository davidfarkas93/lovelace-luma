import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ref } from "lit/directives/ref.js";
import { entityAreaName, entityName, entityState, runAction } from "../helpers";
import { localize, localized } from "../localize";
import { lumaTokens } from "../styles";
import type { HassEntity, HomeAssistant, LovelaceCard } from "../types";

type Mode =
  | "favorite-lights"
  | "homelab-incidents"
  | "infrastructure-updates"
  | "komodo-deployments";
interface Config {
  type: string;
  mode: Mode;
  source_entity?: string;
  limit?: number;
  label?: string;
  empty_text?: string;
}
interface Favorite {
  entity_id: string;
  count?: number;
  last_used?: string;
}
interface Incident {
  entity: HassEntity;
  name: string;
  subtitle: string;
  icon: string;
  tone: string;
}

const platform = (hass: HomeAssistant, entityId: string): string =>
  hass.entities?.[entityId]?.platform || "";
const visible = (hass: HomeAssistant, entityId: string): boolean => {
  const registry = hass.entities?.[entityId];
  return !(
    registry?.hidden ||
    registry?.hidden_by ||
    registry?.disabled ||
    registry?.disabled_by
  );
};
const labels = (hass: HomeAssistant, entityId: string): string[] =>
  hass.entities?.[entityId]?.labels || [];
const niceStackName = (entityId: string): string =>
  entityId
    .split(".")[1]
    .split("_deploy_")[0]
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

@customElement("luma-discovery-card")
export class LumaDiscoveryCard extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private config?: Config;
  @state() private pending?: string;
  private confirmTimer?: number;
  private holdTimer?: number;
  private held = false;

  static styles = [
    lumaTokens,
    css`
      :host {
        display: block;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 9px;
      }
      .grid luma-control-card {
        display: block;
        min-width: 0;
      }
      .stack {
        display: grid;
        gap: 9px;
      }
      .item {
        display: grid;
        grid-template-columns: 42px minmax(0, 1fr) auto;
        align-items: center;
        gap: 11px;
        min-height: 70px;
        padding: 13px;
        border: 1px solid color-mix(in srgb, var(--tone) 15%, transparent);
        border-radius: 18px;
        color: inherit;
        background: linear-gradient(
          145deg,
          color-mix(in srgb, var(--tone) 8%, var(--luma-surface)),
          var(--luma-surface)
        );
        box-shadow: 0 9px 25px color-mix(in srgb, var(--tone) 5%, transparent);
        font: inherit;
        text-align: left;
      }
      .item.clickable {
        cursor: pointer;
        transition:
          transform 0.16s ease,
          border-color 0.16s ease,
          box-shadow 0.16s ease,
          background 0.16s ease;
      }
      .item.clickable:hover {
        transform: translateY(-2px);
        border-color: color-mix(in srgb, var(--tone) 28%, transparent);
        background: linear-gradient(
          145deg,
          color-mix(in srgb, var(--tone) 12%, var(--luma-surface)),
          var(--luma-surface)
        );
        box-shadow: 0 13px 30px color-mix(in srgb, var(--tone) 10%, transparent);
      }
      .item.clickable:active {
        transform: translateY(0) scale(0.99);
      }
      .item.clickable:focus-visible {
        outline: 2px solid color-mix(in srgb, var(--tone) 65%, transparent);
        outline-offset: 2px;
      }
      .icon {
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        border-radius: 14px;
        color: var(--tone);
        background: color-mix(in srgb, var(--tone) 15%, transparent);
      }
      .icon ha-icon {
        --mdc-icon-size: 21px;
      }
      .copy {
        min-width: 0;
      }
      .name {
        overflow: hidden;
        font-size: 13px;
        font-weight: 720;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sub {
        margin-top: 3px;
        overflow: hidden;
        color: var(--luma-muted);
        font-size: 10px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .action {
        min-width: 76px;
        padding: 8px 10px;
        border: 0;
        border-radius: 999px;
        color: var(--tone);
        background: color-mix(in srgb, var(--tone) 14%, transparent);
        font-size: 10px;
        font-weight: 760;
        cursor: pointer;
      }
      .action:disabled {
        cursor: default;
        opacity: 0.65;
      }
      .info {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        color: var(--luma-muted);
        background: color-mix(
          in srgb,
          var(--primary-text-color) 6%,
          transparent
        );
        cursor: pointer;
      }
      .info ha-icon {
        --mdc-icon-size: 17px;
      }
      .empty {
        display: grid;
        grid-template-columns: 42px minmax(0, 1fr);
        align-items: center;
        gap: 11px;
        padding: 15px;
        border: 1px solid
          color-mix(in srgb, var(--success-color) 15%, transparent);
        border-radius: 18px;
        background: linear-gradient(
          145deg,
          color-mix(in srgb, var(--success-color) 8%, var(--luma-surface)),
          var(--luma-surface)
        );
        box-shadow: var(--luma-shadow);
      }
      .empty .icon {
        --tone: var(--success-color);
      }
      .track {
        grid-column: 1/-1;
        height: 6px;
        overflow: hidden;
        border-radius: 99px;
        background: color-mix(
          in srgb,
          var(--primary-text-color) 8%,
          transparent
        );
      }
      .fill {
        height: 100%;
        border-radius: inherit;
        background: var(--tone);
      }
      .indeterminate {
        width: 34%;
        animation: travel 1.2s ease-in-out infinite;
      }
      @keyframes travel {
        0% {
          transform: translateX(-110%);
        }
        100% {
          transform: translateX(300%);
        }
      }
      @media (max-width: 599px) {
        .grid {
          grid-template-columns: 1fr;
        }
        .item {
          grid-template-columns: 40px minmax(0, 1fr) auto;
          min-height: 66px;
          padding: 12px;
        }
        .icon {
          width: 40px;
          height: 40px;
        }
        .action {
          min-width: 68px;
          padding: 7px 9px;
        }
      }
    `,
  ];

  setConfig(c: Config) {
    if (!c?.mode) throw Error("Discovery mode required.");
    this.config = { limit: 5, label: "infrastructure_update", ...c };
  }
  getCardSize() {
    return 3;
  }
  private moreInfo(e: Event, entityId: string) {
    e.stopPropagation();
    void runAction(this, this.hass!, { action: "more-info" }, entityId);
  }
  private startHold(entityId: string) {
    this.held = false;
    clearTimeout(this.holdTimer);
    this.holdTimer = window.setTimeout(() => {
      this.held = true;
      void runAction(this, this.hass!, { action: "more-info" }, entityId);
    }, 500);
  }
  private endHold() {
    clearTimeout(this.holdTimer);
  }
  private arm(entityId: string, action: () => Promise<unknown>) {
    if (this.pending !== entityId) {
      this.pending = entityId;
      clearTimeout(this.confirmTimer);
      this.confirmTimer = window.setTimeout(
        () => (this.pending = undefined),
        4000,
      );
      return;
    }
    this.pending = undefined;
    void action();
  }
  private empty(text: string) {
    return html`<div class="empty">
      <span class="icon"><ha-icon icon="mdi:check-circle"></ha-icon></span
      ><span
        ><div class="name">Minden rendben</div>
        <div class="sub">${text}</div></span
      >
    </div>`;
  }

  private favorites() {
    const source =
      this.hass!.states[
        this.config!.source_entity || "sensor.light_usage_favorites"
      ];
    const raw = (source?.attributes.lights as Favorite[] | undefined) || [];
    const items = raw
      .filter(
        (x) =>
          x.entity_id !== "light.main_light" &&
          this.hass!.states[x.entity_id] &&
          visible(this.hass!, x.entity_id),
      )
      .slice(0, this.config!.limit);
    if (!items.length)
      return this.empty(
        this.config!.empty_text ||
          localized(this.hass,"The list fills automatically as lights are used","A lista használat közben automatikusan feltöltődik"),
      );
    return html`<div class="grid">
      ${items.map((x) => {
        const entity = this.hass!.states[x.entity_id],
          area = entityAreaName(this.hass!, x.entity_id),
          childConfig = {
            type: "custom:luma-control-card",
            entity: x.entity_id,
            name: entityName(entity, x.entity_id),
            subtitle:
              area ||
              localized(
                this.hass,
                `${x.count || 0} uses`,
                `${x.count || 0} használat`,
              ),
            embedded_details: true,
            tap_action: { action: "toggle" },
            hold_action: { action: "more-info" },
          };
        return html`<luma-control-card
          ${ref((node) => {
            const card = node as (HTMLElement & LovelaceCard) | undefined;
            if (card) {
              card.setConfig(childConfig);
              card.hass = this.hass;
            }
          })}
        ></luma-control-card>`;
      })}
    </div>`;
  }

  private incidentsList(): Incident[] {
    const result: Incident[] = [];
    for (const entity of Object.values(this.hass!.states)) {
      if (!visible(this.hass!, entity.entity_id)) continue;
      const p = platform(this.hass!, entity.entity_id),
        id = entity.entity_id,
        lower = String(entity.state).toLowerCase();
      if (
        p === "uptime_kuma" &&
        id.endsWith("_allapot") &&
        !["up", "unknown", "unavailable"].includes(lower)
      )
        result.push({
          entity,
          name: entityName(entity, id).replace(" Állapot", ""),
          subtitle: "Uptime Kuma incident",
          icon: "mdi:alert-circle",
          tone: "var(--error-color)",
        });
      if (
        p === "komodo" &&
        id.endsWith("_alerts") &&
        !["", "0", "unknown", "unavailable", "none"].includes(lower)
      )
        result.push({
          entity,
          name: entityName(entity, id),
          subtitle: "Komodo alert",
          icon: "mdi:alert",
          tone: "var(--error-color)",
        });
      if (
        p === "unraid" &&
        id.startsWith("binary_sensor.tower_") &&
        entity.attributes.device_class === "problem" &&
        entity.state === "on"
      )
        result.push({
          entity,
          name: entityName(entity, id).replace("Tower ", ""),
          subtitle: "Unraid reported a problem",
          icon: "mdi:harddisk-alert",
          tone: "var(--error-color)",
        });
      const value = Number(entity.state);
      if (
        p === "unraid" &&
        /^sensor\.tower_disk_.*_usage$/.test(id) &&
        value >= 80
      )
        result.push({
          entity,
          name: entityName(entity, id).replace("Tower ", ""),
          subtitle: "Capacity warning",
          icon: "mdi:database-alert",
          tone: value >= 90 ? "var(--error-color)" : "var(--warning-color)",
        });
      if (id === "sensor.tower_ram_usage" && value >= 90)
        result.push({
          entity,
          name: "High RAM usage",
          subtitle: "Unraid memory warning",
          icon: "mdi:memory",
          tone: "var(--warning-color)",
        });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }
  private incidents() {
    const items = this.incidentsList();
    if (!items.length)
      return this.empty(
        this.config!.empty_text ||
          localized(this.hass,"No active Kuma, Komodo, or Unraid incidents","Nincs aktív Kuma, Komodo vagy Unraid incidens"),
      );
    return html`<div class="stack">
      ${items.map(
        (x) =>
          html`<button
            class="item clickable"
            style=${`--tone:${x.tone}`}
            @click=${() =>
              runAction(
                this,
                this.hass!,
                { action: "more-info" },
                x.entity.entity_id,
              )}
          >
            <span class="icon"><ha-icon icon=${x.icon}></ha-icon></span
            ><span class="copy"
              ><div class="name">${x.name}</div>
              <div class="sub">${x.subtitle}</div></span
            ><ha-icon icon="mdi:chevron-right"></ha-icon>
          </button>`,
      )}
    </div>`;
  }

  private updates() {
    const items = Object.values(this.hass!.states)
      .filter(
        (e) =>
          e.entity_id.startsWith("update.") &&
          visible(this.hass!, e.entity_id) &&
          labels(this.hass!, e.entity_id).includes(this.config!.label!) &&
          (e.state === "on" || Boolean(e.attributes.in_progress)),
      )
      .sort((a, b) =>
        entityName(a, a.entity_id).localeCompare(entityName(b, b.entity_id)),
      );
    if (!items.length)
      return this.empty(
        this.config!.empty_text || localized(this.hass,"No infrastructure updates available","Nincs elérhető infrastruktúra-frissítés"),
      );
    return html`<div class="stack">
      ${items.map((e) => {
        const a = e.attributes,
          raw = a.in_progress,
          installing = raw === true || (typeof raw === "number" && raw >= 0),
          pct = Number(
            a.update_percentage ?? (typeof raw === "number" ? raw : NaN),
          ),
          progress = Number.isFinite(pct)
            ? Math.max(0, Math.min(100, pct))
            : undefined,
          tone = installing
            ? "var(--info-color,var(--primary-color))"
            : "var(--warning-color)";
        return html`<div
          class="item"
          style=${`--tone:${tone}`}
          @click=${() =>
            runAction(this, this.hass!, { action: "more-info" }, e.entity_id)}
        >
          <span class="icon"
            ><ha-icon
              icon=${installing ? "mdi:progress-download" : "mdi:package-up"}
            ></ha-icon></span
          ><span class="copy"
            ><div class="name">${entityName(e, e.entity_id)}</div>
            <div class="sub">
              ${installing
                ? progress !== undefined
                  ? `${localize(this.hass,"installing")} · ${Math.round(progress)}%`
                  : localize(this.hass,"installing")
                : `${a.installed_version || ""} → ${a.latest_version || ""}`}
            </div></span
          ><button
            class="action"
            ?disabled=${installing}
            @click=${(ev: Event) => {
              ev.stopPropagation();
              this.arm(e.entity_id, () =>
                this.hass!.callService("update", "install", undefined, {
                  entity_id: e.entity_id,
                }),
              );
            }}
          >
            ${installing
              ? progress !== undefined
                ? `${Math.round(progress)}%`
                : localize(this.hass, "installing")
              : this.pending === e.entity_id
                ? localize(this.hass,"confirm").toLocaleUpperCase(this.hass?.locale?.language)
                : localize(this.hass, "install")}</button
          >${installing
            ? html`<span class="track"
                ><span
                  class=${`fill ${progress === undefined ? "indeterminate" : ""}`}
                  style=${progress === undefined ? "" : `width:${progress}%`}
                ></span
              ></span>`
            : nothing}
        </div>`;
      })}
    </div>`;
  }

  private deployments() {
    const buttons = Object.values(this.hass!.states)
      .filter(
        (e) =>
          platform(this.hass!, e.entity_id) === "komodo" &&
          /^button\..*_deploy_.*$/.test(e.entity_id) &&
          visible(this.hass!, e.entity_id),
      )
      .sort((a, b) => a.entity_id.localeCompare(b.entity_id));
    if (!buttons.length)
      return this.empty(
        this.config!.empty_text || "Nincs felfedezett Komodo deployment",
      );
    return html`<div class="stack">
      ${buttons.map((button) => {
        const name = niceStackName(button.entity_id),
          slug = button.entity_id.split(".")[1].split("_deploy_")[0],
          statusId = `sensor.${slug}_stack_state`,
          status = this.hass!.states[statusId];
        return html`<div
          class="item"
          style="--tone:var(--primary-color)"
          @click=${() =>
            status &&
            runAction(this, this.hass!, { action: "more-info" }, statusId)}
        >
          <span class="icon"
            ><ha-icon icon="mdi:rocket-launch-outline"></ha-icon></span
          ><span class="copy"
            ><div class="name">${name}</div>
            <div class="sub">
              ${status ? entityState(this.hass!, status) : "Komodo stack"}
            </div></span
          ><button
            class="action"
            @click=${(ev: Event) => {
              ev.stopPropagation();
              this.arm(button.entity_id, () =>
                this.hass!.callService("button", "press", undefined, {
                  entity_id: button.entity_id,
                }),
              );
            }}
          >
            ${this.pending === button.entity_id ? localize(this.hass,"confirm").toLocaleUpperCase(this.hass?.locale?.language) : "REDEPLOY"}
          </button>
        </div>`;
      })}
    </div>`;
  }

  render() {
    if (!this.hass || !this.config) return nothing;
    switch (this.config.mode) {
      case "favorite-lights":
        return this.favorites();
      case "homelab-incidents":
        return this.incidents();
      case "infrastructure-updates":
        return this.updates();
      case "komodo-deployments":
        return this.deployments();
    }
  }
}
