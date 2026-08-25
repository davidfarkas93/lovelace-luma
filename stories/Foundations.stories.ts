import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

const meta: Meta = {
  title: "Luma/Foundations",
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj;

export const DesignTokens: Story = {
  render: () => html`
    <style>
      .tokens{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;max-width:900px}.token{padding:18px;border:1px solid rgba(80,85,110,.1);border-radius:20px;background:white;box-shadow:0 12px 32px rgba(30,35,60,.05)}.swatch{height:72px;margin-bottom:12px;border-radius:14px;background:var(--tone)}.name{font-weight:720}.value{margin-top:3px;color:#707381;font:11px ui-monospace,monospace}
    </style>
    <div class="tokens">
      ${[
        ["Primary", "#6574c4"], ["Success", "#4da766"], ["Warning", "#e6a11b"],
        ["Error", "#dc5361"], ["Information", "#3d9fda"], ["Surface", "#ffffff"],
      ].map(([name, value]) => html`<div class="token"><div class="swatch" style=${`--tone:${value}`}></div><div class="name">${name}</div><div class="value">${value}</div></div>`)}
    </div>
  `,
};
