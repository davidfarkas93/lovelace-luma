import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { renderCard } from "../storybook/render-card";
import { EvControl, EvOverviewCharging, EvOverviewWaiting, EvMode } from "./Catalogue.stories";
import type { EntityDefinition } from "../storybook/mock-hass";

interface Args { config: Record<string, unknown>; entities: Record<string, EntityDefinition>; width: number }
const overview = { ...EvOverviewCharging.args!.config!, language:"hu", stop_entity:"button.ev_stop" };
const control = { ...EvControl.args!.config!, language:"hu", hide_stop:true };
const mode = { ...EvMode.args!.config!, language:"hu", title:"Automatikus alapmód" };
const entities = { ...EvControl.args!.entities!, ...EvOverviewCharging.args!.entities!, "number.ev_power":{state:4200,attributes:{min:4200,max:11000,step:100,unit_of_measurement:"W"}} };
const layout = {
  columns:2, tablet_columns:1, mobile_columns:1, gap:20,
  cards:[{type:"custom:luma-layout-card",columns:1,cards:[{type:"custom:luma-ev-overview-card",...overview},{type:"custom:luma-ev-mode-card",...mode}]},
    {type:"custom:luma-ev-control-card",...control}],
};
const meta:Meta<Args> = { title:"Charging/Quick charging", args:{config:layout,entities,width:1200},
  render:args=>renderCard("custom:luma-layout-card",args.config,args.entities,args.width),parameters:{controls:{disable:true}} };
export default meta;
type Story = StoryObj<Args>;
export const SolarCharging:Story = {};
export const Mobile:Story = {args:{width:358}};
export const Waiting:Story = {args:{entities:{...entities,...EvOverviewWaiting.args!.entities!}}};
export const Armed:Story = {args:{entities:{...entities,...EvOverviewWaiting.args!.entities!,"binary_sensor.ev_armed":{state:"on"},"binary_sensor.ev_charge_now_armed":{state:"on"}}}};
export const ChargeNow:Story = {args:{entities:{...entities,"sensor.ev_ownership":{state:"charge_now"},"binary_sensor.ev_active":{state:"on"},"binary_sensor.ev_charge_now_active":{state:"on"},"sensor.ev_remaining":{state:900},"sensor.ev_charge_now_remaining":{state:900}}}};
export const Unavailable:Story = {args:{entities:{...entities,"binary_sensor.ev_ocpp_connected":{state:"off"},"number.ev_power":{state:"unavailable"},"select.ev_mode":{state:"unavailable"},"select.ev_duration":{state:"unavailable"}}}};
