import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/cards/luma-hero-card";
import { renderCard } from "../storybook/render-card";

interface Args { name:string; subtitle:string; state:string; accent:string; chipsInline:boolean }
const meta: Meta<Args> = {
  title: "Cards/Hero",
  component: "luma-hero-card",
  args: { name:"Energy", subtitle:"Live production · consumption · grid balance", state:"4.8", accent:"#6574c4", chipsInline:true },
  argTypes: { accent: { control:"color" }, state: { control:"text" } },
  render: (args) => renderCard("custom:luma-hero-card", {
    name:args.name, subtitle:args.subtitle, icon:"mdi:flash", accent_color:args.accent, chips_inline:args.chipsInline,
    chips:[{ entity:"sensor.solar", name:"Solar", icon:"mdi:solar-power", color:"var(--warning-color)", show_state:true }],
  }, { "sensor.solar":{ state:args.state, attributes:{ unit_of_measurement:"kW", friendly_name:"Solar production" } } }, 860),
};
export default meta;
type Story = StoryObj<Args>;
export const Playground: Story = {};
export const WarningTone: Story = { args:{ name:"Solar", subtitle:"Production and forecast", accent:"#e6a11b", state:"3.2" } };
