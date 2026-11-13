import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/index";
import { renderCard } from "../storybook/render-card";

const routes = [
  {url:"/demo/home",label:"Főoldal",icon:"mdi:home-outline"},
  {url:"/demo/rooms",label:"Szobák",icon:"mdi:sofa-outline",match_paths:["/demo/rooms*","/demo/covers"]},
  {url:"/demo/cameras",label:"Kamera",icon:"mdi:camera-outline",match_paths:["/demo/cameras*"]},
  {url:"/demo/energy",label:"Energia",icon:"mdi:lightning-bolt-outline",match_paths:["/demo/energy*"]},
];
const group = (name:string, icon:string, items:string[][]) => ({name,icon,items:items.map(([label,url,icon])=>({label,url,icon}))});
const groupedConfig = {
  routes,
  menu:{name:"Menü",groups:[
    group("Otthon","mdi:home-outline",[["Takarítás","/demo/cleaning","mdi:robot-vacuum"],["Fűtés és hűtés","/demo/climate","mdi:home-thermometer-outline"],["Redőnyök","/demo/covers","mdi:window-shutter"]]),
    group("Kert","mdi:flower-outline",[["Gyep","/demo/lawn","mdi:mower"],["Öntözés","/demo/irrigation","mdi:sprinkler"],["Időjárás","/demo/weather","mdi:weather-cloudy"]]),
    group("Karbantartás","mdi:tools",[["Akkumulátorok","/demo/batteries","mdi:battery"],["Hulladék","/demo/waste","mdi:trash-can-outline"],["Karbantartás","/demo/maintenance","mdi:tools"]]),
    group("Rendszer","mdi:server-outline",[["Homelab","/demo/homelab","mdi:server"],["Beállítások","/config?disable_km","mdi:cog-outline"]]),
  ]},
};

const meta:Meta={title:"Navigation/Grouped menu",parameters:{layout:"fullscreen"}};
export default meta;
type Story=StoryObj;
export const GroupedNavigation:Story={render:()=>renderCard("custom:luma-navbar-card",groupedConfig,{},900)};
export const WithActiveMedia:Story={render:()=>renderCard("custom:luma-navbar-card",{...groupedConfig,media_players:[{entity:"media_player.tv",name:"Nappali",popup:"#remote"}]},{"media_player.tv":{state:"playing",attributes:{media_title:"Film",media_duration:1200}}},900)};
export const CompactMedia:Story={render:()=>renderCard("custom:luma-navbar-card",{...groupedConfig,media_players:[{entity:"media_player.tv",name:"Nappali",popup:"#remote"},{entity:"media_player.bedroom",name:"Hálószoba",popup:"#bedroom"}]},{"media_player.tv":{state:"playing",attributes:{media_title:"Egy hosszabb filmcím, ami kis kijelzőn sem nyomhatja ki a vezérlőket",media_duration:1200,entity_picture:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="48"%3E%3Cpath fill="%235d567d" d="M0 0h48v48H0z"/%3E%3Ccircle fill="%23d4ad6a" cx="30" cy="18" r="12"/%3E%3C/svg%3E'}},"media_player.bedroom":{state:"idle",attributes:{friendly_name:"Hálószoba TV"}}},900)};
export const WithEmbeddedRemotes:Story={render:()=>renderCard("custom:luma-navbar-card",{...groupedConfig,media_players:[
  {entity:"media_player.tv",name:"Nappali",popup:{hash:"tv-remote",name:"Nappali TV",icon:"mdi:television",max_width:760,cards:[{type:"custom:luma-remote-card",remote_entity:"remote.tv",media_entity:"media_player.tv",name:"Nappali TV",apps:[{name:"YouTube",icon:"mdi:youtube",activity:"com.google.android.youtube.tv"}]}]}},
  {entity:"media_player.bedroom",name:"Hálószoba",popup:{hash:"bedroom-remote",name:"Hálószoba TV",cards:[{type:"custom:luma-remote-card",remote_entity:"remote.bedroom",media_entity:"media_player.bedroom",name:"Hálószoba TV"}]}}
]},{"media_player.tv":{state:"playing",attributes:{media_title:"Film",media_duration:1200}},"remote.tv":{state:"on"},"media_player.bedroom":{state:"on",attributes:{friendly_name:"Hálószoba TV"}},"remote.bedroom":{state:"on"}},900)};
export const SectionNavigation:Story={render:()=>renderCard("custom:luma-route-tabs-card",{name:"Öntözés",routes:[
  {url:"/demo/irrigation",label:"Áttekintés",icon:"mdi:sprinkler"},
  {url:"/demo/irrigation-schedules",label:"Ütemezés",icon:"mdi:calendar-clock"},
  {url:"/demo/irrigation-zones",label:"Zónák",icon:"mdi:pipe-valve"},
  {url:"/demo/irrigation-settings",label:"Beállítások",icon:"mdi:tune-variant"},
]},{},900)};
