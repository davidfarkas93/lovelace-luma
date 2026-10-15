import type { HassEntity } from "./types";

const status = {
  heating: { en: "Heating", hu: "Fűt", icon: "mdi:fire", active: true },
  idle: { en: "Not heating", hu: "Nem fűt", icon: "mdi:pause-circle-outline", active: false },
  off: { en: "Off", hu: "Kikapcsolva", icon: "mdi:power", active: false },
  unknown: { en: "Activity unknown", hu: "Működés ismeretlen", icon: "mdi:help-circle-outline", active: false },
  unavailable: { en: "Unavailable", hu: "Nem elérhető", icon: "mdi:cloud-off-outline", active: false },
};
function temperature(value: unknown): number | undefined {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  if (typeof value === "string" && !value.trim()) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function thermostatSummary(entity?: HassEntity) {
  const unavailable = !entity || entity.state === "unavailable" || entity.attributes.restored === true;
  const known = !unavailable && !["unknown", ""].includes(entity!.state);
  const action = known ? entity!.attributes.hvac_action : undefined;
  const state = unavailable ? "unavailable" : !known ? "unknown" : entity!.state === "off" ? "off"
    : action === "heating" ? "heating" : action === "idle" || action === "off" ? "idle" : "unknown";
  return {
    ...status[state],
    current: known ? temperature(entity!.attributes.current_temperature) : undefined,
    target: known ? temperature(entity!.attributes.temperature) : undefined,
  };
}
