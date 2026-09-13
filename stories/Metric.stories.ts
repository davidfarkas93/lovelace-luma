import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/cards/luma-metric-card";
import "../src/cards/luma-layout-card";
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
export const EqualHeightRow:Story={render:()=>renderCard("custom:luma-layout-card",{
  columns:4,tablet_columns:2,mobile_columns:2,cards:[
    {type:"custom:luma-metric-card",entity:"sensor.battery",name:"Battery",icon:"mdi:battery",color:"#4da766",decimals:0},
    {type:"custom:luma-metric-card",entity:"sensor.runtime",name:"Estimated runtime",subtitle:"At current load",icon:"mdi:timer-sand",color:"#3a9bdc",decimals:1},
    {type:"custom:luma-metric-card",entity:"sensor.load",name:"UPS load",subtitle:"Rated capacity utilization",icon:"mdi:gauge",decimals:0},
    {type:"custom:luma-metric-card",entity:"sensor.power",name:"Output power",subtitle:"Power delivered to equipment",icon:"mdi:flash",decimals:0},
  ],
},{"sensor.battery":{state:100,attributes:{unit_of_measurement:"%"}},"sensor.runtime":{state:63.8,attributes:{unit_of_measurement:"min"}},"sensor.load":{state:14,attributes:{unit_of_measurement:"%"}},"sensor.power":{state:115,attributes:{unit_of_measurement:"W"}}},1100)};
