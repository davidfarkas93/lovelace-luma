import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import '../src/index';
import { createMockHass } from '../storybook/mock-hass';
import type { HomeAssistant } from '../src/types';
import { bucketStart, shiftBucket, type HistoryPeriod } from '../src/history';

interface Args { config: Record<string, unknown>; empty: boolean; delay: boolean; sparse: boolean }
const rooms = ['living', 'bedroom', 'child', 'study'];
const roomNames = ['Nappali', 'Háló', 'Gyerekszoba', 'Dolgozó'];
const colors = ['#e9a15b', '#6ba9df', '#a68bd4', '#66b6a0'];
const heating = {
  title: 'Szobák hőmérséklete', unit: '°C', decimals: 1, include_zero: false,
  ranges: [{label:'24 óra',hours_to_show:24},{label:'3 nap',hours_to_show:72}],
  series: rooms.map((room,index)=>({entity:`sensor.${room}_temperature`,name:roomNames[index],color:colors[index]})),
  state_bands: [{entities:rooms.map(room=>`climate.${room}`),attribute:'hvac_action',active_states:['heating'],name:'Legalább egy szoba fűtést kér',color:'#e9a15b'}],
};
const energy = {
  title:'Autótöltési energia',unit:'kWh',decimals:2,series:[{entity:'sensor.ev_energy',name:'Töltés',color:'#58b984'}],
  ranges:[{label:'14 nap',days_to_show:14,period:'day',statistic:'change',chart_type:'bar'},{label:'12 hónap',days_to_show:365,period:'month',statistic:'change',chart_type:'bar'}],
};
const meta: Meta<Args> = {
  title:'Patterns/History',parameters:{layout:'fullscreen',controls:{disable:true}},args:{config:heating,empty:false,delay:false,sparse:false},
  render: ({config,empty,delay,sparse}) => {
    const hass = createMockHass({});
    hass.callWS = async (message:Record<string,unknown>) => {
      if (delay) await new Promise(resolve=>setTimeout(resolve, message.period==='month'?30:200));
      if (empty) return {} as never;
      const now=Date.now(),start=new Date(String(message.start_time)).getTime();
      if(message.type==='recorder/statistics_during_period') {
        const period=String(message.period) as HistoryPeriod;
        const first=shiftBucket(bucketStart(start,period),period,-1);
        const records=[];
        for(let time=first,index=0;time<now;time=shiftBucket(time,period,1),index++) records.push({start:time,change:index===0?18:3+index%6});
        return {'sensor.ev_energy':records} as never;
      }
      const ids=message.entity_ids as string[];
      if(sparse)return Object.fromEntries(ids.map(id=>[id,[
        {s:'0',lu:start/1000},
        {s:'4290',lu:(now-7*3600000)/1000},
        {s:'4180',lu:(now-4*3600000)/1000},
        {s:'0',lu:(now-3*3600000)/1000},
      ]])) as never;
      return Object.fromEntries(ids.map((id,series)=>[id,Array.from({length:97},(_,index)=>{
        const time=start+(now-start)*index/96;
        if(id.startsWith('climate.'))return {s:index===48?'unavailable':'heat',a:{current_temperature:21+Math.sin(index/8),temperature:22,hvac_action:(index+series*4)%24<8?'heating':'idle'},lu:time/1000,lc:start/1000};
        if(id.startsWith('sensor.ev_'))return {s:id==='sensor.ev_requested'?'unknown':String(time<now-3*3600000?3200+series*1000:0),lu:time/1000};
        return {s:index===48?'unavailable':String(21+series*.7+Math.sin(index/8)*.6),lu:time/1000};
      })])) as never;
    };
    const card=document.createElement('luma-history-card') as HTMLElement & {hass:HomeAssistant;setConfig(config:Record<string,unknown>):void};
    card.setConfig({type:'custom:luma-history-card',...config});card.hass=hass;
    return html`<div style="max-width:960px;padding:20px;margin:auto">${card}</div>`;
  },
};
export default meta;
type Story = StoryObj<Args>;
export const HeatingShared:Story={};
export const HeatingAttributes:Story={args:{config:{...heating,title:'Mért és célhőmérséklet',series:[{entity:'climate.living',attribute:'current_temperature',name:'Mért',color:colors[0]},{entity:'climate.living',attribute:'temperature',name:'Cél',dashed:true,color:colors[1]}]}}};
export const ChargingPower:Story={args:{config:{title:'Teljesítménykövetés',unit:'W',ranges:[{label:'2 óra',hours_to_show:2},{label:'12 óra',hours_to_show:12},{label:'24 óra',hours_to_show:24}],series:[{entity:'sensor.ev_pv',name:'PV 1m'},{entity:'sensor.ev_requested',name:'Kért limit'},{entity:'sensor.ev_power',name:'Tényleges töltés'}]}}};
export const DailyEnergy:Story={args:{config:energy}};
export const RangeRace:Story={args:{config:energy,delay:true}};
export const MissingHistory:Story={args:{config:energy,empty:true}};

export const SparseChargingStep:Story={args:{sparse:true,config:{title:'Tényleges töltés — ritka mérési pontok',hours_to_show:12,unit:'W',series:[{entity:'sensor.ev_power',name:'Tényleges töltés',color:'#48aa9b',interpolation:'step'}]}}};
