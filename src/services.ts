import { glob } from './helpers';
import type { HassEntity, HomeAssistant } from './types';

export interface ServiceSelector {
  integration?: string;
  domain?: string;
  entity_pattern?: string;
  exclude?: string[];
}
export interface ServiceMetric {
  from: string;
  to: string;
}
export interface ServiceBinding {
  entity: string;
  monitor?: string;
  name?: string;
  icon?: string;
  url?: string;
}
export interface ServiceOperation {
  name: string;
  icon?: string;
  selector: ServiceSelector;
  service: string;
  confirm: string;
  state?: string[];
}
export interface ServiceGridConfig {
  type: string;
  compact?: boolean;
  stacks?: ServiceSelector;
  containers?: ServiceSelector;
  updates?: ServiceSelector;
  alerts?: ServiceSelector;
  monitors?: ServiceSelector;
  metrics?: { latency?: ServiceMetric; uptime?: ServiceMetric; url?: ServiceMetric };
  uptime_label?: string;
  bindings?: ServiceBinding[];
  operations?: ServiceOperation[];
  monitor_groups?: { name: string; entity_pattern: string }[];
  name_remove?: string[];
  columns?: number;
  tablet_columns?: number;
  mobile_columns?: number;
  show_details?: string;
}
export interface ServiceItem {
  entity: string;
  name: string;
  icon: string;
  stack?: HassEntity;
  monitor?: HassEntity;
  monitorConfigured: boolean;
  containers: HassEntity[];
  updates: HassEntity[];
  alerts: HassEntity[];
  operations: { config: ServiceOperation; entity: HassEntity }[];
  latency?: HassEntity;
  uptime?: HassEntity;
  url?: string;
  group: string;
}
export const serviceEntityVisible = (hass: HomeAssistant, id: string, allowRestored = false) => {
  const r = hass.entities?.[id];
  return !r?.hidden && !r?.hidden_by && !r?.disabled && !r?.disabled_by &&
    (allowRestored || !hass.states[id]?.attributes.restored);
};
export const serviceMatches = (hass: HomeAssistant, id: string, selector?: ServiceSelector, allowRestored = false): boolean => {
  if (!selector || !serviceEntityVisible(hass, id, allowRestored)) return false;
  return (!selector.integration || hass.entities?.[id]?.platform === selector.integration) &&
    (!selector.domain || id.split('.')[0] === selector.domain) &&
    (!selector.entity_pattern || glob(selector.entity_pattern, id)) &&
    !selector.exclude?.some(pattern => glob(pattern, id));
};
export const serviceNumber = (entity?: HassEntity): number | undefined => {
  if (!entity || !entity.state.trim()) return undefined;
  const value = Number(entity.state);
  return Number.isFinite(value) ? value : undefined;
};
export const serviceUrl = (value?: string): string | undefined => {
  if (!value) return undefined;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined; }
  catch { return undefined; }
};
const lower = (entity?: HassEntity) => entity?.state.toLowerCase() || 'unknown';
export const serviceAvailable = (entity?: HassEntity) => Boolean(entity &&
  entity.state.toLowerCase() !== 'unavailable' && !entity.attributes.restored);
export const serviceRunning = (entity?: HassEntity) => ['on', 'running'].includes(lower(entity));
const updateActive = (entity: HassEntity) => entity.state === 'on' || entity.attributes.in_progress === true ||
  typeof entity.attributes.in_progress === 'number';
export const serviceHealth = (item: ServiceItem) => {
  const running = item.containers.filter(serviceRunning).length;
  const unknown = item.containers.filter(e => ['unknown', 'unavailable'].includes(lower(e))).length;
  const total = item.containers.length;
  const monitorState = !item.monitorConfigured ? 'unmonitored' :
    lower(item.monitor) === 'up' ? 'up' : lower(item.monitor) === 'down' ? 'down' : 'unknown';
  const stackState = lower(item.stack);
  const stackBad = Boolean(item.stack && !['running', 'on'].includes(stackState));
  const attention = stackBad || Boolean(item.stack && total === 0) || running < total || item.alerts.length > 0;
  const tone = monitorState === 'down' ? 'error' : attention ? 'warning' :
    monitorState === 'up' ? 'success' : 'muted';
  return { running, total, unknown, monitorState, stackState, attention, tone,
    updateCount: item.updates.filter(updateActive).length };
};

/** Group by registry device, never by display-name guessing or site-specific IDs. */
export function discoverServices(hass: HomeAssistant, config: ServiceGridConfig): ServiceItem[] {
  const entries = Object.values(hass.states);
  const byDevice = new Map<string, HassEntity[]>();
  for (const e of entries) {
    const device = hass.entities?.[e.entity_id]?.device_id;
    if (device) { const group = byDevice.get(device) || []; group.push(e); byDevice.set(device, group); }
  }
  const bindings = new Map(config.bindings?.map(binding => [binding.entity, binding]) || []);
  const usedMonitors = new Set(config.bindings?.flatMap(binding => binding.monitor ? [binding.monitor] : []) || []);
  const cleanName = (name: string) => (config.name_remove || []).reduce((n, text) => n.replace(text, ''), name).trim();
  const relatedMetric = (monitor: string | undefined, metric?: ServiceMetric) =>
    monitor && metric && monitor.endsWith(metric.from)
      ? hass.states[monitor.slice(0, -metric.from.length) + metric.to] : undefined;
  const make = (e: HassEntity, stack: boolean): ServiceItem => {
    const binding = bindings.get(e.entity_id);
    const deviceId = hass.entities?.[e.entity_id]?.device_id;
    const device = deviceId ? hass.devices?.[deviceId] : undefined;
    const siblings = deviceId ? byDevice.get(deviceId) || [] : [];
    const monitorId = stack ? binding?.monitor : e.entity_id;
    const monitor = monitorId ? hass.states[monitorId] : undefined;
    return {
      entity: e.entity_id,
      name: binding?.name || (stack ? device?.name_by_user || device?.name : undefined) ||
        cleanName(String(e.attributes.friendly_name || e.entity_id)),
      icon: binding?.icon || (stack ? 'mdi:cube-outline' : 'mdi:heart-pulse'),
      stack: stack ? e : undefined, monitor, monitorConfigured: Boolean(monitorId),
      containers: stack ? siblings.filter(x => x.entity_id !== e.entity_id && serviceMatches(hass, x.entity_id, config.containers)) : [],
      updates: stack ? siblings.filter(x => serviceMatches(hass, x.entity_id, config.updates)) : [],
      alerts: stack ? siblings.filter(x => serviceMatches(hass, x.entity_id, config.alerts) &&
        !['', '0', 'none', '[]', 'off', 'unknown', 'unavailable'].includes(lower(x))) : [],
      operations: stack ? (config.operations || []).flatMap(op => siblings.filter(x =>
        serviceMatches(hass, x.entity_id, op.selector)).map(entity => ({ config: op, entity }))) : [],
      latency: relatedMetric(monitorId, config.metrics?.latency),
      uptime: relatedMetric(monitorId, config.metrics?.uptime),
      url: serviceUrl(binding?.url || relatedMetric(monitorId, config.metrics?.url)?.state),
      group: stack ? '' : config.monitor_groups?.find(group => glob(group.entity_pattern, e.entity_id))?.name || '',
    };
  };
  // Explicit bindings remain visible during integration recovery, even if HA
  // temporarily restores their unavailable state. Unbound old orphans stay out.
  const stacks = entries.filter(e => serviceMatches(hass, e.entity_id, config.stacks, bindings.has(e.entity_id))).map(e => make(e, true));
  const monitors = entries.filter(e => serviceMatches(hass, e.entity_id, config.monitors, bindings.has(e.entity_id)) && !usedMonitors.has(e.entity_id)).map(e => make(e, false));
  return [...stacks, ...monitors].sort((a, b) => a.name.localeCompare(b.name));
}
