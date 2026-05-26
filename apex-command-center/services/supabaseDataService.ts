/**
 * APEX COMMAND CENTER OS
 * services/supabaseDataService.ts — Supabase Data Integration Layer
 *
 * PATCH RULES:
 *   - Only modifies data layer — does NOT touch UI or Zustand store shape
 *   - All functions return typed data that maps to existing store interfaces
 *   - All calls wrapped in try/catch — never crashes the UI
 *   - When Supabase is not configured → returns null (caller falls back to IndexedDB)
 *   - NO mock data, NO fallback simulation logic
 *
 * TABLE MAP:
 *   jobs             → DeploymentLog / job records
 *   job_assignments  → assignment records (job_id, driver_id, vehicle_id, status)
 *   vehicles         → FleetEntity vehicles
 *   profiles         → driver / user profiles
 *   telemetry        → TelemetryEvent stream
 *   alerts           → AppAlert records
 *
 * REALTIME:
 *   subscribeJobs()          → jobs + job_assignments changes
 *   subscribeTelemetry()     → telemetry inserts
 *   subscribeAlerts()        → alerts inserts
 */

import { getSupabaseClient } from '@/lib/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────
// TYPES — mirror existing store shapes where possible
// ─────────────────────────────────────────────────────────────────

export interface SupabaseJob {
  id: string;
  title?: string;
  description?: string;
  status: string;           // 'pending' | 'assigned' | 'in_progress' | 'complete' | 'cancelled'
  priority?: string;
  tenant_id?: string;
  fleet_id?: string;
  region?: string;
  created_at: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
}

export interface SupabaseJobAssignment {
  id: string;
  job_id: string;
  driver_id: string;
  vehicle_id: string;
  status: 'assigned' | 'accepted' | 'in_progress' | 'complete' | 'cancelled';
  assigned_at: string;
  updated_at?: string;
  notes?: string;
}

export interface SupabaseVehicle {
  id: string;
  tenant_id?: string;
  fleet_id?: string;
  name?: string;
  plate?: string;
  status: string;
  region?: string;
  driver_id?: string;
  last_seen?: string;
  metadata?: Record<string, unknown>;
}

export interface SupabaseProfile {
  id: string;
  full_name?: string;
  email?: string;
  role?: string;
  tenant_id?: string;
  fleet_id?: string;
  status?: string;
  avatar_url?: string;
  created_at?: string;
}

export interface SupabaseTelemetry {
  id: string;
  tenant_id?: string;
  fleet_id?: string;
  vehicle_id?: string;
  event_type: string;
  payload?: Record<string, unknown>;
  timestamp: string;
  processed?: boolean;
  batch_id?: string;
}

export interface SupabaseAlert {
  id: string;
  tenant_id?: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  message: string;
  dismissed?: boolean;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────
// READ FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/** Fetch all jobs. Returns null if Supabase not configured or request fails. */
export async function fetchJobs(limit = 200): Promise<SupabaseJob[] | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) { console.warn('[Apex/Supabase] fetchJobs error:', error.message); return null; }
    return data as SupabaseJob[];
  } catch (e) {
    console.warn('[Apex/Supabase] fetchJobs exception:', e);
    return null;
  }
}

/** Fetch job assignments. Optionally filter by job_id. */
export async function fetchJobAssignments(jobId?: string, limit = 500): Promise<SupabaseJobAssignment[] | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  try {
    let query = sb.from('job_assignments').select('*').limit(limit);
    if (jobId) query = query.eq('job_id', jobId);
    const { data, error } = await query.order('assigned_at', { ascending: false });
    if (error) { console.warn('[Apex/Supabase] fetchJobAssignments error:', error.message); return null; }
    return data as SupabaseJobAssignment[];
  } catch (e) {
    console.warn('[Apex/Supabase] fetchJobAssignments exception:', e);
    return null;
  }
}

/** Fetch vehicles. */
export async function fetchVehicles(limit = 500): Promise<SupabaseVehicle[] | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  try {
    const { data, error } = await sb.from('vehicles').select('*').limit(limit);
    if (error) { console.warn('[Apex/Supabase] fetchVehicles error:', error.message); return null; }
    return data as SupabaseVehicle[];
  } catch (e) {
    console.warn('[Apex/Supabase] fetchVehicles exception:', e);
    return null;
  }
}

/** Fetch driver/user profiles. */
export async function fetchProfiles(limit = 500): Promise<SupabaseProfile[] | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  try {
    const { data, error } = await sb.from('profiles').select('*').limit(limit);
    if (error) { console.warn('[Apex/Supabase] fetchProfiles error:', error.message); return null; }
    return data as SupabaseProfile[];
  } catch (e) {
    console.warn('[Apex/Supabase] fetchProfiles exception:', e);
    return null;
  }
}

/** Fetch recent telemetry events. */
export async function fetchTelemetry(since?: string, limit = 500): Promise<SupabaseTelemetry[] | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  try {
    let query = sb
      .from('telemetry')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);
    if (since) query = query.gte('timestamp', since);
    const { data, error } = await query;
    if (error) { console.warn('[Apex/Supabase] fetchTelemetry error:', error.message); return null; }
    return data as SupabaseTelemetry[];
  } catch (e) {
    console.warn('[Apex/Supabase] fetchTelemetry exception:', e);
    return null;
  }
}

/** Fetch active alerts. */
export async function fetchAlerts(limit = 100): Promise<SupabaseAlert[] | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('alerts')
      .select('*')
      .eq('dismissed', false)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) { console.warn('[Apex/Supabase] fetchAlerts error:', error.message); return null; }
    return data as SupabaseAlert[];
  } catch (e) {
    console.warn('[Apex/Supabase] fetchAlerts exception:', e);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// WRITE FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Create a new job.
 * RULE: inserted with the provided status — does NOT assume active/assigned.
 * Caller sets status (e.g. 'pending').
 */
export async function createJob(
  job: Omit<SupabaseJob, 'id' | 'created_at' | 'updated_at'>
): Promise<SupabaseJob | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('jobs')
      .insert({ ...job, created_at: new Date().toISOString() })
      .select()
      .single();
    if (error) { console.warn('[Apex/Supabase] createJob error:', error.message); return null; }
    return data as SupabaseJob;
  } catch (e) {
    console.warn('[Apex/Supabase] createJob exception:', e);
    return null;
  }
}

/**
 * Assign a job to a driver + vehicle.
 *
 * CRITICAL RULE (per spec):
 *   - ALWAYS creates an entry in job_assignments
 *   - ALWAYS includes job_id, driver_id, vehicle_id, status = "assigned"
 *   - Also updates jobs.status to 'assigned'
 *   - Never bypasses job_assignments table
 */
export async function assignJob(params: {
  jobId: string;
  driverId: string;
  vehicleId: string;
  notes?: string;
}): Promise<SupabaseJobAssignment | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { jobId, driverId, vehicleId, notes } = params;

  try {
    // 1. Create the assignment record (mandatory — never bypass)
    const assignment: Omit<SupabaseJobAssignment, 'id' | 'updated_at'> = {
      job_id:      jobId,
      driver_id:   driverId,
      vehicle_id:  vehicleId,
      status:      'assigned',
      assigned_at: new Date().toISOString(),
      ...(notes ? { notes } : {}),
    };

    const { data: assignData, error: assignError } = await sb
      .from('job_assignments')
      .insert(assignment)
      .select()
      .single();

    if (assignError) {
      console.warn('[Apex/Supabase] assignJob — job_assignments insert error:', assignError.message);
      return null;
    }

    // 2. Update job status to 'assigned'
    const { error: jobError } = await sb
      .from('jobs')
      .update({ status: 'assigned', updated_at: new Date().toISOString() })
      .eq('id', jobId);

    if (jobError) {
      // Non-fatal — assignment was created, log but don't fail
      console.warn('[Apex/Supabase] assignJob — jobs status update error:', jobError.message);
    }

    return assignData as SupabaseJobAssignment;
  } catch (e) {
    console.warn('[Apex/Supabase] assignJob exception:', e);
    return null;
  }
}

/** Update a job's status. */
export async function updateJobStatus(
  jobId: string,
  status: SupabaseJob['status']
): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;
  try {
    const { error } = await sb
      .from('jobs')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', jobId);
    if (error) { console.warn('[Apex/Supabase] updateJobStatus error:', error.message); return false; }
    return true;
  } catch (e) {
    console.warn('[Apex/Supabase] updateJobStatus exception:', e);
    return false;
  }
}

/** Update an assignment's status. */
export async function updateAssignmentStatus(
  assignmentId: string,
  status: SupabaseJobAssignment['status']
): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;
  try {
    const { error } = await sb
      .from('job_assignments')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', assignmentId);
    if (error) { console.warn('[Apex/Supabase] updateAssignmentStatus error:', error.message); return false; }
    return true;
  } catch (e) {
    console.warn('[Apex/Supabase] updateAssignmentStatus exception:', e);
    return false;
  }
}

/** Dismiss an alert in Supabase. */
export async function dismissAlert(alertId: string): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;
  try {
    const { error } = await sb
      .from('alerts')
      .update({ dismissed: true })
      .eq('id', alertId);
    if (error) { console.warn('[Apex/Supabase] dismissAlert error:', error.message); return false; }
    return true;
  } catch (e) {
    console.warn('[Apex/Supabase] dismissAlert exception:', e);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────
// REALTIME SUBSCRIPTIONS
// ─────────────────────────────────────────────────────────────────

export interface RealtimeCallbacks {
  onJobChange?:        (payload: { eventType: string; new: unknown; old: unknown }) => void;
  onAssignmentChange?: (payload: { eventType: string; new: unknown; old: unknown }) => void;
  onTelemetry?:        (payload: { new: SupabaseTelemetry }) => void;
  onAlert?:            (payload: { new: SupabaseAlert }) => void;
}

/**
 * Subscribe to realtime changes on jobs, job_assignments, telemetry, alerts.
 * Returns cleanup function — call it on unmount.
 * Safe to call when Supabase not configured — returns no-op cleanup.
 */
export function subscribeRealtime(callbacks: RealtimeCallbacks): () => void {
  const sb = getSupabaseClient();
  if (!sb) return () => {};

  const channels: RealtimeChannel[] = [];

  try {
    // jobs + job_assignments channel
    if (callbacks.onJobChange || callbacks.onAssignmentChange) {
      const jobChannel = sb
        .channel('apex-jobs-realtime')
        .on(
          'postgres_changes' as Parameters<RealtimeChannel['on']>[0],
          { event: '*', schema: 'public', table: 'jobs' },
          (payload) => callbacks.onJobChange?.(payload as { eventType: string; new: unknown; old: unknown })
        )
        .on(
          'postgres_changes' as Parameters<RealtimeChannel['on']>[0],
          { event: '*', schema: 'public', table: 'job_assignments' },
          (payload) => callbacks.onAssignmentChange?.(payload as { eventType: string; new: unknown; old: unknown })
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('[Apex/Supabase] Jobs realtime channel error');
          }
        });
      channels.push(jobChannel);
    }

    // telemetry channel (inserts only — high volume)
    if (callbacks.onTelemetry) {
      const telChannel = sb
        .channel('apex-telemetry-realtime')
        .on(
          'postgres_changes' as Parameters<RealtimeChannel['on']>[0],
          { event: 'INSERT', schema: 'public', table: 'telemetry' },
          (payload) => callbacks.onTelemetry?.(payload as { new: SupabaseTelemetry })
        )
        .subscribe();
      channels.push(telChannel);
    }

    // alerts channel (inserts only)
    if (callbacks.onAlert) {
      const alertChannel = sb
        .channel('apex-alerts-realtime')
        .on(
          'postgres_changes' as Parameters<RealtimeChannel['on']>[0],
          { event: 'INSERT', schema: 'public', table: 'alerts' },
          (payload) => callbacks.onAlert?.(payload as { new: SupabaseAlert })
        )
        .subscribe();
      channels.push(alertChannel);
    }
  } catch (e) {
    console.warn('[Apex/Supabase] subscribeRealtime setup exception:', e);
  }

  // Cleanup: remove all channels
  return () => {
    for (const ch of channels) {
      try { sb.removeChannel(ch); } catch {}
    }
  };
}

// ─────────────────────────────────────────────────────────────────
// CONNECTION TEST
// ─────────────────────────────────────────────────────────────────

/** Quick connectivity test — returns true if Supabase responds. */
export async function testSupabaseConnection(): Promise<{
  ok: boolean;
  tables: { name: string; reachable: boolean }[];
  error?: string;
}> {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, tables: [], error: 'Supabase not configured' };

  const tableNames = ['jobs', 'job_assignments', 'vehicles', 'profiles', 'telemetry', 'alerts'];
  const results: { name: string; reachable: boolean }[] = [];

  for (const table of tableNames) {
    try {
      const { error } = await sb.from(table).select('id').limit(1);
      results.push({ name: table, reachable: !error });
    } catch {
      results.push({ name: table, reachable: false });
    }
  }

  const ok = results.some((r) => r.reachable);
  return { ok, tables: results };
}
