import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { renderCard } from "../storybook/render-card";
import { SessionBrowser, PeriodStats } from "./Catalogue.stories";
import type { EntityDefinition } from "../storybook/mock-hass";

interface Args { config:Record<string,unknown>; entities:Record<string,EntityDefinition>; width:number }
const sample={session_id:"finished",transaction_id:53,started_at:"2026-11-01T08:14:14Z",ended_at:"2026-11-01T10:00:00Z",energy_kwh:7.08,pv_energy_kwh:3.497,grid_energy_kwh:3.433,unclassified_energy_kwh:0.15,duration_s:6346,mode:"Solar",stop_reason:"Remote"};
const entities={...PeriodStats.args!.entities!,"sensor.ev_session_history":{state:3,attributes:{sessions:[{...sample,session_id:"active",ended_at:null},sample,{...sample,session_id:"earlier",transaction_id:52,started_at:"2026-10-28T12:00:00Z",ended_at:"2026-10-28T14:00:00Z"}]}},"sensor.ev_session_energy":{state:7.08},"sensor.ev_session_pv":{state:3.497},"sensor.ev_session_grid":{state:3.433},"sensor.ev_day_energy":{state:7.08},"sensor.ev_day_pv":{state:3.497},"sensor.ev_day_grid":{state:3.433}};
const browser={...SessionBrowser.args!.config!,language:"hu",completed_only:true,title:"Töltési előzmények",subtitle:"Legutóbbi lezárt töltés · nyilakkal lapozható"};
const period={...PeriodStats.args!.config!,language:"hu",title:"Energia és becsült költség",subtitle:"Napenergia és hálózat · választható időszak",periods:(PeriodStats.args!.config!.periods as Array<Record<string,unknown>>).map((p,i)=>({...p,label:["Ma","Hónap","Év"][i]}))};
const mix={type:"custom:luma-energy-mix-card",title:"Aktuális töltés energiája",language:"hu",total_entity:"sensor.ev_session_energy",unit:"kWh",decimals:2,sources:[{entity:"sensor.ev_session_pv",name:"Napenergia",color:"#58b984"},{entity:"sensor.ev_session_grid",name:"Hálózat",color:"#f4a62a"}]};
const config={columns:2,tablet_columns:1,mobile_columns:1,gap:20,cards:[{type:"custom:luma-session-browser-card",...browser},{type:"custom:luma-period-stats-card",...period},mix]};
const meta:Meta<Args>={title:"Charging/Charging details",args:{config,entities,width:1200},render:args=>renderCard("custom:luma-layout-card",args.config,args.entities,args.width),parameters:{controls:{disable:true}}};
export default meta;
type Story=StoryObj<Args>;
export const SourceBreakdown:Story={};
export const Mobile:Story={args:{width:358}};
export const MissingMeasurements:Story={args:{width:358,entities:{...entities,"sensor.ev_session_pv":{state:"unavailable"},"sensor.ev_session_grid":{state:"unknown"},"sensor.ev_day_pv":{state:"unavailable"},"sensor.ev_day_grid":{state:"unknown"},"sensor.ev_day_share":{state:"unknown"}}}};
export const EmptyHistory:Story={args:{entities:{...entities,"sensor.ev_session_history":{state:0,attributes:{sessions:[]}}}}};
