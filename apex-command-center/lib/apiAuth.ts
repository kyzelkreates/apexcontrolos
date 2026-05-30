/**
 * AP3X API AUTHENTICATION + REQUEST VALIDATION
 *
 * Used by ALL incoming Fleet Control OS API routes.
 * Single source of auth + validation logic — no duplicates in route files.
 *
 * Fleet Control OS must send:
 *   X-Tenant-Id  — UUID
 *   X-Fleet-Id   — UUID
 *   X-Apex-Key   — pairing token (pt_...)
 *
 * AUTH RULES:
 *   ✔ All three headers required
 *   ✔ Fleet must exist, belong to the declared tenant, token must match
 *   ✔ Tenant must not be suspended
 *   ✔ Fleet must not be explicitly offline
 *
 * EVENT VALIDATION:
 *   ✔ validateTelemetryEvent — strict field + enum checks
 *   ✔ validateHeartbeatBody  — range clamping + shape guards
 *   ✔ validateRouteBody      — required fields + numeric sanity
 *   ✔ validateCoordinates    — lat/lng range check
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────
// Auth result
// ─────────────────────────────────────────────────────────────────

export type AuthResult =
  | { ok: true;  tenantId: string; fleetId: string }
  | { ok: false; error: string;    status: number  };

// ─────────────────────────────────────────────────────────────────
// Allowed enum values (mirrors the DB + Driver PWA contract)
// ─────────────────────────────────────────────────────────────────

export const ALLOWED_EVENT_TYPES = new Set([
  'fleet_update', 'vehicle_event', 'route_complete',
  'ai_inference', 'api_call', 'error', 'alert',
  'deployment', 'heartbeat',
]);

export const ALLOWED_SEVERITIES = new Set([
  'info', 'warning', 'critical',
]);

// UUID v4 loose pattern — catches obviously malformed values
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUUID(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

function clamp(val: unknown, min: number, max: number, fallback: number): number {
  const n = Number(val);
  if (!isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

// ─────────────────────────────────────────────────────────────────
// Fleet request authentication
// ─────────────────────────────────────────────────────────────────

export async function authenticateFleetRequest(
  req: Request,
  supabase: SupabaseClient
): Promise<AuthResult> {
  const tenantId = req.headers.get('x-tenant-id')?.trim();
  const fleetId  = req.headers.get('x-fleet-id')?.trim();
  const apexKey  = req.headers.get('x-apex-key')?.trim();

  // 1. Header presence
  if (!tenantId || !fleetId || !apexKey) {
    return { ok: false, error: 'Missing required headers: X-Tenant-Id, X-Fleet-Id, X-Apex-Key', status: 401 };
  }

  // 2. Basic format guard — reject obviously malformed values early
  if (!isUUID(tenantId) || !isUUID(fleetId)) {
    return { ok: false, error: 'Malformed X-Tenant-Id or X-Fleet-Id (expected UUID)', status: 400 };
  }

  try {
    // 3. Fetch fleet + tenant status in a single join-like query
    const { data: fleet, error: fleetErr } = await supabase
      .from('fleet_entities')
      .select('id, tenant_id, pairing_token, status')
      .eq('id', fleetId)
      .eq('tenant_id', tenantId)
      .single();

    if (fleetErr || !fleet) {
      return { ok: false, error: 'Fleet not found or tenant mismatch', status: 401 };
    }

    // 4. Token check
    if (fleet.pairing_token !== apexKey) {
      return { ok: false, error: 'Invalid pairing token', status: 403 };
    }

    // 5. Fleet status — offline means revoked federation
    if (fleet.status === 'offline') {
      return { ok: false, error: 'Fleet is offline — federation may have been revoked', status: 403 };
    }

    // 6. Tenant status — suspended means no data accepted
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('status')
      .eq('id', tenantId)
      .single();

    if (!tenantErr && tenant?.status === 'suspended') {
      return { ok: false, error: 'Tenant is suspended — contact AP3X Control OS admin', status: 403 };
    }

    return { ok: true, tenantId, fleetId };
  } catch (e) {
    console.error('[apiAuth] authenticateFleetRequest exception:', e);
    return { ok: false, error: 'Authentication check failed', status: 500 };
  }
}

// ─────────────────────────────────────────────────────────────────
// Telemetry event validation
// ─────────────────────────────────────────────────────────────────

export interface ValidatedTelemetryEvent {
  id:          string;
  batch_id:    string;
  tenant_id:   string;
  fleet_id:    string;
  vehicle_id:  string | null;
  driver_id:   string | null;
  event_type:  string;
  severity:    string;
  payload:     Record<string, unknown>;
  processed:   false;
  recorded_at: string;
  created_at:  string;
}

export function validateAndNormaliseTelemetryEvent(
  raw: unknown,
  opts: { tenantId: string; fleetId: string; batchId: string; now: string }
): { ok: true; row: ValidatedTelemetryEvent } | { ok: false; reason: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, reason: 'Event is not an object' };
  }

  const e = raw as Record<string, unknown>;

  // event_type — must be in allowed set or default to 'fleet_update'
  const rawType = typeof e.eventType === 'string' ? e.eventType.trim().toLowerCase() : '';
  const eventType = ALLOWED_EVENT_TYPES.has(rawType) ? rawType : 'fleet_update';

  // severity — must be in allowed set or default to 'info'
  const rawSev = typeof e.severity === 'string' ? e.severity.trim().toLowerCase() : '';
  const severity = ALLOWED_SEVERITIES.has(rawSev) ? rawSev : 'info';

  // payload — must be a plain object (not array, not null)
  let payload: Record<string, unknown> = {};
  if (e.payload && typeof e.payload === 'object' && !Array.isArray(e.payload)) {
    payload = e.payload as Record<string, unknown>;
  }

  // timestamp — must be a parseable numeric millisecond epoch
  let recorded_at = opts.now;
  if (e.timestamp !== undefined && e.timestamp !== null) {
    const ts = Number(e.timestamp);
    if (isFinite(ts) && ts > 0) {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) recorded_at = d.toISOString();
    }
  }

  // vehicle_id / driver_id — optional UUIDs
  const vehicle_id = isUUID(e.vehicleId) ? (e.vehicleId as string) : null;
  const driver_id  = isUUID(e.driverId)  ? (e.driverId  as string) : null;

  // id — prefer provided UUID, otherwise generate
  const id = isUUID(e.id) ? (e.id as string) : crypto.randomUUID();

  return {
    ok: true,
    row: {
      id,
      batch_id:   opts.batchId,
      tenant_id:  opts.tenantId,
      fleet_id:   opts.fleetId,
      vehicle_id,
      driver_id,
      event_type: eventType,
      severity,
      payload,
      processed:  false,
      recorded_at,
      created_at: opts.now,
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// Heartbeat body validation + normalisation
// ─────────────────────────────────────────────────────────────────

export interface ValidatedHeartbeatFields {
  vehicle_count:   number;
  active_vehicles: number;
  driver_count:    number;
  active_drivers:  number;
  uptime_percent:  number;
  version:         string | null;
  coordinates:     { lat: number; lng: number } | null;
}

export function validateHeartbeatBody(body: Record<string, unknown>): ValidatedHeartbeatFields {
  const vehicle_count   = clamp(body.vehicleCount,   0, 100_000, 0);
  const active_vehicles = clamp(body.activeVehicles, 0, vehicle_count || 100_000, 0);
  const driver_count    = clamp(body.driverCount,    0, 100_000, 0);
  const active_drivers  = clamp(body.activeDrivers,  0, driver_count || 100_000, 0);
  const uptime_percent  = clamp(body.uptimePercent,  0, 100, 100);

  const version = typeof body.version === 'string' && body.version.trim()
    ? body.version.trim().slice(0, 64)
    : null;

  const coordinates = validateCoordinates(body.coordinates);

  return { vehicle_count, active_vehicles, driver_count, active_drivers, uptime_percent, version, coordinates };
}

// ─────────────────────────────────────────────────────────────────
// Route-complete body validation
// ─────────────────────────────────────────────────────────────────

export interface ValidatedRouteFields {
  vehicle_id:                   string;
  driver_id:                    string;
  route_id:                     string;
  distance_km:                  number;
  duration_min:                 number;
  fuel_saved_l:                 number;
  co2_saved_kg:                 number;
  fuel_cost_saved_usd:          number;
  optimisation_saving_percent:  number;
  ai_optimised:                 boolean;
  on_time_delivery:             boolean;
  stops:                        number;
}

export function validateRouteBody(
  body: Record<string, unknown>
): { ok: true; fields: ValidatedRouteFields } | { ok: false; reason: string } {
  // vehicleId + driverId are required non-empty strings (UUIDs preferred but not enforced)
  const vehicle_id = typeof body.vehicleId === 'string' ? body.vehicleId.trim() : '';
  const driver_id  = typeof body.driverId  === 'string' ? body.driverId.trim()  : '';

  if (!vehicle_id) return { ok: false, reason: 'Missing required field: vehicleId' };
  if (!driver_id)  return { ok: false, reason: 'Missing required field: driverId' };

  const route_id = typeof body.routeId === 'string' && body.routeId.trim()
    ? body.routeId.trim()
    : crypto.randomUUID();

  const distance_km   = clamp(body.distanceKm,  0, 100_000, 0);
  const duration_min  = clamp(body.durationMin, 0, 100_000, 0);
  const fuel_saved_l  = clamp(body.fuelSavedL,  0, 100_000, 0);

  // Derived values — use provided or compute
  const co2_saved_kg        = Number(body.co2SavedKg)        > 0
    ? clamp(body.co2SavedKg, 0, 1_000_000, 0)
    : parseFloat((fuel_saved_l * 2.68).toFixed(4));

  const fuel_cost_saved_usd = Number(body.fuelCostSavedUSD) > 0
    ? clamp(body.fuelCostSavedUSD, 0, 1_000_000, 0)
    : parseFloat((fuel_saved_l * 1.35).toFixed(4));

  const optimisation_saving_percent = clamp(body.optimisationSavingPercent, 0, 100, 0);
  const stops                       = clamp(body.stops,                     0, 10_000, 0);

  const ai_optimised   = body.aiOptimised    === true || body.aiOptimised   === 'true';
  const on_time_delivery = body.onTimeDelivery === true || body.onTimeDelivery === 'true';

  return {
    ok: true,
    fields: {
      vehicle_id, driver_id, route_id,
      distance_km, duration_min,
      fuel_saved_l, co2_saved_kg, fuel_cost_saved_usd,
      optimisation_saving_percent,
      ai_optimised, on_time_delivery, stops,
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// Coordinates validation
// ─────────────────────────────────────────────────────────────────

export function validateCoordinates(
  raw: unknown
): { lat: number; lng: number } | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const c = raw as Record<string, unknown>;
  const lat = Number(c.lat);
  const lng = Number(c.lng);
  if (!isFinite(lat) || !isFinite(lng)) return null;
  if (lat < -90 || lat > 90)   return null;
  if (lng < -180 || lng > 180) return null;
  return { lat, lng };
}

// ─────────────────────────────────────────────────────────────────
// Standard API error response shape
// ─────────────────────────────────────────────────────────────────

export function apiError(
  message: string,
  status: number,
  headers: Record<string, string> = {}
): Response {
  return new Response(
    JSON.stringify({ ok: false, error: message }),
    { status, headers: { 'Content-Type': 'application/json', ...headers } }
  );
}
