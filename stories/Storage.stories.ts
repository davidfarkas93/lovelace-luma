import type { Meta, StoryObj } from '@storybook/web-components-vite';
import '../src/index';
import { renderCard } from '../storybook/render-card';
import type { EntityDefinition } from '../storybook/mock-hass';

const disk={type:'custom:luma-storage-card',entity:'sensor.data_usage',name:'Data disk',subtitle:'Array · XFS',health_entity:'binary_sensor.data_health',
  used:{attribute:'used'},free:{attribute:'free'},total:{attribute:'total'},temperature:{attribute:'temperature',unit:'°C'},health_detail:{entity:'binary_sensor.data_health',attribute:'reason'}};
const entities:Record<string,EntityDefinition>={
  'sensor.data_usage':{state:73.4,attributes:{unit_of_measurement:'%',used:'2.9 TB',free:'1.1 TB',total:'4 TB',temperature:42}},
  'binary_sensor.data_health':{state:'off',attributes:{device_class:'problem'}},
  'binary_sensor.parity_health':{state:'off',attributes:{temperature:40}},
  'sensor.vm_usage':{state:18.7,attributes:{unit_of_measurement:'%'}},
  'sensor.vm_used':{state:153.2,attributes:{unit_of_measurement:'GiB'}},
  'sensor.vm_free':{state:666,attributes:{unit_of_measurement:'GiB'}},
  'sensor.vm_total':{state:819.2,attributes:{unit_of_measurement:'GiB'}},
};
const volume={type:'custom:luma-storage-card',entity:'sensor.vm_usage',name:'Virtual machines',subtitle:'Logical volume',used:{entity:'sensor.vm_used'},free:{entity:'sensor.vm_free'},total:{entity:'sensor.vm_total'}};
const parity={type:'custom:luma-storage-card',health_entity:'binary_sensor.parity_health',name:'Parity',subtitle:'Array protection',temperature:{attribute:'temperature',unit:'°C'}};
interface Args { config:Record<string,unknown>; entities:Record<string,EntityDefinition>; width:number }
const meta:Meta<Args>={title:'Cards/Storage',args:{config:disk,entities,width:360},
  render:args=>renderCard(String(args.config.type),args.config,args.entities,args.width),parameters:{controls:{disable:true}}};
export default meta;
type Story=StoryObj<Args>;
export const Disk:Story={};
export const LogicalVolume:Story={args:{config:volume}};
export const Parity:Story={args:{config:parity}};
const operation={state:{entity:'binary_sensor.check',attribute:'status'},label:'Parity check',state_map:{running:'Running',paused:'Paused',completed:'Completed'},progress:{entity:'sensor.progress'},progress_states:['running','paused']};
export const ParityChecking:Story={args:{config:{...parity,compact:true,operation},entities:{...entities,'binary_sensor.check':{state:'on',attributes:{status:'paused'}},'sensor.progress':{state:25}}}};
export const ParityCompleted:Story={args:{config:{...parity,compact:true,operation},entities:{...entities,'binary_sensor.check':{state:'off',attributes:{status:'completed'}},'sensor.progress':{state:0}}}};
export const Compact:Story={args:{config:{...disk,compact:true}}};
export const Warning:Story={args:{entities:{...entities,'sensor.data_usage':{state:96,attributes:{...entities['sensor.data_usage'].attributes,used:'3.8 TB',free:'0.2 TB'}},'binary_sensor.data_health':{state:'on',attributes:{reason:'Pending sectors detected · inspect the disk before replacing it.'}}}}};
export const Unavailable:Story={args:{entities:{...entities,'sensor.data_usage':{state:'unavailable',attributes:entities['sensor.data_usage'].attributes},'binary_sensor.data_health':{state:'unknown'}}}};
export const ResponsiveSection:Story={args:{width:1100,config:{type:'custom:luma-layout-card',columns:3,tablet_columns:2,mobile_columns:1,cards:[disk,volume,parity]}}};
