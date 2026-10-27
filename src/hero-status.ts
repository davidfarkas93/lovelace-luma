import type { HassEntity } from "./types";

export interface HeroSummaryGroup {
  items: { entity: string; name?: string }[];
  active_states?: string[];
  inactive_states?: string[];
  active_label?: string;
  clear_label?: string;
  show_active?: boolean;
}

export function summarizeHeroGroup(states: Record<string, HassEntity>, group: HeroSummaryGroup) {
  const active: string[] = [], unavailable: string[] = [];
  const seen = new Set<string>();
  for (const item of group.items) {
    if (seen.has(item.entity)) continue;
    seen.add(item.entity);
    const entity = states[item.entity];
    const name = item.name || entity?.attributes.friendly_name || item.entity;
    if (!entity || ["unknown", "unavailable"].includes(entity.state)) unavailable.push(name);
    else if ((group.active_states || ["on"]).includes(entity.state)) active.push(name);
    else if (!(group.inactive_states || ["off"]).includes(entity.state)) unavailable.push(name);
  }
  return { active, unavailable, clear: seen.size > 0 && !active.length && !unavailable.length };
}
