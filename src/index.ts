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

const cards = [
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
  "%c LUMA %c 0.16.0 ",
  "color: white; background: #6d78c5; font-weight: 700; border-radius: 4px 0 0 4px; padding: 2px 5px;",
  "color: #6d78c5; background: #eef0ff; border-radius: 0 4px 4px 0; padding: 2px 5px;",
);
