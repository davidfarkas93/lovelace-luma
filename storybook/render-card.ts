import { html, type TemplateResult } from "lit";
import type { EntityDefinition } from "./mock-hass";

export const renderCard = (
  cardType: string,
  config: Record<string, unknown>,
  entities: Record<string, EntityDefinition>,
  width = 620,
): TemplateResult => html`
  <luma-story-host
    .cardType=${cardType}
    .config=${config}
    .entities=${entities}
    .width=${width}
  ></luma-story-host>
`;
