'use client';
/**
 * APEX COMMAND CENTER OS
 * hooks/useApexData.ts
 *
 * Central data loader. Reads all real data from IndexedDB via Storage SSOT
 * and hydrates the Zustand store.
 *
 * Key fix: isLoading starts FALSE. We flip it true only during the async
 * fetch so pages render their correct empty state on first paint — never
 * stuck on a loading skeleton.
 */

import { useEffect, useRef } from 'react';
import Storage from '@/storage/storage';
import { useApexStore } from '@/store/apex-store';
import { startEngine, subscribeTelemetry } from '@/lib/telemetry-engine';
import type { TelemetryEvent } from '@/types';

export function useApexData() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const store = useApexStore.getState();

    // ── Load all IndexedDB data into Zustand ───────────────────────
    async function loadAll() {
      store.setLoading(true);
      try {
        const [
          tenants,
          fleets,
          aiMetrics,
          apiLogs,
          routeMetrics,
          opsMetrics,
          deployLogs,
          financialEvents,
          infraMetrics,
        ] = await Promise.all([
          Storage.Tenants.getAll(),
          Storage.Fleets.getAll(),
          Storage.AIMetrics.getByTimeRange(Date.now() - 30 * 86_400_000, Date.now()),
          Storage.APIUsage.getByTimeRange(Date.now() - 30 * 86_400_000, Date.now()),
          Storage.Routes.getByTimeRange(Date.now() - 30 * 86_400_000, Date.now()),
          Storage.Operations.getByTimeRange(Date.now() - 30 * 86_400_000, Date.now()),
          Storage.Deployments.getAll(200),
          Storage.Financial.getByTimeRange(Date.now() - 30 * 86_400_000, Date.now()),
          Storage.Infra.getRecent(100),
        ]);

        const telemetry = await Storage.Telemetry.getByTimeRange(
          Date.now() - 7 * 86_400_000,
          Date.now(),
        );

        // Re-grab state reference — store may have been updated in between
        const s = useApexStore.getState();
        s.setTenants(tenants as Parameters<typeof s.setTenants>[0]);
        s.setFleets(fleets as Parameters<typeof s.setFleets>[0]);
        s.setTelemetryEvents(telemetry as Parameters<typeof s.setTelemetryEvents>[0]);
        s.setAIMetrics(aiMetrics as Parameters<typeof s.setAIMetrics>[0]);
        s.setAPIUsageLogs(apiLogs as Parameters<typeof s.setAPIUsageLogs>[0]);
        s.setRouteMetrics(routeMetrics as Parameters<typeof s.setRouteMetrics>[0]);
        s.setOperationalMetrics(opsMetrics as Parameters<typeof s.setOperationalMetrics>[0]);
        s.setDeploymentLogs(deployLogs as Parameters<typeof s.setDeploymentLogs>[0]);
        s.setFinancialEvents(financialEvents as Parameters<typeof s.setFinancialEvents>[0]);
        s.setInfraMetrics(infraMetrics as Parameters<typeof s.setInfraMetrics>[0]);

        s.computeGlobalAggregate();
        s.computeSustainability(30);
      } finally {
        // Always clear loading — pages must always render, even with empty data
        useApexStore.getState().setLoading(false);
      }
    }

    // ── Bootstrap ──────────────────────────────────────────────────
    const init = async () => {
      await loadAll();

      // Start telemetry ingestion engine
      startEngine({ batchSize: 50, flushIntervalMs: 15_000 });

      // Live feed subscription
      subscribeTelemetry((event: TelemetryEvent) => {
        useApexStore.getState().appendLiveFeedEvent(event);
      });

      // Prompt to pair a fleet if still empty after loading
      if (useApexStore.getState().tenants.length === 0) {
        useApexStore.getState().addAlert({
          type: 'info',
          title: 'No Fleet Data Yet',
          message:
            'Pair your first Fleet Control dashboard or Driver app via Tenants → Register Fleet.',
        });
      }
    };

    init().catch(console.error);

    // Refresh every 30 s as live inbound data arrives
    const interval = setInterval(() => {
      loadAll().catch(console.error);
    }, 30_000);

    return () => clearInterval(interval);
  }, []); // runs once on mount
}

export default useApexData;
