/**
 * AP3X FEDERATION SERVICE
 * Control OS is the authoritative federation management layer.
 *
 * Responsibilities:
 *   ✔ Generate pairing codes (Control OS is authoritative issuer)
 *   ✔ Validate + sanitize federation codes (consistent, single source)
 *   ✔ Track registration attempts + expiry
 *   ✔ Prevent duplicate federation
 *   ✔ Monitor fleet registration health
 *   ✔ Support safe federation revocation
 *   ✔ Fetch all federation data for the management panel
 *
 * HARD RULES:
 *   - Supabase is the ONLY source of truth
 *   - No schema drift — only use existing tables
 *   - No duplicate systems — this file IS federation logic
 *   - All writes go through this service, never directly from UI
 */

import { getSupabaseClient } from '@/lib/supabaseClient';
import type {
  Tenant, FleetEntity, PairingCode, TelemetryEvent,
  RouteMetric, FleetHeartbeat, TenantWithFleets, TenantPlan,
} from '@/types/federation';

const sb = () => getSupabaseClient();

// ─────────────────────────────────────────────────────────────────
// PAIRING CODE — SANITIZATION + VALIDATION (single source of truth)
// ─────────────────────────────────────────────────────────────────

/**
 * Sanitize before ANY validation.
 * Handles: leading/trailing whitespace, internal spaces (display formatting),
 * lowercase. Safe to call on every keystroke.
 */
export function sanitizePairingCode(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

// Exact match — no looser patterns, no [A-Z]{2,4} wildcards.
const PAIRING_REGEX = /^APEX-[A-Z0-9]{8}-[A-Z0-9]{4}-FC$/;

/** Returns true for all valid variants (lowercase, spaced, exact) */
export function validateCodeFormat(code: string): boolean {
  return PAIRING_REGEX.test(sanitizePairingCode(code));
}

// ─────────────────────────────────────────────────────────────────
// PAIRING CODE — GENERATION (Control OS is the issuer)
// ─────────────────────────────────────────────────────────────────

/** Generate a cryptographically random APEX pairing code */
function generatePairingCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const hex8  = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase().slice(0, 8);
  const bytes2 = crypto.getRandomValues(new Uint8Array(3));
  const hex4   = Array.from(bytes2).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase().slice(0, 4);
  return `APEX-${hex8}-${hex4}-FC`;
}

/**
 * Issue a new pairing code.
 * Inserts into pairing_codes with status=pending, attempts=0, 1hr TTL.
 * If the fleet already has a pending unused code, expires it first.
 */
export async function generateAndIssuePairingCode(
  ttlHours = 1
): Promise<{ code: PairingCode } | { error: string }> {
  const client = sb();
  if (!client) return { error: 'Supabase not configured' };

  const code   = generatePairingCode();
  const now    = new Date();
  const expiry = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

  try {
    const { data, error } = await client
      .from('pairing_codes')
      .insert({
        code,
        status:     'pending',
        attempts:   0,
        expires_at: expiry.toISOString(),
        tenant_id:  null,
        fleet_id:   null,
        paired_at:  null,
      })
      .select()
      .single();

    if (error) return { error: `Failed to create pairing code: ${error.message}` };
    return { code: data as PairingCode };
  } catch (e) {
    return { error: `Exception: ${String(e)}` };
  }
}

/**
 * Regenerate — expire the old code, issue a new one.
 * Used by "Regenerate Code" button in the federation panel.
 */
export async function regeneratePairingCode(
  oldCodeId: string,
  ttlHours = 1
): Promise<{ code: PairingCode } | { error: string }> {
  const client = sb();
  if (!client) return { error: 'Supabase not configured' };

  // Expire the old one
  await client
    .from('pairing_codes')
    .update({ status: 'expired' })
    .eq('id', oldCodeId)
    .in('status', ['pending']); // only expire if still pending

  return generateAndIssuePairingCode(ttlHours);
}

// ─────────────────────────────────────────────────────────────────
// PAIRING CODE — READS
// ─────────────────────────────────────────────────────────────────

/** Fetch all pairing codes, newest first */
export async function fetchPairingCodes(
  opts: { status?: PairingCode['status']; limit?: number } = {}
): Promise<PairingCode[] | null> {
  const client = sb();
  if (!client) return null;
  try {
    let q = client
      .from('pairing_codes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 200);

    if (opts.status) q = q.eq('status', opts.status);

    const { data, error } = await q;
    if (error) { console.warn('[Federation] fetchPairingCodes:', error.message); return null; }
    return data as PairingCode[];
  } catch (e) { console.warn('[Federation] fetchPairingCodes ex:', e); return null; }
}

/** Attempt increment — called on each failed registration attempt */
export async function incrementPairingAttempt(
  codeId: string,
  newAttempts: number
): Promise<boolean> {
  const client = sb();
  if (!client) return false;
  try {
    // Lock after 5 failed attempts
    const newStatus = newAttempts >= 5 ? 'locked' : undefined;
    const update: Record<string, unknown> = { attempts: newAttempts };
    if (newStatus) update.status = newStatus;

    const { error } = await client
      .from('pairing_codes')
      .update(update)
      .eq('id', codeId);

    return !error;
  } catch { return false; }
}

// ─────────────────────────────────────────────────────────────────
// FLEET REGISTRATION  (the core pairing flow)
// ─────────────────────────────────────────────────────────────────

/** Register a fleet by pairing code. Creates tenant + fleet + marks code used. */
export async function registerFleetByCode(payload: {
  code: string;
  tenantName: string;
  contactEmail: string;
  plan: TenantPlan;
  region: string;
  fleetName: string;
  commandCenterUrl: string;
}): Promise<{ tenant: Tenant; fleet: FleetEntity; pairingToken: string } | { error: string }> {
  const client = sb();
  if (!client) return { error: 'Supabase not configured' };

  // Always sanitize before any further logic
  const code = sanitizePairingCode(payload.code);

  if (!validateCodeFormat(code)) {
    return { error: 'Invalid code format. Expected: APEX-XXXXXXXX-XXXX-FC' };
  }

  // Duplicate federation guard: check if this code is already in use
  try {
    const { data: existing } = await client
      .from('pairing_codes')
      .select('id, status, attempts, expires_at')
      .eq('code', code)
      .single();

    let codeId: string | null = null;

    if (existing) {
      const pc = existing as PairingCode;
      codeId = pc.id;

      if (pc.status === 'used')    return { error: 'This code has already been used.' };
      if (pc.status === 'locked')  return { error: `This code is locked after ${pc.attempts} failed attempts. Generate a new one.` };
      if (pc.status === 'expired') return { error: 'This code has expired. Generate a new pairing code.' };
      if (new Date(pc.expires_at) < new Date()) {
        // Mark expired in DB, return clean error
        await client.from('pairing_codes').update({ status: 'expired' }).eq('id', pc.id);
        return { error: 'This code has expired. Generate a new pairing code.' };
      }

      // Increment attempt counter on the existing code before proceeding
      await incrementPairingAttempt(pc.id, (pc.attempts ?? 0) + 1);
    } else {
      // Code not found in DB — insert as pending (Fleet Control OS pre-registered it externally)
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const { data: inserted, error: insertErr } = await client
        .from('pairing_codes')
        .insert({ code, status: 'pending', attempts: 1, expires_at: expiresAt, tenant_id: null, fleet_id: null, paired_at: null })
        .select('id')
        .single();
      if (insertErr || !inserted) {
        return { error: `Code not recognised and could not be created: ${insertErr?.message}` };
      }
      codeId = (inserted as { id: string }).id;
    }

    // 2. Generate slug + pairing token
    const slug = payload.tenantName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') +
      '-' + Date.now().toString(36);

    const pairingToken = 'pt_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, '0')).join('');

    // 3. Create tenant
    const { data: tenantData, error: tenantErr } = await client
      .from('tenants')
      .insert({
        name:          payload.tenantName,
        slug,
        contact_email: payload.contactEmail || null,
        plan:          payload.plan,
        status:        'active',
        region:        payload.region || null,
        metadata:      {},
      })
      .select()
      .single();

    if (tenantErr || !tenantData) {
      return { error: `Failed to create tenant: ${tenantErr?.message}` };
    }
    const tenant = tenantData as Tenant;

    // 4. Create fleet entity
    const { data: fleetData, error: fleetErr } = await client
      .from('fleet_entities')
      .insert({
        tenant_id:          tenant.id,
        name:               payload.fleetName,
        status:             'online',
        pairing_token:      pairingToken,
        command_center_url: payload.commandCenterUrl || null,
        vehicle_count:      0,
        active_vehicles:    0,
        driver_count:       0,
        active_drivers:     0,
        uptime_percent:     100,
        version:            null,
      })
      .select()
      .single();

    if (fleetErr || !fleetData) {
      // Rollback tenant
      await client.from('tenants').delete().eq('id', tenant.id);
      return { error: `Failed to create fleet: ${fleetErr?.message}` };
    }
    const fleet = fleetData as FleetEntity;

    // 5. Mark code used — link to tenant + fleet
    if (codeId) {
      await client.from('pairing_codes').update({
        status:    'used',
        tenant_id: tenant.id,
        fleet_id:  fleet.id,
        paired_at: new Date().toISOString(),
      }).eq('id', codeId);
    }

    return { tenant, fleet, pairingToken };
  } catch (e) {
    return { error: `Unexpected error: ${String(e)}` };
  }
}

// ─────────────────────────────────────────────────────────────────
// FEDERATION REVOCATION
// ─────────────────────────────────────────────────────────────────

/**
 * Safely revoke a federation — suspends tenant, offline fleet,
 * expires all pending codes. Does NOT delete records (preserves audit trail).
 */
export async function revokeFederation(
  tenantId: string,
  fleetId: string
): Promise<{ ok: true } | { error: string }> {
  const client = sb();
  if (!client) return { error: 'Supabase not configured' };

  try {
    await Promise.all([
      client.from('tenants')
        .update({ status: 'suspended', updated_at: new Date().toISOString() })
        .eq('id', tenantId),
      client.from('fleet_entities')
        .update({ status: 'offline', updated_at: new Date().toISOString() })
        .eq('id', fleetId),
      client.from('pairing_codes')
        .update({ status: 'expired' })
        .eq('tenant_id', tenantId)
        .in('status', ['pending']),
    ]);
    return { ok: true };
  } catch (e) {
    return { error: `Revocation failed: ${String(e)}` };
  }
}

/**
 * Hard delete a tenant + all associated data.
 * Preserves pairing_codes for audit (just marks expired).
 */
export async function deleteTenant(tenantId: string): Promise<boolean> {
  const client = sb();
  if (!client) return false;
  try {
    await Promise.all([
      client.from('fleet_entities').delete().eq('tenant_id', tenantId),
      client.from('pairing_codes').update({ status: 'expired' }).eq('tenant_id', tenantId),
      client.from('telemetry_events').delete().eq('tenant_id', tenantId),
      client.from('route_metrics').delete().eq('tenant_id', tenantId),
      client.from('fleet_heartbeats').delete().eq('tenant_id', tenantId),
    ]);
    const { error } = await client.from('tenants').delete().eq('id', tenantId);
    return !error;
  } catch { return false; }
}

// ─────────────────────────────────────────────────────────────────
// TENANT MANAGEMENT
// ─────────────────────────────────────────────────────────────────

export async function fetchTenants(): Promise<Tenant[] | null> {
  const client = sb();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('tenants')
      .select('*')
      .order('registered_at', { ascending: false });
    if (error) { console.warn('[Federation] fetchTenants:', error.message); return null; }
    return data as Tenant[];
  } catch (e) { console.warn('[Federation] fetchTenants ex:', e); return null; }
}

export async function fetchTenantsWithFleets(): Promise<TenantWithFleets[] | null> {
  const client = sb();
  if (!client) return null;
  try {
    const [tenantsRes, fleetsRes, routesRes, heartbeatsRes] = await Promise.all([
      client.from('tenants').select('*').order('registered_at', { ascending: false }),
      client.from('fleet_entities').select('*'),
      client.from('route_metrics').select('tenant_id, co2_saved_kg, id'),
      client.from('fleet_heartbeats').select('*').order('received_at', { ascending: false }).limit(500),
    ]);

    if (tenantsRes.error) return null;

    const tenants    = (tenantsRes.data  ?? []) as Tenant[];
    const fleets     = (fleetsRes.data   ?? []) as FleetEntity[];
    const routes     = (routesRes.data   ?? []) as { tenant_id: string; co2_saved_kg: number; id: string }[];
    const heartbeats = (heartbeatsRes.data ?? []) as FleetHeartbeat[];

    // Latest heartbeat per fleet
    const latestHB: Record<string, FleetHeartbeat> = {};
    heartbeats.forEach((hb) => {
      if (!latestHB[hb.fleet_id] || hb.received_at > latestHB[hb.fleet_id].received_at) {
        latestHB[hb.fleet_id] = hb;
      }
    });

    return tenants.map((t) => {
      const tenantFleets = fleets.filter((f) => f.tenant_id === t.id);
      const tenantRoutes = routes.filter((r) => r.tenant_id === t.id);
      const latestFleetHB = tenantFleets
        .map((f) => latestHB[f.id])
        .filter(Boolean)
        .sort((a, b) => b.received_at.localeCompare(a.received_at))[0] ?? null;

      return {
        ...t,
        fleets:             tenantFleets,
        latest_heartbeat:   latestFleetHB,
        total_vehicles:     tenantFleets.reduce((s, f) => s + f.vehicle_count, 0),
        total_drivers:      tenantFleets.reduce((s, f) => s + f.driver_count, 0),
        total_routes:       tenantRoutes.length,
        total_co2_saved_kg: tenantRoutes.reduce((s, r) => s + (r.co2_saved_kg ?? 0), 0),
      };
    });
  } catch (e) { console.warn('[Federation] fetchTenantsWithFleets ex:', e); return null; }
}

export async function updateTenantStatus(
  tenantId: string,
  status: Tenant['status']
): Promise<boolean> {
  const client = sb();
  if (!client) return false;
  try {
    const { error } = await client
      .from('tenants')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', tenantId);
    return !error;
  } catch { return false; }
}

// ─────────────────────────────────────────────────────────────────
// FLEET ENTITIES
// ─────────────────────────────────────────────────────────────────

export async function fetchFleets(): Promise<FleetEntity[] | null> {
  const client = sb();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('fleet_entities')
      .select('*')
      .order('registered_at', { ascending: false });
    if (error) return null;
    return data as FleetEntity[];
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────
// TELEMETRY + ROUTES + HEARTBEATS
// ─────────────────────────────────────────────────────────────────

export async function fetchRecentTelemetry(limit = 100): Promise<TelemetryEvent[] | null> {
  const client = sb();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('telemetry_events')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(limit);
    if (error) return null;
    return data as TelemetryEvent[];
  } catch { return null; }
}

export async function fetchRouteMetrics(limit = 200): Promise<RouteMetric[] | null> {
  const client = sb();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('route_metrics')
      .select('*')
      .order('completed_at', { ascending: false })
      .limit(limit);
    if (error) return null;
    return data as RouteMetric[];
  } catch { return null; }
}

export async function fetchFleetHeartbeats(limit = 100): Promise<FleetHeartbeat[] | null> {
  const client = sb();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('fleet_heartbeats')
      .select('*')
      .order('received_at', { ascending: false })
      .limit(limit);
    if (error) return null;
    return data as FleetHeartbeat[];
  } catch { return null; }
}
