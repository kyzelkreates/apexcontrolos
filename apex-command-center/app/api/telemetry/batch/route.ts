/**
 * POST /api/telemetry/batch
 * Receives a batch of telemetry events from Fleet Control Dashboard.
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
    const { batchId, tenantId, fleetId, events } = body;

    if (!tenantId || !fleetId || !Array.isArray(events)) {
      return cors(NextResponse.json({ error: 'tenantId, fleetId, events[] required' }, { status: 400 }));
    }

    console.log(`[Telemetry Batch] fleet=${fleetId} events=${events.length} batchId=${batchId}`);

    return cors(NextResponse.json({
      ok: true,
      batchId,
      accepted: events.length,
      serverTime: Date.now(),
    }));
  } catch {
    return cors(NextResponse.json({ error: 'Invalid payload' }, { status: 400 }));
  }
}
