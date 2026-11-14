import type {Meta,StoryObj} from '@storybook/web-components-vite';
import '../src/index';
import {createMockHass} from '../storybook/mock-hass';
import type {LovelaceCard} from '../src/types';
const meta:Meta={title:'Design review/Room mobile'};export default meta;type Story=StoryObj;
function preview(missing=false){
 const card=document.createElement('luma-layout-card')as LovelaceCard;
 card.style.width='min(720px,calc(100vw - 32px))';
 card.setConfig({type:'custom:luma-layout-card',columns:2,tablet_columns:2,mobile_columns:2,cards:['Nappali','Hálószoba','Zsombor szobája','Dolgozó'].map((name,i)=>({type:'custom:luma-room-card',name,icon:i===2?'mdi:teddy-bear':'mdi:sofa-outline',path:'#room',temperature_entity:'sensor.temp',...(i<2?{humidity_entity:'sensor.humidity'}:{}),light_entity:`light.room${i}`,cover_entity:`cover.room${i}`}))});
 card.hass=createMockHass({'sensor.temp':{state:missing?'unavailable':22.1},'sensor.humidity':{state:45},...Object.fromEntries([0,1,2,3].flatMap(i=>[[`light.room${i}`,{state:missing?'unavailable':i===2?'off':'on'}],[`cover.room${i}`,{state:missing?'unavailable':i===1?'opening':'closed'}]]))});return card;
}
export const Rooms:Story={render:()=>preview()};
export const Missing:Story={render:()=>preview(true)};
