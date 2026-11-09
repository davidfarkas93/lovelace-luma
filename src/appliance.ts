import type { HassEntity, HomeAssistant } from "./types";

const missing = new Set(["", "unknown", "unavailable", "none"]);

export const applianceSeconds = (
  entity: HassEntity | undefined,
  now = Date.now(),
): number | undefined => {
  if (!entity || missing.has(String(entity.state).trim().toLowerCase())) return;
  if (entity.attributes.device_class === "timestamp") {
    const end = Date.parse(entity.state);
    return Number.isFinite(end) ? Math.max(0, (end - now) / 1000) : undefined;
  }
  const raw = entity.state;
  const iso = raw.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (iso) return +(iso[1] || 0) * 3600 + +(iso[2] || 0) * 60 + +(iso[3] || 0);
  const parts = raw.split(":").map(Number);
  if (parts.every(Number.isFinite)) {
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
  }
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return;
  const unit = String(entity.attributes.unit_of_measurement || "s").toLowerCase();
  return numeric * (unit === "h" ? 3600 : unit === "min" ? 60 : 1);
};

export const applianceDuration = (seconds: number | undefined, hass?:HomeAssistant): string =>
  seconds == null
    ? ""
    : seconds >= 3600
      ? `${Math.floor(seconds / 3600)} ${hass?.locale?.language?.startsWith("hu") || !hass ? "ó" : "h"} ${Math.ceil((seconds % 3600) / 60)} ${hass?.locale?.language?.startsWith("hu") || !hass ? "p" : "min"}`
      : `${Math.ceil(seconds / 60)} ${hass?.locale?.language?.startsWith("hu") || !hass ? "p" : "min"}`;

export const applianceFinishTime = (entity: HassEntity | undefined, hass?:HomeAssistant): string => {
  if (!entity || entity.attributes.device_class !== "timestamp") return "";
  const value = Date.parse(entity.state);
  return Number.isFinite(value)
    ? new Intl.DateTimeFormat(hass?.locale?.time_format === "system" ? undefined : hass?.locale?.language, { hour: "2-digit", minute: "2-digit", ...(hass?.locale?.time_format === "12" ? {hour12:true} : hass?.locale?.time_format === "24" ? {hour12:false} : {}) }).format(value).replace(/\s/g,"\u00a0")
    : "";
};

export const applianceProgress = (
  remaining: number | undefined,
  total: number | undefined,
): number | undefined =>
  remaining != null && total != null && total > 0
    ? Math.max(0, Math.min(100, (1 - remaining / total) * 100))
    : undefined;
