/**
 * AP3X CONTROL OS — GOVERNANCE DATA SERVICE
 *
 * READ-ONLY access to governance tables from the UI.
 * All writes go via service-role backend (never from this app directly).
 *
 * Tables: decision_trace_log · safety_metrics_snapshot
 *         system_health_metrics · audit_log_v2
 *         incident_replay_engine
 */

import { getSupabaseClient } from '@/lib/supabaseClient';
import type {
  DecisionTraceLog, SafetyMetricsSnapshot,
  SystemHealthMetric, AuditLogEntry,
  IncidentReplay, SnapshotPeriod,
} from '@/types/governance';

const sb = () => getSupabaseClient();

// ─────────────────────────────────────────────────────────────────
// DECISION TRACE LOG
// ─────────────────────────────────────────────────────────────────

export async function fetchDecisionTraces(
  opts: { taskId?: string; driverId?: string; limit?: number } = {}
): Promise<DecisionTraceLog[] | null> {
  const client = sb(); if (!client) return null;
  try {
    let q = client.from('decision_trace_log').select('*')
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 100);

    if (opts.taskId)   q = q.eq('task_id', opts.taskId);
    if (opts.driverId) q = q.eq('driver_id', opts.driverId);

    const { data, error } = await q;
    if (error) { console.warn('[GOV] fetchDecisionTraces:', error.message); return null; }
    return data as DecisionTraceLog[];
  } catch (e) { console.warn('[GOV] fetchDecisionTraces ex:', e); return null; }
}

export async function fetchDecisionTraceByTask(taskId: string): Promise<DecisionTraceLog | null> {
  const client = sb(); if (!client) return null;
  try {
    const { data, error } = await client
      .from('decision_trace_log')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error) { console.warn('[GOV] fetchDecisionTraceByTask:', error.message); return null; }
    return data as DecisionTraceLog;
  } catch (e) { console.warn('[GOV] fetchDecisionTraceByTask ex:', e); return null; }
}

// ─────────────────────────────────────────────────────────────────
// SAFETY METRICS SNAPSHOTS
// ─────────────────────────────────────────────────────────────────

export async function fetchSafetySnapshots(
  opts: { period?: SnapshotPeriod; tenantId?: string; limit?: number } = {}
): Promise<SafetyMetricsSnapshot[] | null> {
  const client = sb(); if (!client) return null;
  try {
    let q = client.from('safety_metrics_snapshot').select('*')
      .order('period_start', { ascending: false })
      .limit(opts.limit ?? 90);

    if (opts.period)   q = q.eq('snapshot_period', opts.period);
    if (opts.tenantId) q = q.eq('tenant_id', opts.tenantId);

    const { data, error } = await q;
    if (error) { console.warn('[GOV] fetchSafetySnapshots:', error.message); return null; }
    return data as SafetyMetricsSnapshot[];
  } catch (e) { console.warn('[GOV] fetchSafetySnapshots ex:', e); return null; }
}

export async function fetchLatestDailySafety(): Promise<SafetyMetricsSnapshot | null> {
  const client = sb(); if (!client) return null;
  try {
    const { data, error } = await client
      .from('v_latest_daily_safety')
      .select('*')
      .is('tenant_id', null)   // system-wide
      .limit(1)
      .single();
    if (error) { console.warn('[GOV] fetchLatestDailySafety:', error.message); return null; }
    return data as SafetyMetricsSnapshot;
  } catch (e) { console.warn('[GOV] fetchLatestDailySafety ex:', e); return null; }
}

// ─────────────────────────────────────────────────────────────────
// SYSTEM HEALTH METRICS
// ─────────────────────────────────────────────────────────────────

/** Latest health reading per component (uses DB view) */
export async function fetchLatestHealth(): Promise<SystemHealthMetric[] | null> {
  const client = sb(); if (!client) return null;
  try {
    const { data, error } = await client.from('v_latest_health').select('*');
    if (error) {
      // Fallback if view not yet deployed — raw table latest per component
      console.warn('[GOV] fetchLatestHealth (view fallback):', error.message);
      const { data: raw, error: rawErr } = await client
        .from('system_health_metrics')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(50);
      if (rawErr) { console.warn('[GOV] fetchLatestHealth raw:', rawErr.message); return null; }
      // Deduplicate by component — keep latest
      const seen = new Set<string>();
      const deduped: SystemHealthMetric[] = [];
      for (const r of (raw ?? []) as SystemHealthMetric[]) {
        if (!seen.has(r.component)) { seen.add(r.component); deduped.push(r); }
      }
      return deduped;
    }
    return data as SystemHealthMetric[];
  } catch (e) { console.warn('[GOV] fetchLatestHealth ex:', e); return null; }
}

/** Rolling 1-hour history for a specific component */
export async function fetchHealthHistory(
  component: string,
  windowMs = 3600000
): Promise<SystemHealthMetric[] | null> {
  const client = sb(); if (!client) return null;
  try {
    const since = new Date(Date.now() - windowMs).toISOString();
    const { data, error } = await client
      .from('system_health_metrics')
      .select('*')
      .eq('component', component)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true })
      .limit(300);
    if (error) { console.warn('[GOV] fetchHealthHistory:', error.message); return null; }
    return data as SystemHealthMetric[];
  } catch (e) { console.warn('[GOV] fetchHealthHistory ex:', e); return null; }
}

// ─────────────────────────────────────────────────────────────────
// AUDIT LOG V2
// ─────────────────────────────────────────────────────────────────

export async function fetchAuditLog(
  opts: {
    entityType?: string;
    entityId?: string;
    actorId?: string;
    isOverride?: boolean;
    riskLevels?: string[];
    limit?: number;
    offset?: number;
  } = {}
): Promise<AuditLogEntry[] | null> {
  const client = sb(); if (!client) return null;
  try {
    let q = client.from('audit_log_v2').select('*')
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 100)
      .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 100) - 1);

    if (opts.entityType) q = q.eq('entity_type', opts.entityType);
    if (opts.entityId)   q = q.eq('entity_id', opts.entityId);
    if (opts.actorId)    q = q.eq('actor_id', opts.actorId);
    if (opts.isOverride !== undefined) q = q.eq('is_override', opts.isOverride);
    if (opts.riskLevels?.length) q = q.in('risk_level', opts.riskLevels);

    const { data, error } = await q;
    if (error) { console.warn('[GOV] fetchAuditLog:', error.message); return null; }
    return data as AuditLogEntry[];
  } catch (e) { console.warn('[GOV] fetchAuditLog ex:', e); return null; }
}

export async function fetchHighRiskAudit(): Promise<AuditLogEntry[] | null> {
  const client = sb(); if (!client) return null;
  try {
    const { data, error } = await client
      .from('v_high_risk_audit')
      .select('*')
      .limit(100);
    if (error) {
      // Fallback if view not yet deployed
      return fetchAuditLog({ riskLevels: ['high','critical'], limit: 100 });
    }
    return data as AuditLogEntry[];
  } catch (e) { console.warn('[GOV] fetchHighRiskAudit ex:', e); return null; }
}

// ─────────────────────────────────────────────────────────────────
// INCIDENT REPLAY ENGINE
// ─────────────────────────────────────────────────────────────────

export async function fetchIncidentReplays(
  opts: { isIncident?: boolean; hasAnomalies?: boolean; limit?: number } = {}
): Promise<IncidentReplay[] | null> {
  const client = sb(); if (!client) return null;
  try {
    // Try the view first (includes task title, priority, status)
    const view = opts.isIncident ? 'v_active_incidents' : 'incident_replay_engine';
    let q = client.from(view).select('*')
      .order('constructed_at', { ascending: false })
      .limit(opts.limit ?? 50);

    if (opts.hasAnomalies !== undefined) q = q.eq('has_anomalies', opts.hasAnomalies);

    const { data, error } = await q;
    if (error) { console.warn('[GOV] fetchIncidentReplays:', error.message); return null; }
    return data as IncidentReplay[];
  } catch (e) { console.warn('[GOV] fetchIncidentReplays ex:', e); return null; }
}

export async function fetchReplayByTask(taskId: string): Promise<IncidentReplay | null> {
  const client = sb(); if (!client) return null;
  try {
    const { data, error } = await client
      .from('incident_replay_engine')
      .select('*')
      .eq('task_id', taskId)
      .order('version', { ascending: false })
      .limit(1)
      .single();
    if (error) { console.warn('[GOV] fetchReplayByTask:', error.message); return null; }
    return data as IncidentReplay;
  } catch (e) { console.warn('[GOV] fetchReplayByTask ex:', e); return null; }
}
