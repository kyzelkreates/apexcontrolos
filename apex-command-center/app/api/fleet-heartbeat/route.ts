/**
 * POST /api/fleet-heartbeat
 *
 * Receives periodic health pings from Fleet Control OS instances.
 * Part of the locked event pipeline:
 *   Fleet OS → [this endpoint] → Supabase (fleet_entities + fleet_heartbeats)
 *
 * VALIDATION:
 *   - Auth via authenticateFleetRequest
 *   - Body fields clamped to valid ranges via validateHeartbeatBody
 *   - Coordinates validated (lat -90→90, lng -180→180)
 *   - Both fleet_entities upsert + heartbeat log are written atomically
 *     (if the upsert fails the heartbeat log is still attempted — both errors reported)
 *
 * GET /api/fleet-heartbeat
 *   - Public ping endpoint used by Fleet Control OS "Test Connection" button
 *   - No auth required
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import {
  authenticateFleetRequest,
  validateHeartbeatBody,
} from '@/lib/apiAuth';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Tenant-Id, X-Fleet-Id, X-Apex-Key',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** Public health-check — no auth, used by Fleet OS "Test Connection" */
export async function GET() {
  return NextResponse.json(
    { ok: true, service: 'AP3X Command Center', endpoint: 'fleet-heartbeat', serverTime: Date.now() },
    { headers: CORS }
  );
}

export async function POST(req: NextRequest) {
  const now = new Date().toISOString();

  try {
    const supabase = getSupabaseServerClient();

    // ── 1. Authentication ──
    const auth = await authenticateFleetRequest(req, supabase);
    if (!auth.ok) {
      return NextResponse.json(
        { ok: false, error: auth.error },
        { status: auth.status, headers: CORS }
      );
    }

    // ── 2. Parse body ──
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Request body is not valid JSON' },
        { status: 400, headers: CORS }
      );
    }

    // ── 3. Validate + normalise ──
    const fields = validateHeartbeatBody(body);

    // ── 4. Upsert fleet entity stats ──
    const { error: updateErr } = await supabase
      .from('fleet_entities')
      .update({
        vehicle_count:   fields.vehicle_count,
        active_vehicles: fields.active_vehicles,
        driver_count:    fields.driver_count,
        active_drivers:  fields.active_drivers,
        uptime_percent:  fields.uptime_percent,
        version:         fields.version,
        coordinates:     fields.coordinates,
        last_heartbeat:  now,
        status:          'online',
        updated_at:      now,
      })
      .eq('id', auth.fleetId);

    if (updateErr) {
      console.error('[fleet-heartbeat] fleet_entities update error:', updateErr.message);
      // Non-fatal — still log the heartbeat
    }

    // ── 5. Insert heartbeat log ──
    const { error: logErr } = await supabase
      .from('fleet_heartbeats')
      .insert({
        tenant_id:       auth.tenantId,
        fleet_id:        auth.fleetId,
        vehicle_count:   fields.vehicle_count,
        active_vehicles: fields.active_vehicles,
        driver_count:    fields.driver_count,
        active_drivers:  fields.active_drivers,
        uptime_percent:  fields.uptime_percent,
        version:         fields.version,
        coordinates:     fields.coordinates,
        received_at:     now,
      });

    if (logErr) {
      console.error('[fleet-heartbeat] fleet_heartbeats insert error:', logErr.message);
    }

    // ── 6. Report any write errors (non-fatal) ──
    const warnings: string[] = [];
    if (updateErr) warnings.push(`fleet_entities update: ${updateErr.message}`);
    if (logErr)    warnings.push(`fleet_heartbeats log: ${logErr.message}`);

    return NextResponse.json(
      {
        ok:         true,
        serverTime: Date.now(),
        message:    'Heartbeat received',
        ...(warnings.length > 0 && { warnings }),
      },
      { headers: CORS }
    );
  } catch (e) {
    console.error('[fleet-heartbeat] unhandled error:', e);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500, headers: CORS }
    );
  }
}
