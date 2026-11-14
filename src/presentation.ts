import type { HassEntity, HomeAssistant } from './types';
import { localized } from './localize';

/** Reject coercible non-measurements: null, whitespace, booleans and restored data. */
export function finiteMeasurement(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
export function entityAvailable(entity?: HassEntity): entity is HassEntity {
  return !!entity && entity.attributes.restored !== true && !!entity.state.trim()
    && !['unknown', 'unavailable'].includes(entity.state);
}
export function entityMeasurement(entity?: HassEntity): number | null {
  return entityAvailable(entity) ? finiteMeasurement(entity.state) : null;
}
export function missingLabel(hass: HomeAssistant | undefined, entity?: HassEntity): string {
  if (entity?.attributes.restored === true) return localized(hass, 'Awaiting fresh data', 'Friss adatra vár');
  if (!entity || entity.state === 'unavailable') return localized(hass, 'Unavailable', 'Nem elérhető');
  return localized(hass, 'Unknown', 'Ismeretlen');
}
export function formatNumber(hass: HomeAssistant | undefined, value: number, decimals?: number): string {
  const options: Intl.NumberFormatOptions = decimals === undefined
    ? { maximumFractionDigits: 10 }
    : { minimumFractionDigits: Math.max(0, Math.min(20, decimals)), maximumFractionDigits: Math.max(0, Math.min(20, decimals)) };
  try { return new Intl.NumberFormat(hass?.locale?.language || undefined, options).format(value); }
  catch { return new Intl.NumberFormat('en', options).format(value); }
}
/** Explicit labels win; unavailable/restored values never masquerade as active measurements. */
export function presentedState(hass: HomeAssistant, entity?: HassEntity, map?: Record<string, string>): string {
  if (entity && map && Object.hasOwn(map, entity.state)) return map[entity.state];
  if (!entityAvailable(entity)) return missingLabel(hass, entity);
  const numeric = entityMeasurement(entity);
  if (numeric !== null) return `${formatNumber(hass, numeric)}${entity.attributes.unit_of_measurement ? ` ${entity.attributes.unit_of_measurement}` : ''}`;
  const native = hass.formatEntityState?.(entity);
  if (native && native !== entity.state) return native;
  const labels: Record<string, [string,string]> = {
    on:['On','Bekapcsolva'], off:['Off','Kikapcsolva'], open:['Open','Nyitva'], closed:['Closed','Zárva'],
    opening:['Opening','Nyílik'], closing:['Closing','Záródik'], idle:['Idle','Tétlen'], playing:['Playing','Lejátszás'],
    paused:['Paused','Szüneteltetve'], disarmed:['Disarmed','Kikapcsolva'], armed_away:['Armed away','Távolra élesítve'],
    armed_home:['Armed home','Otthonra élesítve'], armed_night:['Armed night','Éjszakára élesítve'],
  };
  const pair = labels[entity.state];
  return pair ? localized(hass, ...pair) : entity.state;
}
