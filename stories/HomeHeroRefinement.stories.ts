import type {Meta,StoryObj} from '@storybook/web-components-vite';
import '../src/index';
import {createMockHass,type EntityDefinition} from '../storybook/mock-hass';
import type {LovelaceCard} from '../src/types';
const meta:Meta={title:'Design review/Home hero'};export default meta;type Story=StoryObj;
function preview(kind='quiet'){
 const busy=kind==='busy',missing=kind==='missing',warning=kind==='warning',windy=kind==='windy'||kind==='windy-clear';
 const now=Date.now()/1000,day=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const entities:Record<string,EntityDefinition>={
 'weather.home':{state:missing?'unavailable':kind==='windy'?'partlycloudy':'clear-night',attributes:{temperature:-1,temperature_unit:'°C',wind_speed:windy?26:5,wind_speed_unit:'km/h'}},
 'alarm_control_panel.home':{state:missing?'unavailable':'disarmed'},
 'sensor.advice':{state:kind==='advice'?'Öltözz rétegesen: meleg felső és kabát is jól jöhet.':'unavailable',attributes:{status:'ready',weather_entity:'weather.home',day,generated_at:now-30,valid_until:now+3600}},
 'light.living':{state:'on'},'light.kitchen':{state:'on'},'sensor.waste':{state:2},'sensor.general':{state:'collection',attributes:{daysTo:2}},'input_boolean.waste_ready':{state:kind==='waste'?'off':'on'},
 'binary_sensor.leak':{state:warning?'on':'off'},
 'sensor.washer':{state:busy?'washing':'off'},'sensor.dryer':{state:busy?'drying':'off'},'lawn_mower.garden':{state:busy?'mowing':'docked'},'sensor.charger':{state:busy?'charging':'idle'},
 };
 const card=document.createElement('luma-home-hero-card')as LovelaceCard;card.style.width='min(1100px,calc(100vw - 32px))';
 card.setConfig({type:'custom:luma-home-hero-card',name:'Dávid',weather_entity:'weather.home',weather_advice_entity:'sensor.advice',wind_threshold:20,alarm_entity:'alarm_control_panel.home',alarm_popover:true,alarm_action:{action:'more-info'},alarm_modes:[{mode:'away',name:'Távol'},{mode:'night',name:'Éjszaka'},{mode:'disarm',name:'Kikapcsolás'}],tap_action:{action:'navigate',navigation_path:'#weather'},active_label:'aktív világítás',active:{include:[{domain:'light',state:'on'}]},active_action:{action:'navigate',navigation_path:'#lights'},waste_entity:'sensor.waste',waste_items:[{entity:'sensor.general',name:'Kommunális'}],waste_ack_entity:'input_boolean.waste_ready',waste_path:'#waste',incidents:[{entity:'binary_sensor.leak',state:'on',message:'1 Unraid lemez SMART problémát jelez · +1',tone:'error',path:'#leak'}],appliances:[{entity:'sensor.washer',name:'Mosógép',icon:'mdi:washing-machine',path:'#laundry',state_map:{washing:'Mosás'}},{entity:'sensor.dryer',name:'Szárító',icon:'mdi:tumble-dryer',path:'#laundry',state_map:{drying:'Szárítás'}}],banners:[{entity:'lawn_mower.garden',label:'Fűnyíró',state:'mowing',state_map:{mowing:'Füvet nyír'},tap_action:{action:'navigate',navigation_path:'#garden'}},{entity:'sensor.charger',label:'Autótöltő',state:'charging',state_map:{charging:'Töltés'},tap_action:{action:'navigate',navigation_path:'#charging'}}]});
 card.hass=createMockHass(entities);return card;
}
export const Quiet:Story={render:()=>preview()};
export const Advice:Story={render:()=>preview('advice')};
export const Windy:Story={render:()=>preview('windy')};
export const Busy:Story={render:()=>preview('busy')};
export const Warning:Story={render:()=>preview('warning')};
export const Missing:Story={render:()=>preview('missing')};
export const Waste:Story={render:()=>preview('waste')};

export const WindyClear:Story={render:()=>preview('windy-clear')};
