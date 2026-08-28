import type {
  HassEntity,
  HomeAssistant,
  LumaAction,
  LumaActiveConfig,
  LumaActiveEntity,
  LumaActiveRule,
  LumaCondition,
  LumaEntityItem,
} from "./types";

export const glob = (pattern: string, value: string): boolean => {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(value);
};

const activeValue = (entity: HassEntity, rule: LumaActiveRule): string =>
  String(rule.attribute ? entity.attributes[rule.attribute] ?? "" : entity.state);

export const activeEntities = (
  hass: HomeAssistant,
  config: LumaActiveConfig | undefined,
  legacyExclude: string[] = [],
): LumaActiveEntity[] => {
  const include = config?.include?.length
    ? config.include
    : [
        { domain: "light", state: "on", exclude_groups: true },
        { domain: "media_player", state_not: ["off", "idle", "standby", "unknown", "unavailable"] },
        { domain: "climate", attribute: "hvac_action", state: ["heating", "cooling", "drying", "fan"] },
      ];
  const exclude = [...legacyExclude, ...(config?.exclude || [])];
  const excludeHidden = config?.exclude_hidden ?? true;
  const excludeDisabled = config?.exclude_disabled ?? true;
  const excludePlatforms = config?.exclude_platforms ?? ["switch_as_x"];
  const found = new Map<string, LumaActiveEntity>();
  for (const rule of include) {
    for (const entity of Object.values(hass.states)) {
      const registry = hass.entities?.[entity.entity_id];
      if (excludeHidden && (registry?.hidden === true || Boolean(registry?.hidden_by))) continue;
      if (excludeDisabled && (registry?.disabled === true || Boolean(registry?.disabled_by))) continue;
      // Broad domain discovery should not surface technical light wrappers for
      // hidden relay switches. Explicit entity/pattern rules remain an opt-in.
      const isBroadRule = Boolean(rule.domain && !rule.entity && !rule.entity_pattern);
      if (isBroadRule && registry?.platform && excludePlatforms.includes(registry.platform)) continue;
      if (rule.entity && entity.entity_id !== rule.entity) continue;
      if (rule.entity_pattern && !glob(rule.entity_pattern, entity.entity_id)) continue;
      if (rule.domain && entity.entity_id.split(".")[0] !== rule.domain) continue;
      if (!rule.entity && !rule.entity_pattern && !rule.domain) continue;
      if (exclude.some((pattern) => glob(pattern, entity.entity_id))) continue;
      const members = entity.attributes.entity_id || entity.attributes.group_entities;
      if (rule.exclude_groups && Array.isArray(members) && members.length) continue;
      const value = activeValue(entity, rule);
      if (rule.state !== undefined && !includesState(rule.state, value)) continue;
      if (rule.state_not !== undefined && includesState(rule.state_not, value)) continue;
      const numeric = Number(value);
      if (rule.above !== undefined && (!Number.isFinite(numeric) || numeric <= rule.above)) continue;
      if (rule.below !== undefined && (!Number.isFinite(numeric) || numeric >= rule.below)) continue;
      found.set(entity.entity_id, { entity, rule });
    }
  }

  // Some integrations expose overlapping logical light groups without their
  // member list. Collapse lets the dashboard describe those aliases while
  // still selecting the best currently-active representation at runtime.
  for (const collapse of config?.collapse || []) {
    if (!collapse.entities?.length) continue;
    const matches = [...found.keys()].filter((entityId) =>
      collapse.entities.some((pattern) => glob(pattern, entityId)),
    );
    if (matches.length < 2) continue;
    const preferred = collapse.prefer
      ? matches.find((entityId) => glob(collapse.prefer!, entityId))
      : undefined;
    const keep = preferred || matches[0];
    for (const entityId of matches) {
      if (entityId !== keep) found.delete(entityId);
    }
  }
  return [...found.values()];
};

export const entityName = (entity: HassEntity | undefined, fallback = "Unknown"): string =>
  entity?.attributes.friendly_name || fallback;

export const entityIcon = (entity: HassEntity | undefined, fallback = "mdi:circle-outline"): string =>
  entity?.attributes.icon || fallback;

export const entityAreaName = (hass: HomeAssistant, entityId: string): string | undefined => {
  const registry = hass.entities?.[entityId];
  const areaId = registry?.area_id || (registry?.device_id ? hass.devices?.[registry.device_id]?.area_id : undefined);
  return areaId ? hass.areas?.[areaId]?.name : undefined;
};

export const entityState = (
  hass: HomeAssistant,
  entity: HassEntity | undefined,
  stateMap?: Record<string, string>,
): string => {
  if (!entity) return "Unavailable";
  if (stateMap?.[entity.state]) return stateMap[entity.state];
  const numeric = Number(entity.state);
  if (Number.isFinite(numeric) && entity.state.includes(".")) {
    const value = new Intl.NumberFormat(hass.locale?.language || undefined, { maximumFractionDigits: 2 }).format(numeric);
    const unit = entity.attributes.unit_of_measurement;
    return unit ? `${value} ${unit}` : value;
  }
  return hass.formatEntityState?.(entity) || entity.state;
};

const commonMediaApps: Record<string, string> = {
  "com.google.android.apps.tv.launcherx": "Google TV",
  "com.google.android.tvlauncher": "Android TV",
  "com.google.android.youtube.tv": "YouTube",
  "com.netflix.ninja": "Netflix",
  "com.spotify.tv.android": "Spotify",
  "com.github.damontecres.wholphin": "Wholphin",
};

export const mediaAppName = (
  entity: HassEntity | undefined,
  overrides: Record<string, string> = {},
): string => {
  const raw = String(entity?.attributes.app_id || entity?.attributes.app_name || "");
  if (!raw) return "";
  if (overrides[raw]) return overrides[raw];
  if (commonMediaApps[raw]) return commonMediaApps[raw];
  if (!raw.includes(".")) return raw;
  const ignored = new Set(["android", "tv", "app", "apps", "mobile", "client", "ninja"]);
  const part = raw.split(".").reverse().find((value) => value && !ignored.has(value.toLowerCase())) || raw;
  return part.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const includesState = (expected: string | string[] | undefined, actual: string): boolean =>
  expected === undefined
    ? false
    : Array.isArray(expected)
      ? expected.includes(actual)
      : expected === actual;

export const conditionMatches = (
  entity: HassEntity | undefined,
  condition: LumaCondition,
): boolean => {
  if (!entity) return false;
  if (condition.state !== undefined && !includesState(condition.state, entity.state)) return false;
  if (condition.state_not !== undefined && includesState(condition.state_not, entity.state)) return false;

  const numeric = Number(entity.state);
  if (condition.above !== undefined && (!Number.isFinite(numeric) || numeric <= condition.above)) {
    return false;
  }
  if (condition.below !== undefined && (!Number.isFinite(numeric) || numeric >= condition.below)) {
    return false;
  }
  return true;
};

export const itemIsVisible = (hass: HomeAssistant, item: LumaEntityItem): boolean => {
  const hasCondition =
    item.state !== undefined ||
    item.state_not !== undefined ||
    item.above !== undefined ||
    item.below !== undefined;
  return !hasCondition || conditionMatches(hass.states[item.entity], item);
};

const fire = (node: HTMLElement, type: string, detail: Record<string, unknown>): void => {
  node.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
};

export const runAction = async (
  node: HTMLElement,
  hass: HomeAssistant,
  action: LumaAction | undefined,
  defaultEntity?: string,
): Promise<void> => {
  if (!action || action.action === "none") return;

  if (action.action === "navigate") {
    const oldURL = window.location.href;
    history.pushState(null, "", action.navigation_path);
    window.dispatchEvent(new Event("location-changed"));
    if (new URL(oldURL).hash !== window.location.hash) {
      window.dispatchEvent(new HashChangeEvent("hashchange", { oldURL, newURL: window.location.href }));
    }
    return;
  }

  if (action.action === "url") {
    window.open(action.url_path, "_blank", "noopener,noreferrer");
    return;
  }

  if (action.action === "more-info") {
    const entityId = action.entity || defaultEntity;
    if (entityId) fire(node, "hass-more-info", { entityId });
    return;
  }

  if (action.action === "toggle") {
    const entityId = action.entity || defaultEntity;
    if (!entityId) return;
    const domain = entityId.split(".")[0];
    await hass.callService(domain, "toggle", undefined, { entity_id: entityId });
    return;
  }

  const serviceName = action.perform_action || action.service;
  if (!serviceName?.includes(".")) return;
  const [domain, service] = serviceName.split(".", 2);
  await hass.callService(domain, service, action.data, action.target);
};

export const relevantEntityIds = (items: Array<{ entity: string }> = []): string[] =>
  [...new Set(items.map((item) => item.entity).filter(Boolean))];
