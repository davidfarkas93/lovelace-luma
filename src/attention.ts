import { glob, incidentSourceIds, matchesIncidentRule } from "./incidents";
import { currentHouseholdEvaluations, householdRules, type HouseholdConfig, type HouseholdSnapshot } from "./household-context";
import { localized } from "./localize";
import type { HassEntity, HomeAssistant, LumaIncidentRule, LumaIncidentTone, LumaAction } from "./types";

export interface AttentionRule extends LumaIncidentRule {
  id: string;
  scope?: string;
  category?: string;
  identity?: "state" | "version" | "condition";
  unavailable_after_minutes?: number;
  /** Explicit channels belonging to this task, never matched by message text. */
  notification_ids?: string[];
  completion?: { label: string; confirmation: string; action: LumaAction };
  state_labels?: Record<string, string>;
  context?: Array<{label:string; entity?:string; entity_pattern?:string; value?:string; source?:string; states?:string[]; decimals?:number}>;
}
export interface AttentionPolicy {
  backend?: { policy_id: string; health_entity?: string };
  version: 1;
  revision: string;
  acknowledgements_entity?: string;
  diagnostics_path?: string;
  rules: AttentionRule[];
  household?: HouseholdConfig;
  ignored?: Record<string, string>;
  ignore_labels?: string[];
  platforms?: Record<string, { scope: string; path?: string }>;
  problems?: { enabled: boolean; exclude?: string[] };
  updates?: { enabled: boolean; path?: string; groups?: Array<{ id: string; name: string; platforms: string[] }> };
  adapters?: { notifications?: boolean; repairs?: boolean; integrations?: boolean; notification_exclude?: string[]; events?: string[] };
}
export interface AttentionEntry {
  id: string;
  key: string;
  rule: string;
  source: string;
  name: string;
  message: string;
  summary?: string;
  summaryName?: string;
  relatedNotifications?: Array<{ id: string; title: string; message: string }>;
  completion?: AttentionRule["completion"];
  scope: string;
  category: string;
  kind: "incident" | "update" | "notification" | "repair" | "integration" | "event";
  status: "active" | "inactive" | "pending" | "unavailable" | "excluded" | "installing" | "event" | "loading";
  reason: string;
  tone: LumaIncidentTone;
  path?: string;
  dismissible: boolean;
  snoozedUntil?: number;
  affectedRules?: string[];
  notificationId?: string;
  sourceState?: string;
  context?: Array<{label:string; value:string; entity?:string}>;
}
export interface AttentionExternal {
  /** Runtime owns explicit request readiness; empty successful registries are valid. */
  registry?: NonNullable<HomeAssistant["entities"]>;
  readiness?: Partial<Record<"registry" | "notifications" | "repairs" | "integrations", "loading" | "ready" | "error">>;
  household?: HouseholdSnapshot;
  householdStatus?: "loading"|"error"|"ready";
  repairTranslations?: Record<string, string>;
  notifications?: Array<{ notification_id: string; title: string; message: string; created_at?: string }>;
  repairs?: { issues: Array<{ domain: string; issue_id: string; severity?: string; is_persistent?: boolean; is_fixable?: boolean; dismissed_version?: string; translation_key?: string; translation_placeholders?: Record<string, string> }> };
  integrations?: Array<{ entry_id: string; domain: string; title: string; state: string; disabled_by?: string | null }>;
  errors?: Record<string, string>;
}
export const attentionHash = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(36);
};
export const attentionAckMap = (raw = ""): Record<string, number> => Object.fromEntries(raw.split(",").flatMap(entry => {
  const i = entry.lastIndexOf(":");
  const expiry = Number(entry.slice(i + 1));
  return i > 0 && Number.isFinite(expiry) ? [[entry.slice(0, i), expiry]] : [];
}));
const available = (e?: HassEntity) => !!e && !["", "unknown", "unavailable"].includes(e.state) && e.attributes.restored !== true;
export const updateInstalling = (e: HassEntity) => e.attributes.in_progress === true || (typeof e.attributes.in_progress === "number" && e.attributes.in_progress >= 0);
/** HA UpdateEntityFeature.INSTALL. An advertised update may be informational only. */
export const updateCanInstall = (e?:HassEntity):boolean => !!e && e.state === "on" && !e.attributes.restored && Boolean(Number(e.attributes.supported_features) & 1) && typeof e.attributes.latest_version === "string" && !!e.attributes.latest_version.trim() && !["unknown","unavailable"].includes(e.attributes.latest_version) && !updateInstalling(e);
const normal = (v: unknown) => String(v ?? "").trim().toLowerCase();

export function attentionPolicyErrors(policy: AttentionPolicy | undefined): string[] {
  if (!policy || policy.version !== 1 || !Array.isArray(policy.rules)) return ["Policy unavailable or incompatible"];
  const errors:string[]=[],ids=new Set<string>();
  for(const r of policy.rules){
    if(!r.id||ids.has(r.id))errors.push(`Missing/duplicate rule id: ${r.id||"?"}`);ids.add(r.id);
    if(typeof r.message!=="string")errors.push(`Missing message: ${r.id}`);
    if(!r.entity&&!r.entity_pattern&&!r.entity_patterns?.length&&!r.device_classes?.length&&!r.platform&&!r.platforms?.length&&!r.domain&&!r.label)errors.push(`Missing selector: ${r.id}`);
    if(r.above!==undefined&&r.below!==undefined&&r.above>=r.below)errors.push(`Invalid numeric range: ${r.id}`);
    if(r.for_minutes!==undefined&&(!Number.isFinite(r.for_minutes)||r.for_minutes<0))errors.push(`Invalid grace: ${r.id}`);
    if(r.notification_ids && (!r.entity || !Array.isArray(r.notification_ids) || r.notification_ids.some(id=>typeof id!=="string" || !id.trim())))errors.push(`Invalid notification links: ${r.id}`);
    if(r.completion && (!r.notification_ids || !r.completion.label || !r.completion.confirmation || !["perform-action","call-service"].includes(r.completion.action?.action)))errors.push(`Invalid completion action: ${r.id}`);
    if(r.state_labels && (typeof r.state_labels !== "object" || Object.values(r.state_labels).some(value=>typeof value !== "string")))errors.push(`Invalid state labels: ${r.id}`);
    if(r.context !== undefined && !Array.isArray(r.context))errors.push(`Invalid context: ${r.id}`);
    else for(const item of r.context || []) {
      if(!item || typeof item.label !== "string" || [item.entity,item.entity_pattern,item.value].filter(value=>value !== undefined).length !== 1)errors.push(`Invalid context source: ${r.id}`);
      if(item?.decimals !== undefined && (!Number.isInteger(item.decimals) || item.decimals < 0 || item.decimals > 6))errors.push(`Invalid context precision: ${r.id}`);
    }
  }
  const channels = policy.rules.flatMap(rule=>rule.notification_ids || []);
  if (new Set(channels).size !== channels.length) errors.push("A notification channel belongs to more than one rule");
  return errors;
}

/** One deterministic snapshot for all surfaces. No services, storage or rendering. */
export function attentionSnapshot(hass: HomeAssistant, policy: AttentionPolicy, external: AttentionExternal = {}, now = Date.now()): AttentionEntry[] {
  const registryReady = external.registry !== undefined || (external.readiness?.registry ? external.readiness.registry === "ready" : !!hass.entities && Object.keys(hass.entities).length > 0);
  if (external.registry) hass = {...hass, entities: external.registry};
  const result: AttentionEntry[] = [];
  const ack = attentionAckMap(policy.acknowledgements_entity ? hass.states[policy.acknowledgements_entity]?.state : "");
  const expected = new Set<string>();
  const names = (e: HassEntity | undefined, source: string) => String(e?.attributes.friendly_name || source);
  const ignored = (source: string) => {
    const registry = hass.entities?.[source];
    if (policy.ignored?.[source]) return policy.ignored[source];
    if (registry?.disabled || registry?.disabled_by) return "disabled";
    if (hass.states[source]?.attributes.restored === true) return "restored";
    if (policy.ignore_labels?.some(label => registry?.labels?.includes(label))) return "ignored_label";
    return "";
  };
  const add = (entry: AttentionEntry, fingerprint: string) => {
    entry.key = `a${attentionHash(`${entry.rule}|${entry.source}|${fingerprint}`)}`;
    const until = ack[entry.key];
    if (entry.dismissible && entry.tone !== "error" && until > now / 1000) entry.snoozedUntil = until;
    result.push(entry);
  };
  const base = (source: string, rule: string, scope = "home", category = "home"): AttentionEntry => ({
    id: `${rule}:${source}`, key: "", rule, source, name: names(hass.states[source], source), message: "", scope, category,
    kind: "incident", status: "inactive", reason: "condition_not_met", tone: "warning", dismissible: true,
  });
  if (!registryReady || external.readiness?.registry === "error") {
    const entry=base("registry","metadata","system");
    entry.status=external.readiness?.registry === "error" ? "unavailable" : "loading";
    entry.reason=entry.status === "loading" ? "metadata_loading" : "metadata_unavailable";
    entry.name=localized(hass,"Monitoring sources","Felügyeleti források");
    entry.message=entry.status === "loading" ? localized(hass,"Entity information is being checked. Monitoring is not yet complete.","Az entitásadatok ellenőrzése folyamatban. A felügyelet még nem teljes.") : localized(hass,"Entity information could not be read. Monitoring coverage cannot be confirmed.","Az entitásadatokat nem sikerült beolvasni. A felügyelet teljessége nem igazolható.");
    entry.dismissible=false; add(entry,"metadata");
    // Labels, disabled flags and platform selectors are unknown. Do not invent
    // individual gaps (or an all-clear) from a half-loaded frontend registry.
    if(!registryReady)return result;
    // Retain known safety conditions if a later metadata refresh fails. The
    // separate coverage fault prevents the cached registry becoming an all-clear.
  }
  for (const rule of policy.rules) {
    const sources = rule.entity ? [rule.entity] : incidentSourceIds(hass, { ...rule, for_minutes: undefined });
    for (const source of sources) {
      expected.add(source);
      const evaluated = rule.related_suffix ? source.replace(rule.related_suffix.from, rule.related_suffix.to) : source;
      const e = hass.states[evaluated], entry = base(source, rule.id, rule.scope, rule.category);
      const codes = (e?.state || "").split(/[,\n]+/).map(code=>code.trim()).filter(Boolean);
      const value = rule.state_labels ? codes.map(code=>rule.state_labels?.[code] || code).join(" · ") : e?.state;
      entry.sourceState = e?.state;
      entry.tone = rule.tone || "warning"; entry.dismissible = rule.dismissible !== false;
      entry.path = rule.navigation_path;
      entry.message = rule.message.replaceAll("{name}", entry.name).replaceAll("{count}", "1")
        .replaceAll("{value}", value || "—").replaceAll("{remaining}", available(e) && Number.isFinite(Number(e!.state)) ? String(Math.max(0, 100 - Number(e!.state))) : "—");
      entry.context = (rule.context || []).filter(item=>(!item.source || item.source === source) && (!item.states || item.states.some(code=>codes.includes(code)))).map(item=>{
        if (item.value !== undefined) return {label:item.label,value:item.value};
        const device = hass.entities?.[source]?.device_id;
        // Pattern bindings are local to this source's device; never borrow a
        // similarly named metric from another server if metadata is missing.
        const id = item.entity || (device && item.entity_pattern ? Object.keys(hass.states).find(id=>hass.entities?.[id]?.device_id === device && glob(item.entity_pattern!,id)) : undefined);
        const metric = id ? hass.states[id] : undefined;
        const numeric = metric && available(metric) ? Number(metric.state) : NaN;
        const formatted = Number.isFinite(numeric) ? numeric.toLocaleString(hass.locale?.language || "en", {maximumFractionDigits:item.decimals ?? 2}) : available(metric) ? metric!.state : localized(hass,"No data","Nincs adat");
        const unit = available(metric) ? String(metric?.attributes.unit_of_measurement || "") : "";
        return {label:item.label,value:`${formatted}${unit ? ` ${unit}` : ""}`,entity:id};
      });
      const exclusion = ignored(source);
      if (exclusion) { entry.status = "excluded"; entry.reason = exclusion; }
      else {
        const blankAllowed = [rule.state,rule.state_not].flatMap(x=>Array.isArray(x)?x:x===undefined?[]:[x]).includes("");
        const noData = !e || ["unknown","unavailable"].includes(e.state) || e.attributes.restored === true || e.state === "" && !blankAllowed;
        // Explicit unknown/unavailable rules are intentional (e.g. five-minute UPS outage).
        const explicitMissing = noData && rule.state !== undefined && (Array.isArray(rule.state) ? rule.state : [rule.state]).some(x => normal(x) === normal(e?.state));
        if (noData && !explicitMissing) {
          entry.status = "unavailable"; entry.reason = "source_unavailable";
          const age = e ? now - new Date(e.last_changed).getTime() : 0;
          if (rule.unavailable_after_minutes !== undefined && age >= rule.unavailable_after_minutes * 60000) {
            entry.status = "active"; entry.message = localized(hass,`${entry.name}: no fresh state`,`${entry.name}: nincs friss állapotadat`); entry.reason = "source_unavailable";
          }
        } else if (matchesIncidentRule(e, { ...rule, for_minutes: undefined })) {
          const age = now - new Date(e!.last_changed).getTime();
          entry.status = rule.for_minutes && age < rule.for_minutes * 60000 ? "pending" : "active";
          entry.reason = entry.status === "pending" ? "grace_period" : "condition_met";
        }
      }
      const identity = rule.identity || (rule.above !== undefined || rule.below !== undefined ? "condition" : "state");
      const fingerprint = identity === "version" ? String(e?.attributes.latest_version || "") : identity === "state" ? `${e?.state}|${e?.last_changed}` : "threshold";
      add(entry, fingerprint);
    }
  }
  for (const e of Object.values(hass.states)) {
    const registry = hass.entities?.[e.entity_id];
    const platform = registry?.platform || "unknown";
    const classification = policy.platforms?.[platform];
    const exclusion = ignored(e.entity_id);
    if (policy.updates?.enabled && e.entity_id.startsWith("update.")) {
      const group = policy.updates.groups?.find(g => g.platforms.includes(platform));
      const entry = base(e.entity_id, "updates", classification?.scope || "homelab", group?.id || "other_updates");
      entry.kind = "update"; entry.path = policy.updates.path; entry.message = group?.name || localized(hass,"Other updates","Egyéb frissítések");
      entry.status = exclusion ? "excluded" : !available(e) ? "unavailable" : updateInstalling(e) ? "installing" : e.state === "on" ? "active" : "inactive";
      entry.reason = exclusion || (entry.status === "unavailable" ? "source_unavailable" : entry.status === "active" ? "update_available" : entry.status === "installing" ? "installing" : "up_to_date");
      add(entry, String(e.attributes.latest_version || "unknown-version"));
    } else if (policy.problems?.enabled && e.entity_id.startsWith("binary_sensor.") && ["problem", "safety", "tamper"].includes(String(e.attributes.device_class)) && !expected.has(e.entity_id)) {
      const entry = base(e.entity_id, "problems", classification?.scope, platform);
      entry.path = classification?.path; entry.message = entry.name; entry.tone = "error"; entry.dismissible = false;
      const excluded = exclusion || (policy.problems.exclude?.some(p => glob(p, e.entity_id)) ? "policy_exception" : "");
      entry.status = excluded ? "excluded" : !available(e) ? "unavailable" : e.state === "on" ? "active" : "inactive";
      entry.reason = excluded || (entry.status === "unavailable" ? "source_unavailable" : "problem_signal");
      add(entry, `${e.state}|${e.last_changed}`);
    }
  }
  const linked = new Set<string>();
  for (const rule of policy.rules.filter(rule=>policy.adapters?.notifications && rule.notification_ids?.length)) {
    const canonical = result.find(row=>row.rule===rule.id && row.source===rule.entity);
    if (!canonical || !["active","pending"].includes(canonical.status)) continue;
    canonical.completion = rule.completion;
    canonical.relatedNotifications = (external.notifications || []).filter(n=>rule.notification_ids!.includes(n.notification_id)).map(n=>({id:n.notification_id,title:n.title,message:n.message}));
    for (const n of canonical.relatedNotifications) linked.add(n.id);
    if (canonical.relatedNotifications.length) canonical.context = [...(canonical.context || []),...canonical.relatedNotifications.map(n=>({label:n.title,value:n.message}))];
  }
  for (const n of policy.adapters?.notifications ? external.notifications || [] : []) {
    if (linked.has(n.notification_id)) continue;
    if (policy.adapters?.notification_exclude?.some(p => glob(p, n.notification_id))) continue;
    const entry = base(`notification:${n.notification_id}`, "persistent_notifications");
    entry.kind = "notification"; entry.name = n.title || localized(hass,"Home Assistant notification","Home Assistant értesítés"); entry.message = n.message; entry.status = "active"; entry.reason = "persistent_notification";
    entry.notificationId = n.notification_id; entry.dismissible = false;
    entry.path = policy.diagnostics_path;
    add(entry, `${n.created_at || ""}|${n.message}`);
  }
  for (const issue of policy.adapters?.repairs ? external.repairs?.issues || [] : []) {
    if (issue.dismissed_version) continue;
    const entry = base(`repair:${issue.domain}:${issue.issue_id}`, "repairs", "homelab");
    const prefix = `component.${issue.domain}.issues.${issue.translation_key || issue.issue_id}`;
    const interpolate = (text:string) => text.replace(/\{([^{}]+)\}/g,(match,key)=>issue.translation_placeholders?.[key] ?? match);
    entry.kind = "repair";
    entry.name = interpolate(external.repairTranslations?.[`${prefix}.title`] || localized(hass,`${issue.domain}: repair needed`,`${issue.domain}: javítási feladat`));
    entry.message = interpolate(external.repairTranslations?.[`${prefix}.description`] || Object.entries(external.repairTranslations || {}).find(([key])=>key.startsWith(`${prefix}.fix_flow.step.`) && key.endsWith(".description"))?.[1] || localized(hass,"Home Assistant reports an open repair. Open Repairs for the integration's explanation.","A Home Assistant nyitott javítási feladatot jelez. Az integráció magyarázata a Javítások oldalon érhető el."));
    entry.sourceState = issue.translation_key || issue.issue_id;
    entry.context = Object.entries(issue.translation_placeholders || {}).map(([label,value])=>({label,value}));
    entry.status = "active"; entry.reason = "repair_issue"; entry.path = "/config/repairs";
    entry.tone = issue.severity === "error" || issue.severity === "critical" ? "error" : "warning";
    add(entry, issue.issue_id);
  }
  for (const integration of policy.adapters?.integrations ? external.integrations || [] : []) {
    if (integration.disabled_by || !["setup_retry", "setup_error", "migration_error", "failed_unload"].includes(integration.state)) continue;
    const entry = base(`integration:${integration.entry_id}`, "integrations", "homelab", integration.domain);
    entry.kind = "integration"; entry.name = integration.title || integration.domain; entry.message = `${entry.name}: ${integration.state}`;
    entry.status = "active"; entry.reason = "integration_error"; entry.path = "/config/integrations"; entry.dismissible = false;
    add(entry, integration.state);
  }
  for (const source of policy.adapters?.events || []) {
    const e = hass.states[source];
    const entry = base(source, "events", "homelab"); entry.kind = "event";
    entry.status = available(e) ? "event" : "unavailable"; entry.reason = "latest_event_only";
    entry.name = String(e?.attributes.title || entry.name); entry.message = String(e?.attributes.subject || e?.attributes.description || "—");
    entry.tone = normal(e?.attributes.importance) === "alert" ? "error" : "warning";
    add(entry, e?.state || "");
  }
  for (const [adapter, readiness] of Object.entries(external.readiness || {})) {
    if (readiness !== "loading" || !policy.adapters?.[adapter as "notifications" | "repairs" | "integrations"]) continue;
    const entry=base(`adapter:${adapter}`,"adapter_health","system");
    entry.name=localized(hass,adapter === "notifications" ? "Home Assistant notifications" : adapter === "repairs" ? "Home Assistant Repairs" : "Integrations",adapter === "notifications" ? "Home Assistant értesítések" : adapter === "repairs" ? "Home Assistant javítási feladatok" : "Integrációk"); entry.status="loading"; entry.reason="adapter_loading"; entry.dismissible=false;
    entry.message=localized(hass,"Checking Home Assistant data sources…","Home Assistant adatforrások ellenőrzése…"); add(entry,adapter);
  }
  for (const [adapter, error] of Object.entries(external.errors || {})) {
    if (!policy.adapters?.[adapter as "notifications" | "repairs" | "integrations"]) continue;
    const entry = base(`adapter:${adapter}`, "adapter_health", "homelab");
    entry.name = localized(hass,adapter === "notifications" ? "Home Assistant notifications" : adapter === "repairs" ? "Home Assistant Repairs" : "Integrations",adapter === "notifications" ? "Home Assistant értesítések" : adapter === "repairs" ? "Home Assistant javítási feladatok" : "Integrációk"); entry.message = error; entry.status = "unavailable"; entry.reason = "adapter_unavailable"; entry.dismissible = false;
    add(entry, adapter);
  }
  if(policy.household) {
    const config=policy.household, decisions=currentHouseholdEvaluations(hass,config,external.household,now);
    const rules=householdRules(hass,config);
    const ready=external.household?.status === "ready" && external.household.revision === hass.states[config.entity]?.attributes.revision && now/1000-external.household.evaluated_at<=90;
    if(!ready) {
      const entry=base(config.entity,"household_health","system");
      entry.name=localized(hass,"Household knowledge","Háztartási háttértudás");
      entry.status=external.householdStatus === "error" || external.household && external.household.status!=="ready" ? "unavailable" : "loading";
      entry.reason=entry.status === "loading" ? "household_loading" : "household_unavailable";
      entry.message=localized(hass,"Household rules could not yet be verified.","A háztartási szabályok érvényessége még nem ellenőrizhető.");entry.dismissible=false;entry.path=config.path;add(entry,"household");
    }
    for(const row of result) {
      const matching=decisions.filter(e=>e.matched_entities.includes(row.source));
      if(matching.length)row.context=[...(row.context||[]),...matching.map(e=>({label:e.title,value:e.explanation+(e.limitation ? ` · ${e.limitation}` : "")}))];
      const expected=matching.find(e=>e.effect==="expected_unavailable");
      // An active fault (including an explicit offline alarm) always wins.
      if(row.status==="unavailable" && expected && external.household?.expected_unavailable.includes(row.source) && ["unknown","unavailable"].includes(hass.states[row.source]?.state)) {
        row.status="excluded";row.reason="household_expected";row.message=expected.explanation;row.path=config.path;
      } else if(row.status==="unavailable" && !ready && external.householdStatus!=="error" && rules.some(r=>r.status==="approved"&&r.enabled&&r.effect==="expected_unavailable"&&r.targets.includes(row.source))) {
        row.status="loading";row.reason="household_loading";
      }
    }
  }
  // Overlapping threshold tiers select the most severe active signal per source.
  const winner = new Map<string, AttentionEntry>();
  for (const row of result.filter(x => x.status === "active")) {
    const key = `${row.kind}:${row.source}`, old = winner.get(key);
    if (!old || row.tone === "error" && old.tone !== "error") winner.set(key, row);
  }
  return result.map(row => row.status === "active" && winner.get(`${row.kind}:${row.source}`) !== row ? { ...row, status: "excluded", reason: "covered_by_stronger_rule" } : row);
}

export const activeAttention = (rows: AttentionEntry[], scope?: string, includeSnoozed = false) => rows.filter(x =>
  (!scope || x.scope === scope || x.scope === "system") && ["active", "installing"].includes(x.status) && (includeSnoozed || !x.snoozedUntil));

/** Presentation only: one unavailable source, even when several rules use it. */
export function attentionCoverageRows(rows: AttentionEntry[], hass: HomeAssistant): AttentionEntry[] {
  const missing = new Map<string, AttentionEntry>();
  const result: AttentionEntry[] = [];
  for (const row of rows) {
    if (row.status !== "unavailable") { result.push(row); continue; }
    const existing = missing.get(row.source);
    if (existing) {
      if (!existing.affectedRules!.includes(row.rule)) existing.affectedRules!.push(row.rule);
      continue;
    }
    const entry = { ...row, affectedRules: [row.rule], message: row.reason === "source_unavailable" && row.kind !== "update" ? localized(hass,"No reliable state is available","Nincs megbízható állapotadat") : row.message };
    missing.set(row.source, entry);
    result.push(entry);
  }
  return result;
}

export function groupAttention(rows: AttentionEntry[], policy: AttentionPolicy, hass: HomeAssistant, now = Date.now()): AttentionEntry[] {
  const grouped = new Map<string, AttentionEntry[]>(), ack = attentionAckMap(policy.acknowledgements_entity ? hass.states[policy.acknowledgements_entity]?.state : "");
  for (const row of rows.filter(x=>["active","installing"].includes(x.status))) {
    const rule = policy.rules.find(r=>r.id===row.rule);
    const id = row.kind === "update" ? `update:${row.category}` : rule?.aggregate ? `rule:${row.rule}` : row.id;
    const group = grouped.get(id)||[]; group.push(row); grouped.set(id,group);
  }
  const copies = new Map<string, AttentionEntry>();
  for (const [id, members] of grouped) {
    const key = `a${attentionHash(`${id}|${members.map(x=>x.key).sort().join(",")}`)}`;
    const rule = policy.rules.find(r=>r.id===members[0].rule);
    const message = members[0].kind === "update" ? members.length === 1
      ? String(hass.states[members[0].source]?.attributes.release_summary || `${hass.states[members[0].source]?.attributes.installed_version || "—"} → ${hass.states[members[0].source]?.attributes.latest_version || "—"}`)
      : localized(hass,`${members.length} components have updates available`,`${members.length} összetevőhöz érhető el frissítés`) : rule?.aggregate ? rule.message.replaceAll("{count}",String(members.length)) : members[0].message;
    for (const row of members) {
      const copy = {...row,key};
      // The summary is separate from each source's own diagnostic explanation.
      copy.summary = message;
      if (row.kind === "update" && members.length > 1) copy.summaryName = row.message;
      delete copy.snoozedUntil;
      if (row.dismissible && row.tone !== "error" && ack[key] > now/1000) copy.snoozedUntil=ack[key];
      copies.set(row.id,copy);
    }
  }
  return rows.map(x=>copies.get(x.id)||x);
}

export const attentionSummaries = (rows: AttentionEntry[], scope?: string, includeSnoozed = false) => [...new Map(activeAttention(rows,scope,includeSnoozed).map(x=>[x.key,{...x,name:x.summaryName||x.name,message:x.summary||x.message}])).values()];

/** Fixed-size legacy input_text storage, compact keys, no truncation of a record. */
export function attentionAckValue(raw: string, key: string, expiry: number | null, now: number, max = 255) {
  const map = attentionAckMap(raw); delete map[key];
  const entries = Object.entries(map).filter(([, end]) => end > now).sort((a,b)=>b[1]-a[1]);
  if (expiry !== null) entries.unshift([key, expiry]);
  const result: string[] = [];
  for (const [id, end] of entries) { const item = `${id}:${end}`; if ([...result,item].join(",").length <= max) result.push(item); }
  return result.join(",");
}

/** Explicit counting units shared by hero surfaces. Updates are maintenance. */
export function attentionOverview(rows:AttentionEntry[], hass:HomeAssistant) {
  const visible=activeAttention(rows), issues=attentionSummaries(visible.filter(row=>row.kind!=="update"));
  const updates=new Set(visible.filter(row=>row.kind==="update").map(row=>row.source)).size;
  const missing=new Set(rows.filter(row=>row.status==="unavailable").map(row=>row.source)).size;
  const loading=rows.some(row=>row.status==="loading");
  const snoozed=new Set(rows.filter(row=>row.snoozedUntil).map(row=>row.key)).size;
  const parts=[issues.length ? localized(hass,`${issues.length} ${issues.length===1?"issue":"issues"}`,`${issues.length} ügy`) : "",updates ? localized(hass,`${updates} ${updates===1?"updatable component":"updatable components"}`,`${updates} frissíthető összetevő`) : "",missing ? localized(hass,`${missing} ${missing===1?"data gap":"data gaps"}`,`${missing} adatkimaradás`) : "", loading ? localized(hass,"Checking sources…","Adatforrások ellenőrzése…") : "",snoozed ? localized(hass,`${snoozed} snoozed`,`${snoozed} szüneteltetve`) : ""].filter(Boolean);
  return {issues:issues.length,updates,missing,loading,snoozed,critical:issues.some(row=>row.tone==="error"),text:parts.join(" · ") || localized(hass,"No active issues","Nincs aktív ügy")};
}
