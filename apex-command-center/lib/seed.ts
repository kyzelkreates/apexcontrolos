/**
 * APEX COMMAND CENTER OS
 * lib/seed.ts — Demo Data Seed Engine
 *
 * Generates realistic demo data on first boot when DB is empty.
 * Writes through Storage SSOT → IndexedDB so it persists across refreshes.
 * Called only when tenants.length === 0.
 *
 * STRICT BUILD MODE: additive only — never overwrites real data.
 */

import Storage from '@/storage/storage';

// ─── Tiny helpers ─────────────────────────────────────────────────
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`;
const rand = (lo: number, hi: number) => Math.random() * (hi - lo) + lo;
const randInt = (lo: number, hi: number) => Math.floor(rand(lo, hi + 1));
const pick = <T>(arr: readonly T[]): T => arr[randInt(0, arr.length - 1)];
const NOW = Date.now();
const daysAgo = (d: number, offsetMs = 0) => NOW - d * 86_400_000 + offsetMs;

// ─── Lookup tables ────────────────────────────────────────────────
const REGIONS         = ['EU', 'NA', 'APAC', 'LATAM', 'MEA'] as const;
const FLEET_STATUSES  = ['online', 'online', 'online', 'degraded', 'offline'] as const;
const PLANS           = ['starter', 'pro', 'enterprise'] as const;
const AI_PROVIDERS    = ['ollama', 'mistral', 'deepseek', 'llama', 'openai', 'anthropic'] as const;
const AI_SOURCES      = ['local', 'local', 'local', 'cloud', 'cached'] as const;
const TASK_TYPES      = ['route_optimisation', 'anomaly_detection', 'demand_forecast', 'nlp_query', 'vision_check'] as const;
const AI_MODELS       = ['llama3:8b', 'mistral:7b', 'deepseek-r1:7b', 'gpt-4o-mini', 'claude-3-haiku', 'gemma2:9b'] as const;
const EVENT_TYPES     = ['vehicle_status', 'driver_login', 'route_started', 'route_completed', 'alert_triggered', 'idle_detected', 'fuel_low'] as const;
const API_ENDPOINTS   = ['/api/fleet-heartbeat', '/api/route-complete', '/api/telemetry/batch', '/api/ai/infer'] as const;
const FIN_CATS        = ['api_cost', 'ai_cost', 'infrastructure', 'revenue', 'optimisation_saving'] as const;
const INFRA_SVCS      = ['db', 'cache', 'queue', 'api_gateway', 'ml_runtime'] as const;
const DEPLOY_STATUSES = ['success', 'success', 'rolling', 'failed', 'rollback'] as const;

const COMPANY_NAMES = [
  'Atlas Freight', 'Meridian Logistics', 'Orion Fleet', 'Vertex Mobility',
  'Nova Transport', 'Zenith Delivery', 'Polaris Cargo', 'Solaris Routes',
];
const FLEET_NAMES = [
  'Northern Division', 'Southern Hub', 'Eastern Corridor', 'West Coast Fleet',
  'Metro Express', 'Regional Link', 'Cross-Border Unit', 'Airport Transfer',
];

// ─── Factories ────────────────────────────────────────────────────
function makeTenant(i: number) {
  return {
    id: uid('ten'),
    name: COMPANY_NAMES[i % COMPANY_NAMES.length],
    status: i < 6 ? 'active' : 'inactive',
    plan: PLANS[i % PLANS.length],
    region: REGIONS[i % REGIONS.length],
    createdAt: daysAgo(randInt(30, 365)),
    fleetCount: randInt(2, 8),
    apiCallsToday: randInt(200, 4000),
    storageUsedMB: randInt(50, 2000),
    lastActivity: daysAgo(0, -randInt(1, 120) * 60_000),
    contactEmail: `admin@${COMPANY_NAMES[i % COMPANY_NAMES.length].toLowerCase().replace(/\s+/g, '')}.com`,
  };
}

function makeFleet(tenantId: string, i: number) {
  const total  = randInt(15, 120);
  const active = randInt(Math.floor(total * 0.5), total);
  const drivers = randInt(total, Math.floor(total * 1.4));
  return {
    id: uid('flt'),
    tenantId,
    name: FLEET_NAMES[i % FLEET_NAMES.length],
    region: pick(REGIONS),
    status: pick(FLEET_STATUSES),
    vehicleCount: total,
    activeVehicles: active,
    driverCount: drivers,
    activeDrivers: randInt(Math.floor(drivers * 0.4), drivers),
    uptimePercent: parseFloat(rand(82, 99.9).toFixed(1)),
    lastHeartbeat: daysAgo(0, -randInt(0, 5) * 60_000),
    version: `2.${randInt(0, 6)}.${randInt(0, 12)}`,
    apiKey: uid('axk'),
    registeredAt: daysAgo(randInt(20, 300)),
  };
}

function makeRoute(tenantId: string, fleetId: string, day: number) {
  const ts     = daysAgo(day, randInt(0, 86399) * 1000);
  const distKm = rand(10, 220);
  const fuelL  = parseFloat((distKm * rand(0.04, 0.09)).toFixed(2));
  const co2Kg  = parseFloat((fuelL * 2.68).toFixed(2));
  const costUSD = parseFloat((fuelL * 1.35).toFixed(2));
  return {
    id: uid('rte'),
    tenantId,
    fleetId,
    driverId: uid('drv'),
    vehicleId: uid('veh'),
    distanceKm: parseFloat(distKm.toFixed(1)),
    durationMin: randInt(20, 240),
    stops: randInt(2, 18),
    fuelSavedL: fuelL,
    fuelSaved: fuelL,       // legacy compat
    co2SavedKg: co2Kg,
    co2Saved: co2Kg,        // legacy compat
    fuelCostSavedUSD: costUSD,
    optimisationSavingPercent: parseFloat(rand(5, 35).toFixed(1)),
    aiOptimised: Math.random() > 0.25,
    onTimeDelivery: Math.random() > 0.15,
    completedAt: ts,
    timestamp: ts,
  };
}

function makeTelemetry(tenantId: string, fleetId: string, day: number) {
  const ts = daysAgo(day, randInt(0, 86399) * 1000);
  return {
    id: uid('tel'),
    tenantId,
    fleetId,
    vehicleId: uid('veh'),
    driverId: uid('drv'),
    eventType: pick(EVENT_TYPES),
    payload: { speed: randInt(0, 110), lat: rand(48, 55), lng: rand(-2, 15) },
    processed: Math.random() > 0.08,
    timestamp: ts,
    batchId: uid('bat'),
  };
}

function makeAIMetric(tenantId: string, fleetId: string, day: number) {
  const src = pick(AI_SOURCES);
  const ts  = daysAgo(day, randInt(0, 86399) * 1000);
  return {
    id: uid('aim'),
    tenantId,
    fleetId,
    provider: pick(AI_PROVIDERS),
    model: pick(AI_MODELS),
    taskType: pick(TASK_TYPES),
    tokensUsed: randInt(100, 8000),
    cost: parseFloat((src === 'cloud' ? rand(0.0001, 0.02) : 0).toFixed(6)),
    latencyMs: randInt(80, 2800),
    inferenceSource: src,
    cacheHit: src === 'cached',
    fallbackTriggered: Math.random() < 0.04,
    success: Math.random() > 0.03,
    timestamp: ts,
  };
}

function makeAPILog(tenantId: string, fleetId: string, day: number) {
  const ts = daysAgo(day, randInt(0, 86399) * 1000);
  return {
    id: uid('api'),
    tenantId,
    fleetId,
    endpoint: pick(API_ENDPOINTS),
    method: pick(['GET', 'POST', 'POST', 'POST'] as const),
    statusCode: pick([200, 200, 200, 201, 400, 500] as const),
    latencyMs: randInt(10, 600),
    cost: parseFloat(rand(0.0001, 0.005).toFixed(6)),
    timestamp: ts,
  };
}

function makeFinancial(tenantId: string, day: number) {
  const cat = pick(FIN_CATS);
  const ts  = daysAgo(day, randInt(0, 86399) * 1000);
  const amts: Record<string, [number, number]> = {
    revenue: [800, 8000], api_cost: [10, 300], ai_cost: [5, 200],
    infrastructure: [50, 800], optimisation_saving: [100, 2000],
  };
  const [lo, hi] = amts[cat] || [10, 500];
  return {
    id: uid('fin'),
    tenantId,
    category: cat,
    amount: parseFloat(rand(lo, hi).toFixed(2)),
    description: `${cat.replace(/_/g, ' ')} — demo data`,
    timestamp: ts,
  };
}

function makeOpMetric(tenantId: string, fleetId: string, day: number) {
  const ts = daysAgo(day, randInt(0, 86399) * 1000);
  return {
    id: uid('ops'),
    tenantId,
    fleetId,
    type: pick(['efficiency', 'latency', 'throughput'] as const),
    efficiency: parseFloat(rand(68, 99).toFixed(1)),
    latencyMs: randInt(15, 500),
    throughput: randInt(10, 1000),
    timestamp: ts,
  };
}

function makeInfra(day: number) {
  const ts = daysAgo(day, randInt(0, 86399) * 1000);
  return {
    id: uid('inf'),
    service: pick(INFRA_SVCS),
    cpuPercent: parseFloat(rand(5, 85).toFixed(1)),
    memPercent: parseFloat(rand(20, 90).toFixed(1)),
    diskPercent: parseFloat(rand(10, 70).toFixed(1)),
    latencyMs: randInt(1, 200),
    errorRate: parseFloat(rand(0, 2).toFixed(2)),
    timestamp: ts,
  };
}

function makeDeployLog(tenantId: string, fleetId: string, day: number) {
  const ts = daysAgo(day, randInt(0, 86399) * 1000);
  return {
    id: uid('dep'),
    tenantId,
    fleetId,
    version: `2.${randInt(0, 6)}.${randInt(0, 12)}`,
    status: pick(DEPLOY_STATUSES),
    deployedBy: pick(['ci-pipeline', 'apex-admin', 'auto-rollout'] as const),
    changesCount: randInt(1, 40),
    timestamp: ts,
    completedAt: ts + randInt(30, 600) * 1000,
  };
}

// ─── Batch helper — avoids overwhelming IndexedDB ─────────────────
async function batchSave<T>(
  items: T[],
  saveFn: (item: T) => Promise<unknown>,
  size = 80,
) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(saveFn));
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────
export default async function seedDemoData(): Promise<{
  seeded: boolean;
  counts: { tenants: number; fleets: number; routes: number; telemetry: number; ai: number };
}> {
  try {
    // 1. Build entities
    const NUM_TENANTS = 8;
    const tenants = Array.from({ length: NUM_TENANTS }, (_, i) => makeTenant(i));

    const fleets: ReturnType<typeof makeFleet>[] = [];
    for (const t of tenants) {
      const count = randInt(2, 4);
      for (let i = 0; i < count; i++) fleets.push(makeFleet(t.id, fleets.length + i));
    }

    // 2. Build time-series (30 days)
    const routes:     ReturnType<typeof makeRoute>[]     = [];
    const telemetry:  ReturnType<typeof makeTelemetry>[] = [];
    const aiMetrics:  ReturnType<typeof makeAIMetric>[]  = [];
    const apiLogs:    ReturnType<typeof makeAPILog>[]    = [];
    const financial:  ReturnType<typeof makeFinancial>[] = [];
    const opsMetrics: ReturnType<typeof makeOpMetric>[]  = [];
    const infraMets:  ReturnType<typeof makeInfra>[]     = [];
    const deploys:    ReturnType<typeof makeDeployLog>[] = [];

    for (let day = 0; day < 30; day++) {
      for (const fleet of fleets) {
        const tid = fleet.tenantId;
        for (let r = 0; r < randInt(3, 12); r++)  routes.push(makeRoute(tid, fleet.id, day));
        for (let t = 0; t < randInt(15, 40); t++)  telemetry.push(makeTelemetry(tid, fleet.id, day));
        for (let a = 0; a < randInt(5, 18); a++)   aiMetrics.push(makeAIMetric(tid, fleet.id, day));
        for (let a = 0; a < randInt(10, 25); a++)  apiLogs.push(makeAPILog(tid, fleet.id, day));
        for (let o = 0; o < randInt(2, 5); o++)    opsMetrics.push(makeOpMetric(tid, fleet.id, day));
        if (Math.random() < 0.06)                  deploys.push(makeDeployLog(tid, fleet.id, day));
      }
      for (const t of tenants) {
        for (let f = 0; f < randInt(3, 8); f++) financial.push(makeFinancial(t.id, day));
      }
      for (let i = 0; i < 4; i++) infraMets.push(makeInfra(day));
    }

    // 3. Persist through Storage SSOT
    // Tenants + Fleets first (other stores reference their IDs)
    await Promise.all(tenants.map((t) => Storage.Tenants.save(t)));
    await Promise.all(fleets.map((f) => Storage.Fleets.save(f)));

    // Time-series data in batches
    await batchSave(routes,     (r) => Storage.Routes.save(r));
    // Telemetry uses ingestBatch
    for (let i = 0; i < telemetry.length; i += 100) {
      await Storage.Telemetry.ingestBatch(telemetry.slice(i, i + 100));
    }
    await batchSave(aiMetrics,  (m) => Storage.AIMetrics.save(m));
    await batchSave(apiLogs,    (l) => Storage.APIUsage.save(l));
    await batchSave(financial,  (f) => Storage.Financial.save(f));
    await batchSave(opsMetrics, (o) => Storage.Operations.save(o));
    await batchSave(infraMets,  (i) => Storage.Infra.save(i));
    await batchSave(deploys,    (d) => Storage.Deployments.save(d));

    return {
      seeded: true,
      counts: {
        tenants: tenants.length,
        fleets: fleets.length,
        routes: routes.length,
        telemetry: telemetry.length,
        ai: aiMetrics.length,
      },
    };
  } catch (err) {
    console.error('[Apex Seed] Error writing demo data:', err);
    return { seeded: false, counts: { tenants: 0, fleets: 0, routes: 0, telemetry: 0, ai: 0 } };
  }
}
