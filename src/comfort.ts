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
export type ComfortReason = 'cold'|'hot'|'dry'|'humid'|'particles';
export interface ComfortMetricStatus {
  severity:'normal'|'warning'|'error'|'missing';
  reason?:ComfortReason;
  direction?:'high'|'low';
}
export function comfortAssessment(values:{temperature:number|null;humidity:number|null;pm25:number|null;pm25Configured:boolean}, config:ComfortThresholds={}) {
  const c={...comfortDefaults,...config};
  function assess(value:number|null,min:number,max:number,warningMin:number,warningMax:number,lowReason:ComfortReason,highReason:ComfortReason):ComfortMetricStatus {
    if(value===null)return {severity:'missing'};
    const high=value>max,low=value<min,severe=value<warningMin||value>warningMax;
    return {severity:severe?'error':high||low?'warning':'normal',reason:high?highReason:low?lowReason:undefined,direction:high?'high':low?'low':undefined};
  }
  const metrics={
    temperature:assess(values.temperature,c.comfortable_temperature_min,c.comfortable_temperature_max,c.warning_temperature_min,c.warning_temperature_max,'cold','hot'),
    humidity:assess(values.humidity,c.comfortable_humidity_min,c.comfortable_humidity_max,c.warning_humidity_min,c.warning_humidity_max,'dry','humid'),
    pm25:assess(values.pm25,-Infinity,c.pm25_elevated,-Infinity,c.pm25_high,'particles','particles'),
  };
  const considered=[metrics.temperature,metrics.humidity,...(values.pm25Configured?[metrics.pm25]:[])];
  const reasons=considered.flatMap(m=>m.reason?[m.reason]:[]);
  const incomplete=considered.some(m=>m.severity==='missing');
  return {metrics,reasons,incomplete,status:considered.some(m=>m.severity==='error')?'error':reasons.length?'warning':incomplete?'incomplete':'comfortable'} as const;
}
