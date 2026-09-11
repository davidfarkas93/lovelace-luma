import type { HassEntity, HomeAssistant, LumaIncidentRule } from "./types";
export type IncidentMatcherRule = Omit<LumaIncidentRule,"message">;

export const glob = (pattern: string, value: string): boolean => {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(value);
};

const listed = (
  expected: string | string[] | undefined,
  actual: string,
): boolean =>
  expected === undefined
    ? false
    : (Array.isArray(expected) ? expected : [expected])
        .map((value) => value.toLocaleLowerCase())
        .includes(actual.toLocaleLowerCase());

export const matchesIncidentRule = (
  entity: HassEntity | undefined,
  rule: IncidentMatcherRule,
): boolean => {
  if (!entity) return false;
  if (rule.state !== undefined && !listed(rule.state, entity.state)) return false;
  if (rule.state_not !== undefined && listed(rule.state_not, entity.state)) return false;
  const numeric = Number(entity.state);
  if (rule.above !== undefined && (!Number.isFinite(numeric) || numeric <= rule.above)) return false;
  if (rule.below !== undefined && (!Number.isFinite(numeric) || numeric >= rule.below)) return false;
  if (rule.for_minutes && Date.now() - new Date(entity.last_changed).getTime() < rule.for_minutes * 60_000) return false;
  return true;
};

export const incidentSourceIds = (
  hass: HomeAssistant,
  rule: IncidentMatcherRule,
): string[] => {
  const ids = Object.keys(hass.states);
  let sources: string[] = [];
  if (rule.entity) sources = [rule.entity];
  else if (rule.entity_patterns) sources = ids.filter((id) => rule.entity_patterns!.some((pattern) => glob(pattern, id)));
  else if (rule.entity_pattern) sources = ids.filter((id) => glob(rule.entity_pattern!, id));
  else if (rule.device_classes) sources = ids;
  return sources.filter((id) => {
    const entity = hass.states[id];
    if (!entity) return false;
    if (rule.exclude?.some((pattern) => glob(pattern, id))) return false;
    if (rule.platform && hass.entities?.[id]?.platform !== rule.platform) return false;
    if (rule.label && !hass.entities?.[id]?.labels?.includes(rule.label)) return false;
    if (rule.device_classes?.length && !rule.device_classes.includes(String(entity.attributes.device_class || ""))) return false;
    return true;
  });
};

export const matchingIncidentIds = (
  hass: HomeAssistant,
  rule: IncidentMatcherRule,
): string[] => incidentSourceIds(hass, rule).filter((source) => {
  const evaluated = rule.related_suffix
    ? source.replace(rule.related_suffix.from, rule.related_suffix.to)
    : source;
  return matchesIncidentRule(hass.states[evaluated], rule);
});
