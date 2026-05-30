/**
 * POST /api/route-complete
 *
 * Records a completed route from a Fleet Control OS instance.
 * Part of the locked event pipeline:
 *   Fleet OS → [this endpoint] → Supabase (route_metrics)
 *
 * VALIDATION:
 *   - Auth via authenticateFleetRequest
 *   - Body validated via validateRouteBody (required fields, numeric ranges)
 *   - vehicleId + driverId are required (not silently defaulted)
 *   - Derived values (co2_saved_kg, fuel_cost_saved_usd) computed only if not provided
 *   - All numerics clamped to sane ranges (no negative distances, no > 100% savings, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import {
  authenticateFleetRequest,
  validateRouteBody,
} from '@/lib/apiAuth';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Tenant-Id, X-Fleet-Id, X-Apex-Key',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
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
    const validation = validateRouteBody(body);
    if (!validation.ok) {
      return NextResponse.json(
        { ok: false, error: validation.reason },
        { status: 422, headers: CORS }
      );
    }

    const f = validation.fields;

    // ── 4. Insert route metric ──
    const { error: insertErr } = await supabase
      .from('route_metrics')
      .insert({
        tenant_id:                   auth.tenantId,
        fleet_id:                    auth.fleetId,
        vehicle_id:                  f.vehicle_id,
        driver_id:                   f.driver_id,
        route_id:                    f.route_id,
        distance_km:                 f.distance_km,
        duration_min:                f.duration_min,
        fuel_saved_l:                f.fuel_saved_l,
        co2_saved_kg:                f.co2_saved_kg,
        fuel_cost_saved_usd:         f.fuel_cost_saved_usd,
        optimisation_saving_percent: f.optimisation_saving_percent,
        ai_optimised:                f.ai_optimised,
        on_time_delivery:            f.on_time_delivery,
        stops:                       f.stops,
        completed_at:                now,
        created_at:                  now,
      });

    if (insertErr) {
      console.error('[route-complete] insert error:', insertErr.message, 'code:', insertErr.code);
      return NextResponse.json(
        { ok: false, error: `Database write failed: ${insertErr.message}` },
        { status: 500, headers: CORS }
      );
    }

    return NextResponse.json(
      { ok: true, routeId: f.route_id, serverTime: Date.now() },
      { headers: CORS }
    );
  } catch (e) {
    console.error('[route-complete] unhandled error:', e);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500, headers: CORS }
    );
  }
}
