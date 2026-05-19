/**
 * APEX COMMAND CENTER OS
 * lib/seed.ts — Demo Data Generator
 * Populates IndexedDB with realistic multi-tenant federation data
 */

import { v4 as uuid } from 'uuid';
import Storage from '@/storage/storage';
import type {
  Tenant, FleetEntity, TelemetryEvent, AIMetric, APIUsageLog,
  RouteMetric, OperationalMetric, DeploymentLog, FinancialEvent,
  RegionCode, AIProvider, FleetStatus, TenantStatus, DeploymentStatus
} from '@/types';

const REGIONS: RegionCode[] = ['NA', 'EU', 'APAC', 'LATAM', 'MEA'];
const AI_PROVIDERS: AIProvider[] = ['ollama', 'mistral', 'deepseek', 'openai', 'anthropic', 'gemini', 'llama', 'qwen'];
const FLEET_STATUSES: FleetStatus[] = ['online', 'degraded', 'offline', 'maintenance'];
const TENANT_STATUSES: TenantStatus[] = ['active', 'active', 'active', 'suspended', 'pending'];
const DEPLOY_STATUSES: DeploymentStatus[] = ['deployed', 'deployed', 'deployed', 'rolling', 'failed'];

const COMPANY_NAMES = [
  'LogiTech Solutions', 'SwiftRoute Corp', 'FleetMaster Inc', 'HaulPro Systems',
  'TransitAI Ltd', 'DriveOps Global', 'CargoSync Enterprise', 'RapidFleet Technologies',
  'UrbanMover Co', 'PrimeDeliver Network',
];

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min: number, max: number, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function timeAgo(daysAgo: number) {
  return Date.now() - daysAgo * 86400000 - rand(0, 86400000);
}

// ============================================================
// SEED TENANTS
// ============================================================
function generateTenants(): Tenant[] {
  return COMPANY_NAMES.map((name, i) => ({
    id: `tenant_${uuid()}`,
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    region: pick(REGIONS),
    status: TENANT_STATUSES[i % TENANT_STATUSES.length],
    registrationCode: `APEX-${uuid().substring(0, 8).toUpperCase()}`,
    pairingToken: uuid(),
    fingerprint: `fp_${uuid()}`,
    createdAt: timeAgo(rand(30, 365)),
    updatedAt: timeAgo(rand(0, 7)),
    contactEmail: `admin@${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
    plan: pick(['starter', 'growth', 'enterprise']) as 'starter' | 'growth' | 'enterprise',
    fleetCount: rand(1, 5),
    vehicleCount: rand(10, 500),
    driverCount: rand(8, 400),
    apiKeyHash: `hash_${uuid()}`,
    telemetryEnabled: Math.random() > 0.1,
    lastSeen: Date.now() - rand(0, 3600000),
    metadata: {},
  }));
}

// ============================================================
// SEED FLEETS
// ============================================================
function generateFleets(tenants: Tenant[]): FleetEntity[] {
  const fleets: FleetEntity[] = [];
  for (const tenant of tenants) {
    const count = rand(1, 3);
    for (let i = 0; i < count; i++) {
      fleets.push({
        id: `fleet_${uuid()}`,
        tenantId: tenant.id,
        name: `${tenant.name} Fleet ${i + 1}`,
        region: tenant.region,
        status: pick(FLEET_STATUSES),
        vehicleCount: rand(5, 150),
        activeVehicles: rand(3, 100),
        driverCount: rand(4, 120),
        activeDrivers: rand(2, 90),
        uptimePercent: randFloat(85, 99.9),
        lastHeartbeat: Date.now() - rand(0, 600000),
        version: `${rand(1, 3)}.${rand(0, 9)}.${rand(0, 20)}`,
        deploymentId: `dep_${uuid()}`,
        telemetryEndpoint: `/api/telemetry/${tenant.slug}`,
        createdAt: tenant.createdAt + rand(0, 86400000 * 7),
        updatedAt: timeAgo(rand(0, 3)),
        coordinates: {
          lat: randFloat(-60, 70),
          lng: randFloat(-160, 160),
        },
        tags: [tenant.region, tenant.plan],
      });
    }
  }
  return fleets;
}

// ============================================================
// SEED TELEMETRY
// ============================================================
function generateTelemetry(fleets: FleetEntity[]): TelemetryEvent[] {
  const events: TelemetryEvent[] = [];
  const types = ['fleet_update', 'vehicle_event', 'route_complete', 'ai_inference', 'api_call', 'heartbeat'];
  for (const fleet of fleets.slice(0, 20)) { // limit for seed
    for (let i = 0; i < rand(20, 60); i++) {
      events.push({
        id: `tel_${uuid()}`,
        tenantId: fleet.tenantId,
        fleetId: fleet.id,
        eventType: pick(types) as TelemetryEvent['eventType'],
        timestamp: timeAgo(rand(0, 7)),
        payload: { vehicleId: `v_${rand(1, 50)}`, value: randFloat(0, 100) },
        processed: Math.random() > 0.2,
        batchId: `batch_${uuid()}`,
        signature: `sig_${uuid()}`,
        size: rand(128, 4096),
      });
    }
  }
  return events;
}

// ============================================================
// SEED AI METRICS
// ============================================================
function generateAIMetrics(fleets: FleetEntity[]): AIMetric[] {
  const metrics: AIMetric[] = [];
  const tasks = ['route_optimise', 'eta_predict', 'anomaly_detect', 'demand_forecast', 'driver_score'];
  for (const fleet of fleets.slice(0, 15)) {
    for (let i = 0; i < rand(30, 80); i++) {
      const provider = pick(AI_PROVIDERS);
      const isLocal = ['ollama', 'llama', 'mistral', 'deepseek', 'qwen'].includes(provider);
      metrics.push({
        id: `ai_${uuid()}`,
        tenantId: fleet.tenantId,
        fleetId: fleet.id,
        provider,
        inferenceSource: isLocal ? 'local' : pick(['cloud', 'cached']),
        model: `${provider}-${pick(['7b', '13b', '70b', 'turbo', 'pro'])}`,
        tokensUsed: rand(50, 4000),
        latencyMs: rand(50, 3000),
        cacheHit: Math.random() > 0.6,
        cost: isLocal ? 0 : randFloat(0.001, 0.05),
        taskType: pick(tasks),
        timestamp: timeAgo(rand(0, 14)),
        success: Math.random() > 0.05,
        fallbackTriggered: Math.random() > 0.85,
      });
    }
  }
  return metrics;
}

// ============================================================
// SEED API USAGE
// ============================================================
function generateAPIUsage(fleets: FleetEntity[]): APIUsageLog[] {
  const logs: APIUsageLog[] = [];
  const services = [
    { name: 'OpenRouteService', category: 'routing' as const, endpoint: '/v2/directions' },
    { name: 'OSM Nominatim', category: 'geocoding' as const, endpoint: '/search' },
    { name: 'OpenWeatherMap', category: 'traffic' as const, endpoint: '/data/2.5/weather' },
    { name: 'OpenAI', category: 'ai' as const, endpoint: '/chat/completions' },
    { name: 'Anthropic', category: 'ai' as const, endpoint: '/messages' },
    { name: 'MapTiler', category: 'maps' as const, endpoint: '/maps/streets/tiles' },
  ];
  for (const fleet of fleets.slice(0, 15)) {
    for (const svc of services) {
      for (let day = 0; day < 7; day++) {
        logs.push({
          id: `api_${uuid()}`,
          tenantId: fleet.tenantId,
          fleetId: fleet.id,
          service: svc.name,
          endpoint: svc.endpoint,
          method: 'GET',
          calls: rand(10, 2000),
          cost: randFloat(0, 15),
          tokens: svc.category === 'ai' ? rand(1000, 50000) : undefined,
          latencyAvgMs: rand(80, 800),
          errorRate: randFloat(0, 3),
          timestamp: timeAgo(day),
          category: svc.category,
        });
      }
    }
  }
  return logs;
}

// ============================================================
// SEED ROUTE METRICS
// ============================================================
function generateRouteMetrics(fleets: FleetEntity[]): RouteMetric[] {
  const metrics: RouteMetric[] = [];
  for (const fleet of fleets.slice(0, 15)) {
    for (let i = 0; i < rand(20, 60); i++) {
      const start = timeAgo(rand(0, 14));
      const duration = rand(15, 480);
      metrics.push({
        id: `route_${uuid()}`,
        tenantId: fleet.tenantId,
        fleetId: fleet.id,
        vehicleId: `v_${rand(1, 50)}`,
        driverId: `d_${rand(1, 40)}`,
        routeId: `r_${uuid()}`,
        distanceKm: randFloat(5, 400),
        durationMin: duration,
        optimisationSavingPercent: randFloat(5, 35),
        fuelSaved: randFloat(0.5, 20),
        co2Saved: randFloat(1, 50),
        startTime: start,
        endTime: start + duration * 60000,
        completedAt: start + duration * 60000,
        aiOptimised: Math.random() > 0.3,
        stops: rand(1, 20),
        onTimeDelivery: Math.random() > 0.15,
      });
    }
  }
  return metrics;
}

// ============================================================
// SEED OPERATIONAL METRICS
// ============================================================
function generateOperationalMetrics(fleets: FleetEntity[]): OperationalMetric[] {
  const metrics: OperationalMetric[] = [];
  for (const fleet of fleets) {
    for (let day = 0; day < 30; day++) {
      metrics.push({
        id: `ops_${uuid()}`,
        tenantId: fleet.tenantId,
        fleetId: fleet.id,
        period: `day_${day}`,
        efficiency: randFloat(70, 98),
        uptimePercent: randFloat(85, 99.9),
        deliverySuccessRate: randFloat(88, 99.5),
        avgRouteOptimisation: randFloat(10, 35),
        driverUtilisation: randFloat(60, 95),
        vehicleUtilisation: randFloat(55, 92),
        incidentCount: rand(0, 5),
        timestamp: timeAgo(day),
      });
    }
  }
  return metrics;
}

// ============================================================
// SEED DEPLOYMENT LOGS
// ============================================================
function generateDeploymentLogs(tenants: Tenant[], fleets: FleetEntity[]): DeploymentLog[] {
  const logs: DeploymentLog[] = [];
  for (const fleet of fleets.slice(0, 20)) {
    for (let i = 0; i < rand(1, 5); i++) {
      const tenant = tenants.find((t) => t.id === fleet.tenantId)!;
      logs.push({
        id: `dep_${uuid()}`,
        tenantId: fleet.tenantId,
        fleetId: fleet.id,
        version: `${rand(1, 3)}.${rand(0, 9)}.${rand(0, 20)}`,
        previousVersion: `${rand(1, 3)}.${rand(0, 9)}.${rand(0, 20)}`,
        status: pick(DEPLOY_STATUSES),
        deployedAt: timeAgo(rand(0, 30)),
        deployedBy: 'system@apexcc.io',
        region: tenant.region,
        rollbackAvailable: Math.random() > 0.3,
        notes: 'Automated deployment via Apex Command Center',
        healthCheckPassed: Math.random() > 0.1,
        vehiclesUpdated: rand(1, fleet.vehicleCount),
        vehiclesTotal: fleet.vehicleCount,
        changelogs: ['Improved AI routing', 'Telemetry batch optimisation', 'Bug fixes'],
      });
    }
  }
  return logs;
}

// ============================================================
// SEED FINANCIAL EVENTS
// ============================================================
function generateFinancialEvents(tenants: Tenant[]): FinancialEvent[] {
  const events: FinancialEvent[] = [];
  const categories = ['api_cost', 'ai_cost', 'infrastructure', 'revenue', 'optimisation_saving'] as const;
  for (const tenant of tenants) {
    for (let day = 0; day < 30; day++) {
      for (const cat of categories) {
        events.push({
          id: `fin_${uuid()}`,
          tenantId: tenant.id,
          category: cat,
          amount: cat === 'revenue' ? randFloat(500, 5000) : cat === 'optimisation_saving' ? randFloat(50, 800) : randFloat(5, 300),
          currency: 'USD',
          description: `${cat.replace(/_/g, ' ')} — ${tenant.name}`,
          timestamp: timeAgo(day),
          period: `day_${day}`,
          tags: [tenant.region, tenant.plan],
        });
      }
    }
  }
  return events;
}

// ============================================================
// MAIN SEED FUNCTION
// ============================================================
export async function seedDemoData(): Promise<{ seeded: boolean; counts: Record<string, number> }> {
  const existingTenants = await Storage.Tenants.getAll();
  if (existingTenants.length > 0) {
    return { seeded: false, counts: {} };
  }

  const tenants = generateTenants();
  const fleets = generateFleets(tenants);
  const telemetry = generateTelemetry(fleets);
  const aiMetrics = generateAIMetrics(fleets);
  const apiLogs = generateAPIUsage(fleets);
  const routeMetrics = generateRouteMetrics(fleets);
  const opsMetrics = generateOperationalMetrics(fleets);
  const deployLogs = generateDeploymentLogs(tenants, fleets);
  const financialEvents = generateFinancialEvents(tenants);

  // Save in controlled batches
  for (const t of tenants) await Storage.Tenants.save(t);
  for (const f of fleets) await Storage.Fleets.save(f);

  // Batch ingest large datasets
  const batchSize = 100;
  for (let i = 0; i < telemetry.length; i += batchSize) {
    await Storage.Telemetry.ingestBatch(telemetry.slice(i, i + batchSize));
  }
  for (let i = 0; i < aiMetrics.length; i += batchSize) {
    await Storage.AIMetrics.saveBatch(aiMetrics.slice(i, i + batchSize));
  }
  for (let i = 0; i < apiLogs.length; i += batchSize) {
    await Storage.APIUsage.saveBatch(apiLogs.slice(i, i + batchSize));
  }
  for (let i = 0; i < routeMetrics.length; i += batchSize) {
    await Storage.Routes.saveBatch(routeMetrics.slice(i, i + batchSize));
  }
  for (const m of opsMetrics) await Storage.Operations.save(m);
  for (const d of deployLogs) await Storage.Deployments.save(d);
  for (let i = 0; i < financialEvents.length; i += batchSize) {
    await Storage.Financial.saveBatch(financialEvents.slice(i, i + batchSize));
  }

  Storage.Config.patch({ masterOwnerId: `owner_${uuid()}` });

  return {
    seeded: true,
    counts: {
      tenants: tenants.length,
      fleets: fleets.length,
      telemetry: telemetry.length,
      aiMetrics: aiMetrics.length,
      apiLogs: apiLogs.length,
      routeMetrics: routeMetrics.length,
      opsMetrics: opsMetrics.length,
      deployLogs: deployLogs.length,
      financialEvents: financialEvents.length,
    },
  };
}

export default seedDemoData;
