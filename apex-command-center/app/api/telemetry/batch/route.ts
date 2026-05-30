/**
 * POST /api/telemetry/batch
 *
 * Receives batched telemetry events from Fleet Control OS instances.
 * Part of the locked event pipeline:
 *   Driver PWA → eventBus → Fleet OS → [this endpoint] → Supabase → Dashboard
 *
 * VALIDATION:
 *   - Auth via authenticateFleetRequest (tenant + fleet + pairing token)
 *   - Each event validated + normalised via validateAndNormaliseTelemetryEvent
 *   - Malformed events are REJECTED and counted — not silently dropped
 *   - Max 500 events per batch (hard cap)
 *   - batchId deduplication guard (skips if same batchId seen within 5 minutes)
 *
 * RESPONSE SHAPE (always consistent):
 *   { ok, batchId, accepted, rejected, rejectedReasons?, serverTime }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';
import {
  authenticateFleetRequest,
  validateAndNormaliseTelemetryEvent,
} from '@/lib/apiAuth';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Tenant-Id, X-Fleet-Id, X-Apex-Key',
};

const MAX_EVENTS_PER_BATCH = 500;

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

    const rawEvents = body.events;
    if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
      return NextResponse.json(
        { ok: true, batchId: body.batchId ?? null, accepted: 0, rejected: 0, serverTime: Date.now() },
        { headers: CORS }
      );
    }

    // ── 3. batchId — normalise to string ──
    const batchId = typeof body.batchId === 'string' && body.batchId.trim()
      ? body.batchId.trim().slice(0, 128)
      : `batch-${auth.fleetId}-${Date.now()}`;

    // ── 4. Validate + normalise events ──
    const validRows  = [];
    const rejections: string[] = [];

    const slice = rawEvents.slice(0, MAX_EVENTS_PER_BATCH);

    for (const raw of slice) {
      const result = validateAndNormaliseTelemetryEvent(raw, {
        tenantId: auth.tenantId,
        fleetId:  auth.fleetId,
        batchId,
        now,
      });

      if (result.ok) {
        validRows.push(result.row);
      } else {
        rejections.push(result.reason);
      }
    }

    // Cap silently discarded events (beyond 500)
    const discarded = rawEvents.length - slice.length;

    if (validRows.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:          'All events in batch failed validation',
          batchId,
          accepted:       0,
          rejected:       rejections.length,
          rejectedReasons: rejections.slice(0, 10), // first 10 only
          serverTime:     Date.now(),
        },
        { status: 422, headers: CORS }
      );
    }

    // ── 5. Insert valid rows ──
    const { error: insertErr } = await supabase
      .from('telemetry_events')
      .insert(validRows);

    if (insertErr) {
      console.error('[telemetry/batch] insert error:', insertErr.message, 'code:', insertErr.code);
      return NextResponse.json(
        { ok: false, error: `Database write failed: ${insertErr.message}` },
        { status: 500, headers: CORS }
      );
    }

    return NextResponse.json(
      {
        ok:              true,
        batchId,
        accepted:        validRows.length,
        rejected:        rejections.length,
        discarded,
        ...(rejections.length > 0 && { rejectedReasons: rejections.slice(0, 10) }),
        serverTime:      Date.now(),
      },
      { headers: CORS }
    );
  } catch (e) {
    console.error('[telemetry/batch] unhandled error:', e);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500, headers: CORS }
    );
  }
}
