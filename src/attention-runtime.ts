import { attentionAckMap, attentionHash, attentionSnapshot, attentionPolicyErrors, groupAttention, type AttentionEntry, type AttentionExternal, type AttentionPolicy } from "./attention";
import { callHouseholdScript, type HouseholdSnapshot } from "./household-context";
import type { HomeAssistant } from "./types";
import { localized } from "./localize";

interface BackendResult {schema_version:1;policy_id:string;policy_hash:string;policy_revision:string;generated_at:number;rows:AttentionEntry[];policy:AttentionPolicy}
const backend = new Map<string,{binding:string;language:string;data?:BackendResult;fetching:boolean;at:number;error:boolean;health:unknown;request?:number}>();
export async function refreshAttentionBackend(hass:HomeAssistant,name:string,force=false) {
  session(hass);const policy=window.lumaAttentionPolicies?.[name],binding=policy?.backend;
  if(!binding)return;
  const language=hass.locale?.language?.startsWith('hu')?'hu':'en',key=JSON.stringify(binding);
  let entry=backend.get(name);
  if(!entry||entry.binding!==key||entry.language!==language){entry={binding:key,language,fetching:false,at:0,error:false,health:undefined};backend.set(name,entry)}
  const health=binding.health_entity?hass.states[binding.health_entity]?.attributes.event_count:undefined;
  if(entry.fetching&&!force||!force&&entry.health===health&&Date.now()-entry.at<15000)return;
  entry.fetching=true;entry.health=health;entry.at=Date.now();const epoch=generation;
  const request=entry.request=(entry.request||0)+1;
  try {
    if(!hass.callWS)throw Error('WebSocket unavailable');
    const result=await hass.callWS<BackendResult>({type:'home_insights/attention',policy_id:binding.policy_id,language});
    if(epoch!==generation||backend.get(name)!==entry||entry.request!==request)return;
    if(result.schema_version!==1||result.policy_id!==binding.policy_id||!Array.isArray(result.rows)||!result.policy?.rules||typeof result.policy_hash!=='string'||!Number.isFinite(result.generated_at)||Date.now()-result.generated_at>45000||result.generated_at>Date.now()+10000||result.rows.some(r=>!r||typeof r.id!=='string'||typeof r.key!=='string'||!['active','inactive','pending','unavailable','excluded','installing','event','loading'].includes(r.status)))throw Error('Invalid backend attention snapshot');
    entry.data=result;entry.error=false;
  } catch {if(epoch===generation&&backend.get(name)===entry&&entry.request===request)entry.error=true;}
  finally{if(epoch===generation&&backend.get(name)===entry&&entry.request===request){entry.fetching=false;externalVersion++;changed();}}
}
function backendRows(name:string,hass:HomeAssistant,policy:AttentionPolicy,now:number):AttentionEntry[]{
  const current=backend.get(name),valid=current?.binding===JSON.stringify(policy.backend)&&current.language===(hass.locale?.language?.startsWith('hu')?'hu':'en');
  const data=valid?current.data:undefined,expired=data&&now-data.generated_at>45000;
  const rows=data&&!expired?data.rows.map(row=>({...row})):[];
  if(!data||current?.error||expired){
    const error=!!current?.error||!!expired;
    rows.push({id:'attention_backend',key:'attention_backend',rule:'backend_health',source:'backend',scope:'system',category:'system',kind:'incident',status:error?'unavailable':'loading',reason:error?'backend_unavailable':'backend_loading',tone:'error',dismissible:false,name:localized(hass,'Notification monitoring','Jelzésfigyelés'),message:error?localized(hass,'The background observer could not be read. Current monitoring cannot be confirmed.','A háttérfigyelő adatai nem olvashatók. Az aktuális felügyelet nem igazolható.'):localized(hass,'Reading the background observer…','Háttérfigyelő adatainak betöltése…')});
  }
  return groupAttention(rows,data?.policy||policy,hass,now);
}

declare global { interface Window { lumaAttentionPolicies?: Record<string, AttentionPolicy> } }
const external: AttentionExternal = {};
let owner: object | undefined, generation = 0;
let householdFetching=false, householdFetchedAt=0, householdRevision:unknown, householdSource="";
let registryFetched = false, registryFetching = false, registryFetchAt = 0;
function session(hass: HomeAssistant) {
  const next = hass.connection || hass.callWS || hass;
  if (owner !== next) {
    owner = next; generation++; notificationRequest++; lastFetch = 0; fetching = false;
    householdFetching=false;householdFetchedAt=0;householdRevision=undefined;householdSource="";
    registryFetched = false; registryFetching = false; registryFetchAt = 0;
    for (const key of Object.keys(external)) delete external[key as keyof AttentionExternal];
    external.readiness = {registry:"loading"}; cache.clear(); externalVersion++;
    backend.clear();
  }
}
let lastFetch = 0, fetching = false, externalVersion = 0;
let notificationRequest = 0;
const listeners = new Set<() => void>();
const cache = new Map<string, { hass: HomeAssistant; policy: AttentionPolicy | undefined; bucket: number; version: number; rows: AttentionEntry[] }>();
const episodes = new Map<string, { active: boolean; started: number }>();
let episodesLoaded = false;
const changed = () => { cache.clear(); for (const listener of listeners) listener(); };

async function readNotifications(hass: HomeAssistant) {
  const request = ++notificationRequest;
  const epoch = generation;
  try {
    if(!hass.callWS)throw Error("WebSocket unavailable");
    const value = await hass.callWS<NonNullable<AttentionExternal["notifications"]>>({type:"persistent_notification/get"});
    if (epoch !== generation || request !== notificationRequest) return;
    if (!Array.isArray(value) || value.some(row=>!row || typeof row.notification_id!=="string" || typeof row.message!=="string")) throw Error("Invalid notification response");
    external.notifications = value;
    external.readiness ||= {}; external.readiness.notifications = "ready";
    if (external.errors) delete external.errors.notifications;
  } catch {
    if (epoch !== generation || request !== notificationRequest) return;
    external.readiness ||= {}; external.readiness.notifications = "error";
    external.errors ||= {}; external.errors.notifications = "The notification source could not be read";
    delete external.notifications;
  } finally { if (epoch === generation && request === notificationRequest) { externalVersion++; changed(); } }
}

/** Dismiss exactly one HA notification. Never write a Luma snooze record. */
export async function dismissAttentionNotification(hass: HomeAssistant, notificationId: string) {
  if (!notificationId.trim()) throw Error("Notification id required");
  await hass.callService("persistent_notification", "dismiss", {notification_id:notificationId});
  // A completed HA service removes the notice. Invalidate older reads so a late
  // pre-dismiss response cannot resurrect it in this browser's shared cache.
  notificationRequest++;
  external.notifications = external.notifications?.filter(row => row.notification_id !== notificationId);
  externalVersion++; changed();
  // Re-read immediately: a producer may legitimately create a new notice again.
  const names=Object.entries(window.lumaAttentionPolicies||{}).filter(([,p])=>p.backend).map(([name])=>name);
  if(names.length)await Promise.all(names.map(name=>refreshAttentionBackend(hass,name,true)));
  else await readNotifications(hass);
}
export const attentionPolicy = (name?: string) => {
  const local=name?window.lumaAttentionPolicies?.[name]:undefined,entry=name?backend.get(name):undefined;
  return local?.backend&&entry?.binding===JSON.stringify(local.backend)&&entry.data?{...local,...entry.data.policy,backend:local.backend}:local;
};
export function policyRows(name: string, hass: HomeAssistant): AttentionEntry[] {
  session(hass);
  const policy = attentionPolicy(name), now = Date.now(), bucket = Math.floor(now / 15000), hit = cache.get(name);
  if(policy?.backend)return backendRows(name,hass,policy,now);
  if (hit?.hass === hass && hit.policy === policy && hit.bucket === bucket && hit.version === externalVersion) return hit.rows;
  const errors=attentionPolicyErrors(policy);
  if (errors.length || !policy) return [{
    id: "policy", key: "policy", source: name, rule: "policy_health", scope: "system", category: "configuration", kind: "incident",
    name: name, message: errors.join(" · "), status: "active", reason: "policy_unavailable", tone: "error", dismissible: false,
  }];
  external.readiness ||= {};
  for(const key of ["notifications","repairs","integrations"] as const) if(policy.adapters?.[key] && !external.readiness[key])external.readiness[key]="loading";
  const rows = attentionSnapshot(hass, policy, external, now);
  // Threshold recurrence can be tracked while a dashboard is observing. Persist
  // across reloads, but never claim this replaces a backend incident lifecycle.
  if (!episodesLoaded) {
    episodesLoaded = true;
    try { for (const [id, value] of Object.entries(JSON.parse(localStorage.getItem("luma-attention-episodes-v1") || "{}"))) {
      const v = value as {active:boolean;started:number}; if (typeof v.active === "boolean" && Number.isFinite(v.started)) episodes.set(id,v);
    } } catch { /* Private browsing/storage limits do not hide incidents. */ }
  }
  let dirty = false;
  const ack = attentionAckMap(policy.acknowledgements_entity ? hass.states[policy.acknowledgements_entity]?.state : "");
  for (const row of rows) {
    const rule = policy.rules.find(r=>r.id===row.rule);
    if (!rule || (rule.identity && rule.identity !== "condition") || rule.above === undefined && rule.below === undefined) continue;
    const id = `${name}:${row.id}`, old = episodes.get(id), active = row.status === "active";
    if (["inactive","active"].includes(row.status) && (!old || old.active !== active)) {
      // A first observation must share the same identity across browsers. Only
      // an observed recovery/reoccurrence adds a source transition timestamp.
      const transition = Date.parse(hass.states[row.source]?.last_changed || "");
      episodes.set(id,{active,started:old && active ? (Number.isFinite(transition) ? transition : now) : 0}); dirty = true;
    }
    const episode = episodes.get(id);
    if (episode?.active) {
      row.key = `a${attentionHash(`${row.key}|${episode.started}`)}`;
      delete row.snoozedUntil;
      if (row.dismissible && row.tone !== "error" && ack[row.key] > now/1000) row.snoozedUntil = ack[row.key];
    }
  }
  if (dirty) try { localStorage.setItem("luma-attention-episodes-v1",JSON.stringify(Object.fromEntries([...episodes].slice(-300)))); } catch { /* Optional local continuity. */ }
  const grouped = groupAttention(rows,policy,hass,now);
  cache.set(name,{hass,policy,bucket,version:externalVersion,rows:grouped});
  return grouped;
}

async function refreshRegistry(hass: HomeAssistant) {
  session(hass);
  if (registryFetching || registryFetched && Date.now()-registryFetchAt < 60000) return;
  registryFetching = true; registryFetched = true; registryFetchAt = Date.now();
  const epoch=generation;
  try {
    if (!hass.callWS) throw Error("WebSocket unavailable");
    const value = await hass.callWS<Array<{entity_id:string} & NonNullable<HomeAssistant["entities"]>[string]>>({type:"config/entity_registry/list"});
    if (epoch !== generation) return;
    if (!Array.isArray(value) || value.some(row=>!row || typeof row.entity_id !== "string")) throw Error("Invalid entity registry");
    external.registry=Object.fromEntries(value.map(row=>[row.entity_id,row]));
    external.readiness ||= {}; external.readiness.registry="ready";
  } catch {
    if (epoch !== generation) return;
    external.readiness ||= {}; external.readiness.registry="error";
  } finally { if(epoch===generation){registryFetching=false;externalVersion++;changed();} }
}

async function refreshAdapters(hass: HomeAssistant, policy?: AttentionPolicy) {
  session(hass);
  if (!policy?.adapters || fetching || Date.now()-lastFetch < 30000) return;
  const calls: Array<["notifications"|"repairs"|"integrations",string]> = [];
  if (policy.adapters.notifications) calls.push(["notifications","persistent_notification/get"]);
  if (policy.adapters.repairs) calls.push(["repairs","repairs/list_issues"]);
  if (policy.adapters.integrations) calls.push(["integrations","config_entries/get"]);
  if (!calls.length) return;
  fetching = true; lastFetch = Date.now(); const epoch=generation;
  external.readiness ||= {};
  for(const [key] of calls) if(!external.readiness[key])external.readiness[key]="loading";
  externalVersion++; changed();
  try {
    await Promise.all(calls.map(async ([key,type])=>{
      if (key === "notifications") { await readNotifications(hass); return; }
      try {
        if(!hass.callWS)throw Error("WebSocket unavailable");
        const value = await hass.callWS({type});
        if(epoch!==generation)return;
        if(key==="repairs" ? !Array.isArray((value as AttentionExternal["repairs"])?.issues) : !Array.isArray(value))throw Error("Invalid source response");
        Object.assign(external,{[key]:value}); external.readiness![key]="ready";
        if (external.errors) delete external.errors[key];
        externalVersion++; changed();
        if(key === "repairs") {
          const domains=[...new Set(external.repairs!.issues.map(issue=>issue.domain))];
          if(domains.length)try {
            const translated=await hass.callWS<{resources:Record<string,string>}>({type:"frontend/get_translations",language:hass.locale?.language || "en",category:"issues",integration:domains});
            if(epoch===generation)external.repairTranslations=translated.resources || {};
          } catch { /* The repair remains visible with a human-readable fallback. */ }
        }
      } catch {
        if(epoch!==generation)return;
        external.readiness![key]="error";
        external.errors ||= {}; external.errors[key] = "The data source could not be read";
        delete external[key];
      }
    }));
  } finally { if(epoch===generation){fetching = false; externalVersion++; changed();} }
}

export function householdRuntime(){return {snapshot:external.household,status:external.householdStatus};}
export async function refreshHousehold(hass:HomeAssistant,policy?:AttentionPolicy,force=false) {
  session(hass);const config=policy?.household;if(!config)return;
  const revision=hass.states[config.entity]?.attributes.revision,source=`${config.entity}:${config.evaluate_script}`;
  if(householdFetching || !force && householdSource===source && householdRevision===revision && Date.now()-householdFetchedAt<30000)return;
  householdFetching=true;householdFetchedAt=Date.now();householdRevision=revision;householdSource=source;const epoch=generation;
  if(!external.household)external.householdStatus="loading";
  try {
    const value=await callHouseholdScript(hass,config.evaluate_script);
    if(epoch!==generation)return;
    if(value.schema_version!==1 || !Array.isArray(value.evaluations) || !Array.isArray(value.expected_unavailable))throw Error("Invalid household snapshot");
    external.household=value as unknown as HouseholdSnapshot;external.householdStatus=value.status==="ready"?"ready":"error";
  }catch{if(epoch===generation){delete external.household;external.householdStatus="error";}}
  finally{if(epoch===generation){householdFetching=false;externalVersion++;changed();}}
}

/** Lifecycle-owned timer: missing grace/ack deadlines must not depend on weather updates. */
export class AttentionSubscription {
  private timer?: number;
  private hass?: HomeAssistant;
  private name?: string;
  private connected = false;
  private invalidate = () => this.render();
  constructor(private render: () => void) {}
  connect() {
    if (this.connected) return; this.connected = true;
    listeners.add(this.invalidate);
    window.addEventListener("luma-attention-policy-changed",this.invalidate);
    this.timer = window.setInterval(()=>{this.render();void this.refresh();},15000);
    void this.refresh();
  }
  update(hass: HomeAssistant | undefined, name?: string) { this.hass=hass;this.name=name;if(this.connected)void this.refresh(); }
  disconnect() { this.connected=false;clearInterval(this.timer);listeners.delete(this.invalidate);window.removeEventListener("luma-attention-policy-changed",this.invalidate); }
  private async refresh() {
    if(this.hass&&this.name){
      if(window.lumaAttentionPolicies?.[this.name]?.backend)await refreshAttentionBackend(this.hass,this.name);
      else await Promise.all([refreshRegistry(this.hass),refreshAdapters(this.hass,attentionPolicy(this.name)),refreshHousehold(this.hass,attentionPolicy(this.name))]);
    }
  }
}
