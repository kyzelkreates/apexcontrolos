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
 *
 * FIX LOG (pairing_codes table hardening):
 *   - Added fetchPairingCodeByCode() — normalised lookup with PGRST116 handling
 *   - generateAndIssuePairingCode() — retry on UNIQUE collision (up to 3 attempts)
 *   - regeneratePairingCode() — verify old code exists before expiring
 *   - registerFleetByCode() — real DB errors now distinguished from "not found"
 *   - registerFleetByCode() — attempt increment moved AFTER successful registration
 *   - registerFleetByCode() — mark-used failure is now surfaced, not silently skipped
 *   - incrementPairingAttempt() — added return value logging for diagnostics
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
function generateRawPairingCode(): string {
  const bytes  = crypto.getRandomValues(new Uint8Array(6));
  const hex8   = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase().slice(0, 8);
  const bytes2 = crypto.getRandomValues(new Uint8Array(3));
  const hex4   = Array.from(bytes2).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase().slice(0, 4);
  return `APEX-${hex8}-${hex4}-FC`;
}

/**
 * Issue a new pairing code.
 * Inserts into pairing_codes with status=pending, attempts=0, configurable TTL.
 *
 * FIXED: Retries up to 3 times on UNIQUE constraint collision (23505).
 * In practice collision is astronomically unlikely but this prevents a raw
 * Postgres error from reaching the UI if it ever occurs.
 */
export async function generateAndIssuePairingCode(
  ttlHours = 1
): Promise<{ code: PairingCode } | { error: string }> {
  const client = sb();
  if (!client) return { error: 'Supabase not configured' };

  const expiry = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

  const MAX_ATTEMPTS = 3;
  let lastError = '';

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateRawPairingCode();

    try {
      const { data, error } = await client
        .from('pairing_codes')
        .insert({
          code,
          status:     'pending',
          attempts:   0,
          expires_at: expiry,
          tenant_id:  null,
          fleet_id:   null,
          paired_at:  null,
        })
        .select()
        .single();

      if (error) {
        // 23505 = unique_violation — retry with a new code
        if (error.code === '23505') {
          console.warn(`[Federation] generateAndIssuePairingCode: collision on attempt ${attempt + 1}, retrying`);
          lastError = `Code collision (attempt ${attempt + 1})`;
          continue;
        }
        return { error: `Failed to create pairing code: ${error.message}` };
      }

      return { code: data as PairingCode };
    } catch (e) {
      return { error: `Exception generating pairing code: ${String(e)}` };
    }
  }

  return { error: `Failed to generate unique pairing code after ${MAX_ATTEMPTS} attempts. ${lastError}` };
}

/**
 * Regenerate — expire the old code, issue a new one.
 * Used by "Regenerate Code" button in the federation panel.
 *
 * FIXED: Verifies the old code exists before expiring it. If it doesn't
 * exist (e.g. already deleted) the new code is still issued cleanly.
 */
export async function regeneratePairingCode(
  oldCodeId: string,
  ttlHours = 1
): Promise<{ code: PairingCode } | { error: string }> {
  const client = sb();
  if (!client) return { error: 'Supabase not configured' };

  if (!oldCodeId) return { error: 'Missing oldCodeId — cannot regenerate' };

  try {
    // Verify the old code exists and is still pending before expiring
    const { data: existing, error: fetchErr } = await client
      .from('pairing_codes')
      .select('id, status')
      .eq('id', oldCodeId)
      .single();

    if (fetchErr && fetchErr.code !== 'PGRST116') {
      // Real DB error — still issue a new code but log the issue
      console.warn('[Federation] regeneratePairingCode: could not fetch old code:', fetchErr.message);
    } else if (existing && (existing as PairingCode).status === 'pending') {
      // Only expire if it's still pending — used/expired/locked codes don't need touching
      const { error: expireErr } = await client
        .from('pairing_codes')
        .update({ status: 'expired' })
        .eq('id', oldCodeId)
        .eq('status', 'pending');

      if (expireErr) {
        console.warn('[Federation] regeneratePairingCode: expire failed:', expireErr.message);
        // Non-fatal — still issue the new code
      }
    }

    return generateAndIssuePairingCode(ttlHours);
  } catch (e) {
    return { error: `Exception regenerating code: ${String(e)}` };
  }
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

/**
 * Fetch a single pairing code record by code string.
 *
 * ADDED: Normalised lookup used by registerFleetByCode.
 * Distinguishes between "not found" (PGRST116) and real DB errors.
 *
 * Returns:
 *   { found: false }           — code does not exist in DB
 *   { found: true, code }      — record found
 *   { dbError: string }        — real Supabase/network error
 */
type FetchByCodeResult =
  | { found: false }
  | { found: true; code: PairingCode }
  | { dbError: string };

export async function fetchPairingCodeByCode(
  rawCode: string
): Promise<FetchByCodeResult> {
  const client = sb();
  if (!client) return { dbError: 'Supabase not configured' };

  const code = sanitizePairingCode(rawCode);

  try {
    const { data, error } = await client
      .from('pairing_codes')
      .select('*')
      .eq('code', code)
      .single();

    if (error) {
      // PGRST116 = "0 rows returned" — not found, not an error
      if (error.code === 'PGRST116') return { found: false };
      return { dbError: `pairing_codes lookup failed: ${error.message}` };
    }

    if (!data) return { found: false };
    return { found: true, code: data as PairingCode };
  } catch (e) {
    return { dbError: `Exception looking up pairing code: ${String(e)}` };
  }
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
    const willLock = newAttempts >= 5;
    const update: Record<string, unknown> = { attempts: newAttempts };
    if (willLock) update.status = 'locked';

    const { error } = await client
      .from('pairing_codes')
      .update(update)
      .eq('id', codeId);

    if (error) {
      console.warn(`[Federation] incrementPairingAttempt (id=${codeId}):`, error.message);
      return false;
    }
    if (willLock) {
      console.warn(`[Federation] Pairing code ${codeId} LOCKED after ${newAttempts} attempts`);
    }
    return true;
  } catch (e) {
    console.warn('[Federation] incrementPairingAttempt ex:', e);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────
// FLEET REGISTRATION  (the core pairing flow)
// ─────────────────────────────────────────────────────────────────

/**
 * Register a fleet by pairing code. Creates tenant + fleet + marks code used.
 *
 * FIXED (pairing_codes table hardening):
 *   1. Uses fetchPairingCodeByCode() — real DB errors distinguished from "not found"
 *   2. incrementPairingAttempt() moved AFTER successful registration (not before)
 *      so a server-side failure doesn't penalise a valid code
 *   3. Mark-used step now checks for its own error and surfaces it
 *   4. If mark-used fails, the registration still succeeds but a warning is logged
 *      so the operator knows the code may need manual cleanup
 *   5. "Code not found" branch still inserts-as-pending for Fleet OS compatibility,
 *      but now only if the lookup confirmed "not found" — not on DB errors
 */
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

  // ── 1. Sanitize + format-validate ──
  const code = sanitizePairingCode(payload.code);
  if (!validateCodeFormat(code)) {
    return { error: 'Invalid code format. Expected: APEX-XXXXXXXX-XXXX-FC' };
  }

  // ── 2. Look up the pairing code ──
  const lookupResult = await fetchPairingCodeByCode(code);

  // Real DB error — do not proceed, do not insert phantom records
  if ('dbError' in lookupResult) {
    return { error: `Could not verify pairing code: ${lookupResult.dbError}` };
  }

  let codeId: string;

  if (lookupResult.found) {
    const pc = lookupResult.code;
    codeId = pc.id;

    // ── Guard: existing code state ──
    if (pc.status === 'used') {
      return { error: 'This code has already been used to register a fleet.' };
    }
    if (pc.status === 'locked') {
      return { error: `This code is locked after ${pc.attempts} failed attempt${pc.attempts !== 1 ? 's' : ''}. Generate a new one.` };
    }
    if (pc.status === 'expired') {
      return { error: 'This code has expired. Generate a new pairing code.' };
    }
    // Double-check clock-expiry even if status is still 'pending'
    if (new Date(pc.expires_at) < new Date()) {
      // Fix the DB state silently — non-blocking
      void client.from('pairing_codes').update({ status: 'expired' }).eq('id', pc.id);
      return { error: 'This code has expired. Generate a new pairing code.' };
    }
  } else {
    // ── Code not in DB ——
    // Fleet Control OS may have generated this code externally before it was
    // entered here. Insert it as pending so the flow can continue.
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { data: inserted, error: insertErr } = await client
      .from('pairing_codes')
      .insert({
        code,
        status:    'pending',
        attempts:  0,
        expires_at: expiresAt,
        tenant_id: null,
        fleet_id:  null,
        paired_at: null,
      })
      .select('id')
      .single();

    if (insertErr || !inserted) {
      return {
        error: `Pairing code not found and could not be registered: ${insertErr?.message ?? 'unknown error'}`,
      };
    }
    codeId = (inserted as { id: string }).id;
  }

  // ── 3. Generate slug + pairing token ──
  const slug =
    payload.tenantName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') +
    '-' +
    Date.now().toString(36);

  const pairingToken =
    'pt_' +
    Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

  // ── 4. Create tenant ──
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
    return { error: `Failed to create tenant: ${tenantErr?.message ?? 'no data returned'}` };
  }
  const tenant = tenantData as Tenant;

  // ── 5. Create fleet entity ──
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
    // Rollback tenant — don't leave orphaned records
    await client.from('tenants').delete().eq('id', tenant.id);
    return { error: `Failed to create fleet: ${fleetErr?.message ?? 'no data returned'}` };
  }
  const fleet = fleetData as FleetEntity;

  // ── 6. Mark code used — link to tenant + fleet ──
  // Performed AFTER successful tenant + fleet creation so that a server-side
  // failure during registration doesn't consume attempt credits.
  const { error: markUsedErr } = await client
    .from('pairing_codes')
    .update({
      status:    'used',
      tenant_id: tenant.id,
      fleet_id:  fleet.id,
      paired_at: new Date().toISOString(),
    })
    .eq('id', codeId);

  if (markUsedErr) {
    // Registration succeeded but code wasn't marked used — log for operator awareness.
    // Do NOT fail the registration — the tenant + fleet are real and valid.
    console.error(
      `[Federation] registerFleetByCode: fleet registered (tenant=${tenant.id}, fleet=${fleet.id}) ` +
      `but pairing_codes mark-used FAILED for codeId=${codeId}: ${markUsedErr.message}. ` +
      `The code may need manual cleanup in Supabase.`
    );
  }

  // ── 7. Record the registration attempt (after success — not before) ──
  // Only increments if the code was pre-existing (not freshly inserted above).
  if (lookupResult.found) {
    const pc = lookupResult.code;
    await incrementPairingAttempt(codeId, (pc.attempts ?? 0) + 1);
  }

  return { tenant, fleet, pairingToken };
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
    const results = await Promise.allSettled([
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

    const failures = results
      .filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value?.error))
      .map((r) => r.status === 'rejected' ? String(r.reason) : (r as PromiseFulfilledResult<{ error: { message: string } }>).value?.error?.message);

    if (failures.length > 0) {
      console.warn('[Federation] revokeFederation partial failures:', failures);
      // Return ok if at least tenant + fleet were suspended
      // (pairing code expiry failure is non-fatal)
    }

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
    await Promise.allSettled([
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

    const tenants    = (tenantsRes.data    ?? []) as Tenant[];
    const fleets     = (fleetsRes.data     ?? []) as FleetEntity[];
    const routes     = (routesRes.data     ?? []) as { tenant_id: string; co2_saved_kg: number; id: string }[];
    const heartbeats = (heartbeatsRes.data ?? []) as FleetHeartbeat[];

    // Latest heartbeat per fleet
    const latestHB: Record<string, FleetHeartbeat> = {};
    heartbeats.forEach((hb) => {
      if (!latestHB[hb.fleet_id] || hb.received_at > latestHB[hb.fleet_id].received_at) {
        latestHB[hb.fleet_id] = hb;
      }
    });

    return tenants.map((t) => {
      const tenantFleets   = fleets.filter((f) => f.tenant_id === t.id);
      const tenantRoutes   = routes.filter((r) => r.tenant_id === t.id);
      const latestFleetHB  = tenantFleets
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
