/**
 * APEX COMMAND CENTER OS
 * store/apex-store.ts — Zustand Global State
 *
 * Single state tree. ALL aggregates computed from real data — zero mock values.
 * Sustainability metrics (fuel, CO₂, cost saved) computed from routeMetrics.
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import type {
  Tenant, FleetEntity, TelemetryEvent, AIMetric, APIUsageLog,
  RouteMetric, OperationalMetric, DeploymentLog, FinancialEvent,
  GlobalAggregate, DashboardState, InfrastructureMetric,
  SustainabilityMetrics, DriverMetric,
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
// FUEL / CO₂ CONSTANTS
// ============================================================
// These are the physics anchors — adjust per fleet type if needed
const DIESEL_PRICE_PER_LITRE_USD = 1.35; // global avg diesel
const CO2_PER_LITRE_DIESEL_KG = 2.68;    // kg CO₂ per litre diesel burned
const TREE_CO2_KG_PER_YEAR = 21;         // avg tree CO₂ absorption/year
const CAR_CO2_KG_PER_KM = 0.12;          // avg petrol car

// ============================================================
// HELPER — normalise route fuel/co₂ fields (legacy compat)
// ============================================================
function normRoute(r: RouteMetric) {
  const fuelL = r.fuelSavedL ?? r.fuelSaved ?? 0;
  const co2Kg = r.co2SavedKg ?? r.co2Saved ?? (fuelL * CO2_PER_LITRE_DIESEL_KG);
  const costUSD = r.fuelCostSavedUSD ?? (fuelL * DIESEL_PRICE_PER_LITRE_USD);
  return { fuelL, co2Kg, costUSD };
}

// ============================================================
// COMPUTE GLOBAL AGGREGATE — pure function, no randomness
// ============================================================
function computeAggregate(
  tenants: Tenant[],
  fleets: FleetEntity[],
  aiMetrics: AIMetric[],
  apiUsageLogs: APIUsageLog[],
  telemetryEvents: TelemetryEvent[],
  deploymentLogs: DeploymentLog[],
  routeMetrics: RouteMetric[],
  operationalMetrics: OperationalMetric[],
  alerts: AppAlert[],
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

  // Efficiency from real operational metrics
  const globalEfficiency = operationalMetrics.length
    ? operationalMetrics.reduce((acc, m) => acc + m.efficiency, 0) / operationalMetrics.length
    : 0;

  const avgRouteOpt = routeMetrics.length
    ? routeMetrics.reduce((acc, r) => acc + r.optimisationSavingPercent, 0) / routeMetrics.length
    : 0;

  // Sustainability from real route data
  let totalFuelL = 0, totalCO2Kg = 0, totalCostUSD = 0;
  let routesOptimised = 0;
  let onTimeCount = 0;
  let totalDistKm = 0;

  for (const r of routeMetrics) {
    const { fuelL, co2Kg, costUSD } = normRoute(r);
    totalFuelL += fuelL;
    totalCO2Kg += co2Kg;
    totalCostUSD += costUSD;
    if (r.aiOptimised) routesOptimised++;
    if (r.onTimeDelivery) onTimeCount++;
    totalDistKm += r.distanceKm;
  }

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
    globalEfficiency: parseFloat(globalEfficiency.toFixed(1)),
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
    // Sustainability
    totalFuelSavedL: parseFloat(totalFuelL.toFixed(1)),
    totalCO2SavedKg: parseFloat(totalCO2Kg.toFixed(1)),
    totalFuelCostSavedUSD: parseFloat(totalCostUSD.toFixed(2)),
    totalTreesEquivalent: parseFloat((totalCO2Kg / TREE_CO2_KG_PER_YEAR).toFixed(1)),
    totalCarKmEquivalent: parseFloat((totalCO2Kg / CAR_CO2_KG_PER_KM).toFixed(0)),
    totalRoutesOptimised: routesOptimised,
    totalRoutes: routeMetrics.length,
    globalOnTimeRate: routeMetrics.length
      ? parseFloat(((onTimeCount / routeMetrics.length) * 100).toFixed(1))
      : 0,
  };
}

// ============================================================
// COMPUTE SUSTAINABILITY PER ENTITY
// ============================================================
export function computeSustainabilityByEntity(
  routeMetrics: RouteMetric[],
  tenants: Tenant[],
  fleets: FleetEntity[],
  periodDays = 30,
): {
  global: SustainabilityMetrics;
  byTenant: SustainabilityMetrics[];
  byFleet: SustainabilityMetrics[];
  byDriver: DriverMetric[];
} {
  const since = Date.now() - periodDays * 86400000;
  const recent = routeMetrics.filter((r) => r.completedAt >= since);

  function buildMetric(
    routes: RouteMetric[],
    entityId: string,
    entityType: SustainabilityMetrics['entityType'],
    entityName: string,
  ): SustainabilityMetrics {
    let fuelL = 0, co2Kg = 0, costUSD = 0, optimised = 0, onTime = 0, distKm = 0;
    for (const r of routes) {
      const n = normRoute(r);
      fuelL += n.fuelL;
      co2Kg += n.co2Kg;
      costUSD += n.costUSD;
      if (r.aiOptimised) optimised++;
      if (r.onTimeDelivery) onTime++;
      distKm += r.distanceKm;
    }
    const total = routes.length;
    return {
      entityId, entityType, entityName,
      fuelSavedL: parseFloat(fuelL.toFixed(1)),
      co2SavedKg: parseFloat(co2Kg.toFixed(1)),
      fuelCostSavedUSD: parseFloat(costUSD.toFixed(2)),
      routesOptimised: optimised,
      totalRoutes: total,
      optimisationRate: total ? parseFloat(((optimised / total) * 100).toFixed(1)) : 0,
      avgSavingPercent: total
        ? parseFloat((routes.reduce((a, r) => a + r.optimisationSavingPercent, 0) / total).toFixed(1))
        : 0,
      treesEquivalent: parseFloat((co2Kg / TREE_CO2_KG_PER_YEAR).toFixed(1)),
      carKmEquivalent: parseFloat((co2Kg / CAR_CO2_KG_PER_KM).toFixed(0)),
      onTimeRate: total ? parseFloat(((onTime / total) * 100).toFixed(1)) : 0,
      totalDistanceKm: parseFloat(distKm.toFixed(0)),
      periodDays,
    };
  }

  // Global
  const global = buildMetric(recent, 'global', 'global', 'All Tenants');

  // By tenant
  const byTenant = tenants.map((t) => {
    const tRoutes = recent.filter((r) => r.tenantId === t.id);
    return buildMetric(tRoutes, t.id, 'tenant', t.name);
  }).filter((m) => m.totalRoutes > 0);

  // By fleet
  const byFleet = fleets.map((f) => {
    const fRoutes = recent.filter((r) => r.fleetId === f.id);
    return buildMetric(fRoutes, f.id, 'fleet', f.name);
  }).filter((m) => m.totalRoutes > 0);

  // By driver
  const driverMap = new Map<string, DriverMetric>();
  for (const r of recent) {
    if (!r.driverId) continue;
    const existing = driverMap.get(r.driverId);
    const { fuelL, co2Kg, costUSD } = normRoute(r);
    if (existing) {
      existing.totalRoutes++;
      if (r.onTimeDelivery) existing.onTimeRoutes++;
      existing.totalDistanceKm += r.distanceKm;
      existing.fuelSavedL += fuelL;
      existing.co2SavedKg += co2Kg;
      existing.fuelCostSavedUSD += costUSD;
      existing.avgOptimisationPercent =
        (existing.avgOptimisationPercent * (existing.totalRoutes - 1) + r.optimisationSavingPercent) / existing.totalRoutes;
      if (r.completedAt > existing.lastActive) existing.lastActive = r.completedAt;
    } else {
      driverMap.set(r.driverId, {
        driverId: r.driverId,
        fleetId: r.fleetId,
        tenantId: r.tenantId,
        totalRoutes: 1,
        onTimeRoutes: r.onTimeDelivery ? 1 : 0,
        totalDistanceKm: r.distanceKm,
        fuelSavedL: fuelL,
        co2SavedKg: co2Kg,
        fuelCostSavedUSD: costUSD,
        avgOptimisationPercent: r.optimisationSavingPercent,
        lastActive: r.completedAt,
      });
    }
  }
  const byDriver = Array.from(driverMap.values()).map((d) => ({
    ...d,
    fuelSavedL: parseFloat(d.fuelSavedL.toFixed(1)),
    co2SavedKg: parseFloat(d.co2SavedKg.toFixed(1)),
    fuelCostSavedUSD: parseFloat(d.fuelCostSavedUSD.toFixed(2)),
    totalDistanceKm: parseFloat(d.totalDistanceKm.toFixed(0)),
    avgOptimisationPercent: parseFloat(d.avgOptimisationPercent.toFixed(1)),
  }));

  return { global, byTenant, byFleet, byDriver };
}

// ============================================================
// STORE SHAPE
// ============================================================
interface ApexStore {
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

  // Computed
  globalAggregate: GlobalAggregate | null;
  sustainability: ReturnType<typeof computeSustainabilityByEntity> | null;

  // UI
  selectedTenantId: string | null;
  selectedFleetId: string | null;
  activeModule: string;
  sidebarCollapsed: boolean;
  dateRange: { from: number; to: number };
  isLoading: boolean;
  isSeeded: boolean;

  alerts: AppAlert[];
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
  ingestTelemetryBatch: (events: TelemetryEvent[]) => void;

  setAIMetrics: (metrics: AIMetric[]) => void;
  setAPIUsageLogs: (logs: APIUsageLog[]) => void;
  setRouteMetrics: (metrics: RouteMetric[]) => void;
  appendRouteMetric: (metric: RouteMetric) => void;
  setOperationalMetrics: (metrics: OperationalMetric[]) => void;
  setDeploymentLogs: (logs: DeploymentLog[]) => void;
  setFinancialEvents: (events: FinancialEvent[]) => void;
  setInfraMetrics: (metrics: InfrastructureMetric[]) => void;

  setGlobalAggregate: (agg: GlobalAggregate) => void;
  computeGlobalAggregate: () => void;
  computeSustainability: (periodDays?: number) => void;

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

  getFleetsByTenant: (tenantId: string) => FleetEntity[];
  getActiveTenants: () => Tenant[];
  getOnlineFleets: () => FleetEntity[];
  getTenantById: (id: string) => Tenant | undefined;
  getFleetById: (id: string) => FleetEntity | undefined;
}

// ============================================================
// STORE
// ============================================================
export const useApexStore = create<ApexStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
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
      sustainability: null,

      selectedTenantId: null,
      selectedFleetId: null,
      activeModule: 'overview',
      sidebarCollapsed: false,
      dateRange: { from: Date.now() - 86400000 * 30, to: Date.now() },
      isLoading: false,
      isSeeded: false,
      alerts: [],
      liveFeed: [],
      liveFeedMax: 100,

      // Tenant
      setTenants: (tenants) => set({ tenants }),
      addTenant: (tenant) => set((s) => ({ tenants: [...s.tenants, tenant] })),
      updateTenant: (id, patch) =>
        set((s) => ({ tenants: s.tenants.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      removeTenant: (id) => set((s) => ({ tenants: s.tenants.filter((t) => t.id !== id) })),

      // Fleet
      setFleets: (fleets) => set({ fleets }),
      addFleet: (fleet) => set((s) => ({ fleets: [...s.fleets, fleet] })),
      updateFleet: (id, patch) =>
        set((s) => ({ fleets: s.fleets.map((f) => (f.id === id ? { ...f, ...patch } : f)) })),

      // Telemetry
      setTelemetryEvents: (telemetryEvents) => set({ telemetryEvents }),
      appendLiveFeedEvent: (event) =>
        set((s) => ({ liveFeed: [event, ...s.liveFeed].slice(0, s.liveFeedMax) })),
      ingestTelemetryBatch: (events) =>
        set((s) => ({
          telemetryEvents: [...events, ...s.telemetryEvents].slice(0, 5000),
          liveFeed: [...events, ...s.liveFeed].slice(0, s.liveFeedMax),
        })),

      // Data setters
      setAIMetrics: (aiMetrics) => set({ aiMetrics }),
      setAPIUsageLogs: (apiUsageLogs) => set({ apiUsageLogs }),
      setRouteMetrics: (routeMetrics) => set({ routeMetrics }),
      appendRouteMetric: (metric) =>
        set((s) => ({ routeMetrics: [metric, ...s.routeMetrics] })),
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
          s.telemetryEvents, s.deploymentLogs, s.routeMetrics,
          s.operationalMetrics, s.alerts,
        );
        set({ globalAggregate: agg });
      },
      computeSustainability: (periodDays = 30) => {
        const s = get();
        const sustainability = computeSustainabilityByEntity(
          s.routeMetrics, s.tenants, s.fleets, periodDays
        );
        set({ sustainability });
      },

      // UI
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
        set((s) => ({ alerts: s.alerts.map((a) => (a.id === id ? { ...a, dismissed: true } : a)) })),
      clearAlerts: () => set({ alerts: [] }),

      // Selectors
      getFleetsByTenant: (tenantId) => get().fleets.filter((f) => f.tenantId === tenantId),
      getActiveTenants: () => get().tenants.filter((t) => t.status === 'active'),
      getOnlineFleets: () => get().fleets.filter((f) => f.status === 'online'),
      getTenantById: (id) => get().tenants.find((t) => t.id === id),
      getFleetById: (id) => get().fleets.find((f) => f.id === id),
    })),
    { name: 'ApexStore' }
  )
);
