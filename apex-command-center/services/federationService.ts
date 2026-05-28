/**
 * AP3X FEDERATION SERVICE
 * All Supabase operations for the multi-fleet federation system.
 *
 * Admin responsibilities:
 *   ✔ Validate pairing codes from Fleet Control OS instances
 *   ✔ Create tenant + fleet entity records on successful pairing
 *   ✔ Read all tenants, fleets, telemetry, route metrics, heartbeats
 *   ✔ Suspend/activate tenants
 *
 * The actual data ingestion (heartbeat, telemetry, route-complete)
 * lives in the API routes — this service handles admin UI reads/writes.
 */

import { getSupabaseClient } from '@/lib/supabaseClient';
import type {
  Tenant, FleetEntity, PairingCode, TelemetryEvent,
  RouteMetric, FleetHeartbeat, TenantWithFleets, TenantPlan,
} from '@/types/federation';

const sb = () => getSupabaseClient();

// ─────────────────────────────────────────────────────────────────
// PAIRING CODES
// ─────────────────────────────────────────────────────────────────

// Sanitize input: trim, strip all spaces, uppercase — THEN validate.
// This handles display-formatted input like 'A P E X - D B A D 7 6 E 2 - A 4 2 5 - F C'.
export function sanitizePairingCode(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

const PAIRING_REGEX = /^APEX-[A-Z0-9]{8}-[A-Z0-9]{4}-FC$/;

export function validateCodeFormat(code: string): boolean {
  return PAIRING_REGEX.test(sanitizePairingCode(code));
}

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

  const code = payload.code.trim().toUpperCase();

  if (!validateCodeFormat(code)) return { error: 'Invalid code format. Expected: APEX-XXXXXXXX-XXXX-FC' };

  try {
    // 1. Look up the code
    const { data: codeRow, error: codeErr } = await client
      .from('pairing_codes')
      .select('*')
      .eq('code', code)
      .single();

    if (codeErr || !codeRow) {
      // Code doesn't exist yet — insert it as a new pending code (first-time registration)
      // This allows Fleet Control OS to pre-register codes
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
      const { error: insertErr } = await client.from('pairing_codes').insert({
        code,
        status: 'pending',
        attempts: 0,
        expires_at: expiresAt.toISOString(),
      });
      if (insertErr) return { error: `Code not recognised and could not be created: ${insertErr.message}` };
    } else {
      // Code exists — validate it
      const pc = codeRow as PairingCode;
      if (pc.status === 'used') return { error: 'This code has already been used.' };
      if (pc.status === 'locked') return { error: 'This code is locked after too many attempts.' };
      if (pc.status === 'expired') return { error: 'This code has expired. Ask the fleet to regenerate.' };
      if (new Date(pc.expires_at) < new Date()) return { error: 'This code has expired. Ask the fleet to regenerate.' };
    }

    // 2. Generate slug and pairing token
    const slug = payload.tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);
    const pairingToken = 'pt_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, '0')).join('');

    // 3. Create tenant
    const { data: tenantData, error: tenantErr } = await client
      .from('tenants')
      .insert({
        name: payload.tenantName,
        slug,
        contact_email: payload.contactEmail || null,
        plan: payload.plan,
        status: 'active',
        region: payload.region || null,
        metadata: {},
      })
      .select()
      .single();

    if (tenantErr || !tenantData) return { error: `Failed to create tenant: ${tenantErr?.message}` };
    const tenant = tenantData as Tenant;

    // 4. Create fleet entity
    const { data: fleetData, error: fleetErr } = await client
      .from('fleet_entities')
      .insert({
        tenant_id: tenant.id,
        name: payload.fleetName,
        status: 'online',
        pairing_token: pairingToken,
        command_center_url: payload.commandCenterUrl || null,
        vehicle_count: 0,
        active_vehicles: 0,
        driver_count: 0,
        active_drivers: 0,
        uptime_percent: 100,
        version: null,
      })
      .select()
      .single();

    if (fleetErr || !fleetData) {
      // Rollback tenant
      await client.from('tenants').delete().eq('id', tenant.id);
      return { error: `Failed to create fleet: ${fleetErr?.message}` };
    }
    const fleet = fleetData as FleetEntity;

    // 5. Mark code as used
    await client.from('pairing_codes').update({
      status: 'used',
      tenant_id: tenant.id,
      fleet_id: fleet.id,
      paired_at: new Date().toISOString(),
    }).eq('code', code);

    return { tenant, fleet, pairingToken };
  } catch (e) {
    return { error: `Unexpected error: ${String(e)}` };
  }
}

// ─────────────────────────────────────────────────────────────────
// TENANTS
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

    const tenants = (tenantsRes.data ?? []) as Tenant[];
    const fleets = (fleetsRes.data ?? []) as FleetEntity[];
    const routes = (routesRes.data ?? []) as { tenant_id: string; co2_saved_kg: number; id: string }[];
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
        fleets: tenantFleets,
        latest_heartbeat: latestFleetHB,
        total_vehicles: tenantFleets.reduce((s, f) => s + f.vehicle_count, 0),
        total_drivers: tenantFleets.reduce((s, f) => s + f.driver_count, 0),
        total_routes: tenantRoutes.length,
        total_co2_saved_kg: tenantRoutes.reduce((s, r) => s + (r.co2_saved_kg ?? 0), 0),
      };
    });
  } catch (e) { console.warn('[Federation] fetchTenantsWithFleets ex:', e); return null; }
}

export async function updateTenantStatus(tenantId: string, status: Tenant['status']): Promise<boolean> {
  const client = sb();
  if (!client) return false;
  try {
    const { error } = await client.from('tenants').update({ status, updated_at: new Date().toISOString() }).eq('id', tenantId);
    return !error;
  } catch { return false; }
}

export async function deleteTenant(tenantId: string): Promise<boolean> {
  const client = sb();
  if (!client) return false;
  try {
    // Cascade: delete fleets, pairing codes, telemetry for this tenant
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
// FLEET ENTITIES
// ─────────────────────────────────────────────────────────────────

export async function fetchFleets(): Promise<FleetEntity[] | null> {
  const client = sb();
  if (!client) return null;
  try {
    const { data, error } = await client.from('fleet_entities').select('*').order('registered_at', { ascending: false });
    if (error) return null;
    return data as FleetEntity[];
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────
// TELEMETRY
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

// ─────────────────────────────────────────────────────────────────
// ROUTE METRICS
// ─────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────
// FEDERATION AGGREGATE (for dashboard KPIs)
// ─────────────────────────────────────────────────────────────────

export interface FederationAggregate {
  totalTenants: number;
  activeTenants: number;
  totalFleets: number;
  onlineFleets: number;
  totalVehicles: number;
  totalDrivers: number;
  totalRoutes: number;
  totalCo2SavedKg: number;
  totalTelemetryEvents: number;
}

export async function fetchFederationAggregate(): Promise<FederationAggregate | null> {
  const client = sb();
  if (!client) return null;
  try {
    const [tenantsRes, fleetsRes, routesRes, telemetryCountRes] = await Promise.all([
      client.from('tenants').select('id, status'),
      client.from('fleet_entities').select('id, status, vehicle_count, driver_count'),
      client.from('route_metrics').select('id, co2_saved_kg'),
      client.from('telemetry_events').select('id', { count: 'exact', head: true }),
    ]);

    const tenants = (tenantsRes.data ?? []) as { id: string; status: string }[];
    const fleets = (fleetsRes.data ?? []) as { id: string; status: string; vehicle_count: number; driver_count: number }[];
    const routes = (routesRes.data ?? []) as { id: string; co2_saved_kg: number }[];

    return {
      totalTenants: tenants.length,
      activeTenants: tenants.filter((t) => t.status === 'active').length,
      totalFleets: fleets.length,
      onlineFleets: fleets.filter((f) => f.status === 'online').length,
      totalVehicles: fleets.reduce((s, f) => s + (f.vehicle_count ?? 0), 0),
      totalDrivers: fleets.reduce((s, f) => s + (f.driver_count ?? 0), 0),
      totalRoutes: routes.length,
      totalCo2SavedKg: routes.reduce((s, r) => s + (r.co2_saved_kg ?? 0), 0),
      totalTelemetryEvents: telemetryCountRes.count ?? 0,
    };
  } catch { return null; }
}
