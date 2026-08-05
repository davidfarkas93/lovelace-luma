import "./cards/luma-hero-card";
import "./cards/luma-home-hero-card";
import "./cards/luma-control-card";
import "./cards/luma-control-group-card";
import "./cards/luma-metric-card";
import "./cards/luma-room-card";
import "./cards/luma-comfort-card";
import "./cards/luma-status-card";

const cards = [
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
  "%c LUMA %c 0.8.0 ",
  "color: white; background: #6d78c5; font-weight: 700; border-radius: 4px 0 0 4px; padding: 2px 5px;",
  "color: #6d78c5; background: #eef0ff; border-radius: 0 4px 4px 0; padding: 2px 5px;",
);
