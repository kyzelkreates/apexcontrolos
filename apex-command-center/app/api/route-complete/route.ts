/**
 * POST /api/route-complete
 * Records a completed route from a Fleet Control OS instance.
 * Computes and stores CO2/fuel savings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import { authenticateFleetRequest } from '@/lib/apiAuth';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Tenant-Id, X-Fleet-Id, X-Apex-Key',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
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

    // Compute derived values if not provided
    const fuelSavedL         = Number(body.fuelSavedL ?? 0);
    const co2SavedKg         = Number(body.co2SavedKg ?? (fuelSavedL * 2.68));
    const fuelCostSavedUSD   = Number(body.fuelCostSavedUSD ?? (fuelSavedL * 1.35));
    const routeId            = body.routeId ?? crypto.randomUUID();

    const { error } = await supabase.from('route_metrics').insert({
      tenant_id:                    auth.tenantId,
      fleet_id:                     auth.fleetId,
      vehicle_id:                   body.vehicleId,
      driver_id:                    body.driverId,
      route_id:                     routeId,
      distance_km:                  Number(body.distanceKm ?? 0),
      duration_min:                 Number(body.durationMin ?? 0),
      fuel_saved_l:                 fuelSavedL,
      co2_saved_kg:                 co2SavedKg,
      fuel_cost_saved_usd:          fuelCostSavedUSD,
      optimisation_saving_percent:  Number(body.optimisationSavingPercent ?? 0),
      ai_optimised:                 Boolean(body.aiOptimised ?? false),
      on_time_delivery:             Boolean(body.onTimeDelivery ?? false),
      stops:                        Number(body.stops ?? 0),
      completed_at:                 now,
      created_at:                   now,
    });

    if (error) {
      console.error('[route-complete] insert error:', error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: CORS });
    }

    return NextResponse.json({
      ok: true,
      routeId,
      serverTime: Date.now(),
      computed: { co2SavedKg, fuelCostSavedUSD, fuelSavedL },
    }, { headers: CORS });
  } catch (e) {
    console.error('[route-complete] error:', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500, headers: CORS });
  }
}
