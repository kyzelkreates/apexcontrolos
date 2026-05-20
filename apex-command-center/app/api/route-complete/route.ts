/**
 * POST /api/route-complete
 * Receives a completed route from Fleet Control Dashboard OR Driver App.
 * This is the primary data feed for ALL sustainability metrics in Apex.
 *
 * Body: RouteCompletePayload
 * {
 *   tenantId, fleetId, vehicleId, driverId, routeId,
 *   distanceKm, durationMin,
 *   fuelSavedL, co2SavedKg, fuelCostSavedUSD,
 *   optimisationSavingPercent, aiOptimised, onTimeDelivery, stops
 * }
 */

import { NextRequest, NextResponse } from 'next/server';

function cors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Apex-Key, X-Tenant-Id, X-Fleet-Id');
  return res;
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tenantId, fleetId, vehicleId, driverId, routeId,
      distanceKm, durationMin, fuelSavedL, co2SavedKg, fuelCostSavedUSD,
      optimisationSavingPercent, aiOptimised, onTimeDelivery, stops,
    } = body;

    if (!tenantId || !fleetId || !routeId) {
      return cors(NextResponse.json({ error: 'tenantId, fleetId, routeId required' }, { status: 400 }));
    }

    // Validate sustainability fields — compute any missing values
    const fuel = parseFloat(fuelSavedL) || 0;
    const co2 = parseFloat(co2SavedKg) || (fuel * 2.68);
    const cost = parseFloat(fuelCostSavedUSD) || (fuel * 1.35);

    // Structured route record that mirrors RouteMetric in types/index.ts
    const routeRecord = {
      id: routeId || `route_api_${Date.now()}`,
      tenantId,
      fleetId,
      vehicleId: vehicleId || 'unknown',
      driverId: driverId || 'unknown',
      routeId: routeId,
      distanceKm: parseFloat(distanceKm) || 0,
      durationMin: parseFloat(durationMin) || 0,
      optimisationSavingPercent: parseFloat(optimisationSavingPercent) || 0,
      fuelSavedL: fuel,
      co2SavedKg: co2,
      fuelCostSavedUSD: cost,
      startTime: Date.now() - (parseFloat(durationMin) || 0) * 60000,
      endTime: Date.now(),
      completedAt: Date.now(),
      aiOptimised: Boolean(aiOptimised),
      stops: parseInt(stops) || 0,
      onTimeDelivery: Boolean(onTimeDelivery),
    };

    // In a full server-side deployment this would be stored in a DB.
    // The client-side Apex dashboard reads from IndexedDB via storage.js.
    // This endpoint acts as the ingestion gateway — it accepts the payload
    // and returns it normalised so the Fleet/Driver app can confirm receipt.
    console.log(`[Route Complete] fleet=${fleetId} driver=${driverId} fuel=${fuel}L co2=${co2.toFixed(1)}kg opt=${optimisationSavingPercent}%`);

    return cors(NextResponse.json({
      ok: true,
      routeId: routeRecord.id,
      serverTime: Date.now(),
      // Return computed values so client can display them
      computed: {
        fuelSavedL: fuel,
        co2SavedKg: parseFloat(co2.toFixed(2)),
        fuelCostSavedUSD: parseFloat(cost.toFixed(2)),
        treesEquivalent: parseFloat((co2 / 21).toFixed(2)),
        carKmEquivalent: parseFloat((co2 / 0.12).toFixed(0)),
      },
      record: routeRecord,
    }));
  } catch {
    return cors(NextResponse.json({ error: 'Invalid payload' }, { status: 400 }));
  }
}
