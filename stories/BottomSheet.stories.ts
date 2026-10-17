import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../src/index';
import type { LumaBottomSheet } from '../src/components/luma-bottom-sheet';
import { renderCard } from '../storybook/render-card';

interface Args { count: number; heading: string }
const meta: Meta<Args> = {
  title: 'Luma/Bottom sheet',
  parameters: { layout: 'fullscreen', controls: { disable: true } },
  args: { count: 16, heading: 'Gyors hozzáférés' },
  render: ({ count, heading }) => html`
    <div>
      <button style="margin:24px;padding:12px" @click=${(event: Event) => {
        event.currentTarget instanceof HTMLElement &&
          ((event.currentTarget.parentElement!.querySelector('luma-bottom-sheet') as LumaBottomSheet).open = true);
      }}>Panel megnyitása</button>
      <luma-bottom-sheet .open=${true} .heading=${heading}
        subtitle="Aktív eszközök és gyakori vezérlők" closeLabel="Bezárás"
        @sheet-dismiss=${(event: Event) => { (event.currentTarget as LumaBottomSheet).open = false; }}>
        ${renderCard('custom:luma-layout-card', {
          columns: 1, tablet_columns: 1, mobile_columns: 1,
          cards: Array.from({ length: count }, (_, index) => ({
            type: 'custom:luma-control-card', entity: `light.demo_${index}`,
            name: ['Nappali mennyezeti világítás', 'Konyhasziget', 'Dolgozószoba'][index % 3],
            tap_action: { action: 'toggle' },
          })),
        }, Object.fromEntries(Array.from({ length: count }, (_, index) =>
          [`light.demo_${index}`, { state: index % 2 ? 'off' : 'on' }])), 620)}
      </luma-bottom-sheet>
    </div>`,
};
export default meta;
type Story = StoryObj<Args>;

export const Scrollable: Story = {};
export const Compact: Story = { args: { count: 1 } };
export const LongHeading: Story = { args: { heading: 'Aktív eszközök és a leggyakrabban használt otthoni vezérlők' } };
