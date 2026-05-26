/**
 * APEX COMMAND CENTER OS
 * services/deploymentProvider.ts — Deployment Source Layer
 *
 * SINGLE POINT OF TRUTH for all deployment data routing.
 * Components MUST use only the exported functions below.
 * Components MUST NOT import seed data, mock arrays, or
 * call external endpoints directly.
 *
 * ARCHITECTURE:
 *   UI Layer
 *     ↓
 *   deploymentProvider  ← mode switch lives here
 *     ↓
 *   Simulation Engine  OR  Live Dashboard Network Layer
 *
 * SAFETY CONTRACT:
 *   - All live fetches are wrapped in try/catch
 *   - Unreachable dashboards → marked "offline", never removed
 *   - System never crashes due to missing external dashboards
 *   - If live fetch fails entirely → falls back to simulation data
 */

import Storage from '@/storage/storage';
import type { DeploymentLog } from '@/types';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export type DeploymentSourceMode = 'simulation' | 'live';

export interface DeploymentNode {
  id: string;
  name: string;
  endpoint: string;
  region: string;
  version: string;
  status: 'online' | 'degraded' | 'offline' | 'unreachable';
  lastSeen: number;          // epoch ms
  syncStatus: 'synced' | 'behind' | 'unknown';
  tenantId: string;
  fleetCount: number;
  activeVehicles: number;
  healthScore: number;       // 0–100
  uptime: number;            // percent
  responseTimeMs: number;
  source: 'live' | 'simulation' | 'fallback';
}

export interface DashboardStatus {
  nodeId: string;
  dashboardVersion: string;
  isReachable: boolean;
  lastCheckAt: number;
  activeSessions: number;
  cpuPercent: number;
  memPercent: number;
  diskPercent: number;
  queueDepth: number;
  errorRate: number;         // 0–1
  source: 'live' | 'simulation' | 'fallback';
}

export interface FleetTelemetrySummary {
  nodeId: string;
  eventsLast1h: number;
  eventsLast24h: number;
  activeRoutes: number;
  completedRoutes: number;
  alertCount: number;
  avgResponseMs: number;
  dataFreshnessMs: number;   // how old the data is
  source: 'live' | 'simulation' | 'fallback';
}

export interface ConnectionHealth {
  nodeId: string;
  latencyMs: number | null;
  packetLossPercent: number;
  connected: boolean;
  tlsValid: boolean;
  lastPingAt: number;
  consecutiveFailures: number;
  source: 'live' | 'simulation' | 'fallback';
}

export interface DeploymentServiceState {
  mode: DeploymentSourceMode;
  nodes: DeploymentNode[];
  dashboardStatuses: DashboardStatus[];
  fleetTelemetry: FleetTelemetrySummary[];
  connectionHealth: ConnectionHealth[];
  lastRefreshedAt: number;
  liveEndpoints: LiveEndpoint[];
  systemHealthy: boolean;
}

export interface LiveEndpoint {
  id: string;
  label: string;
  url: string;
  enabled: boolean;
}

// ─────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────

const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`;
const rand = (lo: number, hi: number) => Math.random() * (hi - lo) + lo;
const randInt = (lo: number, hi: number) => Math.floor(rand(lo, hi + 1));
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

const REGIONS   = ['EU', 'NA', 'APAC', 'LATAM', 'MEA'] as const;
const VERSIONS  = ['2.3.1', '2.3.0', '2.2.9', '2.2.8', '2.1.4'] as const;
const NAMES     = [
  'Atlas Fleet Hub', 'Meridian Control', 'Orion Node',
  'Vertex Gateway', 'Nova Dashboard', 'Zenith Monitor',
  'Polaris Instance', 'Solaris Control',
];

// ─────────────────────────────────────────────────────────────────
// SIMULATION ENGINE
// ─────────────────────────────────────────────────────────────────

function simulateNodes(count = 6): DeploymentNode[] {
  return Array.from({ length: count }, (_, i) => {
    const isOffline = i === count - 1; // last node always offline for realism
    return {
      id: `node_sim_${i}`,
      name: NAMES[i % NAMES.length],
      endpoint: `https://ap3x-node-${i + 1}.example.internal`,
      region: REGIONS[i % REGIONS.length],
      version: pick(VERSIONS),
      status: isOffline ? 'offline' : pick(['online', 'online', 'online', 'degraded'] as const),
      lastSeen: Date.now() - (isOffline ? rand(300_000, 3_600_000) : rand(1_000, 30_000)),
      syncStatus: isOffline ? 'unknown' : pick(['synced', 'synced', 'behind'] as const),
      tenantId: `ten_sim_${i}`,
      fleetCount: randInt(2, 8),
      activeVehicles: isOffline ? 0 : randInt(20, 200),
      healthScore: isOffline ? 0 : randInt(65, 100),
      uptime: isOffline ? 0 : parseFloat(rand(92, 99.9).toFixed(2)),
      responseTimeMs: isOffline ? 0 : randInt(12, 280),
      source: 'simulation' as const,
    };
  });
}

function simulateDashboardStatuses(nodes: DeploymentNode[]): DashboardStatus[] {
  return nodes.map((n) => ({
    nodeId: n.id,
    dashboardVersion: n.version,
    isReachable: n.status !== 'offline',
    lastCheckAt: Date.now() - randInt(5_000, 60_000),
    activeSessions: n.status === 'offline' ? 0 : randInt(1, 24),
    cpuPercent: n.status === 'offline' ? 0 : randInt(10, 85),
    memPercent: n.status === 'offline' ? 0 : randInt(30, 78),
    diskPercent: n.status === 'offline' ? 0 : randInt(20, 65),
    queueDepth: n.status === 'offline' ? 0 : randInt(0, 450),
    errorRate: n.status === 'offline' ? 1 : parseFloat(rand(0, 0.05).toFixed(3)),
    source: 'simulation' as const,
  }));
}

function simulateFleetTelemetry(nodes: DeploymentNode[]): FleetTelemetrySummary[] {
  return nodes.map((n) => ({
    nodeId: n.id,
    eventsLast1h: n.status === 'offline' ? 0 : randInt(100, 4_000),
    eventsLast24h: n.status === 'offline' ? 0 : randInt(2_000, 80_000),
    activeRoutes: n.status === 'offline' ? 0 : randInt(0, 120),
    completedRoutes: n.status === 'offline' ? 0 : randInt(50, 1_200),
    alertCount: n.status === 'offline' ? 0 : randInt(0, 15),
    avgResponseMs: n.status === 'offline' ? 0 : randInt(8, 350),
    dataFreshnessMs: n.status === 'offline' ? 99_999_999 : randInt(1_000, 120_000),
    source: 'simulation' as const,
  }));
}

function simulateConnectionHealth(nodes: DeploymentNode[]): ConnectionHealth[] {
  return nodes.map((n) => ({
    nodeId: n.id,
    latencyMs: n.status === 'offline' ? null : randInt(5, 320),
    packetLossPercent: n.status === 'offline' ? 100 : parseFloat(rand(0, 3).toFixed(1)),
    connected: n.status !== 'offline',
    tlsValid: n.status !== 'offline',
    lastPingAt: Date.now() - (n.status === 'offline' ? rand(600_000, 7_200_000) : rand(1_000, 15_000)),
    consecutiveFailures: n.status === 'offline' ? randInt(3, 30) : 0,
    source: 'simulation' as const,
  }));
}

// ─────────────────────────────────────────────────────────────────
// LIVE NETWORK LAYER
// ─────────────────────────────────────────────────────────────────

async function fetchLiveNode(endpoint: LiveEndpoint): Promise<{
  node: DeploymentNode;
  status: DashboardStatus;
  telemetry: FleetTelemetrySummary;
  health: ConnectionHealth;
}> {
  const pingStart = Date.now();
  let reachable = false;
  let latencyMs: number | null = null;
  let consecutiveFailures = 0;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    const response = await fetch(`${endpoint.url}/api/ap3x/status`, {
      signal: controller.signal,
      headers: { 'X-AP3X-Control-Plane': '1' },
    });
    clearTimeout(timeout);

    latencyMs = Date.now() - pingStart;
    reachable = response.ok;

    if (response.ok) {
      const data = await response.json();

      const node: DeploymentNode = {
        id: endpoint.id,
        name: endpoint.label,
        endpoint: endpoint.url,
        region: data.region ?? 'UNKNOWN',
        version: data.version ?? '0.0.0',
        status: data.status ?? 'online',
        lastSeen: Date.now(),
        syncStatus: data.syncStatus ?? 'synced',
        tenantId: data.tenantId ?? endpoint.id,
        fleetCount: data.fleetCount ?? 0,
        activeVehicles: data.activeVehicles ?? 0,
        healthScore: data.healthScore ?? 100,
        uptime: data.uptime ?? 100,
        responseTimeMs: latencyMs,
        source: 'live',
      };

      const status: DashboardStatus = {
        nodeId: endpoint.id,
        dashboardVersion: data.version ?? '0.0.0',
        isReachable: true,
        lastCheckAt: Date.now(),
        activeSessions: data.activeSessions ?? 0,
        cpuPercent: data.cpu ?? 0,
        memPercent: data.mem ?? 0,
        diskPercent: data.disk ?? 0,
        queueDepth: data.queueDepth ?? 0,
        errorRate: data.errorRate ?? 0,
        source: 'live',
      };

      const telemetry: FleetTelemetrySummary = {
        nodeId: endpoint.id,
        eventsLast1h: data.eventsLast1h ?? 0,
        eventsLast24h: data.eventsLast24h ?? 0,
        activeRoutes: data.activeRoutes ?? 0,
        completedRoutes: data.completedRoutes ?? 0,
        alertCount: data.alertCount ?? 0,
        avgResponseMs: latencyMs,
        dataFreshnessMs: Date.now() - (data.lastEventAt ?? Date.now()),
        source: 'live',
      };

      const health: ConnectionHealth = {
        nodeId: endpoint.id,
        latencyMs,
        packetLossPercent: data.packetLoss ?? 0,
        connected: true,
        tlsValid: true,
        lastPingAt: Date.now(),
        consecutiveFailures: 0,
        source: 'live',
      };

      return { node, status, telemetry, health };
    }
  } catch {
    // Network error or timeout — mark unreachable, do NOT throw
    latencyMs = null;
    consecutiveFailures = 1;
  }

  // ── FALLBACK: endpoint unreachable → safe offline record ──────
  const offline: DeploymentNode = {
    id: endpoint.id,
    name: endpoint.label,
    endpoint: endpoint.url,
    region: 'UNKNOWN',
    version: '—',
    status: 'unreachable',
    lastSeen: Date.now() - 999_999,
    syncStatus: 'unknown',
    tenantId: endpoint.id,
    fleetCount: 0,
    activeVehicles: 0,
    healthScore: 0,
    uptime: 0,
    responseTimeMs: 0,
    source: 'fallback',
  };

  return {
    node: offline,
    status: {
      nodeId: endpoint.id,
      dashboardVersion: '—',
      isReachable: false,
      lastCheckAt: Date.now(),
      activeSessions: 0,
      cpuPercent: 0,
      memPercent: 0,
      diskPercent: 0,
      queueDepth: 0,
      errorRate: 1,
      source: 'fallback',
    },
    telemetry: {
      nodeId: endpoint.id,
      eventsLast1h: 0,
      eventsLast24h: 0,
      activeRoutes: 0,
      completedRoutes: 0,
      alertCount: 0,
      avgResponseMs: 0,
      dataFreshnessMs: 99_999_999,
      source: 'fallback',
    },
    health: {
      nodeId: endpoint.id,
      latencyMs: null,
      packetLossPercent: 100,
      connected: false,
      tlsValid: false,
      lastPingAt: Date.now(),
      consecutiveFailures,
      source: 'fallback',
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────

/**
 * Returns deployment nodes (simulated or live, with safe fallbacks).
 */
export async function getDeploymentNodes(): Promise<DeploymentNode[]> {
  const mode = getDeploymentMode();

  if (mode === 'simulation') {
    return simulateNodes(6);
  }

  // LIVE — fetch all enabled endpoints, safe per-node fallback
  const endpoints = getLiveEndpoints().filter((e) => e.enabled);
  if (endpoints.length === 0) {
    // No endpoints configured → fallback to simulation with source flag
    const sim = simulateNodes(6);
    return sim.map((n) => ({ ...n, source: 'fallback' as const }));
  }

  const results = await Promise.allSettled(endpoints.map(fetchLiveNode));
  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value.node;
    // Should never reach here (fetchLiveNode never throws), but be safe
    return {
      id: endpoints[i].id,
      name: endpoints[i].label,
      endpoint: endpoints[i].url,
      region: 'UNKNOWN',
      version: '—',
      status: 'unreachable' as const,
      lastSeen: 0,
      syncStatus: 'unknown' as const,
      tenantId: endpoints[i].id,
      fleetCount: 0,
      activeVehicles: 0,
      healthScore: 0,
      uptime: 0,
      responseTimeMs: 0,
      source: 'fallback' as const,
    };
  });
}

/**
 * Returns dashboard status for all nodes.
 */
export async function getDashboardStatus(): Promise<DashboardStatus[]> {
  const mode = getDeploymentMode();
  if (mode === 'simulation') {
    const nodes = simulateNodes(6);
    return simulateDashboardStatuses(nodes);
  }
  const endpoints = getLiveEndpoints().filter((e) => e.enabled);
  if (endpoints.length === 0) {
    return simulateDashboardStatuses(simulateNodes(6)).map((s) => ({
      ...s, source: 'fallback' as const,
    }));
  }
  const results = await Promise.allSettled(endpoints.map(fetchLiveNode));
  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value.status;
    return {
      nodeId: endpoints[i].id,
      dashboardVersion: '—',
      isReachable: false,
      lastCheckAt: Date.now(),
      activeSessions: 0,
      cpuPercent: 0,
      memPercent: 0,
      diskPercent: 0,
      queueDepth: 0,
      errorRate: 1,
      source: 'fallback' as const,
    };
  });
}

/**
 * Returns fleet telemetry summaries for all nodes.
 */
export async function getFleetTelemetry(): Promise<FleetTelemetrySummary[]> {
  const mode = getDeploymentMode();
  if (mode === 'simulation') {
    const nodes = simulateNodes(6);
    return simulateFleetTelemetry(nodes);
  }
  const endpoints = getLiveEndpoints().filter((e) => e.enabled);
  if (endpoints.length === 0) {
    return simulateFleetTelemetry(simulateNodes(6)).map((t) => ({
      ...t, source: 'fallback' as const,
    }));
  }
  const results = await Promise.allSettled(endpoints.map(fetchLiveNode));
  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value.telemetry;
    return {
      nodeId: endpoints[i].id,
      eventsLast1h: 0,
      eventsLast24h: 0,
      activeRoutes: 0,
      completedRoutes: 0,
      alertCount: 0,
      avgResponseMs: 0,
      dataFreshnessMs: 99_999_999,
      source: 'fallback' as const,
    };
  });
}

/**
 * Returns connection health for all nodes.
 */
export async function getConnectionHealth(): Promise<ConnectionHealth[]> {
  const mode = getDeploymentMode();
  if (mode === 'simulation') {
    const nodes = simulateNodes(6);
    return simulateConnectionHealth(nodes);
  }
  const endpoints = getLiveEndpoints().filter((e) => e.enabled);
  if (endpoints.length === 0) {
    return simulateConnectionHealth(simulateNodes(6)).map((h) => ({
      ...h, source: 'fallback' as const,
    }));
  }
  const results = await Promise.allSettled(endpoints.map(fetchLiveNode));
  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value.health;
    return {
      nodeId: endpoints[i].id,
      latencyMs: null,
      packetLossPercent: 100,
      connected: false,
      tlsValid: false,
      lastPingAt: Date.now(),
      consecutiveFailures: 1,
      source: 'fallback' as const,
    };
  });
}

// ─────────────────────────────────────────────────────────────────
// SETTINGS ACCESSORS (read / write deployment mode via SSOT)
// ─────────────────────────────────────────────────────────────────

const DEPLOYMENT_MODE_KEY = 'apex_deployment_mode';
const LIVE_ENDPOINTS_KEY  = 'apex_live_endpoints';

export function getDeploymentMode(): DeploymentSourceMode {
  if (typeof localStorage === 'undefined') return 'simulation';
  return (localStorage.getItem(DEPLOYMENT_MODE_KEY) as DeploymentSourceMode) ?? 'simulation';
}

export function setDeploymentMode(mode: DeploymentSourceMode): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(DEPLOYMENT_MODE_KEY, mode);
  Storage.Audit.log({
    action: 'DEPLOYMENT_MODE_CHANGED',
    entityType: 'system',
    detail: `Switched to ${mode} mode`,
  });
}

export function getLiveEndpoints(): LiveEndpoint[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(LIVE_ENDPOINTS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveLiveEndpoints(endpoints: LiveEndpoint[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LIVE_ENDPOINTS_KEY, JSON.stringify(endpoints));
  Storage.Audit.log({
    action: 'LIVE_ENDPOINTS_UPDATED',
    entityType: 'system',
    detail: `${endpoints.length} endpoint(s) configured`,
  });
}
