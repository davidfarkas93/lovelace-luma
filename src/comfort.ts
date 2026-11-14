import type { HassEntity, HomeAssistant } from "./types";

interface Activity { en: string; hu: string; icon: string; color: string }
interface ActivityConfig { heating_entity?: string; air_conditioner_entity?: string }
const heating: Activity = { en: "Heating", hu: "Fűtés", icon: "mdi:radiator", color: "var(--warning-color)" };
const acActions: Record<string, Activity> = {
  heating: { ...heating, en: "AC heating", hu: "Klíma fűtés", icon: "mdi:air-conditioner" },
  cooling: { en: "AC cooling", hu: "Klíma hűtés", icon: "mdi:snowflake", color: "var(--info-color, #039be5)" },
  drying: { en: "AC drying", hu: "Klíma párátlanítás", icon: "mdi:water-percent", color: "var(--info-color, #039be5)" },
  fan: { en: "AC fan", hu: "Klíma ventilátor", icon: "mdi:fan", color: "var(--primary-color)" },
  defrosting: { en: "AC defrosting", hu: "Klíma leolvasztás", icon: "mdi:snowflake-melt", color: "var(--warning-color)" },
};
function available(entity?: HassEntity): entity is HassEntity {
  return !!entity && !["", "unknown", "unavailable"].includes(entity.state) && entity.attributes.restored !== true;
}

export function comfortActivity(hass: HomeAssistant, config: ActivityConfig): Activity[] {
  const result: Activity[] = [];
  const heat = config.heating_entity ? hass.states[config.heating_entity] : undefined;
  if (available(heat)) {
    const active = heat.entity_id.startsWith("climate.")
      ? heat.attributes.hvac_action === "heating"
      : ["on", "heat", "heating"].includes(heat.state);
    if (active) result.push(heating);
  }
  const ac = config.air_conditioner_entity ? hass.states[config.air_conditioner_entity] : undefined;
  if (available(ac) && ac.state !== "off") {
    const action = ac.attributes.hvac_action;
    if (typeof action === "string" && acActions[action]) result.push(acActions[action]);
    else if (action == null && ["auto", "heat", "cool", "heat_cool", "dry", "fan_only"].includes(ac.state)) {
      result.push({ en: "AC on", hu: "Klíma bekapcsolva", icon: "mdi:air-conditioner", color: "var(--primary-color)" });
    }
  }
  return result;
}

export const comfortDefaults = {
  comfortable_temperature_min:18, comfortable_temperature_max:25,
  warning_temperature_min:16, warning_temperature_max:27,
  comfortable_humidity_min:35, comfortable_humidity_max:65,
  warning_humidity_min:30, warning_humidity_max:70,
  pm25_elevated:12, pm25_high:35,
};
export type ComfortThresholds = Partial<typeof comfortDefaults>;
export function comfortAssessment(values:{temperature:number|null;humidity:number|null;pm25:number|null;pm25Configured:boolean}, config:ComfortThresholds={}) {
  const c={...comfortDefaults,...config}, t=values.temperature,h=values.humidity,p=values.pm25;
  const reasons: Array<'cold'|'hot'|'dry'|'humid'|'particles'>=[];
  if(t!==null&&t<c.comfortable_temperature_min)reasons.push('cold');
  if(t!==null&&t>c.comfortable_temperature_max)reasons.push('hot');
  if(h!==null&&h<c.comfortable_humidity_min)reasons.push('dry');
  if(h!==null&&h>c.comfortable_humidity_max)reasons.push('humid');
  if(p!==null&&p>c.pm25_elevated)reasons.push('particles');
  const high=(t!==null&&(t<c.warning_temperature_min||t>c.warning_temperature_max))
    ||(h!==null&&(h<c.warning_humidity_min||h>c.warning_humidity_max))||(p!==null&&p>c.pm25_high);
  const incomplete=t===null||h===null||(values.pm25Configured&&p===null);
  return {reasons,incomplete,status:high?'error':reasons.length?'warning':incomplete?'incomplete':'comfortable'} as const;
}
