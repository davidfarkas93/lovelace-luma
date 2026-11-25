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
const coverItems = [
  {entity:'cover.back_left',name:'Hátsó bal'}, {entity:'cover.back_right',name:'Hátsó jobb'},
  {entity:'cover.terrace_left',name:'Terasz bal'}, {entity:'cover.terrace_right',name:'Terasz jobb'},
  {entity:'cover.kitchen',name:'Konyha'},
];
const config = {
  name: "Nappali", lights,
  metrics: [{ entity: "sensor.temp", name:"Hőmérséklet", icon: "mdi:thermometer" }, { entity: "sensor.humidity", name:"Páratartalom", icon: "mdi:water-percent" }],
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
export const HandleFader: Story = { render: () => renderCard("custom:luma-light-fader-card", { ...lights[3], orientation: "horizontal", interaction: "handle", subtitle: "Fogd meg a fogantyút, majd húzd" }, definitions, 560) };
export const NonDimmable: Story = { render: () => renderCard("custom:luma-light-fader-card", lights[0], { "light.sofa": { state: "on", attributes: { supported_color_modes: ["onoff"] } } }, 280) };

// Standalone, interactive demo. These IDs and service calls never reach Home Assistant.
function interactiveDemo(dark = false, hardware = false, horizontal = false, touch = false, idle = false) {
    const buttons = config.scenes.map((s,i) => ({ entity: `event.button_${i+1}`, name: s.name, icon: s.icon, event_type: "single_push" }));
    const card = document.createElement("luma-wall-panel-card") as LumaWallPanelCard;
    card.setConfig({ type: "custom:luma-wall-panel-card", ...config, fullscreen: true, ...(touch?{touch_controls:true,details_idle_timeout:idle?30:0,lights:lights.slice(0,5).map(l=>idle&&l.entity==='light.island'?{...l,show_color:false}:l),cover_entities:coverItems,detail_groups:[
      {entities:[{entity:'media_player.tv',name:'Nappali TV',remote_entity:'remote.tv',apps:['YouTube','Netflix','Spotify','Wholphin'].map(name=>({name,tap_action:{action:'perform-action',perform_action:'script.demo_tv_app',data:{app:name}}}))}]},
      {entities:[{entity:'fan.air',name:'Légtisztító',metrics:[{entity:'sensor.pm25',name:'PM2.5'},{entity:'sensor.humidity',name:'Páratartalom'}]},{entity:'humidifier.air',name:'Párásító',metrics:[{entity:'sensor.humidity',name:'Páratartalom'}]}]}
    ],shortcuts:config.shortcuts.map(s=>s.name==="Redőnyök"?{...s,entity:"cover.room",tap_action:{action:"more-info"}}:s)}:{}), ...(horizontal ? { light_orientation: "horizontal" } : {}), ...(hardware ? { physical_buttons: { side: "right", buttons } } : {}) } as Parameters<LumaWallPanelCard["setConfig"]>[0]);
    let hass = createMockHass({ ...definitions, ...Object.fromEntries(buttons.map(b => [b.entity, { state: "2026-01-01T00:00:00Z", attributes: { event_type: "single_push" } }])) });
    hass.formatEntityState = e => e.attributes.unit_of_measurement ? `${e.state} ${e.attributes.unit_of_measurement}` : ({ open: "Nyitva", closed: "Zárva", playing: "Lejátszás", paused: "Szünet", idle: "Készenlét", on: "Be", off: "Ki" }[e.state] || e.state);
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
    if(touch){
      const extra=createMockHass({
        'media_player.tv':{state:'playing',attributes:{friendly_name:'Nappali TV',supported_features:153529,app_name:'Wholphin',is_volume_muted:false}},
        'remote.tv':{state:'on',attributes:{supported_features:4}},
        'fan.air':{state:'on',attributes:{supported_features:57,percentage:40,percentage_step:20,preset_mode:'auto',preset_modes:['auto','allergen','night','speed_1','speed_2','speed_3','turbo']}},
        'humidifier.air':{state:'on',attributes:{supported_features:1,min_humidity:40,max_humidity:70,humidity:50,current_humidity:42,mode:'purification_humidification',available_modes:['purification','purification_humidification']}},
        'sensor.pm25':{state:12,attributes:{unit_of_measurement:'μg/m³'}}
      });
      hass.states={...hass.states,...extra.states};
      for(const id of ['light.sofa','light.spots','light.kitchen']) hass.states[id].attributes={...hass.states[id].attributes,supported_color_modes:['color_temp'],min_color_temp_kelvin:2202,max_color_temp_kelvin:4000,color_temp_kelvin:3000};
      hass.states['light.island'].attributes={...hass.states['light.island'].attributes,supported_color_modes:['color_temp','xy'],min_color_temp_kelvin:2202,max_color_temp_kelvin:6535,color_temp_kelvin:3000,hs_color:[35,70]};
      for(const item of coverItems) hass.states[item.entity]={...hass.states['cover.room'],entity_id:item.entity,attributes:{...hass.states['cover.room'].attributes,friendly_name:item.name}};
      const originalWS=hass.callWS;
      hass.callWS=async message=>{
        if(message.type!=='history/history_during_period')return originalWS!(message);
        const start=Date.parse(String(message.start_time)),end=Date.parse(String(message.end_time));
        return Object.fromEntries((message.entity_ids as string[]).map(id=>[id,Array.from({length:145},(_,i)=>({s:String(Math.round(((id==='sensor.temp'?22.5:48)+Math.sin(i/15)*(id==='sensor.temp'?1:5))*10)/10),lu:(start+(end-start)*i/144)/1000}))])) as never;
      };
      const original=hass.callService;
      hass.callService=async(domain,service,data,target)=>{
        await original(domain,service,data,target);
        const id=String(target?.entity_id||'');
        if(hass.states[id]&&['turn_on','turn_off','media_play','media_pause'].includes(service)) hass.states[id]={...hass.states[id],state:({turn_on:'on',turn_off:'off',media_play:'playing',media_pause:'paused'} as Record<string,string>)[service]};
        if(domain==='script'&&data?.app)hass.states['media_player.tv']={...hass.states['media_player.tv'],state:'playing',attributes:{...hass.states['media_player.tv'].attributes,app_name:data.app}};
        if(hass.states[id]){hass={...hass,states:{...hass.states,[id]:{...hass.states[id],attributes:{...hass.states[id].attributes,...data,...(data?.position!==undefined?{current_position:data.position}:{})}}}};card.hass=hass;}
      };
    }
    card.hass = hass;
    // Fallback for controls outside the wall-specific detail groups.
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

export const TouchControls: Story = { parameters: { layout: "fullscreen" }, render: () => interactiveDemo(true, true, true, true) };

// White-spectrum devices may advertise XY for mapping group commands to white.
export const IdleDetails: Story = {
  parameters: { layout: "fullscreen" },
  render: () => interactiveDemo(true,true,true,true,true),
};
