'use client';
/**
 * APEX COMMAND CENTER OS
 * hooks/useApexData.ts
 *
 * Central data loader hook. Reads all data from IndexedDB via Storage
 * and hydrates the Zustand store. Called once on app mount.
 */

import { useEffect, useRef, useCallback } from 'react';
import Storage from '@/storage/storage';
import { useApexStore } from '@/store/apex-store';
import seedDemoData from '@/lib/seed';
import { startEngine, subscribeTelemetry } from '@/lib/telemetry-engine';

export function useApexData() {
  const initialized = useRef(false);
  const {
    setTenants, setFleets, setTelemetryEvents, setAIMetrics,
    setAPIUsageLogs, setRouteMetrics, setOperationalMetrics,
    setDeploymentLogs, setFinancialEvents, setInfraMetrics,
    setLoading, setSeeded, computeGlobalAggregate, appendLiveFeedEvent,
    addAlert,
  } = useApexStore();

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [
        tenants, fleets, aiMetrics, apiLogs, routeMetrics,
        opsMetrics, deployLogs, financialEvents, infraMetrics
      ] = await Promise.all([
        Storage.Tenants.getAll(),
        Storage.Fleets.getAll(),
        Storage.AIMetrics.getByTimeRange(Date.now() - 30 * 86400000, Date.now()),
        Storage.APIUsage.getByTimeRange(Date.now() - 30 * 86400000, Date.now()),
        Storage.Routes.getByTimeRange(Date.now() - 30 * 86400000, Date.now()),
        Storage.Operations.getByTimeRange(Date.now() - 30 * 86400000, Date.now()),
        Storage.Deployments.getAll(100),
        Storage.Financial.getByTimeRange(Date.now() - 30 * 86400000, Date.now()),
        Storage.Infra.getRecent(100),
      ]);

      const telemetry = await Storage.Telemetry.getByTimeRange(
        Date.now() - 7 * 86400000, Date.now()
      );

      setTenants(tenants);
      setFleets(fleets);
      setTelemetryEvents(telemetry);
      setAIMetrics(aiMetrics);
      setAPIUsageLogs(apiLogs);
      setRouteMetrics(routeMetrics);
      setOperationalMetrics(opsMetrics);
      setDeploymentLogs(deployLogs);
      setFinancialEvents(financialEvents);
      setInfraMetrics(infraMetrics);

      computeGlobalAggregate();

      // Load saved alerts from localStorage
      const savedAlerts = Storage.Alerts.getAll();
      savedAlerts.slice(0, 10).forEach((a: Record<string, unknown>) => {
        if (!(a as { dismissed?: boolean }).dismissed) {
          addAlert({
            type: (a.type as 'info' | 'success' | 'warning' | 'danger') || 'info',
            title: String(a.title || ''),
            message: String(a.message || ''),
          });
        }
      });

    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const init = async () => {
      // Seed demo data if empty
      const result = await seedDemoData();
      if (result.seeded) {
        setSeeded(true);
        addAlert({
          type: 'success',
          title: 'Demo Data Loaded',
          message: `Seeded ${result.counts.tenants} tenants, ${result.counts.fleets} fleets, ${result.counts.telemetry} telemetry events.`,
        });
      }

      await loadAll();

      // Start telemetry engine
      startEngine({ batchSize: 50, flushIntervalMs: 15000 });

      // Subscribe to live telemetry for UI feed
      subscribeTelemetry((event) => {
        appendLiveFeedEvent(event);
      });
    };

    init().catch(console.error);

    // Refresh aggregate every 30 seconds
    const refreshInterval = setInterval(() => {
      computeGlobalAggregate();
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, []);

  return { reload: loadAll };
}

export default useApexData;
