import { attentionAckMap, attentionHash, attentionSnapshot, attentionPolicyErrors, groupAttention, type AttentionEntry, type AttentionExternal, type AttentionPolicy } from "./attention";
import type { HomeAssistant } from "./types";

declare global { interface Window { lumaAttentionPolicies?: Record<string, AttentionPolicy> } }
const external: AttentionExternal = {};
let lastFetch = 0, fetching = false, externalVersion = 0;
const listeners = new Set<() => void>();
const cache = new Map<string, { hass: HomeAssistant; policy: AttentionPolicy | undefined; bucket: number; version: number; rows: AttentionEntry[] }>();
const episodes = new Map<string, { active: boolean; started: number }>();
let episodesLoaded = false;
const changed = () => { cache.clear(); for (const listener of listeners) listener(); };
export const attentionPolicy = (name?: string) => name ? window.lumaAttentionPolicies?.[name] : undefined;
export function policyRows(name: string, hass: HomeAssistant): AttentionEntry[] {
  const policy = attentionPolicy(name), now = Date.now(), bucket = Math.floor(now / 15000), hit = cache.get(name);
  if (hit?.hass === hass && hit.policy === policy && hit.bucket === bucket && hit.version === externalVersion) return hit.rows;
  const errors=attentionPolicyErrors(policy);
  if (errors.length || !policy) return [{
    id: "policy", key: "policy", source: name, rule: "policy_health", scope: "system", category: "configuration", kind: "incident",
    name: name, message: errors.join(" · "), status: "active", reason: "policy_unavailable", tone: "error", dismissible: false,
  }];
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

async function refreshAdapters(hass: HomeAssistant, policy?: AttentionPolicy) {
  if (!hass.callWS || !policy?.adapters || fetching || Date.now()-lastFetch < 30000) return;
  const calls: Array<[keyof AttentionExternal,string]> = [];
  if (policy.adapters.notifications) calls.push(["notifications","persistent_notification/get"]);
  if (policy.adapters.repairs) calls.push(["repairs","repairs/list_issues"]);
  if (policy.adapters.integrations) calls.push(["integrations","config_entries/get"]);
  if (!calls.length) return;
  fetching = true; lastFetch = Date.now();
  try {
    for (const [key,type] of calls) {
      try {
        const value = await hass.callWS({type});
        Object.assign(external,{[key]:value});
        if (external.errors) delete external.errors[key];
      } catch {
        external.errors ||= {}; external.errors[key] = "The data source could not be read";
        delete external[key];
      }
    }
  } finally { fetching = false; externalVersion++; changed(); }
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
  private async refresh() { if(this.hass&&this.name)await refreshAdapters(this.hass,attentionPolicy(this.name)); }
}
