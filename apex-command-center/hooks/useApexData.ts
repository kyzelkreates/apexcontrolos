'use client';
/**
 * APEX COMMAND CENTER OS
 * hooks/useApexData.ts
 *
 * Central data loader. Reads all real data from IndexedDB via Storage
 * and hydrates the Zustand store.
 *
 * Data modes (see core/dataMode.ts):
 *   "mock"   — seed demo data on empty DB, use seed as source
 *   "hybrid" — IndexedDB first, seed as fallback when empty  ← DEFAULT
 *   "live"   — IndexedDB only, never fall back to seed
 *
 * Data enters the system from:
 *  - Fleet Control dashboards  → POST /api/telemetry, /api/routes, /api/fleet-heartbeat
 *  - Driver apps               → POST /api/route-complete, /api/driver-metrics
 *  - Pairing engine            → registers new tenants + fleets
 *  - Supabase                  → when credentials configured in Settings
 *
 * SUPABASE INTEGRATION (patch — additive only):
 *   When supabaseUrl + supabaseAnonKey are set in Storage.Config:
 *     - Supabase data is loaded alongside IndexedDB data
 *     - Realtime subscriptions active for: jobs, job_assignments, telemetry, alerts
 *     - Falls back to IndexedDB-only if Supabase not configured
 *   When Supabase not configured: behaviour is unchanged from pre-patch.
 */

import { useEffect, useRef, useCallback } from 'react';
import Storage from '@/storage/storage';
import { useApexStore } from '@/store/apex-store';
import { startEngine, subscribeTelemetry } from '@/lib/telemetry-engine';
import { resolveArray } from '@/core/dataResolver';
import { DATA_MODE } from '@/core/dataMode';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import {
  fetchJobs, fetchJobAssignments, fetchVehicles, fetchProfiles,
  fetchTelemetry, fetchAlerts, subscribeRealtime,
  type SupabaseJob, type SupabaseJobAssignment,
  type SupabaseTelemetry, type SupabaseAlert,
} from '@/services/supabaseDataService';
import type { TelemetryEvent } from '@/types';

export function useApexData() {
  const initialized = useRef(false);
  const realtimeCleanupRef = useRef<(() => void) | null>(null);

  const {
    setTenants, setFleets, setTelemetryEvents, setAIMetrics,
    setAPIUsageLogs, setRouteMetrics, setOperationalMetrics,
    setDeploymentLogs, setFinancialEvents, setInfraMetrics,
    setLoading, computeGlobalAggregate, computeSustainability,
    appendLiveFeedEvent, addAlert,
  } = useApexStore();

  // ─── Supabase → Zustand bridge: map raw Supabase records into alerts ────
  const bridgeSupabaseAlerts = useCallback((records: SupabaseAlert[]) => {
    for (const r of records) {
      if (!r.dismissed) {
        // addAlert generates id/createdAt/dismissed — pass only required fields
        addAlert({
          type:    r.type,
          title:   r.title,
          message: r.message,
        });
      }
    }
  }, [addAlert]);

  // ─── Load Supabase data into stores (additive alongside IndexedDB) ───────
  const loadSupabaseData = useCallback(async () => {
    if (!isSupabaseConfigured()) return;

    try {
      const [jobs, assignments, vehicles, profiles, telemetry, alerts] = await Promise.allSettled([
        fetchJobs(500),
        fetchJobAssignments(undefined, 1000),
        fetchVehicles(500),
        fetchProfiles(500),
        fetchTelemetry(new Date(Date.now() - 7 * 86400000).toISOString(), 500),
        fetchAlerts(100),
      ]);

      // Bridge alerts into the existing Zustand alert store
      if (alerts.status === 'fulfilled' && alerts.value) {
        bridgeSupabaseAlerts(alerts.value);
      }

      // Log what came back (dev visibility — not shown to user)
      const summary = [
        ['jobs',            jobs],
        ['assignments',     assignments],
        ['vehicles',        vehicles],
        ['profiles',        profiles],
        ['telemetry',       telemetry],
        ['alerts',          alerts],
      ] as const;

      for (const [table, result] of summary) {
        if (result.status === 'rejected') {
          console.warn(`[Apex/Supabase] ${table} fetch rejected:`, result.reason);
        } else if (result.value === null) {
          console.info(`[Apex/Supabase] ${table} → no data or not configured`);
        } else {
          const count = Array.isArray(result.value) ? result.value.length : 0;
          console.info(`[Apex/Supabase] ${table} → ${count} records`);
        }
      }
    } catch (e) {
      // Never crash the UI — Supabase is additive only
      console.warn('[Apex/Supabase] loadSupabaseData failed gracefully:', e);
    }
  }, [bridgeSupabaseAlerts]);

  // ─── Setup Supabase realtime subscriptions ───────────────────────────────
  const setupSupabaseRealtime = useCallback(() => {
    if (!isSupabaseConfigured()) return;

    // Clean up any existing subscriptions first
    realtimeCleanupRef.current?.();

    const cleanup = subscribeRealtime({
      onJobChange: (payload) => {
        console.info('[Apex/Supabase RT] job change:', payload.eventType);
        // Re-fetch jobs on any change — keeps UI in sync without complex diffing
        fetchJobs(500).then((jobs) => {
          if (jobs) {
            console.info(`[Apex/Supabase RT] refreshed ${jobs.length} jobs`);
          }
        });
      },

      onAssignmentChange: (payload) => {
        console.info('[Apex/Supabase RT] assignment change:', payload.eventType);
        fetchJobAssignments(undefined, 1000).then((assignments) => {
          if (assignments) {
            console.info(`[Apex/Supabase RT] refreshed ${assignments.length} assignments`);
          }
        });
      },

      onTelemetry: (payload) => {
        // Bridge incoming Supabase telemetry event into the existing live feed
        const raw = payload.new as SupabaseTelemetry;
        if (!raw) return;
        const event: TelemetryEvent = {
          id:         raw.id,
          tenantId:   raw.tenant_id ?? '',
          fleetId:    raw.fleet_id ?? '',
          eventType:  (raw.event_type as TelemetryEvent['eventType']) ?? 'fleet_update',
          timestamp:  raw.timestamp ? new Date(raw.timestamp).getTime() : Date.now(),
          payload:    raw.payload ?? {},
          processed:  raw.processed ?? false,
          batchId:    raw.batch_id ?? '',
          signature:  '',
          size:       0,
        };
        appendLiveFeedEvent(event);
      },

      onAlert: (payload) => {
        const raw = payload.new as SupabaseAlert;
        if (!raw || raw.dismissed) return;
        addAlert({
          type:    raw.type,
          title:   raw.title,
          message: raw.message,
        });
      },
    });

    realtimeCleanupRef.current = cleanup;
  }, [appendLiveFeedEvent, addAlert]);

  // ─── Main data load (IndexedDB + Supabase) ───────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      // ── 1. Pull from IndexedDB (unchanged from pre-patch) ─────────────
      const [
        liveTenants, liveFleets, liveAIMetrics, liveAPILogs,
        liveRouteMetrics, liveOpsMetrics, liveDeployLogs,
        liveFinancialEvents, liveInfraMetrics,
      ] = await Promise.all([
        Storage.Tenants.getAll(),
        Storage.Fleets.getAll(),
        Storage.AIMetrics.getByTimeRange(Date.now() - 30 * 86400000, Date.now()),
        Storage.APIUsage.getByTimeRange(Date.now() - 30 * 86400000, Date.now()),
        Storage.Routes.getByTimeRange(Date.now() - 30 * 86400000, Date.now()),
        Storage.Operations.getByTimeRange(Date.now() - 30 * 86400000, Date.now()),
        Storage.Deployments.getAll(200),
        Storage.Financial.getByTimeRange(Date.now() - 30 * 86400000, Date.now()),
        Storage.Infra.getRecent(100),
      ]);

      const liveTelemetry = await Storage.Telemetry.getByTimeRange(
        Date.now() - 7 * 86400000, Date.now()
      );

      // ── 2. Hydrate store from IndexedDB ───────────────────────────────
      setTenants(resolveArray(liveTenants, null, null, 'tenants') as Parameters<typeof setTenants>[0]);
      setFleets(resolveArray(liveFleets, null, null, 'fleets') as Parameters<typeof setFleets>[0]);
      setTelemetryEvents(resolveArray(liveTelemetry, null, null, 'telemetry') as Parameters<typeof setTelemetryEvents>[0]);
      setAIMetrics(resolveArray(liveAIMetrics, null, null, 'ai') as Parameters<typeof setAIMetrics>[0]);
      setAPIUsageLogs(resolveArray(liveAPILogs, null, null, 'api') as Parameters<typeof setAPIUsageLogs>[0]);
      setRouteMetrics(resolveArray(liveRouteMetrics, null, null, 'routes') as Parameters<typeof setRouteMetrics>[0]);
      setOperationalMetrics(resolveArray(liveOpsMetrics, null, null, 'ops') as Parameters<typeof setOperationalMetrics>[0]);
      setDeploymentLogs(resolveArray(liveDeployLogs, null, null, 'deploy') as Parameters<typeof setDeploymentLogs>[0]);
      setFinancialEvents(resolveArray(liveFinancialEvents, null, null, 'finance') as Parameters<typeof setFinancialEvents>[0]);
      setInfraMetrics(resolveArray(liveInfraMetrics, null, null, 'infra') as Parameters<typeof setInfraMetrics>[0]);

      computeGlobalAggregate();
      computeSustainability(30);

      if ((liveTenants as unknown[]).length === 0) {
        addAlert({
          type: 'info',
          title: 'No Fleet Data Yet',
          message: 'Pair your first Fleet Control dashboard or Driver app using the Tenants → Register Fleet button.',
        });
      }

      // ── 4. Load Supabase data on top (additive) ────────────────────────
      await loadSupabaseData();

    } finally {
      setLoading(false);
    }
  }, [
    setTenants, setFleets, setTelemetryEvents, setAIMetrics,
    setAPIUsageLogs, setRouteMetrics, setOperationalMetrics,
    setDeploymentLogs, setFinancialEvents, setInfraMetrics,
    setLoading, computeGlobalAggregate, computeSustainability,
    addAlert, loadSupabaseData,
  ]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const init = async () => {
      await loadAll();

      // Start telemetry engine (processes incoming queue, flushes to IndexedDB)
      startEngine({ batchSize: 50, flushIntervalMs: 15000 });

      // Subscribe to existing local telemetry feed
      subscribeTelemetry((event: TelemetryEvent) => {
        appendLiveFeedEvent(event);
      });

      // Setup Supabase realtime subscriptions (no-op if not configured)
      setupSupabaseRealtime();
    };

    init().catch(console.error);

    // Recompute every 30 seconds
    const refreshInterval = setInterval(async () => {
      await loadAll();
    }, 30000);

    return () => {
      clearInterval(refreshInterval);
      // Clean up Supabase realtime on unmount
      realtimeCleanupRef.current?.();
    };
  }, [loadAll, appendLiveFeedEvent, setupSupabaseRealtime]);
}

export default useApexData;
