import type { Meta, StoryObj } from '@storybook/web-components-vite';
import '../src/index';
import {renderCard} from '../storybook/render-card';
const meta:Meta={title:'Design system/Surfaces and meaning'};
export default meta;
type Story=StoryObj;
export const StateGallery:Story={render:()=>renderCard('custom:luma-layout-card',{
 columns:2,tablet_columns:2,mobile_columns:1,gap:16,cards:[
  {type:'custom:luma-room-card',name:'Nappali',icon:'mdi:sofa',accent_color:'#8f79c9',temperature_entity:'sensor.temperature',light_entity:'light.room',cover_entity:'cover.room',path:'/demo/room'},
  {type:'custom:luma-metric-card',entity:'sensor.power',name:'Aktív fogyasztás',decimals:1,active_states:['1.4'],secondary_entity:'sensor.energy',secondary_prefix:'Ma: ',secondary_decimals:1,tap_action:{action:'more-info'},secondary_tap_action:{action:'more-info'}},
  {type:'custom:luma-gate-card',entity:'cover.closed',name:'Zárt kapu',display:'popover'},
  {type:'custom:luma-gate-card',entity:'cover.open',name:'Nyitott kapu',display:'popover'},
  {type:'custom:luma-comfort-card',name:'Komfort — rendben',temperature_entity:'sensor.temperature',humidity_entity:'sensor.humidity'},
  {type:'custom:luma-comfort-card',name:'Komfort — figyelmeztetés',temperature_entity:'sensor.temperature',humidity_entity:'sensor.humidity',pm25_entity:'sensor.pm_warning'},
  {type:'custom:luma-comfort-card',name:'Komfort — magas érték',temperature_entity:'sensor.temperature',humidity_entity:'sensor.humidity',pm25_entity:'sensor.pm_error'},
  {type:'custom:luma-comfort-card',name:'Komfort — hiányos adat',temperature_entity:'sensor.missing',humidity_entity:'sensor.humidity'},
 ],
},{'sensor.temperature':{state:22.4,attributes:{unit_of_measurement:'°C'}},'sensor.humidity':{state:43},'light.room':{state:'on'},'cover.room':{state:'open'},'sensor.power':{state:1.4,attributes:{unit_of_measurement:'kW'}},'sensor.energy':{state:12.3,attributes:{unit_of_measurement:'kWh'}},'cover.closed':{state:'closed'},'cover.open':{state:'open'},'sensor.pm_warning':{state:18},'sensor.pm_error':{state:40}},1100)};

export const NarrowGates:Story={render:()=>renderCard('custom:luma-layout-card',{
 columns:2,tablet_columns:2,mobile_columns:2,cards:[
 {type:'custom:luma-gate-card',entity:'cover.gate',name:'Garázs',display:'popover'},
 {type:'custom:luma-gate-card',entity:'cover.gate',name:'Nagykapu',display:'popover'},
 ],
},{'cover.gate':{state:'closed'}},390)};

export const GarageSensor:Story={render:()=>renderCard('custom:luma-gate-card',{
 entity:'switch.garage',state_entity:'binary_sensor.garage',kind:'switch',name:'Garázs',display:'popover',
},{'switch.garage':{state:'on'},'binary_sensor.garage':{state:'off',attributes:{device_class:'garage_door'}}},390)};
