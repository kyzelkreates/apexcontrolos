'use client';
/**
 * APEX COMMAND CENTER OS
 * hooks/useApexData.ts
 *
 * Central data loader. Reads all real data from IndexedDB via Storage
 * and hydrates the Zustand store. No mock/seed data.
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
import type { TelemetryEvent } from '@/types';

export function useApexData() {
  const initialized = useRef(false);
  const {
    setTenants, setFleets, setTelemetryEvents, setAIMetrics,
    setAPIUsageLogs, setRouteMetrics, setOperationalMetrics,
    setDeploymentLogs, setFinancialEvents, setInfraMetrics,
    setLoading, computeGlobalAggregate, computeSustainability,
    appendLiveFeedEvent, addAlert,
  } = useApexStore();

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [
        tenants, fleets, aiMetrics, apiLogs, routeMetrics,
        opsMetrics, deployLogs, financialEvents, infraMetrics,
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

      const telemetry = await Storage.Telemetry.getByTimeRange(
        Date.now() - 7 * 86400000, Date.now()
      );

      setTenants(tenants as Parameters<typeof setTenants>[0]);
      setFleets(fleets as Parameters<typeof setFleets>[0]);
      setTelemetryEvents(telemetry as Parameters<typeof setTelemetryEvents>[0]);
      setAIMetrics(aiMetrics as Parameters<typeof setAIMetrics>[0]);
      setAPIUsageLogs(apiLogs as Parameters<typeof setAPIUsageLogs>[0]);
      setRouteMetrics(routeMetrics as Parameters<typeof setRouteMetrics>[0]);
      setOperationalMetrics(opsMetrics as Parameters<typeof setOperationalMetrics>[0]);
      setDeploymentLogs(deployLogs as Parameters<typeof setDeploymentLogs>[0]);
      setFinancialEvents(financialEvents as Parameters<typeof setFinancialEvents>[0]);
      setInfraMetrics(infraMetrics as Parameters<typeof setInfraMetrics>[0]);

      computeGlobalAggregate();
      computeSustainability(30);

    } finally {
      setLoading(false);
    }
  }, [
    setTenants, setFleets, setTelemetryEvents, setAIMetrics,
    setAPIUsageLogs, setRouteMetrics, setOperationalMetrics,
    setDeploymentLogs, setFinancialEvents, setInfraMetrics,
    setLoading, computeGlobalAggregate, computeSustainability,
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

      // Alert if no tenants — guide user to pair first fleet
      const { tenants } = useApexStore.getState();
      if (tenants.length === 0) {
        addAlert({
          type: 'info',
          title: 'No Fleet Data Yet',
          message: 'Pair your first Fleet Control dashboard or Driver app using the Tenants → Register Fleet button.',
        });
      }
    };

    init().catch(console.error);

    // Recompute every 30 seconds as live data arrives
    const refreshInterval = setInterval(async () => {
      await loadAll();
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [loadAll, appendLiveFeedEvent, addAlert]);
}

export default useApexData;
