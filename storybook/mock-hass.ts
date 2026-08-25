import type { HassEntity, HomeAssistant } from "../src/types";

export interface EntityDefinition {
  state: string | number;
  attributes?: HassEntity["attributes"];
  area?: string;
  platform?: string;
  device?: string;
  model?: string;
  labels?: string[];
  hidden?: boolean;
}

export interface ServiceCall {
  domain: string;
  service: string;
  data?: Record<string, unknown>;
  target?: Record<string, unknown>;
}

const now = (): string => new Date().toISOString();

export const createMockHass = (
  definitions: Record<string, EntityDefinition>,
  onServiceCall?: (call: ServiceCall) => void,
): HomeAssistant => {
  const states = Object.fromEntries(
    Object.entries(definitions).map(([entityId, definition]) => [
      entityId,
      {
        entity_id: entityId,
        state: String(definition.state),
        attributes: {
          friendly_name: entityId.split(".")[1].replaceAll("_", " "),
          ...definition.attributes,
        },
        last_changed: now(),
        last_updated: now(),
      } satisfies HassEntity,
    ]),
  );

  const areas: NonNullable<HomeAssistant["areas"]> = {};
  const entities: NonNullable<HomeAssistant["entities"]> = {};
  const devices: NonNullable<HomeAssistant["devices"]> = {};
  for (const [entityId, definition] of Object.entries(definitions)) {
    const areaId = definition.area?.toLowerCase().replaceAll(" ", "_");
    if (areaId) areas[areaId] = { name: definition.area };
    const deviceId = definition.device?.toLowerCase().replaceAll(" ", "_");
    entities[entityId] = { area_id: areaId, platform: definition.platform, device_id: deviceId, hidden_by: definition.hidden ? "user" : undefined, labels: definition.labels };
    if (deviceId) devices[deviceId] = { name: definition.device, model: definition.model };
  }

  return {
    states,
    entities,
    areas,
    devices,
    user: { id: "storybook", name: "Luma Explorer", is_admin: true },
    editMode: true,
    locale: { language: document.documentElement.lang || "en" },
    formatEntityState: (entity) => entity.state,
    callService: async (domain, service, data, target) => {
      onServiceCall?.({ domain, service, data, target });
    },
    callWS: async (message: Record<string, unknown>) => {
      if (message.type === "auth/sign_path") return { path: message.path } as never;
      if (message.type === "history/history_during_period") {
        const ids = (message.entity_ids as string[]) || [];
        return ids.map((id, series) => Array.from({ length: 18 }, (_, index) => ({
          entity_id: id,
          state: String(18 + series * 4 + Math.sin(index / 2) * (2 + series)),
          last_changed: new Date(Date.now() - (17 - index) * 3_600_000).toISOString(),
          attributes: states[id]?.attributes || {},
        }))) as never;
      }
      if (message.type === "logbook/get_events") return [
        { when: Date.now() / 1000 - 900, name: "Front lawn", state: "on", entity_id: "switch.front_lawn" },
        { when: Date.now() / 1000 - 1500, name: "Irrigation", state: "Program started", entity_id: "sensor.irrigation_state" },
        { when: Date.now() / 1000 - 4200, name: "Rain sensor", state: "dry", entity_id: "binary_sensor.rain" },
      ] as never;
      if (message.type === "call_service" && message.domain === "weather") return {
        response: { "weather.home": { forecast: demoForecast() } },
      } as never;
      return {} as never;
    },
  };
};

const demoForecast = () => Array.from({ length: 7 }, (_, index) => ({
  datetime: new Date(Date.now() + index * 86_400_000).toISOString(),
  condition: ["partlycloudy", "sunny", "rainy", "cloudy"][index % 4],
  temperature: 24 - index * .5,
  templow: 14 + index * .3,
  precipitation_probability: [10, 5, 65, 25][index % 4],
  wind_speed: 8 + index,
}));
