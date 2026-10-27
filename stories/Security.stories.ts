import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/index";
import { renderCard } from "../storybook/render-card";
import type { EntityDefinition } from "../storybook/mock-hass";

interface Args { cardType: string; config: Record<string,unknown>; entities: Record<string,EntityDefinition>; width: number }
export default { title: "Patterns/Security", render: (a: Args) => renderCard(a.cardType,a.config,a.entities,a.width), args:{width:390} } satisfies Meta<Args>;
type Story = StoryObj<Args>;
const items = [
  {entity:"binary_sensor.door",name:"Bejárati ajtó",state_map:{on:"Nyitva",off:"Zárva"}},
  {entity:"binary_sensor.garage",name:"Garázskapu",state_map:{on:"Nyitva",off:"Zárva"}},
  {entity:"binary_sensor.hall",name:"Hosszú nevű helyiség érzékelője",state_map:{on:"Mozgás",off:"Nyugalomban"}},
];
const sensors = {cardType:"custom:luma-sensor-grid-card",config:{name:"Nyílászárók és érzékelők",surface:true,collapsible:true,language:"hu",items}};
export const SensorsClear: Story = {args:{...sensors,entities:{"binary_sensor.door":{state:"off"},"binary_sensor.garage":{state:"off"},"binary_sensor.hall":{state:"off"}}}};
export const SensorsAttention: Story = {args:{...sensors,entities:{"binary_sensor.door":{state:"on"},"binary_sensor.garage":{state:"unavailable"},"binary_sensor.hall":{state:"off"}}}};
export const SensorsMissing: Story = {args:{...sensors,entities:{}}};
export const AlarmDisarmed: Story = {args:{cardType:"custom:luma-alarm-card",config:{entity:"alarm_control_panel.home",name:"Otthoni riasztó",language:"hu"},entities:{"alarm_control_panel.home":{state:"disarmed"}}}};
export const AlarmUnavailable: Story = {args:{cardType:"custom:luma-alarm-card",config:{entity:"alarm_control_panel.home",language:"hu"},entities:{"alarm_control_panel.home":{state:"unavailable"}}}};
const event = (type:string,offset:number) => ({id:`${type}-${offset}`,type,timestamp:new Date(Date.now()-offset*1000).toISOString(),snapshot:"",url:`/mock-video/${type}-${offset}`});
export const GroupedEvents: Story = {args:{cardType:"custom:luma-timeline-card",config:{entity:"sensor.events",title:"Bejárat eseményei",language:"hu",group_seconds:30,initial_items:3},entities:{"sensor.events":{state:"7",attributes:{events:[event("smartDetectLine",60),event("motion",63),event("person",64),event("animal",120),event("motion",123),event("ring",240),event("motion",400)]}}}}};
export const EventsUnavailable: Story = {args:{cardType:"custom:luma-timeline-card",config:{entity:"sensor.events",language:"hu"},entities:{"sensor.events":{state:"unavailable",attributes:{events:[event("person",60)]}}}}};

export const LatestEvent: Story = {args:{...GroupedEvents.args,config:{...GroupedEvents.args!.config,title:"Legutóbbi esemény",subtitle:"Koppints a felvételhez",max_items:1,initial_items:1,show_group_details:false,show_count:false,history_path:"/security/front-door"}}};
export const LatestEventUnavailable: Story = {args:{...EventsUnavailable.args,config:{...EventsUnavailable.args!.config,show_group_details:false,show_count:false,history_path:"/security/front-door"}}};

const securityHeroConfig = {name:"Biztonság",chips_inline:true,chips:[{entity:"alarm_control_panel.home",name:"Riasztó",icon:"mdi:shield-outline",state_map:{disarmed:"Kikapcsolva",armed_away:"Élesítve",unavailable:"Nem elérhető"}}],language:"hu",icon:"mdi:shield-home-outline",state_map:{disarmed:"Riasztó kikapcsolva",armed_away:"Riasztó élesítve",triggered:"Riasztás!",unavailable:"A riasztó nem elérhető"},summary_groups:[{items:[{entity:"binary_sensor.door",name:"Bejárati ajtó"},{entity:"binary_sensor.gate",name:"Garázskapu"}],clear_label:"Nyílászárók zárva",active_label:"nyitva"},{items:[{entity:"binary_sensor.room",name:"Dolgozó érzékelője"}],show_active:false}]};
export const SecurityHeroClear: Story = {args:{cardType:"custom:luma-hero-card",width:900,config:securityHeroConfig,entities:{"alarm_control_panel.home":{state:"disarmed"},"binary_sensor.door":{state:"off"},"binary_sensor.gate":{state:"off"},"binary_sensor.room":{state:"off"}}}};
export const SecurityHeroAttention: Story = {args:{...SecurityHeroClear.args,entities:{"alarm_control_panel.home":{state:"armed_away"},"binary_sensor.door":{state:"off"},"binary_sensor.gate":{state:"on"},"binary_sensor.room":{state:"unavailable"}}}};
export const SecurityHeroUnavailable: Story = {args:{...SecurityHeroClear.args,entities:{"alarm_control_panel.home":{state:"unavailable"},"binary_sensor.door":{state:"unknown"}}}};
