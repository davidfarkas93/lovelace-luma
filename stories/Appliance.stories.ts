import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/cards/luma-appliance-card";
import { renderCard } from "../storybook/render-card";

interface Args { name:string; state:"washing"|"rinsing"|"spinning"|"power_off"; remaining:number; total:number; color:string }
const meta:Meta<Args>={
  title:"Cards/Appliance",component:"luma-appliance-card",
  args:{name:"Washing machine",state:"washing",remaining:42,total:95,color:"#6574c4"},
  argTypes:{state:{control:"select",options:["washing","rinsing","spinning","power_off"]},remaining:{control:{type:"range",min:0,max:180,step:1}},total:{control:{type:"range",min:1,max:240,step:1}},color:{control:"color"}},
  render:(args)=>renderCard("custom:luma-appliance-card",{entity:"sensor.washer_state",remaining_entity:"sensor.washer_remaining",total_entity:"sensor.washer_total",name:args.name,icon:"mdi:washing-machine",color:args.color,state_map:{washing:"Washing",rinsing:"Rinsing",spinning:"Spinning",power_off:"Ready"}},{"sensor.washer_state":{state:args.state,attributes:{friendly_name:args.name}},"sensor.washer_remaining":{state:args.remaining,attributes:{unit_of_measurement:"min"}},"sensor.washer_total":{state:args.total,attributes:{unit_of_measurement:"min"}}},620),
};
export default meta;
type Story=StoryObj<Args>;
export const Playground:Story={};
export const Spinning:Story={args:{state:"spinning",remaining:8,total:95}};
export const Idle:Story={args:{state:"power_off",remaining:0,total:95}};
