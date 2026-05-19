/**
 * APEX COMMAND CENTER OS
 * lib/telemetry-engine.ts
 *
 * Local-first telemetry ingestion engine.
 * - Batched event processing (no constant streaming)
 * - Delta-sync support
 * - Offline reconciliation queue
 * - Signed payload simulation
 * - Memory-safe with configurable limits
 */

import { v4 as uuid } from 'uuid';
import Storage from '@/storage/storage';
import type { TelemetryEvent } from '@/types';

// ============================================================
// TYPES
// ============================================================

interface IngestBatch {
  batchId: string;
  tenantId: string;
  fleetId: string;
  events: Omit<TelemetryEvent, 'id' | 'batchId' | 'signature'>[];
  timestamp: number;
}

interface TelemetryEngineConfig {
  batchSize: number;
  flushIntervalMs: number;
  maxQueueDepth: number;
  retentionDays: number;
  signatureEnabled: boolean;
}

interface EngineStats {
  queueDepth: number;
  totalProcessed: number;
  totalDropped: number;
  lastFlushAt: number;
  isProcessing: boolean;
}

// ============================================================
// ENGINE STATE
// ============================================================

const DEFAULT_CONFIG: TelemetryEngineConfig = {
  batchSize: 50,
  flushIntervalMs: 15000,
  maxQueueDepth: 2000,
  retentionDays: 30,
  signatureEnabled: true,
};

let _config: TelemetryEngineConfig = { ...DEFAULT_CONFIG };
let _queue: TelemetryEvent[] = [];
let _flushTimer: ReturnType<typeof setInterval> | null = null;
let _stats: EngineStats = {
  queueDepth: 0,
  totalProcessed: 0,
  totalDropped: 0,
  lastFlushAt: 0,
  isProcessing: false,
};
let _listeners: Array<(event: TelemetryEvent) => void> = [];

// ============================================================
// SIGNATURE SIMULATION
// ============================================================

function signPayload(event: Omit<TelemetryEvent, 'signature'>): string {
  if (!_config.signatureEnabled) return 'unsigned';
  // Deterministic signature simulation (not cryptographic — for local use)
  const raw = `${event.tenantId}:${event.fleetId}:${event.timestamp}:${event.eventType}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return `sig_${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

// ============================================================
// INGEST SINGLE EVENT
// ============================================================

export function ingestEvent(
  raw: Omit<TelemetryEvent, 'id' | 'batchId' | 'signature' | 'processed'>
): void {
  if (_queue.length >= _config.maxQueueDepth) {
    _stats.totalDropped++;
    console.warn('[TelemetryEngine] Queue full — dropping event');
    return;
  }

  const event: TelemetryEvent = {
    ...raw,
    id: `tel_${uuid()}`,
    batchId: '',
    signature: '',
    processed: false,
  };
  event.signature = signPayload(event);

  _queue.push(event);
  _stats.queueDepth = _queue.length;

  // Notify live listeners (for real-time UI updates)
  _listeners.forEach((fn) => fn(event));

  // Auto-flush if batch is full
  if (_queue.length >= _config.batchSize) {
    void flushQueue();
  }
}

// ============================================================
// INGEST BATCH (from Fleet OS federation)
// ============================================================

export async function ingestBatch(batch: IngestBatch): Promise<{
  accepted: number;
  dropped: number;
  batchId: string;
}> {
  const batchId = batch.batchId || `batch_${uuid()}`;
  let accepted = 0;
  let dropped = 0;

  for (const raw of batch.events) {
    if (_queue.length >= _config.maxQueueDepth) {
      dropped++;
      _stats.totalDropped++;
      continue;
    }

    const event: TelemetryEvent = {
      ...raw,
      id: `tel_${uuid()}`,
      batchId,
      signature: '',
      processed: false,
      tenantId: batch.tenantId,
      fleetId: batch.fleetId,
    };
    event.signature = signPayload(event);
    _queue.push(event);
    accepted++;
    _listeners.forEach((fn) => fn(event));
  }

  _stats.queueDepth = _queue.length;

  if (_queue.length >= _config.batchSize) {
    await flushQueue();
  }

  return { accepted, dropped, batchId };
}

// ============================================================
// FLUSH QUEUE TO INDEXEDDB
// ============================================================

export async function flushQueue(): Promise<number> {
  if (_stats.isProcessing || _queue.length === 0) return 0;
  _stats.isProcessing = true;

  const batch = _queue.splice(0, _config.batchSize);
  _stats.queueDepth = _queue.length;

  try {
    await Storage.Telemetry.ingestBatch(batch);
    _stats.totalProcessed += batch.length;
    _stats.lastFlushAt = Date.now();

    // Log to infra metrics
    await Storage.Infra.save({
      id: `infra_${uuid()}`,
      tenantId: 'system',
      timestamp: Date.now(),
      storageUsedMB: 0,
      telemetryQueueDepth: _queue.length,
      processingLatencyMs: Date.now() - _stats.lastFlushAt,
      indexedDBSizeMB: 0,
      localStorageSizeKB: 0,
      activeFleets: 0,
      batchesProcessed: 1,
      droppedEvents: 0,
    });

    return batch.length;
  } catch (err) {
    console.error('[TelemetryEngine] Flush failed — re-queuing batch', err);
    _queue.unshift(...batch); // re-queue on failure
    return 0;
  } finally {
    _stats.isProcessing = false;
  }
}

// ============================================================
// DELTA SYNC RECONCILIATION
// ============================================================

export async function reconcileOfflineQueue(tenantId: string): Promise<{
  reconciled: number;
  snapshotId: string;
}> {
  const unprocessed = await Storage.Telemetry.getUnprocessed(500);
  const tenantUnprocessed = unprocessed.filter((e) => e.tenantId === tenantId);

  if (tenantUnprocessed.length === 0) {
    return { reconciled: 0, snapshotId: '' };
  }

  await Storage.Telemetry.markProcessed(tenantUnprocessed.map((e) => e.id));

  const snapshotId = `snap_${uuid()}`;
  await Storage.Sync.save({
    id: snapshotId,
    tenantId,
    snapshotAt: Date.now(),
    entityCounts: {
      telemetry_events: tenantUnprocessed.length,
    },
    deltaHash: `delta_${Date.now().toString(16)}`,
    reconciled: true,
    size: tenantUnprocessed.reduce((acc, e) => acc + (e.size || 0), 0),
  });

  return { reconciled: tenantUnprocessed.length, snapshotId };
}

// ============================================================
// PRUNING — RETENTION MANAGEMENT
// ============================================================

export async function pruneOldTelemetry(): Promise<number> {
  const cutoff = Date.now() - _config.retentionDays * 86400000;
  const pruned = await Storage.Telemetry.pruneOlderThan(cutoff);
  console.info(`[TelemetryEngine] Pruned ${pruned} events older than ${_config.retentionDays} days`);
  return pruned;
}

// ============================================================
// ENGINE LIFECYCLE
// ============================================================

export function startEngine(config?: Partial<TelemetryEngineConfig>): void {
  if (config) _config = { ..._config, ...config };
  if (_flushTimer) clearInterval(_flushTimer);

  _flushTimer = setInterval(() => {
    void flushQueue();
  }, _config.flushIntervalMs);

  console.info('[TelemetryEngine] Started — batch:', _config.batchSize, 'flush:', _config.flushIntervalMs + 'ms');
}

export function stopEngine(): void {
  if (_flushTimer) {
    clearInterval(_flushTimer);
    _flushTimer = null;
  }
  void flushQueue(); // final flush
  console.info('[TelemetryEngine] Stopped');
}

// ============================================================
// LIVE LISTENERS (for UI)
// ============================================================

export function subscribeTelemetry(fn: (event: TelemetryEvent) => void): () => void {
  _listeners.push(fn);
  return () => {
    _listeners = _listeners.filter((l) => l !== fn);
  };
}

// ============================================================
// STATS
// ============================================================

export function getEngineStats(): EngineStats & { config: TelemetryEngineConfig } {
  return { ..._stats, config: { ..._config } };
}

export function resetStats(): void {
  _stats = {
    queueDepth: 0,
    totalProcessed: 0,
    totalDropped: 0,
    lastFlushAt: 0,
    isProcessing: false,
  };
}

// ============================================================
// ANOMALY DETECTION — Simple threshold-based
// ============================================================

interface TelemetryAnomaly {
  type: 'queue_flood' | 'high_drop_rate' | 'stale_flush' | 'large_payload';
  severity: 'low' | 'medium' | 'high';
  message: string;
  value: number;
  threshold: number;
}

export function detectAnomalies(): TelemetryAnomaly[] {
  const anomalies: TelemetryAnomaly[] = [];
  const now = Date.now();

  if (_stats.queueDepth > _config.maxQueueDepth * 0.8) {
    anomalies.push({
      type: 'queue_flood',
      severity: 'high',
      message: 'Telemetry queue is 80%+ full',
      value: _stats.queueDepth,
      threshold: _config.maxQueueDepth * 0.8,
    });
  }

  const dropRate = _stats.totalDropped / Math.max(_stats.totalProcessed + _stats.totalDropped, 1);
  if (dropRate > 0.05) {
    anomalies.push({
      type: 'high_drop_rate',
      severity: dropRate > 0.15 ? 'high' : 'medium',
      message: `Drop rate ${(dropRate * 100).toFixed(1)}% exceeds threshold`,
      value: dropRate,
      threshold: 0.05,
    });
  }

  if (_stats.lastFlushAt > 0 && now - _stats.lastFlushAt > _config.flushIntervalMs * 3) {
    anomalies.push({
      type: 'stale_flush',
      severity: 'medium',
      message: 'Last flush was more than 3x interval ago',
      value: now - _stats.lastFlushAt,
      threshold: _config.flushIntervalMs * 3,
    });
  }

  return anomalies;
}
