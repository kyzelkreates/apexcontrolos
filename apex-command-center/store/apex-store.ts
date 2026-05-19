/**
 * APEX COMMAND CENTER OS
 * store/apex-store.ts — Zustand Global State
 *
 * Single state tree for the entire dashboard.
 * All state mutations go through this store.
 * Persistence is handled by storage/storage.js — NOT duplicated here.
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import type {
  Tenant, FleetEntity, TelemetryEvent, AIMetric, APIUsageLog,
  RouteMetric, OperationalMetric, DeploymentLog, FinancialEvent,
  GlobalAggregate, DashboardState, InfrastructureMetric
} from '@/types';

// ============================================================
// ALERT
// ============================================================

export interface AppAlert {
  id: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  message: string;
  createdAt: number;
  dismissed: boolean;
  tenantId?: string;
}

// ============================================================
// STORE SHAPE
// ============================================================

interface ApexStore {
  // Core data
  tenants: Tenant[];
  fleets: FleetEntity[];
  telemetryEvents: TelemetryEvent[];
  aiMetrics: AIMetric[];
  apiUsageLogs: APIUsageLog[];
  routeMetrics: RouteMetric[];
  operationalMetrics: OperationalMetric[];
  deploymentLogs: DeploymentLog[];
  financialEvents: FinancialEvent[];
  infraMetrics: InfrastructureMetric[];

  // Computed aggregate
  globalAggregate: GlobalAggregate | null;

  // UI state
  selectedTenantId: string | null;
  selectedFleetId: string | null;
  activeModule: string;
  sidebarCollapsed: boolean;
  dateRange: { from: number; to: number };
  isLoading: boolean;
  isSeeded: boolean;

  // Alerts
  alerts: AppAlert[];

  // Telemetry live feed (last N events)
  liveFeed: TelemetryEvent[];
  liveFeedMax: number;

  // Actions
  setTenants: (tenants: Tenant[]) => void;
  addTenant: (tenant: Tenant) => void;
  updateTenant: (id: string, patch: Partial<Tenant>) => void;
  removeTenant: (id: string) => void;

  setFleets: (fleets: FleetEntity[]) => void;
  addFleet: (fleet: FleetEntity) => void;
  updateFleet: (id: string, patch: Partial<FleetEntity>) => void;

  setTelemetryEvents: (events: TelemetryEvent[]) => void;
  appendLiveFeedEvent: (event: TelemetryEvent) => void;

  setAIMetrics: (metrics: AIMetric[]) => void;
  setAPIUsageLogs: (logs: APIUsageLog[]) => void;
  setRouteMetrics: (metrics: RouteMetric[]) => void;
  setOperationalMetrics: (metrics: OperationalMetric[]) => void;
  setDeploymentLogs: (logs: DeploymentLog[]) => void;
  setFinancialEvents: (events: FinancialEvent[]) => void;
  setInfraMetrics: (metrics: InfrastructureMetric[]) => void;

  setGlobalAggregate: (agg: GlobalAggregate) => void;
  computeGlobalAggregate: () => void;

  setSelectedTenant: (id: string | null) => void;
  setSelectedFleet: (id: string | null) => void;
  setActiveModule: (module: string) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setDateRange: (range: { from: number; to: number }) => void;
  setLoading: (loading: boolean) => void;
  setSeeded: (seeded: boolean) => void;

  addAlert: (alert: Omit<AppAlert, 'id' | 'createdAt' | 'dismissed'>) => void;
  dismissAlert: (id: string) => void;
  clearAlerts: () => void;

  // Derived selectors
  getFleetsByTenant: (tenantId: string) => FleetEntity[];
  getActiveTenants: () => Tenant[];
  getOnlineFleets: () => FleetEntity[];
  getTenantById: (id: string) => Tenant | undefined;
  getFleetById: (id: string) => FleetEntity | undefined;
}

// ============================================================
// COMPUTED AGGREGATE
// ============================================================

function computeAggregate(
  tenants: Tenant[],
  fleets: FleetEntity[],
  aiMetrics: AIMetric[],
  apiUsageLogs: APIUsageLog[],
  telemetryEvents: TelemetryEvent[],
  deploymentLogs: DeploymentLog[],
  routeMetrics: RouteMetric[],
  alerts: AppAlert[]
): GlobalAggregate {
  const today = Date.now() - 86400000;
  const todayAI = aiMetrics.filter((m) => m.timestamp > today);
  const todayAPI = apiUsageLogs.filter((l) => l.timestamp > today);
  const todayTel = telemetryEvents.filter((e) => e.timestamp > today);

  const localInferences = todayAI.filter((m) => m.inferenceSource === 'local').length;
  const totalInferences = todayAI.length;

  const totalActiveVehicles = fleets.reduce((acc, f) => acc + f.activeVehicles, 0);
  const totalVehicles = fleets.reduce((acc, f) => acc + f.vehicleCount, 0);
  const totalActiveDrivers = fleets.reduce((acc, f) => acc + f.activeDrivers, 0);
  const totalDrivers = fleets.reduce((acc, f) => acc + f.driverCount, 0);

  const activeFleets = fleets.filter((f) => f.status === 'online');
  const avgUptime = fleets.length
    ? fleets.reduce((acc, f) => acc + f.uptimePercent, 0) / fleets.length
    : 0;

  const avgRouteOpt = routeMetrics.length
    ? routeMetrics.reduce((acc, r) => acc + r.optimisationSavingPercent, 0) / routeMetrics.length
    : 0;

  return {
    totalTenants: tenants.length,
    activeTenants: tenants.filter((t) => t.status === 'active').length,
    totalFleets: fleets.length,
    activeFleets: activeFleets.length,
    totalVehicles,
    activeVehicles: totalActiveVehicles,
    totalDrivers,
    activeDrivers: totalActiveDrivers,
    globalUptimePercent: parseFloat(avgUptime.toFixed(1)),
    globalEfficiency: parseFloat(
      (fleets.length ? fleets.reduce((acc, _) => acc + 87 + Math.random() * 10, 0) / fleets.length : 0).toFixed(1)
    ),
    totalApiCostToday: parseFloat(todayAPI.reduce((acc, l) => acc + l.cost, 0).toFixed(2)),
    totalAiCostToday: parseFloat(todayAI.reduce((acc, m) => acc + m.cost, 0).toFixed(2)),
    totalAiTokensToday: todayAI.reduce((acc, m) => acc + m.tokensUsed, 0),
    localInferencePercent: totalInferences
      ? parseFloat(((localInferences / totalInferences) * 100).toFixed(1))
      : 0,
    telemetryEventsToday: todayTel.length,
    deploymentsActive: deploymentLogs.filter((d) => d.status === 'rolling').length,
    alertsActive: alerts.filter((a) => !a.dismissed).length,
    routeOptimisationAvg: parseFloat(avgRouteOpt.toFixed(1)),
  };
}

// ============================================================
// STORE IMPLEMENTATION
// ============================================================

export const useApexStore = create<ApexStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // Data
      tenants: [],
      fleets: [],
      telemetryEvents: [],
      aiMetrics: [],
      apiUsageLogs: [],
      routeMetrics: [],
      operationalMetrics: [],
      deploymentLogs: [],
      financialEvents: [],
      infraMetrics: [],
      globalAggregate: null,

      // UI
      selectedTenantId: null,
      selectedFleetId: null,
      activeModule: 'overview',
      sidebarCollapsed: false,
      dateRange: { from: Date.now() - 86400000 * 7, to: Date.now() },
      isLoading: true,
      isSeeded: false,
      alerts: [],
      liveFeed: [],
      liveFeedMax: 50,

      // Tenant actions
      setTenants: (tenants) => set({ tenants }),
      addTenant: (tenant) =>
        set((s) => ({ tenants: [...s.tenants, tenant] })),
      updateTenant: (id, patch) =>
        set((s) => ({
          tenants: s.tenants.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      removeTenant: (id) =>
        set((s) => ({ tenants: s.tenants.filter((t) => t.id !== id) })),

      // Fleet actions
      setFleets: (fleets) => set({ fleets }),
      addFleet: (fleet) =>
        set((s) => ({ fleets: [...s.fleets, fleet] })),
      updateFleet: (id, patch) =>
        set((s) => ({
          fleets: s.fleets.map((f) => (f.id === id ? { ...f, ...patch } : f)),
        })),

      // Data setters
      setTelemetryEvents: (telemetryEvents) => set({ telemetryEvents }),
      appendLiveFeedEvent: (event) =>
        set((s) => ({
          liveFeed: [event, ...s.liveFeed].slice(0, s.liveFeedMax),
        })),
      setAIMetrics: (aiMetrics) => set({ aiMetrics }),
      setAPIUsageLogs: (apiUsageLogs) => set({ apiUsageLogs }),
      setRouteMetrics: (routeMetrics) => set({ routeMetrics }),
      setOperationalMetrics: (operationalMetrics) => set({ operationalMetrics }),
      setDeploymentLogs: (deploymentLogs) => set({ deploymentLogs }),
      setFinancialEvents: (financialEvents) => set({ financialEvents }),
      setInfraMetrics: (infraMetrics) => set({ infraMetrics }),

      // Aggregate
      setGlobalAggregate: (globalAggregate) => set({ globalAggregate }),
      computeGlobalAggregate: () => {
        const s = get();
        const agg = computeAggregate(
          s.tenants, s.fleets, s.aiMetrics, s.apiUsageLogs,
          s.telemetryEvents, s.deploymentLogs, s.routeMetrics, s.alerts
        );
        set({ globalAggregate: agg });
      },

      // UI actions
      setSelectedTenant: (id) => set({ selectedTenantId: id, selectedFleetId: null }),
      setSelectedFleet: (id) => set({ selectedFleetId: id }),
      setActiveModule: (module) => set({ activeModule: module }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setDateRange: (range) => set({ dateRange: range }),
      setLoading: (isLoading) => set({ isLoading }),
      setSeeded: (isSeeded) => set({ isSeeded }),

      // Alerts
      addAlert: (alert) =>
        set((s) => ({
          alerts: [
            { ...alert, id: `alert_${Date.now()}`, createdAt: Date.now(), dismissed: false },
            ...s.alerts,
          ].slice(0, 100),
        })),
      dismissAlert: (id) =>
        set((s) => ({
          alerts: s.alerts.map((a) => (a.id === id ? { ...a, dismissed: true } : a)),
        })),
      clearAlerts: () => set({ alerts: [] }),

      // Derived selectors
      getFleetsByTenant: (tenantId) => get().fleets.filter((f) => f.tenantId === tenantId),
      getActiveTenants: () => get().tenants.filter((t) => t.status === 'active'),
      getOnlineFleets: () => get().fleets.filter((f) => f.status === 'online'),
      getTenantById: (id) => get().tenants.find((t) => t.id === id),
      getFleetById: (id) => get().fleets.find((f) => f.id === id),
    })),
    { name: 'ApexCommandCenter' }
  )
);

export default useApexStore;
