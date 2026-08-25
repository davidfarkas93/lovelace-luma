import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/cards/luma-metric-card";
import { renderCard } from "../storybook/render-card";

interface Args { name:string; subtitle:string; value:number; unit:string; decimals:number; color:string }
const meta: Meta<Args> = {
  title:"Cards/Metric", component:"luma-metric-card",
  args:{ name:"Battery", subtitle:"Robot mower", value:72, unit:"%", decimals:0, color:"#4da766" },
  argTypes:{ value:{control:{type:"number"}}, decimals:{control:{type:"range",min:0,max:3,step:1}}, color:{control:"color"} },
  render:(args)=>renderCard("custom:luma-metric-card",{entity:"sensor.metric",name:args.name,subtitle:args.subtitle,icon:"mdi:battery-high",color:args.color,decimals:args.decimals},{"sensor.metric":{state:args.value,attributes:{unit_of_measurement:args.unit,friendly_name:args.name}}},520),
};
export default meta;
type Story=StoryObj<Args>;
export const Playground:Story={};
export const Monetary:Story={args:{name:"Monthly forecast",subtitle:"Estimated bill",value:7083,unit:"Ft",decimals:0,color:"#6574c4"}};
