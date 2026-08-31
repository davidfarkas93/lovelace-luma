import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/index";
import { renderCard } from "../storybook/render-card";

const meta:Meta={title:"Patterns/Main dashboard hero",parameters:{controls:{disable:true}}};
export default meta;
type Story=StoryObj;

const config={
  name:"Alex",
  weather_entity:"weather.home",
  alarm_entity:"alarm_control_panel.home",
  alarm_popover:true,
  alarm_modes:[{mode:"away",name:"Away",icon:"mdi:shield-lock"},{mode:"night",name:"Night",icon:"mdi:shield-moon"},{mode:"disarm",name:"Disarm",icon:"mdi:shield-off-outline"}],
  notifications_entity:"sensor.notifications",
  acknowledgements_entity:"input_text.acknowledged_incidents",
  irrigation_entity:"sensor.active_irrigation_program",
  irrigation_zone_entities:[{entity:"switch.front_lawn",name:"Front lawn"},{entity:"switch.back_lawn",name:"Back lawn"},{entity:"switch.drip_line",name:"Drip line"}],
  irrigation_path:"/irrigation",
  waste_ack_entity:"input_boolean.waste_ready",
  waste_path:"/waste",
  waste_days:2,
  waste_items:[{entity:"sensor.general_collection",name:"General"},{entity:"sensor.plastic_collection",name:"Plastic"}],
  wind_threshold:8,
  active_action:{action:"navigate",navigation_path:"#frequent"},
  active:{
    include:[
      {domain:"light",state:"on"},
      {domain:"media_player",state:["on","playing","paused"]},
      {domain:"climate",state_not:["off","unknown","unavailable"]},
    ],
    exclude:["light.*_child_*"],
    exclude_hidden:true,
    collapse:[{entities:["light.terrace","light.terrace_wall"],prefer:"light.terrace"}],
  },
  appliances:[
    {entity:"sensor.washer_state",name:"Washer",active_entity:"binary_sensor.washer_running",remaining_entity:"sensor.washer_remaining",path:"/rooms/laundry",icon:"mdi:washing-machine",state_map:{run:"Washing",spin:"Spinning"}},
    {entity:"sensor.dryer_state",name:"Dryer",active_entity:"binary_sensor.dryer_running",remaining_entity:"sensor.dryer_remaining",path:"/rooms/laundry",icon:"mdi:tumble-dryer",state_map:{drying:"Drying"}},
  ],
  incident_preset:"home",
  incidents:[
    {entity:"binary_sensor.front_door",state:"on",message:"Front door is open",tone:"warning",path:"/security",dismissible:true},
    {entity_pattern:"update.*",label:"infrastructure_update",state:"on",message:"Infrastructure update available",tone:"warning",aggregate:true,ack_scope:"matches",navigation_path:"/homelab/operations"},
  ],
  tap_action:{action:"navigate",navigation_path:"/weather"},
};

const entities={
  "weather.home":{state:"partlycloudy",attributes:{temperature:23.5,humidity:44,wind_speed:14,wind_speed_unit:"km/h",friendly_name:"Home weather"}},
  "alarm_control_panel.home":{state:"armed_night",attributes:{friendly_name:"Home alarm"}},
  "sensor.notifications":{state:2,attributes:{friendly_name:"Notifications"}},
  "input_text.acknowledged_incidents":{state:"",attributes:{}},
  "sensor.active_irrigation_program":{state:"Morning lawn",attributes:{}},
  "switch.front_lawn":{state:"on",attributes:{friendly_name:"Front lawn"},area:"Garden"},
  "switch.back_lawn":{state:"off",attributes:{friendly_name:"Back lawn"},area:"Garden"},
  "switch.drip_line":{state:"off",attributes:{friendly_name:"Drip line"},area:"Garden"},
  "input_boolean.waste_ready":{state:"off",attributes:{}},
  "sensor.general_collection":{state:"2026-08-25",attributes:{daysTo:2,friendly_name:"General collection"}},
  "sensor.plastic_collection":{state:"2026-08-25",attributes:{daysTo:2,friendly_name:"Plastic collection"}},
  "light.sofa":{state:"on",attributes:{friendly_name:"Sofa lamp"},area:"Living room"},
  "light.terrace":{state:"on",attributes:{friendly_name:"Terrace lights"},area:"Garden"},
  "light.terrace_wall":{state:"on",attributes:{friendly_name:"Terrace wall lights"},area:"Garden"},
  "light.technical_child":{state:"on",attributes:{friendly_name:"Technical child"},hidden:true},
  "media_player.living_room":{state:"playing",attributes:{friendly_name:"Living room TV",media_title:"Planet Earth"},area:"Living room"},
  "climate.living_room":{state:"cool",attributes:{friendly_name:"Living room climate",current_temperature:23.1,temperature:22},area:"Living room"},
  "sensor.washer_state":{state:"idle",attributes:{}},
  "binary_sensor.washer_running":{state:"off",attributes:{}},
  "sensor.washer_remaining":{state:0,attributes:{unit_of_measurement:"min"}},
  "sensor.dryer_state":{state:"drying",attributes:{}},
  "binary_sensor.dryer_running":{state:"on",attributes:{}},
  "sensor.dryer_remaining":{state:34,attributes:{unit_of_measurement:"min"}},
  "binary_sensor.front_door":{state:"on",attributes:{friendly_name:"Front door"},area:"Entrance"},
  "update.home_assistant":{state:"on",attributes:{friendly_name:"Home Assistant update",installed_version:"2026.8.1",latest_version:"2026.8.3"},labels:["infrastructure_update"]},
};

export const RealWorldExample:Story={render:()=>renderCard("custom:luma-home-hero-card",config,entities,1080)};
export const QuietHome:Story={render:()=>renderCard("custom:luma-home-hero-card",{...config,incidents:[],incident_preset:"none"},{...entities,"sensor.notifications":{state:0},"sensor.active_irrigation_program":{state:"none"},"switch.front_lawn":{state:"off"},"light.sofa":{state:"off"},"light.terrace":{state:"off"},"light.terrace_wall":{state:"off"},"media_player.living_room":{state:"off"},"climate.living_room":{state:"off"},"binary_sensor.dryer_running":{state:"off"},"input_boolean.waste_ready":{state:"on"}},1080)};
