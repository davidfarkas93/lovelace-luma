import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/cards/luma-metric-card";
import "../src/cards/luma-room-card";
import "../src/cards/luma-gate-card";
import {renderCard} from "../storybook/render-card";

const meta:Meta={title:"Design system/Interactions"};
export default meta;
type Story=StoryObj;
export const MetricActions:Story={render:()=>renderCard("custom:luma-metric-card",{
  entity:"sensor.temperature",name:"Temperature",decimals:1,
  secondary_entity:"sensor.humidity",secondary_prefix:"Humidity: ",
  tap_action:{action:"more-info"},secondary_tap_action:{action:"more-info"},
},{"sensor.temperature":{state:22.4,attributes:{unit_of_measurement:"°C"}},"sensor.humidity":{state:43,attributes:{unit_of_measurement:"%"}}},390)};
export const RoomActionsAndStatus:Story={render:()=>renderCard("custom:luma-room-card",{
  name:"Living room",icon:"mdi:sofa",tap_action:{action:"more-info",entity:"sensor.temperature"},
  temperature_entity:"sensor.temperature",items:[
    {entity:"light.room",name:"Light",tap_action:{action:"toggle"}},
    {entity:"cover.room",name:"Cover",tap_action:{action:"more-info"}},
    {entity:"sensor.humidity",name:"Humidity",tap_action:{action:"none"}},
  ],
},{"sensor.temperature":{state:22.4},"light.room":{state:"off"},"cover.room":{state:"open"},"sensor.humidity":{state:43,attributes:{unit_of_measurement:"%"}}},390)};
export const GatePopover:Story={render:()=>renderCard("custom:luma-gate-card",{
  entity:"cover.gate",name:"Gate",kind:"cover",display:"popover",pedestrian_entity:"button.walk",
},{"cover.gate":{state:"closed"},"button.walk":{state:"unknown"}},390)};
export const GateUnavailable:Story={render:()=>renderCard("custom:luma-gate-card",{
  entity:"cover.gate",name:"Gate",kind:"cover",display:"full",
},{"cover.gate":{state:"unavailable"}},390)};
