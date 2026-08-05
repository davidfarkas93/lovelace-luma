import type {
  HassEntity,
  HomeAssistant,
  LumaAction,
  LumaCondition,
  LumaEntityItem,
} from "./types";

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
