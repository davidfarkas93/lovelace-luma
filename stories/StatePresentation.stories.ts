import type { Meta, StoryObj } from '@storybook/web-components-vite';
import '../src/index';
import { renderCard } from '../storybook/render-card';
const meta:Meta={title:'Design system/State presentation'};
export default meta;
type Story=StoryObj;
export const Metric:Story={render:()=>renderCard('custom:luma-metric-card',{
 entity:'sensor.value',name:'Measurement',decimals:1,secondary_entity:'sensor.secondary',secondary_prefix:'Humidity: ',secondary_decimals:0,
},{'sensor.value':{state:22.4,attributes:{unit_of_measurement:'°C'}},'sensor.secondary':{state:43,attributes:{unit_of_measurement:'%'}}},390)};
export const Comfort:Story={render:()=>renderCard('custom:luma-comfort-card',{
 temperature_entity:'sensor.temperature',humidity_entity:'sensor.humidity',pm25_entity:'sensor.pm',outdoor_temperature_entity:'sensor.outside',
},{'sensor.temperature':{state:22.4,attributes:{unit_of_measurement:'°C'}},'sensor.humidity':{state:43},'sensor.pm':{state:'unavailable'},'sensor.outside':{state:9.2,attributes:{unit_of_measurement:'°C'}}},520)};
export const Room:Story={render:()=>renderCard('custom:luma-room-card',{
 name:'Living room',icon:'mdi:sofa',temperature_entity:'sensor.temperature',humidity_entity:'sensor.humidity',light_entity:'light.room',cover_entity:'cover.room',
},{'sensor.temperature':{state:22.4,attributes:{unit_of_measurement:'°C'}},'sensor.humidity':{state:'unknown'},'light.room':{state:'unavailable'},'cover.room':{state:'open'}},390)};
export const Hero:Story={render:()=>renderCard('custom:luma-home-hero-card',{
 weather_entity:'weather.home',alarm_entity:'alarm_control_panel.home',name:'Alex',
},{'weather.home':{state:'sunny',attributes:{temperature:9.2,temperature_unit:'°C',wind_speed:0,wind_speed_unit:'km/h'}},'alarm_control_panel.home':{state:'unavailable'}},900)};
