export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown> & {
    friendly_name?: string;
    icon?: string;
    unit_of_measurement?: string;
  };
  last_changed: string;
  last_updated: string;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  locale?: { language?: string };
  formatEntityState?: (state: HassEntity) => string;
  callService: (
    domain: string,
    service: string,
    data?: Record<string, unknown>,
    target?: Record<string, unknown>,
  ) => Promise<unknown>;
}

export type LumaAction =
  | { action: "none" }
  | { action: "navigate"; navigation_path: string }
  | { action: "more-info"; entity?: string }
  | { action: "toggle"; entity?: string }
  | {
      action: "perform-action" | "call-service";
      perform_action?: string;
      service?: string;
      data?: Record<string, unknown>;
      target?: Record<string, unknown>;
    };

export interface LumaCondition {
  state?: string | string[];
  state_not?: string | string[];
  above?: number;
  below?: number;
}

export interface LumaEntityItem extends LumaCondition {
  entity: string;
  name?: string;
  icon?: string;
  color?: string;
  show_state?: boolean;
  state_map?: Record<string, string>;
  tap_action?: LumaAction;
}

export interface LumaBannerConfig extends LumaEntityItem {
  label?: string;
  state_label?: string;
  secondary_label?: string;
  secondary_action?: LumaAction;
}

export type LumaIncidentTone = "warning" | "error";

export interface LumaIncidentRule extends LumaCondition {
  entity?: string;
  entity_pattern?: string;
  related_suffix?: { from: string; to: string };
  device_classes?: string[];
  message: string;
  tone?: LumaIncidentTone;
  navigation_path?: string;
  for_minutes?: number;
  aggregate?: boolean;
  dismissible?: boolean;
}

export interface LovelaceCard extends HTMLElement {
  hass?: HomeAssistant;
  setConfig(config: unknown): void;
  getCardSize?(): number | Promise<number>;
}

declare global {
  interface Window {
    loadCardHelpers?: () => Promise<{
      createCardElement: (config: Record<string, unknown>) => HTMLElement;
    }>;
    customCards?: Array<{
      type: string;
      name: string;
      description: string;
      preview?: boolean;
      documentationURL?: string;
    }>;
  }
}
