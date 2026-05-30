/**
 * AP3X FEDERATION EVENT PROCESSOR
 *
 * LISTEN-ONLY realtime add-on for the Control OS.
 * Handles INSERT events on telemetry_events — the table that Driver PWA
 * events flow into via Fleet OS.
 *
 * DATA FLOW (locked — this file does not change it):
 *   Driver PWA → eventBus → Fleet OS → Supabase telemetry_events
 *                                          ↓  (realtime INSERT)
 *                                   Federation OS (this file)
 *                                          ↓
 *                              insights · fleet_metrics · store updates
 *
 * RULES:
 *   ✔ Listen-only — no writes that alter the original event record
 *   ✔ No schema changes — only reads telemetry_events, writes to
 *     fleet_entities (metrics update) and dashboard_events (insights)
 *     which are EXISTING tables already in the schema
 *   ✔ Non-blocking — processing is queued and async, never blocks realtime callback
 *   ✔ Dedup guard — processed event IDs tracked for 5 min to prevent double-processing
 *   ✔ Validation — malformed events are logged and rejected, not thrown
 *   ✔ No background timers or polling loops
 */

import { getSupabaseClient } from '@/lib/supabaseClient';
import type { TelemetryEvent } from '@/types/federation';

// ─────────────────────────────────────────────────────────────────
// Allowed values — mirrors apiAuth.ts (no imports to avoid circular)
// ─────────────────────────────────────────────────────────────────

const ALLOWED_EVENT_TYPES = new Set([
  'fleet_update', 'vehicle_event', 'route_complete',
  'ai_inference', 'api_call', 'error', 'alert',
  'deployment', 'heartbeat',
]);

const ALLOWED_SEVERITIES = new Set(['info', 'warning', 'critical']);

// ─────────────────────────────────────────────────────────────────
// Dedup guard — prevents double-processing if realtime fires twice
// TTL: 5 minutes per event ID
// ─────────────────────────────────────────────────────────────────

const DEDUP_TTL_MS = 5 * 60 * 1000;

interface DedupEntry { ts: number }
const processedIds = new Map<string, DedupEntry>();

function isDuplicate(id: string): boolean {
  const entry = processedIds.get(id);
  if (!entry) return false;
  if (Date.now() - entry.ts > DEDUP_TTL_MS) {
    processedIds.delete(id);
    return false;
  }
  return true;
}

function markProcessed(id: string): void {
  processedIds.set(id, { ts: Date.now() });
  // Prune old entries if map grows large (> 2000 entries)
  if (processedIds.size > 2000) {
    const cutoff = Date.now() - DEDUP_TTL_MS;
    for (const [k, v] of processedIds) {
      if (v.ts < cutoff) processedIds.delete(k);
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Async processing queue — non-blocking, sequential
// ─────────────────────────────────────────────────────────────────

type QueueItem = () => Promise<void>;
const queue: QueueItem[] = [];
let running = false;

async function drainQueue(): Promise<void> {
  if (running) return;
  running = true;
  while (queue.length > 0) {
    const item = queue.shift();
    if (item) {
      try {
        await item();
      } catch (e) {
        console.error('[FedEventProcessor] queue item error:', e);
      }
    }
  }
  running = false;
}

function enqueue(fn: QueueItem): void {
  // Cap queue at 500 to prevent unbounded growth during bursts
  if (queue.length >= 500) {
    console.warn('[FedEventProcessor] queue full (500), dropping oldest item');
    queue.shift();
  }
  queue.push(fn);
  void drainQueue();
}

// ─────────────────────────────────────────────────────────────────
// Event validation
// ─────────────────────────────────────────────────────────────────

function validateEvent(raw: unknown): TelemetryEvent | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    console.warn('[FedEventProcessor] rejected: event is not a plain object');
    return null;
  }

  const e = raw as Record<string, unknown>;

  if (typeof e.id !== 'string' || !e.id) {
    console.warn('[FedEventProcessor] rejected: missing id');
    return null;
  }
  if (typeof e.tenant_id !== 'string' || !e.tenant_id) {
    console.warn('[FedEventProcessor] rejected: missing tenant_id');
    return null;
  }
  if (typeof e.fleet_id !== 'string' || !e.fleet_id) {
    console.warn('[FedEventProcessor] rejected: missing fleet_id');
    return null;
  }

  // Coerce to known values (same logic as apiAuth.ts — belt and suspenders)
  const event_type = typeof e.event_type === 'string' && ALLOWED_EVENT_TYPES.has(e.event_type)
    ? e.event_type as TelemetryEvent['event_type']
    : 'fleet_update';

  const severity = typeof e.severity === 'string' && ALLOWED_SEVERITIES.has(e.severity)
    ? e.severity as TelemetryEvent['severity']
    : 'info';

  const payload = e.payload && typeof e.payload === 'object' && !Array.isArray(e.payload)
    ? (e.payload as Record<string, unknown>)
    : {};

  return {
    id:          e.id as string,
    batch_id:    (e.batch_id as string) ?? '',
    tenant_id:   e.tenant_id as string,
    fleet_id:    e.fleet_id as string,
    vehicle_id:  typeof e.vehicle_id === 'string' ? e.vehicle_id : null,
    driver_id:   typeof e.driver_id  === 'string' ? e.driver_id  : null,
    event_type,
    severity,
    payload,
    processed:   Boolean(e.processed),
    recorded_at: typeof e.recorded_at === 'string' ? e.recorded_at : new Date().toISOString(),
    created_at:  typeof e.created_at  === 'string' ? e.created_at  : new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────
// Insight generation — produces a dashboard_events record
// Only fires for warning/critical severity or specific event types
// ─────────────────────────────────────────────────────────────────

function shouldGenerateInsight(event: TelemetryEvent): boolean {
  if (event.severity === 'critical' || event.severity === 'warning') return true;
  if (event.event_type === 'error')  return true;
  if (event.event_type === 'alert')  return true;
  return false;
}

function buildInsightRecord(event: TelemetryEvent): Record<string, unknown> {
  const titleMap: Record<string, string> = {
    error:         `Fleet error detected`,
    alert:         `Fleet alert triggered`,
    vehicle_event: `Vehicle event: ${event.vehicle_id ?? 'unknown'}`,
    ai_inference:  `AI inference event`,
    deployment:    `Fleet deployment event`,
  };

  const title = titleMap[event.event_type] ?? `Fleet event: ${event.event_type}`;

  const description = [
    `Fleet: ${event.fleet_id}`,
    event.vehicle_id ? `Vehicle: ${event.vehicle_id}` : null,
    event.driver_id  ? `Driver: ${event.driver_id}`   : null,
    `Severity: ${event.severity}`,
  ].filter(Boolean).join(' · ');

  return {
    event_type:  mapToFeedEventType(event.event_type, event.severity),
    severity:    event.severity,
    title,
    description,
    entity_type: event.vehicle_id ? 'vehicle' : event.driver_id ? 'driver' : 'fleet',
    entity_id:   event.vehicle_id ?? event.driver_id ?? event.fleet_id,
    metadata: {
      source:      'federation_realtime',
      fleet_id:    event.fleet_id,
      tenant_id:   event.tenant_id,
      event_type:  event.event_type,
      batch_id:    event.batch_id,
      recorded_at: event.recorded_at,
      payload:     event.payload,
    },
  };
}

function mapToFeedEventType(eventType: string, severity: string): string {
  if (severity === 'critical') return 'fleet_node_alert';
  if (eventType === 'vehicle_event') return 'vehicle_alert';
  if (eventType === 'error' || eventType === 'alert') return 'system';
  return 'system';
}

// ─────────────────────────────────────────────────────────────────
// Fleet metrics update — updates fleet_entities last_heartbeat + status
// Only fires for heartbeat and fleet_update event types
// ─────────────────────────────────────────────────────────────────

function shouldUpdateFleetMetrics(event: TelemetryEvent): boolean {
  return event.event_type === 'heartbeat' || event.event_type === 'fleet_update';
}

function extractFleetMetricsPatch(
  event: TelemetryEvent
): Record<string, unknown> | null {
  const p = event.payload;

  // Only patch fields that are explicitly present in the payload
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let hasField = false;

  if (typeof p.vehicleCount   === 'number') { patch.vehicle_count   = Math.max(0, Math.round(p.vehicleCount));   hasField = true; }
  if (typeof p.activeVehicles === 'number') { patch.active_vehicles = Math.max(0, Math.round(p.activeVehicles)); hasField = true; }
  if (typeof p.driverCount    === 'number') { patch.driver_count    = Math.max(0, Math.round(p.driverCount));    hasField = true; }
  if (typeof p.activeDrivers  === 'number') { patch.active_drivers  = Math.max(0, Math.round(p.activeDrivers));  hasField = true; }
  if (typeof p.uptimePercent  === 'number') { patch.uptime_percent  = Math.min(100, Math.max(0, p.uptimePercent)); hasField = true; }
  if (typeof p.status === 'string' &&
    ['online','degraded','offline','maintenance'].includes(p.status)) {
    patch.status = p.status; hasField = true;
  }

  return hasField ? patch : null;
}

// ─────────────────────────────────────────────────────────────────
// Core event processor — runs inside the async queue
// ─────────────────────────────────────────────────────────────────

async function processEvent(event: TelemetryEvent): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    console.warn('[FedEventProcessor] processEvent: Supabase client unavailable');
    return;
  }

  console.log(
    `[FedEventProcessor] processing event id=${event.id}`,
    `type=${event.event_type} severity=${event.severity}`,
    `fleet=${event.fleet_id}`
  );

  const promises: Promise<unknown>[] = [];

  // ── 1. Fleet metrics update (heartbeat / fleet_update only) ──
  if (shouldUpdateFleetMetrics(event)) {
    const patch = extractFleetMetricsPatch(event);
    if (patch) {
      promises.push(
        Promise.resolve(
          client
            .from('fleet_entities')
            .update(patch)
            .eq('id', event.fleet_id)
        ).then(({ error }) => {
          if (error) console.warn('[FedEventProcessor] fleet_metrics update error:', error.message);
        })
      );
    }
  }

  // ── 2. Insight generation (warning/critical/error/alert only) ──
  if (shouldGenerateInsight(event)) {
    const insight = buildInsightRecord(event);
    promises.push(
      Promise.resolve(
        client
          .from('dashboard_events')
          .insert(insight)
      ).then(({ error }) => {
        if (error) console.warn('[FedEventProcessor] insight insert error:', error.message);
      })
    );
  }

  if (promises.length > 0) {
    await Promise.allSettled(promises);
  }
}

// ─────────────────────────────────────────────────────────────────
// Public entry point — called by realtime subscription callback
// ─────────────────────────────────────────────────────────────────

/**
 * Called from the realtime subscription on every INSERT to telemetry_events.
 * Returns immediately (non-blocking) — processing happens in the async queue.
 */
export function handleFederationEvent(raw: unknown): void {
  const event = validateEvent(raw);
  if (!event) return; // validation logged the reason

  if (isDuplicate(event.id)) {
    console.log(`[FedEventProcessor] dedup skip id=${event.id}`);
    return;
  }

  markProcessed(event.id);

  // Enqueue for non-blocking async processing
  enqueue(() => processEvent(event));
}
