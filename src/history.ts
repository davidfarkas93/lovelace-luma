export type HistoryPeriod = 'hour' | 'day' | 'week' | 'month';
export interface HistoryPoint { time: number; value?: number }
export interface HistoryWindow { start: number; end: number }
export interface ActivityPoint { time: number; active?: boolean }
export interface ActivityInterval { start: number; end: number }
type RecordValue = Record<string, unknown>;

export function historyNumber(value: unknown): number | undefined {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function historyTimestamp(value: unknown): number {
  if (value == null || value === '') return NaN;
  const number = typeof value === 'number' || /^\d+(\.\d+)?$/.test(String(value)) ? Number(value) : NaN;
  return Number.isFinite(number) ? number < 1e11 ? number * 1000 : number : new Date(String(value)).getTime();
}

export function historyGroups(raw: unknown): Array<{ id: string; records: RecordValue[] }> {
  const entries = Array.isArray(raw)
    ? raw.map(records => [Array.isArray(records) ? records[0]?.entity_id ?? records[0]?.entityId : '', records])
    : raw && typeof raw === 'object' ? Object.entries(raw) : [];
  return entries.filter(([id, records]) => id && Array.isArray(records))
    .map(([id, records]) => ({ id: String(id), records: (records as unknown[]).filter((row): row is RecordValue => row != null && typeof row === 'object') }));
}

export function recordTime(record: RecordValue) {
  // Attribute changes can retain last_changed while last_updated moves forward.
  return historyTimestamp(record.last_updated ?? record.lu ?? record.last_changed ?? record.lc);
}

export function recordValue(record: RecordValue, attribute?: string): unknown {
  const state = record.state ?? record.s;
  if (state == null || state === 'unknown' || state === 'unavailable') return;
  if (!attribute) return state;
  const attributes = (record.attributes ?? record.a) as RecordValue | undefined;
  if (attributes?.restored === true) return;
  return attributes?.[attribute];
}

export function bucketStart(time: number, period: HistoryPeriod): number {
  const date = new Date(time);
  date.setMinutes(0, 0, 0);
  if (period !== 'hour') date.setHours(0);
  if (period === 'week') date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  if (period === 'month') date.setDate(1);
  return date.getTime();
}

export function shiftBucket(time: number, period: HistoryPeriod, count: number): number {
  const date = new Date(time);
  if (period === 'hour') return time + count * 3600000;
  if (period === 'day') date.setDate(date.getDate() + count);
  if (period === 'week') date.setDate(date.getDate() + count * 7);
  if (period === 'month') date.setMonth(date.getMonth() + count);
  return date.getTime();
}

export function chartWindow(now: number, hours: number, period?: HistoryPeriod): HistoryWindow {
  if (!period) return { start: now - hours * 3600000, end: now };
  const current = bucketStart(now, period);
  const days = hours / 24;
  const count = Math.max(1, Math.round(period === 'month' ? days / 30.4375 : period === 'week' ? days / 7 : period === 'day' ? days : hours));
  return { start: shiftBucket(current, period, 1 - count), end: shiftBucket(current, period, 1) };
}

export function bucketCenter(time: number, period: HistoryPeriod): number {
  const start = bucketStart(time, period);
  return (start + shiftBucket(start, period, 1)) / 2;
}

export function activityIntervals(points: ActivityPoint[], window: HistoryWindow): ActivityInterval[] {
  const sorted = points.filter(point => Number.isFinite(point.time)).slice().sort((a, b) => a.time - b.time);
  const result: ActivityInterval[] = [];
  for (let index = 0; index < sorted.length; index++) {
    if (sorted[index].active !== true) continue;
    const start = Math.max(window.start, sorted[index].time);
    const end = Math.min(window.end, sorted[index + 1]?.time ?? window.end);
    if (end <= start) continue;
    const last = result.at(-1);
    if (last?.end === start) last.end = end;
    else result.push({ start, end });
  }
  return result;
}

export function mergeActivityIntervals(intervals: ActivityInterval[]): ActivityInterval[] {
  const result: ActivityInterval[] = [];
  for (const interval of intervals.slice().sort((a, b) => a.start - b.start)) {
    const last = result.at(-1);
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
    else result.push({ ...interval });
  }
  return result;
}

/** Preserve gaps and the initial recorder seed without fabricating past values. */
export function historySegments(points: HistoryPoint[], window: HistoryWindow): Array<Required<HistoryPoint>[]> {
  const sorted = points.filter(point => Number.isFinite(point.time)).slice().sort((a, b) => a.time - b.time);
  const segments: Array<Required<HistoryPoint>[]> = [];
  let segment: Required<HistoryPoint>[] = [];
  const finish = () => { if (segment.length) segments.push(segment); segment = []; };
  for (let index = 0; index < sorted.length; index++) {
    const point = sorted[index];
    if (point.time > window.end) break;
    if (point.time < window.start && sorted[index + 1]?.time <= window.start) continue;
    if (point.value == null) {
      if (segment.length) segment.push({ time: Math.min(window.end, point.time), value: segment.at(-1)!.value });
      finish();
    } else {
      segment.push({ time: Math.max(window.start, point.time), value: point.value });
    }
  }
  if (segment.length) segment.push({ time: window.end, value: segment.at(-1)!.value });
  finish();
  return segments;
}

export function tooltipLeft(anchor: number, tooltipWidth: number, containerWidth: number, padding = 8): number {
  return Math.max(padding, Math.min(containerWidth - tooltipWidth - padding, anchor - tooltipWidth / 2));
}

/** State changes apply at their recorded timestamp, never before it. */
export function historyLinePoints(points: Required<HistoryPoint>[], interpolation: 'linear' | 'step' = 'linear'): Required<HistoryPoint>[] {
  if (interpolation === 'linear') return points;
  return points.flatMap((point, index) => index === 0 ? [point] : [
    { time: point.time, value: points[index - 1].value }, point,
  ]);
}
