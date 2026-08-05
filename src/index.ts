import "./cards/luma-hero-card";
import "./cards/luma-home-hero-card";
import "./cards/luma-status-card";

const cards = [
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
  "%c LUMA %c 0.2.1 ",
  "color: white; background: #6d78c5; font-weight: 700; border-radius: 4px 0 0 4px; padding: 2px 5px;",
  "color: #6d78c5; background: #eef0ff; border-radius: 0 4px 4px 0; padding: 2px 5px;",
);
