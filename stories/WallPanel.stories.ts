import type { Meta, StoryObj } from "@storybook/web-components-vite";
import type { LumaWallPanelCard } from "../src/cards/luma-wall-panel-card";
import "../src/cards/luma-wall-panel-card";
import { renderCard } from "../storybook/render-card";
import { createMockHass, type EntityDefinition } from "../storybook/mock-hass";

const lights = [
  { entity: "light.sofa", name: "Kanapé", icon: "mdi:ceiling-light-outline" },
  { entity: "light.spots", name: "Kanapé spot", icon: "mdi:track-light" },
  { entity: "light.island", name: "Konyhasziget", icon: "mdi:ceiling-light-multiple-outline" },
  { entity: "light.counter", name: "Munkapult", icon: "mdi:led-strip-variant" },
  { entity: "light.kitchen", name: "Konyha spot", icon: "mdi:track-light" },
  { entity: "light.all", name: "Összes fény", subtitle: "Nappali + konyha", icon: "mdi:lightbulb-group-outline" },
];
const definitions: Record<string, EntityDefinition> = {
  ...Object.fromEntries(lights.map((l, i) => [l.entity, { state: i === 3 ? "off" : "on", attributes: { brightness: [180,75,210,0,128,140][i], supported_color_modes: ["brightness"] } }])),
  "sensor.temp": { state: 23.2, attributes: { unit_of_measurement: "°C" } },
  "sensor.humidity": { state: 54, attributes: { unit_of_measurement: "%" } },
  "cover.room": { state: "open", attributes: { supported_features: 15, current_position: 50 } },
  "media_player.tv": { state: "playing" }, "fan.air": { state: "on" },
  "scene.film": { state: "2026-11-17T10:00:00Z" }, "scene.relax": { state: "2026-11-17T10:00:00Z" },
};
const config = {
  name: "Nappali", lights,
  metrics: [{ entity: "sensor.temp", icon: "mdi:thermometer" }, { entity: "sensor.humidity", icon: "mdi:water-percent" }],
  cover: { entity: "cover.room", name: "Nappali + konyha" },
  scenes: [
    { entity: "scene.film", name: "Film", icon: "mdi:movie-open-outline", tap_action: { action: "perform-action", perform_action: "scene.turn_on", target: { entity_id: "scene.film" } } },
    { entity: "scene.relax", name: "Pihenés", icon: "mdi:weather-night", tap_action: { action: "perform-action", perform_action: "scene.turn_on", target: { entity_id: "scene.relax" } } },
    { entity: "light.all", name: "Teljes fény", icon: "mdi:brightness-7", tap_action: { action: "perform-action", perform_action: "light.turn_on", target: { entity_id: "light.all" }, data: { brightness_pct: 100 } } },
    { entity: "light.all", name: "Fények le", icon: "mdi:lightbulb-multiple-off-outline", tap_action: { action: "perform-action", perform_action: "light.turn_off", target: { entity_id: "light.all" } } },
  ],
  shortcuts: [
    { entity: "media_player.tv", name: "TV", icon: "mdi:television", tap_action: { action: "more-info" } },
    { entity: "fan.air", name: "Levegő", icon: "mdi:air-purifier", tap_action: { action: "more-info" } },
    { name: "Redőnyök", icon: "mdi:window-shutter", tap_action: { action: "navigate", navigation_path: "#shutters" } },
  ],
};
const meta: Meta = { title: "Cards/Wall Panel", component: "luma-wall-panel-card" };
export default meta;
type Story = StoryObj;
export const Landscape: Story = { render: () => renderCard("custom:luma-wall-panel-card", config, definitions, 1280) };
export const Portrait: Story = { render: () => renderCard("custom:luma-wall-panel-card", config, definitions, 768) };
export const Unavailable: Story = { render: () => renderCard("custom:luma-wall-panel-card", config, { ...definitions, "light.sofa": { state: "unavailable" }, "light.spots": { state: "unknown" }, "cover.room": { state: "unavailable" } }, 1280) };
export const LightFader: Story = { render: () => renderCard("custom:luma-light-fader-card", lights[0], definitions, 280) };
export const NonDimmable: Story = { render: () => renderCard("custom:luma-light-fader-card", lights[0], { "light.sofa": { state: "on", attributes: { supported_color_modes: ["onoff"] } } }, 280) };

// Standalone, interactive demo. These IDs and service calls never reach Home Assistant.
function interactiveDemo(dark = false, hardware = false, horizontal = false) {
    const buttons = config.scenes.map((s,i) => ({ entity: `event.button_${i+1}`, name: s.name, icon: s.icon, event_type: "single_push" }));
    const card = document.createElement("luma-wall-panel-card") as LumaWallPanelCard;
    card.setConfig({ type: "custom:luma-wall-panel-card", ...config, fullscreen: true, ...(horizontal ? { light_orientation: "horizontal" } : {}), ...(hardware ? { physical_buttons: { side: "right", buttons } } : {}) } as Parameters<LumaWallPanelCard["setConfig"]>[0]);
    let hass = createMockHass({ ...definitions, ...Object.fromEntries(buttons.map(b => [b.entity, { state: "2026-01-01T00:00:00Z", attributes: { event_type: "single_push" } }])) });
    hass.formatEntityState = e => e.attributes.unit_of_measurement ? `${e.state} ${e.attributes.unit_of_measurement}` : ({ open: "Nyitva", closed: "Zárva", on: "Be", off: "Ki" }[e.state] || e.state);
    hass.callService = async (domain, service, data, target) => {
      const id = String(target?.entity_id || data?.entity_id || "");
      const states = { ...hass.states };
      const updateLight = (entity: string, pct: number) => {
        const previous = states[entity];
        states[entity] = { ...previous, state: pct ? "on" : "off", attributes: { ...previous.attributes, brightness: Math.round(pct * 2.55) } };
      };
      if (domain === "light") {
        const pct = service === "turn_off" || service === "toggle" && states[id].state === "on" ? 0 : Number(data?.brightness_pct ?? 100);
        for (const light of id === "light.all" ? lights : lights.filter(l => l.entity === id)) updateLight(light.entity, pct);
      }
      if (domain === "scene") lights.forEach((light, index) => updateLight(light.entity, id === "scene.film" ? [10,25,0,0,10,10][index] : [40,30,35,0,25,30][index]));
      if (domain === "cover" && service !== "stop_cover") states[id] = { ...states[id], state: service === "open_cover" ? "open" : "closed" };
      if (domain === "light" || domain === "scene") {
        const individuals = lights.slice(0,-1).map(l => states[l.entity]);
        states["light.all"] = { ...states["light.all"], state: individuals.some(e => e.state === "on") ? "on" : "off", attributes: { ...states["light.all"].attributes, brightness: Math.round(individuals.reduce((sum,e) => sum + Number(e.attributes.brightness),0) / individuals.length) } };
      }
      hass = { ...hass, states }; card.hass = hass;
    };
    card.hass = hass;
    // Demo-only detail dialog; production uses Home Assistant's own More Info.
    const container = document.createElement("div");
    const dialog = document.createElement("dialog");
    dialog.style.cssText = "border:1px solid #d5d7e1;border-radius:20px;padding:28px;font:16px system-ui;max-width:320px";
    const copy = document.createElement("p"), close = document.createElement("button");
    close.textContent = "Bezárás"; close.style.cssText = "padding:12px 24px;border:0;border-radius:12px;cursor:pointer";
    close.onclick = () => dialog.close(); dialog.append(copy,close);
    card.addEventListener("hass-more-info", event => { copy.textContent = `Demó · ${(event as CustomEvent).detail.entityId}. Az élő dashboardon itt az eszköz részletes vezérlője nyílik meg.`; dialog.showModal(); });
    if (dark) container.style.cssText = "--primary-text-color:#eeeef3;--secondary-text-color:#a6a7b3;--primary-background-color:#15161d;--card-background-color:#202129;--ha-card-background:#202129;--warning-color:#ddb77c;color-scheme:dark";
    container.append(card,dialog);
    if (hardware) {
      const controls = document.createElement("div");
      controls.style.cssText = "display:flex;gap:12px;padding:16px;flex-wrap:wrap;background:var(--primary-background-color);font:14px system-ui";
      controls.append("Demó · fizikai gombok szimulálása:");
      buttons.forEach((b,i) => {
        const button = document.createElement("button");
        button.textContent = `${i+1}. ${b.name}`;
        button.style.cssText = "padding:10px 16px;cursor:pointer";
        button.onclick = async () => {
          hass = { ...hass, states: { ...hass.states, [b.entity]: { ...hass.states[b.entity], state: new Date().toISOString() } } };
          card.hass = hass;
          const action = config.scenes[i].tap_action;
          const [domain,service] = action.perform_action.split(".");
          await hass.callService(domain,service,"data" in action ? action.data : {},action.target);
        };
        controls.append(button);
      });
      container.append(controls);
    }
    return container;
}
export const InteractiveDemo: Story = { parameters: { layout: "fullscreen" }, render: () => interactiveDemo() };
export const InteractiveDark: Story = { parameters: { layout: "fullscreen" }, render: () => interactiveDemo(true) };

export const PhysicalButtons: Story = { parameters: { layout: "fullscreen" }, render: () => interactiveDemo(true, true) };

export const Horizontal: Story = { parameters: { layout: "fullscreen" }, render: () => interactiveDemo(true, true, true) };
