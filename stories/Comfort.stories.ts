import type {Meta,StoryObj} from '@storybook/web-components-vite';
import '../src/index';
import {renderCard} from '../storybook/render-card';
const meta:Meta={title:'Cards/Comfort'};export default meta;type Story=StoryObj;
const config={name:'Komfort',temperature_entity:'sensor.temperature',temperature_label:'Benti átlag',humidity_entity:'sensor.humidity',humidity_label:'Átlagos pára',pm25_entity:'sensor.pm',pm25_label:'PM2.5 · Nappali',outdoor_temperature_entity:'sensor.outside',heating_entity:'sensor.heating',tap_action:{action:'navigate',navigation_path:'#environment'},climate:{entity:'climate.ac',name:'Klíma · Nappali',modes:[{mode:'off',name:'Ki'},{mode:'cool',name:'Hűtés'}]}};
const entities={'sensor.temperature':{state:22.1,attributes:{unit_of_measurement:'°C'}},'sensor.humidity':{state:45},'sensor.pm':{state:7},'sensor.outside':{state:1.4,attributes:{unit_of_measurement:'°C'}},'sensor.heating':{state:'heat'},'climate.ac':{state:'off',attributes:{hvac_modes:['off','cool','heat','dry'],temperature:24,temperature_unit:'°C'}}};
export const Integrated:Story={render:()=>renderCard('custom:luma-comfort-card',config,entities,620)};
export const Warning:Story={render:()=>renderCard('custom:luma-comfort-card',config,{...entities,'sensor.pm':{state:24}},620)};
export const Missing:Story={render:()=>renderCard('custom:luma-comfort-card',config,{...entities,'sensor.temperature':{state:'unavailable'},'climate.ac':{state:'unavailable',attributes:entities['climate.ac'].attributes}},620)};
export const Cooling:Story={render:()=>renderCard('custom:luma-comfort-card',config,{...entities,'climate.ac':{state:'cool',attributes:{...entities['climate.ac'].attributes,hvac_action:'cooling'}}},620)};
export const AlongsideRooms:Story={render:()=>renderCard('custom:luma-layout-card',{columns:2,tablet_columns:1,mobile_columns:1,cards:[{type:'custom:luma-comfort-card',...config},{type:'custom:luma-layout-card',columns:2,tablet_columns:2,mobile_columns:2,cards:[{type:'custom:luma-room-card',name:'Nappali',icon:'mdi:sofa',temperature_entity:'sensor.temperature',humidity_entity:'sensor.humidity',light_entity:'light.living',accent_color:'#58afc2',path:'#living'},{type:'custom:luma-room-card',name:'Hálószoba',icon:'mdi:bed-king',temperature_entity:'sensor.temperature',light_entity:'light.bedroom',accent_color:'#a18acb',path:'#bedroom'}]}]},{...entities,'light.living':{state:'on'},'light.bedroom':{state:'off'}},1200)};

// The details reuse the summary's sources and thresholds inside the shared shell.
const detailConfig={...config,display:'details',rooms:[
 {name:'Nappali',icon:'mdi:sofa',temperature_entity:'sensor.temperature',humidity_entity:'sensor.humidity',climate_entity:'climate.living'},
 {name:'Hálószoba',icon:'mdi:bed-king',temperature_entity:'sensor.bedroom',humidity_entity:'sensor.bedroom_humidity',climate_entity:'climate.bedroom'},
 {name:'Dolgozó',icon:'mdi:desk',temperature_entity:'sensor.work',climate_entity:'climate.work'},
 {name:'Zsombor szobája',icon:'mdi:teddy-bear',temperature_entity:'sensor.child',climate_entity:'climate.child'},
],context_entities:[{entity:'sensor.outside',name:'Kinti hőmérséklet',icon:'mdi:thermometer'},{entity:'sensor.allergen',name:'Allergén · Nappali',icon:'mdi:flower-pollen',decimals:0}],details_action:{action:'navigate',navigation_path:'/dashboard-climate/climate'}};
const detailEntities={...entities,'sensor.pm':{state:24},'sensor.bedroom':{state:21.4},'sensor.bedroom_humidity':{state:48},'sensor.work':{state:22.6},'sensor.child':{state:21.8},'sensor.allergen':{state:2},
 'climate.living':{state:'heat',attributes:{hvac_action:'heating',temperature:23}},
 'climate.bedroom':{state:'heat',attributes:{hvac_action:'idle',temperature:21}},
 'climate.work':{state:'off',attributes:{temperature:22}},
 'climate.child':{state:'heat',attributes:{hvac_action:'heating',temperature:22}},
};
import {html} from 'lit';
import {createMockHass} from '../storybook/mock-hass';
import type {LumaComfortCard} from '../src/cards/luma-comfort-card';
import type {LumaBottomSheet} from '../src/components/luma-bottom-sheet';
function detailSheet(missing=false){const card=document.createElement('luma-comfort-card') as LumaComfortCard;card.setConfig({type:'custom:luma-comfort-card',...detailConfig,display:'details',tap_action:{action:'none'},details_action:{action:'navigate',navigation_path:'/dashboard-climate/climate'}});card.hass=createMockHass(missing?{...detailEntities,'sensor.temperature':{state:'unavailable'},'climate.living':{state:'heat',attributes:{restored:true,hvac_action:'heating',temperature:99}},'climate.child':{state:'heat'},'climate.ac':{state:'unavailable'}}:detailEntities);return html`<button @click=${(e:Event)=>{(e.currentTarget as HTMLElement).parentElement!.querySelector<LumaBottomSheet>('luma-bottom-sheet')!.open=true}}>Komfort megnyitása</button><luma-bottom-sheet .open=${true} heading="Komfort" icon="mdi:home-thermometer-outline" closeLabel="Bezárás" .maxWidth=${760} @sheet-dismiss=${(e:Event)=>{(e.currentTarget as LumaBottomSheet).open=false}}>${card}</luma-bottom-sheet>`;}
export const Details:Story={render:()=>detailSheet(),parameters:{layout:'fullscreen'}};
export const DetailsMissing:Story={render:()=>detailSheet(true),parameters:{layout:'fullscreen'}};

export const CompactClimate:Story={render:()=>renderCard('custom:luma-climate-card',{...config.climate,variant:'compact'},entities,420)};
export const CompactClimateCooling:Story={render:()=>renderCard('custom:luma-climate-card',{...config.climate,variant:'compact'},{...entities,'climate.ac':{state:'cool',attributes:{...entities['climate.ac'].attributes,hvac_action:'cooling'}}},420)};

export const CompactClimateModes:Story={render:()=>renderCard('custom:luma-climate-card',{...config.climate,variant:'compact',modes:[{mode:'off'},{mode:'cool'},{mode:'heat'},{mode:'dry'}]},entities,420)};
