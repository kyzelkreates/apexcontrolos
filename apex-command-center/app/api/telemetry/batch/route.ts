/**
 * POST /api/telemetry/batch
 * Receives batched telemetry events from Fleet Control OS instances.
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
    const events = body.events ?? [];
    const batchId = body.batchId ?? `batch-${Date.now()}`;
    const now = new Date().toISOString();

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ ok: true, batchId, accepted: 0, serverTime: Date.now() }, { headers: CORS });
    }

    // Sanitise and insert events (max 500 per batch)
    const rows = events.slice(0, 500).map((e: Record<string, unknown>) => ({
      id:          e.id ?? crypto.randomUUID(),
      batch_id:    batchId,
      tenant_id:   auth.tenantId,
      fleet_id:    auth.fleetId,
      vehicle_id:  e.vehicleId ?? null,
      driver_id:   e.driverId  ?? null,
      event_type:  e.eventType ?? 'fleet_update',
      severity:    e.severity  ?? 'info',
      payload:     e.payload   ?? {},
      processed:   false,
      recorded_at: e.timestamp ? new Date(Number(e.timestamp)).toISOString() : now,
      created_at:  now,
    }));

    const { error } = await supabase.from('telemetry_events').insert(rows);
    if (error) {
      console.error('[telemetry/batch] insert error:', error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: CORS });
    }

    return NextResponse.json(
      { ok: true, batchId, accepted: rows.length, serverTime: Date.now() },
      { headers: CORS }
    );
  } catch (e) {
    console.error('[telemetry/batch] error:', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500, headers: CORS });
  }
}
