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
 */

import { useEffect, useRef, useCallback } from 'react';
import Storage from '@/storage/storage';
import { useApexStore } from '@/store/apex-store';
import { startEngine, subscribeTelemetry } from '@/lib/telemetry-engine';
import { resolveArray } from '@/core/dataResolver';
import { DATA_MODE, ENABLE_FALLBACK } from '@/core/dataMode';
import type { TelemetryEvent } from '@/types';

// Lazy-load seed so it's never bundled unless actually needed
async function getMockSeed() {
  if (!ENABLE_FALLBACK) return null;
  try {
    const mod = await import('@/lib/seed');
    return mod.default;
  } catch {
    return null;
  }
}

export function useApexData() {
  const initialized = useRef(false);
  const {
    setTenants, setFleets, setTelemetryEvents, setAIMetrics,
    setAPIUsageLogs, setRouteMetrics, setOperationalMetrics,
    setDeploymentLogs, setFinancialEvents, setInfraMetrics,
    setLoading, computeGlobalAggregate, computeSustainability,
    appendLiveFeedEvent, addAlert, setSeeded,
  } = useApexStore();

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      // ── 1. Pull from IndexedDB (live / local) ──────────────────────────
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

      // ── 2. If DB is empty and fallback is allowed → run seed once ──────
      const dbIsEmpty = (liveTenants as unknown[]).length === 0;

      if (dbIsEmpty && ENABLE_FALLBACK) {
        const seedFn = await getMockSeed();
        if (seedFn) {
          try {
            const result = await seedFn();
            if (result.seeded) {
              setSeeded(true);
              // Re-read after seeding
              const [
                st, sf, sai, sapi, sr, so, sd, sfin, sinf,
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
              const stelem = await Storage.Telemetry.getByTimeRange(
                Date.now() - 7 * 86400000, Date.now()
              );

              setTenants(resolveArray(st, null, null, 'tenants') as Parameters<typeof setTenants>[0]);
              setFleets(resolveArray(sf, null, null, 'fleets') as Parameters<typeof setFleets>[0]);
              setTelemetryEvents(resolveArray(stelem, null, null, 'telemetry') as Parameters<typeof setTelemetryEvents>[0]);
              setAIMetrics(resolveArray(sai, null, null, 'ai') as Parameters<typeof setAIMetrics>[0]);
              setAPIUsageLogs(resolveArray(sapi, null, null, 'api') as Parameters<typeof setAPIUsageLogs>[0]);
              setRouteMetrics(resolveArray(sr, null, null, 'routes') as Parameters<typeof setRouteMetrics>[0]);
              setOperationalMetrics(resolveArray(so, null, null, 'ops') as Parameters<typeof setOperationalMetrics>[0]);
              setDeploymentLogs(resolveArray(sd, null, null, 'deploy') as Parameters<typeof setDeploymentLogs>[0]);
              setFinancialEvents(resolveArray(sfin, null, null, 'finance') as Parameters<typeof setFinancialEvents>[0]);
              setInfraMetrics(resolveArray(sinf, null, null, 'infra') as Parameters<typeof setInfraMetrics>[0]);

              computeGlobalAggregate();
              computeSustainability(30);
              return;
            }
          } catch (seedErr) {
            console.warn('[Apex] Seed failed, continuing with empty state:', seedErr);
          }
        }
      }

      // ── 3. Resolve with priority: live → local → null ─────────────────
      // (mock already written to IndexedDB by seed above if needed)
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

      // ── 4. Show pairing prompt only in live mode or when DB truly empty ─
      if (dbIsEmpty && DATA_MODE === 'live') {
        addAlert({
          type: 'info',
          title: 'No Fleet Data Yet',
          message: 'Pair your first Fleet Control dashboard or Driver app using the Tenants → Register Fleet button.',
        });
      }

    } finally {
      setLoading(false);
    }
  }, [
    setTenants, setFleets, setTelemetryEvents, setAIMetrics,
    setAPIUsageLogs, setRouteMetrics, setOperationalMetrics,
    setDeploymentLogs, setFinancialEvents, setInfraMetrics,
    setLoading, computeGlobalAggregate, computeSustainability,
    addAlert, setSeeded,
  ]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const init = async () => {
      await loadAll();

      // Start telemetry engine (processes incoming queue, flushes to IndexedDB)
      startEngine({ batchSize: 50, flushIntervalMs: 15000 });

      // Subscribe to live telemetry feed for real-time UI updates
      subscribeTelemetry((event: TelemetryEvent) => {
        appendLiveFeedEvent(event);
      });
    };

    init().catch(console.error);

    // Recompute every 30 seconds as live data arrives
    const refreshInterval = setInterval(async () => {
      await loadAll();
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [loadAll, appendLiveFeedEvent]);
}

export default useApexData;
