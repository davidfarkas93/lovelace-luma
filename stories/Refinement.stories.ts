import type {Meta,StoryObj} from '@storybook/web-components-vite';
import {html} from 'lit';
import '../storybook/refinement-preview';
const meta:Meta={title:'Design review/Surface refinement',args:{theme:'dark',variant:'compare'},argTypes:{theme:{control:'select',options:['light','dark']},variant:{control:'select',options:['compare','current','refined']}},render:args=>html`<luma-refinement-preview .theme=${args.theme} .variant=${args.variant}></luma-refinement-preview>`};
export default meta;
type Story=StoryObj;
export const Compare:Story={};
export const Proposed:Story={args:{variant:'refined'}};
export const Light:Story={args:{theme:'light'}};
