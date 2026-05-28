/**
 * POST /api/fleet-heartbeat
 * Receives periodic health pings from Fleet Control OS instances.
 * Authenticated via X-Tenant-Id + X-Fleet-Id + X-Apex-Key headers.
 *
 * Also accepts OPTIONS preflight (used by Fleet Control OS "Test Connection" button).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import { authenticateFleetRequest } from '@/lib/apiAuth';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Tenant-Id, X-Fleet-Id, X-Apex-Key',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  // Used by Fleet Control OS "Test Connection" button (no auth needed)
  return NextResponse.json(
    { ok: true, service: 'AP3X Command Center', endpoint: 'fleet-heartbeat', serverTime: Date.now() },
    { headers: CORS }
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const auth = await authenticateFleetRequest(req, supabase);
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status, headers: CORS });
    }

    const body = await req.json();
    const now = new Date().toISOString();

    // Upsert fleet entity stats
    await supabase.from('fleet_entities').update({
      vehicle_count:   body.vehicleCount   ?? 0,
      active_vehicles: body.activeVehicles ?? 0,
      driver_count:    body.driverCount    ?? 0,
      active_drivers:  body.activeDrivers  ?? 0,
      uptime_percent:  body.uptimePercent  ?? 100,
      version:         body.version        ?? null,
      coordinates:     body.coordinates    ?? null,
      last_heartbeat:  now,
      status:          'online',
      updated_at:      now,
    }).eq('id', auth.fleetId);

    // Insert heartbeat log
    await supabase.from('fleet_heartbeats').insert({
      tenant_id:       auth.tenantId,
      fleet_id:        auth.fleetId,
      vehicle_count:   body.vehicleCount   ?? 0,
      active_vehicles: body.activeVehicles ?? 0,
      driver_count:    body.driverCount    ?? 0,
      active_drivers:  body.activeDrivers  ?? 0,
      uptime_percent:  body.uptimePercent  ?? 100,
      version:         body.version        ?? null,
      coordinates:     body.coordinates    ?? null,
      received_at:     now,
    });

    return NextResponse.json(
      { ok: true, serverTime: Date.now(), message: 'Heartbeat received' },
      { headers: CORS }
    );
  } catch (e) {
    console.error('[heartbeat] error:', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500, headers: CORS });
  }
}
