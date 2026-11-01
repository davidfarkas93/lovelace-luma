import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/index";
import { renderCard } from "../storybook/render-card";
import type { AttentionPolicy } from "../src/attention";
import type { EntityDefinition } from "../storybook/mock-hass";

const policy:AttentionPolicy={version:1,revision:"Demo policy",acknowledgements_entity:"input_text.ack",rules:[
  {id:"host-alerts",entity_pattern:"sensor.*_alerts",platform:"komodo",state_not:["","0","none","unknown","unavailable"],message:"{count} host alert",aggregate:true,scope:"homelab"},
  {id:"rack",entity:"sensor.rack_temperature",above:42,message:"Rack temperature high",scope:"homelab"},
  {id:"cooling",entity:"binary_sensor.fan_failure",state:"on",for_minutes:5,message:"Cooling fault",tone:"error",dismissible:false,scope:"homelab"},
],problems:{enabled:true},updates:{enabled:true,groups:[{id:"firmware",name:"Firmware updates",platforms:["shelly","esphome"]},{id:"software",name:"Software updates",platforms:["hacs","komodo"]}]},ignored:{"update.retired":"Retired duplicate"}};
window.lumaAttentionPolicies={...window.lumaAttentionPolicies,demo:policy};
window.dispatchEvent(new Event("luma-attention-policy-changed"));
const entities:Record<string,EntityDefinition>={
 "input_text.ack":{state:"",attributes:{max:255}},
 "sensor.host_alerts":{state:"ServerMem",platform:"komodo"},
 "sensor.rack_temperature":{state:44,attributes:{unit_of_measurement:"°C"}},
 "binary_sensor.fan_failure":{state:"off",attributes:{device_class:"problem"}},
 "binary_sensor.boiler_fault":{state:"on",attributes:{device_class:"problem",friendly_name:"Boiler fault"}},
 "update.new_shelly":{state:"on",platform:"shelly",attributes:{installed_version:"1.0",latest_version:"1.1",friendly_name:"New Shelly firmware"}},
 "update.new_vendor":{state:"on",platform:"future_vendor",attributes:{latest_version:"2.0",friendly_name:"New vendor firmware"}},
 "update.esphome":{state:"unavailable",platform:"esphome",attributes:{friendly_name:"BLE proxy"}},
 "update.retired":{state:"unavailable",attributes:{restored:true}},
};
interface Args{config:Record<string,unknown>;entities:Record<string,EntityDefinition>;width:number}
const meta:Meta<Args>={title:"Attention/Shared policy",args:{config:{policy:"demo",mode:"diagnostics"},entities,width:1050},render:args=>renderCard("custom:luma-attention-card",args.config,args.entities,args.width),parameters:{controls:{disable:true}}};
export default meta;
type Story=StoryObj<Args>;
export const Coverage:Story={};
export const Mobile:Story={args:{width:358}};
export const Updates:Story={args:{config:{policy:"demo",mode:"updates"}}};
export const Incidents:Story={args:{config:{policy:"demo",mode:"incidents"}}};
export const MissingPolicy:Story={args:{config:{policy:"not-registered",mode:"diagnostics"}}};
export const HomeSummary:Story={render:()=>renderCard("custom:luma-home-hero-card",{weather_entity:"weather.demo",attention_policy:"demo",acknowledgements_entity:"input_text.ack"},{...entities,"weather.demo":{state:"sunny",attributes:{temperature:21,temperature_unit:"°C"}}},1050)};
export const HomelabSummary:Story={render:()=>renderCard("custom:luma-homelab-hero-card",{attention_policy:"demo",attention_scope:"homelab"},entities,1050)};
