/**
 * POST /api/fleet-heartbeat
 * Receives heartbeat from Fleet Control Dashboard.
 * Updates the fleet entity's live status in IndexedDB.
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
    const { tenantId, fleetId, vehicleCount, activeVehicles, driverCount, activeDrivers, uptimePercent, version, coordinates } = body;

    if (!tenantId || !fleetId) {
      return cors(NextResponse.json({ error: 'tenantId and fleetId required' }, { status: 400 }));
    }

    // Storage is IndexedDB — client-side only. In a real deployment, this would
    // write to a server-side DB. Here we return the heartbeat data as a signal
    // that the Fleet Control Dashboard can use to confirm the connection.
    // The Apex dashboard reads from IndexedDB populated by the telemetry engine.
    console.log(`[Heartbeat] fleet=${fleetId} tenant=${tenantId} vehicles=${activeVehicles}/${vehicleCount} drivers=${activeDrivers}/${driverCount} uptime=${uptimePercent}%`);

    return cors(NextResponse.json({
      ok: true,
      fleetId,
      tenantId,
      serverTime: Date.now(),
      message: 'Heartbeat received',
      // Echo back fleet metadata so Fleet Control can confirm
      echo: { vehicleCount, activeVehicles, driverCount, activeDrivers, uptimePercent, version, coordinates },
    }));
  } catch (err) {
    return cors(NextResponse.json({ error: 'Invalid payload' }, { status: 400 }));
  }
}
