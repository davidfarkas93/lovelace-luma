import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/cards/luma-cover-card";
import { renderCard } from "../storybook/render-card";

interface Args { name:string; state:"open"|"closed"|"opening"|"closing"|"unavailable"; position:number; variant:"master"|"group"|"compact"; confirmation:boolean }
const meta:Meta<Args>={
  title:"Cards/Cover",component:"luma-cover-card",
  args:{name:"Living room shades",state:"open",position:64,variant:"group",confirmation:true},
  argTypes:{state:{control:"select",options:["open","closed","opening","closing","unavailable"]},position:{control:{type:"range",min:0,max:100,step:1}},variant:{control:"radio",options:["master","group","compact"]}},
  render:(args)=>renderCard("custom:luma-cover-card",{entity:"cover.living_room",name:args.name,variant:args.variant,confirm_open:args.confirmation,confirm_close:args.confirmation},{"cover.living_room":{state:args.state,area:"Living room",attributes:{friendly_name:args.name,current_position:args.position}}},680),
};
export default meta;
type Story=StoryObj<Args>;
export const Playground:Story={};
export const Closing:Story={args:{state:"closing",position:38}};
export const Compact:Story={args:{variant:"compact",position:24}};
