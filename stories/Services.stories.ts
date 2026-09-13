import type { Meta, StoryObj } from '@storybook/web-components-vite';
import '../src/index';
import { renderCard } from '../storybook/render-card';
import type { EntityDefinition } from '../storybook/mock-hass';
import type { ServiceGridConfig } from '../src/services';

const config: ServiceGridConfig = {
  type:'custom:luma-service-grid-card',
  stacks:{integration:'komodo',entity_pattern:'sensor.*_stack_state'},
  containers:{integration:'komodo',domain:'switch',exclude:['switch.*_stack']},
  monitors:{integration:'uptime_kuma',entity_pattern:'sensor.*_status'},
  updates:{integration:'komodo',domain:'update'},
  metrics:{latency:{from:'_status',to:'_latency'},uptime:{from:'_status',to:'_uptime'},url:{from:'_status',to:'_url'}},
  uptime_label:'30 days',
  bindings:[
    {entity:'sensor.identity_stack_state',monitor:'sensor.identity_status',name:'Identity',icon:'mdi:shield-account-outline'},
    {entity:'sensor.photos_stack_state',monitor:'sensor.photos_status',name:'Photos',icon:'mdi:image-multiple-outline'},
    {entity:'sensor.media_stack_state',monitor:'sensor.media_status',name:'Media library',icon:'mdi:play-box-outline'},
  ],
  operations:[
    {name:'Redeploy stack',icon:'mdi:rocket-launch-outline',selector:{domain:'button',entity_pattern:'button.*_deploy'},service:'button.press',confirm:'Redeploy this entire stack? This can interrupt service.'},
    {name:'Stop stack',icon:'mdi:stop-circle-outline',selector:{domain:'switch',entity_pattern:'switch.*_stack'},service:'switch.turn_off',confirm:'Stop every container in this stack?',state:['on']},
  ],
  monitor_groups:[{name:'Infrastructure',entity_pattern:'sensor.host_*'},{name:'Backups',entity_pattern:'sensor.backup_*'}],
  name_remove:[' status',' Stack State'],
};
const entities: Record<string,EntityDefinition> = {};
const add = (id:string,state:string|number,device?:string,platform='komodo',attributes:Record<string,unknown>={}) => {
  entities[id]={state,device,platform,attributes};
};
for(const [slug,name,count] of [['identity','Identity',4],['photos','Photos',4],['media','Media library',1],['tunnel','Tunnel',1]] as const){
  add(`sensor.${slug}_stack_state`,'RUNNING',name);
  add(`switch.${slug}_stack`,'on',name);
  add(`button.${slug}_deploy`,'unknown',name);
  for(let i=1;i<=count;i++)add(`switch.${slug}_container_${i}`,'on',name,'komodo',{friendly_name:`${name} · ${['Server','Worker','Database','Cache'][i-1]}`});
  if(slug!=='tunnel'){
    add(`sensor.${slug}_status`,'up',undefined,'uptime_kuma');
    add(`sensor.${slug}_latency`,14+count,undefined,'uptime_kuma');
    add(`sensor.${slug}_uptime`,99.98,undefined,'uptime_kuma');
    add(`sensor.${slug}_url`,'https://example.com',undefined,'uptime_kuma');
  }
}
add('sensor.host_storage_status','up',undefined,'uptime_kuma',{friendly_name:'Storage server'});
add('sensor.backup_vm_status','up',undefined,'uptime_kuma',{friendly_name:'Virtual machine backups'});
add('sensor.backup_vm_latency','unknown',undefined,'uptime_kuma');
add('update.identity_server','on','Identity','komodo',{friendly_name:'Identity server',installed_version:'1.0',latest_version:'1.1',supported_features:1});

interface Args { config:ServiceGridConfig; entities:Record<string,EntityDefinition>; width:number }
const meta:Meta<Args>={title:'Cards/Services',args:{config,entities,width:1120},
  render:args=>renderCard('custom:luma-service-grid-card',args.config as unknown as Record<string,unknown>,args.entities,args.width),parameters:{controls:{disable:true}}};
export default meta;
type Story=StoryObj<Args>;
export const Unified:Story={};
export const Mobile:Story={args:{width:360}};
export const PartialFailure:Story={args:{entities:{...entities,'switch.photos_container_3':{...entities['switch.photos_container_3'],state:'off'},'sensor.media_status':{...entities['sensor.media_status'],state:'down'}}}};
export const MissingData:Story={args:{entities:{...entities,'sensor.identity_status':{...entities['sensor.identity_status'],state:'unavailable'},'switch.photos_container_2':{...entities['switch.photos_container_2'],state:'unavailable'}}}};
export const Details:Story={args:{config:{...config,show_details:'sensor.identity_stack_state'}}};
