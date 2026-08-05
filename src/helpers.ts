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
  const found = new Map<string, LumaActiveEntity>();
  for (const rule of include) {
    for (const entity of Object.values(hass.states)) {
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
  return [...found.values()];
};

export const entityName = (entity: HassEntity | undefined, fallback = "Unknown"): string =>
  entity?.attributes.friendly_name || fallback;

export const entityIcon = (entity: HassEntity | undefined, fallback = "mdi:circle-outline"): string =>
  entity?.attributes.icon || fallback;

export const entityState = (
  hass: HomeAssistant,
  entity: HassEntity | undefined,
  stateMap?: Record<string, string>,
): string => {
  if (!entity) return "Unavailable";
  if (stateMap?.[entity.state]) return stateMap[entity.state];
  return hass.formatEntityState?.(entity) || entity.state;
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
