export interface CameraEvent {
  id?: string;
  timestamp?: string;
  url?: string;
  snapshot?: string;
  type?: string;
}

export interface CameraEventGroup extends CameraEvent { members: CameraEvent[] }

const generic = (type?: string) => !type || ["motion", "smartDetectLine", "smartDetectZone"].includes(type);

/** Group only a bounded time window from one camera; keep distinct object types apart. */
export function groupCameraEvents(events: CameraEvent[], seconds = 0): CameraEventGroup[] {
  const sorted = [...events].sort((a, b) => (Date.parse(b.timestamp || "") || 0) - (Date.parse(a.timestamp || "") || 0));
  const groups: CameraEventGroup[] = [];
  const anchors = new Map<CameraEventGroup, number>();
  for (const event of sorted) {
    const time = Date.parse(event.timestamp || "");
    const group = seconds > 0 && Number.isFinite(time) && event.type !== "ring"
      ? groups.find(g => g.type !== "ring" && anchors.get(g)! - time <= seconds * 1000
        && (generic(g.type) || generic(event.type) || g.type === event.type))
      : undefined;
    if (group) {
      group.members.push(event);
      if (generic(group.type) && !generic(event.type)) Object.assign(group, event);
    } else {
      const next = { ...event, members: [event] };
      groups.push(next);
      anchors.set(next, Number.isFinite(time) ? time : Infinity);
    }
  }
  return groups;
}
