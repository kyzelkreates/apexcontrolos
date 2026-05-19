/**
 * APEX COMMAND CENTER OS
 * storage/storage.js — SINGLE SOURCE OF TRUTH
 *
 * All persistence is controlled through this module.
 * NO other file should write directly to IndexedDB or localStorage.
 *
 * Architecture:
 * - IndexedDB (via Dexie.js): large datasets, telemetry, metrics, logs
 * - localStorage: config, dashboard state, lightweight settings
 *
 * Future-backend-ready: all methods are async and use clean adapters.
 * To migrate to a backend, swap the adapter implementations only.
 */

// ============================================================
// CONSTANTS
// ============================================================

const DB_NAME = 'ApexCommandCenterDB';
const DB_VERSION = 1;
const LS_PREFIX = 'apex_cc_';

// ============================================================
// INDEXEDDB — STORE NAMES
// ============================================================

export const STORES = {
  TENANTS: 'tenants',
  FLEET_ENTITIES: 'fleet_entities',
  TELEMETRY_EVENTS: 'telemetry_events',
  AI_METRICS: 'ai_metrics',
  API_USAGE_LOGS: 'api_usage_logs',
  ROUTE_METRICS: 'route_metrics',
  OPERATIONAL_METRICS: 'operational_metrics',
  DEPLOYMENT_LOGS: 'deployment_logs',
  SYNC_SNAPSHOTS: 'sync_snapshots',
  FINANCIAL_EVENTS: 'financial_events',
  EXPORT_JOBS: 'export_jobs',
  INFRASTRUCTURE_METRICS: 'infrastructure_metrics',
  PAIRING_REGISTRATIONS: 'pairing_registrations',
};

// ============================================================
// INDEXEDDB INITIALISER
// ============================================================

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      // SSR guard — return null-safe stub
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Tenants
      if (!db.objectStoreNames.contains(STORES.TENANTS)) {
        const ts = db.createObjectStore(STORES.TENANTS, { keyPath: 'id' });
        ts.createIndex('status', 'status');
        ts.createIndex('region', 'region');
        ts.createIndex('slug', 'slug', { unique: true });
      }

      // Fleet Entities
      if (!db.objectStoreNames.contains(STORES.FLEET_ENTITIES)) {
        const fe = db.createObjectStore(STORES.FLEET_ENTITIES, { keyPath: 'id' });
        fe.createIndex('tenantId', 'tenantId');
        fe.createIndex('status', 'status');
        fe.createIndex('region', 'region');
      }

      // Telemetry Events
      if (!db.objectStoreNames.contains(STORES.TELEMETRY_EVENTS)) {
        const te = db.createObjectStore(STORES.TELEMETRY_EVENTS, { keyPath: 'id' });
        te.createIndex('tenantId', 'tenantId');
        te.createIndex('fleetId', 'fleetId');
        te.createIndex('timestamp', 'timestamp');
        te.createIndex('eventType', 'eventType');
        te.createIndex('processed', 'processed');
        te.createIndex('batchId', 'batchId');
      }

      // AI Metrics
      if (!db.objectStoreNames.contains(STORES.AI_METRICS)) {
        const am = db.createObjectStore(STORES.AI_METRICS, { keyPath: 'id' });
        am.createIndex('tenantId', 'tenantId');
        am.createIndex('fleetId', 'fleetId');
        am.createIndex('provider', 'provider');
        am.createIndex('timestamp', 'timestamp');
        am.createIndex('inferenceSource', 'inferenceSource');
      }

      // API Usage Logs
      if (!db.objectStoreNames.contains(STORES.API_USAGE_LOGS)) {
        const al = db.createObjectStore(STORES.API_USAGE_LOGS, { keyPath: 'id' });
        al.createIndex('tenantId', 'tenantId');
        al.createIndex('fleetId', 'fleetId');
        al.createIndex('timestamp', 'timestamp');
        al.createIndex('category', 'category');
        al.createIndex('service', 'service');
      }

      // Route Metrics
      if (!db.objectStoreNames.contains(STORES.ROUTE_METRICS)) {
        const rm = db.createObjectStore(STORES.ROUTE_METRICS, { keyPath: 'id' });
        rm.createIndex('tenantId', 'tenantId');
        rm.createIndex('fleetId', 'fleetId');
        rm.createIndex('completedAt', 'completedAt');
      }

      // Operational Metrics
      if (!db.objectStoreNames.contains(STORES.OPERATIONAL_METRICS)) {
        const om = db.createObjectStore(STORES.OPERATIONAL_METRICS, { keyPath: 'id' });
        om.createIndex('tenantId', 'tenantId');
        om.createIndex('fleetId', 'fleetId');
        om.createIndex('timestamp', 'timestamp');
      }

      // Deployment Logs
      if (!db.objectStoreNames.contains(STORES.DEPLOYMENT_LOGS)) {
        const dl = db.createObjectStore(STORES.DEPLOYMENT_LOGS, { keyPath: 'id' });
        dl.createIndex('tenantId', 'tenantId');
        dl.createIndex('fleetId', 'fleetId');
        dl.createIndex('status', 'status');
        dl.createIndex('deployedAt', 'deployedAt');
      }

      // Sync Snapshots
      if (!db.objectStoreNames.contains(STORES.SYNC_SNAPSHOTS)) {
        const ss = db.createObjectStore(STORES.SYNC_SNAPSHOTS, { keyPath: 'id' });
        ss.createIndex('tenantId', 'tenantId');
        ss.createIndex('snapshotAt', 'snapshotAt');
      }

      // Financial Events
      if (!db.objectStoreNames.contains(STORES.FINANCIAL_EVENTS)) {
        const fev = db.createObjectStore(STORES.FINANCIAL_EVENTS, { keyPath: 'id' });
        fev.createIndex('tenantId', 'tenantId');
        fev.createIndex('timestamp', 'timestamp');
        fev.createIndex('category', 'category');
      }

      // Export Jobs
      if (!db.objectStoreNames.contains(STORES.EXPORT_JOBS)) {
        const ej = db.createObjectStore(STORES.EXPORT_JOBS, { keyPath: 'id' });
        ej.createIndex('status', 'status');
        ej.createIndex('createdAt', 'createdAt');
      }

      // Infrastructure Metrics
      if (!db.objectStoreNames.contains(STORES.INFRASTRUCTURE_METRICS)) {
        const im = db.createObjectStore(STORES.INFRASTRUCTURE_METRICS, { keyPath: 'id' });
        im.createIndex('tenantId', 'tenantId');
        im.createIndex('timestamp', 'timestamp');
      }

      // Pairing Registrations
      if (!db.objectStoreNames.contains(STORES.PAIRING_REGISTRATIONS)) {
        const pr = db.createObjectStore(STORES.PAIRING_REGISTRATIONS, { keyPath: 'id' });
        pr.createIndex('code', 'code', { unique: true });
        pr.createIndex('status', 'status');
        pr.createIndex('tenantId', 'tenantId');
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });

  return _dbPromise;
}

// ============================================================
// INDEXEDDB — GENERIC CRUD ADAPTER
// ============================================================

async function idbGet(storeName, id) {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetAll(storeName, { index, value, limit, offset } = {}) {
  const db = await openDB();
  if (!db) return [];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const source = index ? store.index(index) : store;
    const range = value !== undefined ? IDBKeyRange.only(value) : null;
    const results = [];
    let skipped = 0;
    const req = source.openCursor(range);
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) { resolve(results); return; }
      if (offset && skipped < offset) { skipped++; cursor.continue(); return; }
      if (limit && results.length >= limit) { resolve(results); return; }
      results.push(cursor.value);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(storeName, record) {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

async function idbPutBatch(storeName, records) {
  const db = await openDB();
  if (!db) return [];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    records.forEach((r) => store.put(r));
    tx.oncomplete = () => resolve(records);
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(storeName, id) {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

async function idbCount(storeName, { index, value } = {}) {
  const db = await openDB();
  if (!db) return 0;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const source = index ? store.index(index) : store;
    const range = value !== undefined ? IDBKeyRange.only(value) : null;
    const req = source.count(range);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetByRange(storeName, indexName, lower, upper) {
  const db = await openDB();
  if (!db) return [];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const range = IDBKeyRange.bound(lower, upper);
    const results = [];
    const req = tx.objectStore(storeName).index(indexName).openCursor(range);
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) { resolve(results); return; }
      results.push(cursor.value);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

// ============================================================
// LOCALSTORAGE ADAPTER
// ============================================================

function lsGet(key) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const val = localStorage.getItem(LS_PREFIX + key);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}

function lsSet(key, value) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.warn('[ApexStorage] localStorage write failed:', e);
  }
}

function lsRemove(key) {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(LS_PREFIX + key);
}

// ============================================================
// TENANT STORE
// ============================================================

export const TenantStore = {
  async getAll() { return idbGetAll(STORES.TENANTS); },
  async get(id) { return idbGet(STORES.TENANTS, id); },
  async save(tenant) { return idbPut(STORES.TENANTS, { ...tenant, updatedAt: Date.now() }); },
  async delete(id) { return idbDelete(STORES.TENANTS, id); },
  async getByStatus(status) { return idbGetAll(STORES.TENANTS, { index: 'status', value: status }); },
  async getByRegion(region) { return idbGetAll(STORES.TENANTS, { index: 'region', value: region }); },
  async count() { return idbCount(STORES.TENANTS); },
  async countByStatus(status) { return idbCount(STORES.TENANTS, { index: 'status', value: status }); },
};

// ============================================================
// FLEET ENTITY STORE
// ============================================================

export const FleetStore = {
  async getAll() { return idbGetAll(STORES.FLEET_ENTITIES); },
  async get(id) { return idbGet(STORES.FLEET_ENTITIES, id); },
  async save(fleet) { return idbPut(STORES.FLEET_ENTITIES, { ...fleet, updatedAt: Date.now() }); },
  async delete(id) { return idbDelete(STORES.FLEET_ENTITIES, id); },
  async getByTenant(tenantId) { return idbGetAll(STORES.FLEET_ENTITIES, { index: 'tenantId', value: tenantId }); },
  async getByStatus(status) { return idbGetAll(STORES.FLEET_ENTITIES, { index: 'status', value: status }); },
  async count() { return idbCount(STORES.FLEET_ENTITIES); },
  async countByTenant(tenantId) { return idbCount(STORES.FLEET_ENTITIES, { index: 'tenantId', value: tenantId }); },
};

// ============================================================
// TELEMETRY STORE
// ============================================================

export const TelemetryStore = {
  async ingestBatch(events) { return idbPutBatch(STORES.TELEMETRY_EVENTS, events); },
  async getUnprocessed(limit = 100) {
    const all = await idbGetAll(STORES.TELEMETRY_EVENTS, { index: 'processed', value: false, limit });
    return all;
  },
  async getByTenant(tenantId, limit = 500) {
    return idbGetAll(STORES.TELEMETRY_EVENTS, { index: 'tenantId', value: tenantId, limit });
  },
  async getByFleet(fleetId, limit = 200) {
    return idbGetAll(STORES.TELEMETRY_EVENTS, { index: 'fleetId', value: fleetId, limit });
  },
  async getByTimeRange(from, to) {
    return idbGetByRange(STORES.TELEMETRY_EVENTS, 'timestamp', from, to);
  },
  async markProcessed(ids) {
    const db = await openDB();
    if (!db) return;
    const tx = db.transaction(STORES.TELEMETRY_EVENTS, 'readwrite');
    const store = tx.objectStore(STORES.TELEMETRY_EVENTS);
    for (const id of ids) {
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result) store.put({ ...req.result, processed: true });
      };
    }
    return new Promise((res) => { tx.oncomplete = res; });
  },
  async pruneOlderThan(timestamp) {
    const old = await idbGetByRange(STORES.TELEMETRY_EVENTS, 'timestamp', 0, timestamp);
    const db = await openDB();
    if (!db || !old.length) return 0;
    const tx = db.transaction(STORES.TELEMETRY_EVENTS, 'readwrite');
    const store = tx.objectStore(STORES.TELEMETRY_EVENTS);
    old.forEach((e) => store.delete(e.id));
    return new Promise((res) => { tx.oncomplete = () => res(old.length); });
  },
  async count() { return idbCount(STORES.TELEMETRY_EVENTS); },
  async countByTenant(tenantId) { return idbCount(STORES.TELEMETRY_EVENTS, { index: 'tenantId', value: tenantId }); },
};

// ============================================================
// AI METRICS STORE
// ============================================================

export const AIMetricsStore = {
  async save(metric) { return idbPut(STORES.AI_METRICS, metric); },
  async saveBatch(metrics) { return idbPutBatch(STORES.AI_METRICS, metrics); },
  async getByTenant(tenantId, limit = 500) {
    return idbGetAll(STORES.AI_METRICS, { index: 'tenantId', value: tenantId, limit });
  },
  async getByProvider(provider, limit = 200) {
    return idbGetAll(STORES.AI_METRICS, { index: 'provider', value: provider, limit });
  },
  async getByTimeRange(from, to) {
    return idbGetByRange(STORES.AI_METRICS, 'timestamp', from, to);
  },
  async count() { return idbCount(STORES.AI_METRICS); },
};

// ============================================================
// API USAGE STORE
// ============================================================

export const APIUsageStore = {
  async save(log) { return idbPut(STORES.API_USAGE_LOGS, log); },
  async saveBatch(logs) { return idbPutBatch(STORES.API_USAGE_LOGS, logs); },
  async getByTenant(tenantId, limit = 500) {
    return idbGetAll(STORES.API_USAGE_LOGS, { index: 'tenantId', value: tenantId, limit });
  },
  async getByCategory(category, limit = 200) {
    return idbGetAll(STORES.API_USAGE_LOGS, { index: 'category', value: category, limit });
  },
  async getByTimeRange(from, to) {
    return idbGetByRange(STORES.API_USAGE_LOGS, 'timestamp', from, to);
  },
  async count() { return idbCount(STORES.API_USAGE_LOGS); },
};

// ============================================================
// ROUTE METRICS STORE
// ============================================================

export const RouteMetricsStore = {
  async save(metric) { return idbPut(STORES.ROUTE_METRICS, metric); },
  async saveBatch(metrics) { return idbPutBatch(STORES.ROUTE_METRICS, metrics); },
  async getByTenant(tenantId, limit = 500) {
    return idbGetAll(STORES.ROUTE_METRICS, { index: 'tenantId', value: tenantId, limit });
  },
  async getByFleet(fleetId, limit = 200) {
    return idbGetAll(STORES.ROUTE_METRICS, { index: 'fleetId', value: fleetId, limit });
  },
  async getByTimeRange(from, to) {
    return idbGetByRange(STORES.ROUTE_METRICS, 'completedAt', from, to);
  },
  async count() { return idbCount(STORES.ROUTE_METRICS); },
};

// ============================================================
// OPERATIONAL METRICS STORE
// ============================================================

export const OperationalStore = {
  async save(metric) { return idbPut(STORES.OPERATIONAL_METRICS, metric); },
  async getByTenant(tenantId, limit = 200) {
    return idbGetAll(STORES.OPERATIONAL_METRICS, { index: 'tenantId', value: tenantId, limit });
  },
  async getByTimeRange(from, to) {
    return idbGetByRange(STORES.OPERATIONAL_METRICS, 'timestamp', from, to);
  },
  async count() { return idbCount(STORES.OPERATIONAL_METRICS); },
};

// ============================================================
// DEPLOYMENT STORE
// ============================================================

export const DeploymentStore = {
  async save(log) { return idbPut(STORES.DEPLOYMENT_LOGS, log); },
  async getAll(limit = 100) { return idbGetAll(STORES.DEPLOYMENT_LOGS, { limit }); },
  async getByTenant(tenantId, limit = 50) {
    return idbGetAll(STORES.DEPLOYMENT_LOGS, { index: 'tenantId', value: tenantId, limit });
  },
  async getByStatus(status) {
    return idbGetAll(STORES.DEPLOYMENT_LOGS, { index: 'status', value: status });
  },
  async count() { return idbCount(STORES.DEPLOYMENT_LOGS); },
};

// ============================================================
// FINANCIAL STORE
// ============================================================

export const FinancialStore = {
  async save(event) { return idbPut(STORES.FINANCIAL_EVENTS, event); },
  async saveBatch(events) { return idbPutBatch(STORES.FINANCIAL_EVENTS, events); },
  async getByTenant(tenantId, limit = 500) {
    return idbGetAll(STORES.FINANCIAL_EVENTS, { index: 'tenantId', value: tenantId, limit });
  },
  async getByCategory(category, limit = 200) {
    return idbGetAll(STORES.FINANCIAL_EVENTS, { index: 'category', value: category, limit });
  },
  async getByTimeRange(from, to) {
    return idbGetByRange(STORES.FINANCIAL_EVENTS, 'timestamp', from, to);
  },
  async count() { return idbCount(STORES.FINANCIAL_EVENTS); },
};

// ============================================================
// PAIRING STORE
// ============================================================

export const PairingStore = {
  async save(reg) { return idbPut(STORES.PAIRING_REGISTRATIONS, reg); },
  async get(id) { return idbGet(STORES.PAIRING_REGISTRATIONS, id); },
  async getByCode(code) {
    const all = await idbGetAll(STORES.PAIRING_REGISTRATIONS, { index: 'code', value: code });
    return all[0] || null;
  },
  async getByStatus(status) {
    return idbGetAll(STORES.PAIRING_REGISTRATIONS, { index: 'status', value: status });
  },
  async getByTenant(tenantId) {
    return idbGetAll(STORES.PAIRING_REGISTRATIONS, { index: 'tenantId', value: tenantId });
  },
  async delete(id) { return idbDelete(STORES.PAIRING_REGISTRATIONS, id); },
};

// ============================================================
// SYNC SNAPSHOT STORE
// ============================================================

export const SyncStore = {
  async save(snapshot) { return idbPut(STORES.SYNC_SNAPSHOTS, snapshot); },
  async getLatestByTenant(tenantId) {
    const all = await idbGetAll(STORES.SYNC_SNAPSHOTS, { index: 'tenantId', value: tenantId });
    return all.sort((a, b) => b.snapshotAt - a.snapshotAt)[0] || null;
  },
  async count() { return idbCount(STORES.SYNC_SNAPSHOTS); },
};

// ============================================================
// INFRASTRUCTURE METRICS STORE
// ============================================================

export const InfraStore = {
  async save(metric) { return idbPut(STORES.INFRASTRUCTURE_METRICS, metric); },
  async getRecent(limit = 100) {
    const all = await idbGetAll(STORES.INFRASTRUCTURE_METRICS, { limit });
    return all.sort((a, b) => b.timestamp - a.timestamp);
  },
  async getByTimeRange(from, to) {
    return idbGetByRange(STORES.INFRASTRUCTURE_METRICS, 'timestamp', from, to);
  },
};

// ============================================================
// EXPORT JOB STORE
// ============================================================

export const ExportStore = {
  async save(job) { return idbPut(STORES.EXPORT_JOBS, job); },
  async get(id) { return idbGet(STORES.EXPORT_JOBS, id); },
  async getAll(limit = 50) {
    const all = await idbGetAll(STORES.EXPORT_JOBS, { limit });
    return all.sort((a, b) => b.createdAt - a.createdAt);
  },
  async getByStatus(status) {
    return idbGetAll(STORES.EXPORT_JOBS, { index: 'status', value: status });
  },
  async count() { return idbCount(STORES.EXPORT_JOBS); },
};

// ============================================================
// LOCALSTORAGE — DASHBOARD STATE
// ============================================================

export const DashboardStateStore = {
  get() {
    return lsGet('dashboard_state') || {
      selectedTenantId: null,
      selectedFleetId: null,
      activeModule: 'overview',
      sidebarCollapsed: false,
      dateRange: { from: Date.now() - 86400000 * 7, to: Date.now() },
      refreshInterval: 30000,
      theme: 'dark',
      alertsVisible: true,
      mapCenter: { lat: 51.5074, lng: -0.1278, zoom: 3 },
    };
  },
  set(state) { lsSet('dashboard_state', state); },
  patch(partial) {
    const current = DashboardStateStore.get();
    DashboardStateStore.set({ ...current, ...partial });
  },
};

// ============================================================
// LOCALSTORAGE — SYSTEM CONFIG
// ============================================================

export const ConfigStore = {
  get() {
    return lsGet('system_config') || {
      masterOwnerId: null,
      systemName: 'Apex Command Center OS',
      version: '1.0.0',
      telemetryBatchSize: 50,
      telemetryFlushIntervalMs: 15000,
      maxLocalTelemetryEvents: 50000,
      telemetryRetentionDays: 30,
      encryptionEnabled: false,
      auditLogEnabled: true,
      backendMigrationReady: false,
    };
  },
  set(config) { lsSet('system_config', config); },
  patch(partial) {
    const current = ConfigStore.get();
    ConfigStore.set({ ...current, ...partial });
  },
};

// ============================================================
// LOCALSTORAGE — ALERTS
// ============================================================

export const AlertStore = {
  getAll() { return lsGet('alerts') || []; },
  add(alert) {
    const alerts = AlertStore.getAll();
    alerts.unshift({ ...alert, id: alert.id || `alert_${Date.now()}`, createdAt: Date.now() });
    lsSet('alerts', alerts.slice(0, 200)); // max 200 alerts
  },
  dismiss(id) {
    const alerts = AlertStore.getAll().filter((a) => a.id !== id);
    lsSet('alerts', alerts);
  },
  clearAll() { lsSet('alerts', []); },
};

// ============================================================
// LOCALSTORAGE — AUDIT LOG
// ============================================================

export const AuditStore = {
  log(entry) {
    const logs = lsGet('audit_log') || [];
    logs.unshift({ ...entry, id: `audit_${Date.now()}`, timestamp: Date.now() });
    lsSet('audit_log', logs.slice(0, 1000)); // max 1000 entries in LS
  },
  getAll() { return lsGet('audit_log') || []; },
  getByEntity(entityType) {
    return (lsGet('audit_log') || []).filter((l) => l.entityType === entityType);
  },
};

// ============================================================
// STORAGE HEALTH CHECK
// ============================================================

export const StorageHealth = {
  async check() {
    const db = await openDB();
    const results = {
      indexedDB: !!db,
      localStorage: typeof localStorage !== 'undefined',
      stores: {},
    };
    if (db) {
      for (const store of Object.values(STORES)) {
        try {
          const count = await idbCount(store);
          results.stores[store] = { ok: true, count };
        } catch (e) {
          results.stores[store] = { ok: false, error: e.message };
        }
      }
    }
    return results;
  },
  async getStorageSizeEstimate() {
    if (navigator?.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        usedMB: (estimate.usage / 1024 / 1024).toFixed(2),
        quotaMB: (estimate.quota / 1024 / 1024).toFixed(2),
        percentUsed: ((estimate.usage / estimate.quota) * 100).toFixed(1),
      };
    }
    return null;
  },
};

// ============================================================
// GLOBAL STORAGE NAMESPACE (convenience export)
// ============================================================

const Storage = {
  Tenants: TenantStore,
  Fleets: FleetStore,
  Telemetry: TelemetryStore,
  AIMetrics: AIMetricsStore,
  APIUsage: APIUsageStore,
  Routes: RouteMetricsStore,
  Operations: OperationalStore,
  Deployments: DeploymentStore,
  Financial: FinancialStore,
  Pairing: PairingStore,
  Sync: SyncStore,
  Infra: InfraStore,
  Exports: ExportStore,
  Dashboard: DashboardStateStore,
  Config: ConfigStore,
  Alerts: AlertStore,
  Audit: AuditStore,
  Health: StorageHealth,
};

export default Storage;
