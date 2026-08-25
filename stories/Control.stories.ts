import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/cards/luma-control-card";
import { renderCard } from "../storybook/render-card";

interface Args { name:string; state:"on"|"off"|"unavailable"; brightness:number; area:string; confirmation:boolean }
const meta:Meta<Args>={
  title:"Cards/Control",component:"luma-control-card",
  args:{name:"Sofa lights",state:"on",brightness:68,area:"Living room",confirmation:false},
  argTypes:{state:{control:"select",options:["on","off","unavailable"]},brightness:{control:{type:"range",min:0,max:100,step:1}}},
  render:(args)=>renderCard("custom:luma-control-card",{entity:"light.sofa",name:args.name,icon:"mdi:lightbulb",tap_action:{action:"toggle",entity:"light.sofa",...(args.confirmation?{confirmation:{text:"Tap again to confirm"}}:{})}},{"light.sofa":{state:args.state,area:args.area,attributes:{friendly_name:args.name,brightness:Math.round(args.brightness*2.55),unit_of_measurement:"%"}}},560),
};
export default meta;
type Story=StoryObj<Args>;
export const Playground:Story={};
export const Off:Story={args:{state:"off",brightness:0}};
