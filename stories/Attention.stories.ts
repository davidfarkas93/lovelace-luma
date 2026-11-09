import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/index";
import { renderCard } from "../storybook/render-card";
import type { AttentionPolicy } from "../src/attention";
import type { EntityDefinition } from "../storybook/mock-hass";

const policy:AttentionPolicy={version:1,revision:"Demo policy",acknowledgements_entity:"input_text.ack",rules:[
  {id:"host-alerts",entity_pattern:"sensor.*_alerts",platform:"komodo",state_not:["","0","none","unknown","unavailable"],message:"{count} host alert",aggregate:true,scope:"homelab"},
  {id:"rack",entity:"sensor.rack_temperature",above:42,message:"Rack temperature high",scope:"homelab"},
  {id:"cooling",entity:"binary_sensor.fan_failure",state:"on",for_minutes:5,message:"Cooling fault",tone:"error",dismissible:false,scope:"homelab"},
  {id:"certificate-warning",entity_pattern:"sensor.*_certificate_days",below:21,message:"Certificate expires soon",scope:"homelab"},
  {id:"certificate-critical",entity_pattern:"sensor.*_certificate_days",below:7,message:"Certificate expires critically soon",tone:"error",scope:"homelab"},
],problems:{enabled:true},updates:{enabled:true,groups:[{id:"firmware",name:"Firmware updates",platforms:["shelly","esphome"]},{id:"software",name:"Software updates",platforms:["hacs","komodo"]}]},ignored:{"update.retired":"Retired duplicate"}};
window.lumaAttentionPolicies={...window.lumaAttentionPolicies,demo:policy};
window.lumaAttentionPolicies["demo-notifications"]={version:1,revision:"Native notification demo",rules:[],adapters:{notifications:true}};
window.lumaAttentionPolicies["demo-host-alerts"]={...policy,rules:[{...policy.rules[0],message:"{name}: {value}",aggregate:false,state_labels:{ServerDisk:"Disk space is running low"},context:[
 {label:"Filesystem",value:"Docker image (/var/lib/docker)",states:["ServerDisk"]},
 {label:"Disk usage",entity_pattern:"sensor.*_disk_usage",states:["ServerDisk"],decimals:1},
 {label:"Free space",entity_pattern:"sensor.*_disk_free",states:["ServerDisk"]},
 {label:"Capacity",entity_pattern:"sensor.*_disk_total",states:["ServerDisk"]},
]}]};
window.dispatchEvent(new Event("luma-attention-policy-changed"));
const entities:Record<string,EntityDefinition>={
 "input_text.ack":{state:"",attributes:{max:255}},
 "sensor.host_alerts":{state:"ServerMem",platform:"komodo"},
 "sensor.rack_temperature":{state:44,attributes:{unit_of_measurement:"°C"}},
 "sensor.backup_certificate_days":{state:"unknown",attributes:{friendly_name:"Backup certificate"}},
 "sensor.photos_certificate_days":{state:"unknown",attributes:{friendly_name:"Photos certificate"}},
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
export const NativeNotification:Story={args:{config:{policy:"demo-notifications",mode:"incidents"},entities:{},width:620}};
export const HostAlert:Story={args:{config:{policy:"demo-host-alerts",mode:"incidents"},entities:{
 "sensor.host_alerts":{state:"ServerDisk",platform:"komodo",device:"Tower",attributes:{friendly_name:"Tower"}},
 "sensor.host_disk_usage":{state:83.9,device:"Tower",attributes:{unit_of_measurement:"%"}},
 "sensor.host_disk_free":{state:4.83,device:"Tower",attributes:{unit_of_measurement:"GB"}},
 "sensor.host_disk_total":{state:30,device:"Tower",attributes:{unit_of_measurement:"GB"}},
},width:620}};
export const Embedded:Story={args:{config:{policy:"demo",mode:"diagnostics",embedded:true},width:620}};
export const LongLabels:Story={args:{width:358,entities:{...entities,
 "sensor.host_alerts":{...entities["sensor.host_alerts"],attributes:{friendly_name:"Hálózati tároló és háttérszolgáltatások riasztásai"}},
 "sensor.backup_certificate_days":{...entities["sensor.backup_certificate_days"],attributes:{friendly_name:"Biztonsági mentések tanúsítványának hátralévő érvényessége"}},
}}};
export const Clear:Story={args:{config:{policy:"demo",mode:"updates"},entities:Object.fromEntries(Object.entries(entities).map(([id,value])=>[id,id.startsWith("update.")?{...value,state:"off",attributes:{...value.attributes,restored:false}}:value]))}};
export const DataGapsOnly:Story={args:{entities:{...entities,
 "sensor.host_alerts":{...entities["sensor.host_alerts"],state:""},
 "sensor.rack_temperature":{...entities["sensor.rack_temperature"],state:20},
 "binary_sensor.boiler_fault":{...entities["binary_sensor.boiler_fault"],state:"off"},
 "update.new_shelly":{...entities["update.new_shelly"],state:"off"},
 "update.new_vendor":{...entities["update.new_vendor"],state:"off"},
}}};
export const HomeSummary:Story={render:()=>renderCard("custom:luma-home-hero-card",{weather_entity:"weather.demo",attention_policy:"demo",acknowledgements_entity:"input_text.ack"},{...entities,"weather.demo":{state:"sunny",attributes:{temperature:21,temperature_unit:"°C"}}},1050)};
export const HomeNativeNotification:Story={render:()=>renderCard("custom:luma-home-hero-card",{weather_entity:"weather.demo",attention_policy:"demo-notifications"},{"weather.demo":{state:"sunny",attributes:{temperature:21,temperature_unit:"°C"}}},620)};
export const HomelabSummary:Story={render:()=>renderCard("custom:luma-homelab-hero-card",{attention_policy:"demo",attention_scope:"homelab"},entities,1050)};

// Replays the audit's failure modes with generic, non-operational entities.
import { html } from "lit";
import { ref } from "lit/directives/ref.js";
import { createMockHass } from "../storybook/mock-hass";
import type { LovelaceCard } from "../src/types";
window.lumaAttentionPolicies["demo-review"]={version:1,revision:"Notification review",acknowledgements_entity:"input_text.ack",ignore_labels:["monitoring_ignore"],rules:[
 {id:"plants",entity:"input_boolean.plants_due",state:"on",message:"Check indoor plants",category:"household",notification_ids:["plants-due"],completion:{label:"Watered",confirmation:"Record watering now and clear the reminder channels?",action:{action:"perform-action",perform_action:"input_button.press",target:{entity_id:"input_button.plants_watered"}}}},
 {id:"certificate",entity:"sensor.ignored_certificate",below:7,message:"Certificate expires soon"},
],updates:{enabled:true,groups:[{id:"applications",name:"Application updates",platforms:["marketplace"]},{id:"host",name:"Host updates",platforms:["virtualization"]}]},adapters:{notifications:true,repairs:true,integrations:true}};
const reviewEntities:Record<string,EntityDefinition>={
 "input_text.ack":{state:"",attributes:{max:255}},
 "input_boolean.plants_due":{state:"on",attributes:{friendly_name:"Indoor plants"}},
 "input_button.plants_watered":{state:"unknown"},
 "sensor.ignored_certificate":{state:"unknown",labels:["monitoring_ignore"]},
 "weather.demo":{state:"sunny",attributes:{temperature:21,temperature_unit:"°C"}},
 "update.weather":{state:"on",platform:"marketplace",attributes:{friendly_name:"Weather integration",installed_version:"1.4.1",latest_version:"2.0.0",supported_features:23}},
 "update.camera":{state:"on",platform:"marketplace",attributes:{friendly_name:"Camera card",installed_version:"8.1.0",latest_version:"8.2.0",supported_features:23}},
 "update.host":{state:"on",platform:"virtualization",attributes:{friendly_name:"Virtualization host",supported_features:16,installed_version:"9.2.26",latest_version:"9.2.26-p0-d3",release_summary:"3 system packages available: 0 virtualization packages and 3 other packages. Review packages on the host."}},
};
const reviewScenario=(options:{hero?:boolean;registry?:"loading"|"error";repairs?:"loading"|"error";task?:boolean}={})=>{
 const calls:unknown[]=[];
 const hass=createMockHass({...reviewEntities,"input_boolean.plants_due":{...reviewEntities["input_boolean.plants_due"],state:options.task?"on":"off"}},call=>calls.push(call));
 const original=hass.callWS!;
 hass.callWS=async(message)=>{
   if(message.type==="config/entity_registry/list" && options.registry){if(options.registry==="error")throw Error("Denied");return await new Promise(()=>{});}
   if(message.type==="repairs/list_issues"){
     if(options.repairs==="error")throw Error("Denied");if(options.repairs==="loading")return await new Promise(()=>{});
     return {issues:[{domain:"storage",issue_id:"stats-stalled",translation_key:"stats_stalled",translation_placeholders:{server:"Storage server"}}]} as never;
   }
   if(message.type==="frontend/get_translations")return {resources:{"component.storage.issues.stats_stalled.title":"Container statistics stopped on {server}","component.storage.issues.stats_stalled.description":"No CPU or memory statistics have arrived for five minutes. Container operation is not affected. Check the statistics service."}} as never;
   if(message.type==="persistent_notification/get")return (options.task ? [{notification_id:"plants-due",title:"Indoor plants need checking",message:"The season and indoor temperature suggest checking soil moisture. Water only if needed."}] : []) as never;
   return original(message);
 };
 if(options.registry)hass.entities={};
 return html`<div style="width:1050px;max-width:calc(100vw - 48px)">${options.hero ? html`<luma-home-hero-card .hass=${hass} ${ref(node=>{const card=node as HTMLElement & LovelaceCard;if(card)card.setConfig({type:"custom:luma-home-hero-card",weather_entity:"weather.demo",attention_policy:"demo-review"});})}></luma-home-hero-card>` : html`<luma-attention-card .hass=${hass} .open=${true} ${ref(node=>{const card=node as HTMLElement & LovelaceCard;if(card)card.setConfig({type:"custom:luma-attention-card",policy:"demo-review",mode:"diagnostics",panel:true,title:"Notifications"});})}></luma-attention-card>`}</div>`;
};
export const ReviewFlow:Story={render:()=>reviewScenario({hero:true})};
export const HouseholdTask:Story={render:()=>reviewScenario({task:true})};
export const RegistryLoading:Story={render:()=>reviewScenario({registry:"loading"})};
export const RegistryFailed:Story={render:()=>reviewScenario({registry:"error"})};
export const RepairsLoading:Story={render:()=>reviewScenario({repairs:"loading"})};
export const RepairsFailed:Story={render:()=>reviewScenario({repairs:"error"})};

import { attentionSnapshot } from "../src/attention";
const backendScenario=(failed=false)=>{
 const backendPolicy=window.lumaAttentionPolicies!["demo-review"];
 window.lumaAttentionPolicies!["demo-backend"]={version:1,revision:"Backend binding",rules:[],backend:{policy_id:"demo"},acknowledgements_entity:"input_text.ack"};
 const hass=createMockHass(reviewEntities);
 const original=hass.callWS!;
 hass.callWS=async(command)=>{
  if(command.type==='home_insights/attention'){
   if(failed)throw Error('Observer unavailable');
   const external={registry:hass.entities||{},notifications:[{notification_id:'plants-due',title:'Indoor plants',message:'Watering is due'}],readiness:{registry:'ready' as const,notifications:'ready' as const,repairs:'ready' as const,integrations:'ready' as const},repairs:{issues:[]},integrations:[]};
   return {schema_version:1,policy_id:'demo',policy_hash:'storybook',policy_revision:backendPolicy.revision,generated_at:Date.now(),policy:backendPolicy,rows:attentionSnapshot(hass,backendPolicy,external,Date.now())} as never;
  }
  return original(command);
 };
 return html`<div style="width:1050px;max-width:calc(100vw - 48px)"><luma-home-hero-card .hass=${hass} ${ref(node=>{const card=node as HTMLElement & LovelaceCard;if(card)card.setConfig({type:'custom:luma-home-hero-card',weather_entity:'weather.demo',attention_policy:'demo-backend'})})}></luma-home-hero-card></div>`;
};
export const BackendObserver:Story={render:()=>backendScenario()};
export const BackendUnavailable:Story={render:()=>backendScenario(true)};
