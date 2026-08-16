import "./cards/luma-hero-card";
import "./cards/luma-home-hero-card";
import "./cards/luma-control-card";
import "./cards/luma-control-group-card";
import "./cards/luma-metric-card";
import "./cards/luma-room-card";
import "./cards/luma-comfort-card";
import "./cards/luma-climate-card";
import "./cards/luma-tab-card";
import "./cards/luma-active-card";
import "./cards/luma-popup-card";
import "./cards/luma-alarm-card";
import "./cards/luma-status-card";
import "./cards/luma-heading-card";
import "./cards/luma-sensor-grid-card";
import "./cards/luma-remote-card";
import "./cards/luma-gate-card";
import "./cards/luma-cover-card";
import "./cards/luma-temperature-card";
import "./cards/luma-disclosure-card";
import "./cards/luma-energy-flow-card";
import "./cards/luma-navigation-card";
import "./cards/luma-history-card";
import "./cards/luma-homelab-hero-card";
import "./cards/luma-rack-cooling-card";
import "./cards/luma-irrigation-hero-card";
import "./cards/luma-irrigation-schedule-card";
import "./cards/luma-irrigation-zone-card";
import "./cards/luma-irrigation-program-card";
import "./cards/luma-logbook-card";
import "./cards/luma-update-card";
import "./cards/luma-timeline-card";
import "./cards/luma-action-card";
import "./cards/luma-weather-hero-card";
import "./cards/luma-weather-forecast-card";
import "./cards/luma-iframe-card";

const cards = [
  { type:"luma-weather-hero-card", name:"Luma Weather Hero", description:"A responsive current-weather hero with contextual conditions and metrics." },
  { type:"luma-weather-forecast-card", name:"Luma Weather Forecast", description:"A responsive native Home Assistant daily forecast strip." },
  { type:"luma-iframe-card", name:"Luma Iframe", description:"A polished responsive frame for maps and embedded dashboards." },
  { type:"luma-action-card", name:"Luma Action", description:"A compact reusable action, scene, or navigation card with optional confirmation." },
  { type:"luma-timeline-card", name:"Luma Timeline", description:"A responsive UniFi Protect event timeline with authenticated video playback." },
  { type:"luma-update-card", name:"Luma Update", description:"An update installer with confirmation and live installation progress." },
  { type:"luma-logbook-card", name:"Luma Logbook", description:"A recorder-backed, grouped and collapsible event timeline." },
  { type:"luma-irrigation-program-card", name:"Luma Irrigation Program", description:"A confirmed irrigation program launcher with live progress." },
  { type:"luma-irrigation-zone-card", name:"Luma Irrigation Zone", description:"An adjustable timed zone controller with confirmation and live progress." },
  { type:"luma-irrigation-schedule-card", name:"Luma Irrigation Schedule", description:"An even-width weekday and start-time schedule controller." },
  { type:"luma-irrigation-hero-card", name:"Luma Irrigation Hero", description:"A contextual irrigation system header." },
  { type:"luma-rack-cooling-card", name:"Luma Rack Cooling", description:"A responsive rack thermal and fan controller summary." },
  { type:"luma-homelab-hero-card", name:"Luma Homelab Hero", description:"A dynamic Homelab health hero aggregating Kuma, Komodo and infrastructure incidents." },
  { type:"luma-history-card", name:"Luma History", description:"Responsive recorder history chart with gradients and touch inspection." },
  { type:"luma-energy-flow-card", name:"Luma Energy Flow", description:"Live solar, home and grid power flow." },
  { type:"luma-navigation-card", name:"Luma Navigation", description:"A polished contextual navigation card." },
  { type:"luma-disclosure-card", name:"Luma Disclosure", description:"A compact expandable container for related controls." },
  { type:"luma-temperature-card", name:"Luma Temperature", description:"A visual room-temperature comparison with comfort-aware color and scale." },
  { type:"luma-cover-card", name:"Luma Cover", description:"A responsive cover controller with position, motion state, progress and confirmation." },
  { type:"luma-gate-card", name:"Luma Gate", description:"A confirmed gate and garage controller." },
  { type:"luma-remote-card", name:"Luma Remote", description:"A compact Android TV remote controller." },
  { type:"luma-sensor-grid-card", name:"Luma Sensor Grid", description:"A responsive grouped sensor summary." },
  { type:"luma-heading-card", name:"Luma Heading", description:"A compact, consistent section heading." },
  {
    type:"luma-alarm-card",name:"Luma Alarm",description:"A contextual alarm status and arming-mode controller.",
  },
  {
    type:"luma-popup-card",name:"Luma Popup",description:"A responsive Material 3 inspired hash-driven bottom sheet.",
  },
  {
    type:"luma-active-card",name:"Luma Active",description:"A dynamic active-entity list driven by reusable runtime rules.",
  },
  {
    type:"luma-tab-card",name:"Luma Tabs",description:"A polished responsive tab container for native and custom Lovelace cards.",
  },
  {
    type:"luma-climate-card",name:"Luma Climate",description:"A compact responsive climate controller with configurable HVAC modes.",
  },
  {
    type:"luma-comfort-card",name:"Luma Comfort",description:"A responsive indoor comfort summary with contextual air-quality effects.",
  },
  {
    type:"luma-room-card",name:"Luma Room",description:"A contextual room card with environment and quick controls.",
  },
  {
    type:"luma-metric-card",name:"Luma Metric",description:"A compact primary and secondary entity metric card.",
  },
  {
    type: "luma-control-group-card",
    name: "Luma Control Group",
    description: "A compact one-row group of responsive entity controls.",
  },
  {
    type: "luma-control-card",
    name: "Luma Control",
    description: "A responsive entity control with mapped state, contextual accent, and actions.",
  },
  {
    type: "luma-home-hero-card",
    name: "Luma Home Hero",
    description: "A weather-aware home hero with incident acknowledgement and contextual banners.",
  },
  {
    type: "luma-hero-card",
    name: "Luma Hero",
    description: "A responsive, context-aware hero card with chips and conditional banners.",
  },
  {
    type: "luma-status-card",
    name: "Luma Status",
    description: "A compact entity status card using the Luma design system.",
  },
];

window.customCards = window.customCards || [];
for (const card of cards) {
  if (!window.customCards.some((registered) => registered.type === card.type)) {
    window.customCards.push({
      ...card,
      preview: true,
      documentationURL: "https://github.com/davidfarkas93/lovelace-luma",
    });
  }
}

console.info(
  "%c LUMA %c 0.33.1 ",
  "color: white; background: #6d78c5; font-weight: 700; border-radius: 4px 0 0 4px; padding: 2px 5px;",
  "color: #6d78c5; background: #eef0ff; border-radius: 0 4px 4px 0; padding: 2px 5px;",
);
