/**
 * GET /api/pairing-status?code=APEX-XXXXXXXX-XXXX-FC
 *
 * Polled by Fleet Control OS every ~10 seconds while awaiting pairing.
 * Returns pairing result once the admin has registered the fleet in Control OS.
 *
 * VALIDATION:
 *   - Code is sanitized: trim + strip spaces + uppercase (matches sanitizePairingCode)
 *   - Format validated against /^APEX-[A-Z0-9]{8}-[A-Z0-9]{4}-FC$/ before DB query
 *   - Expired codes detected at query time + auto-updated in DB
 *   - No auth required (code IS the credential for this poll)
 *
 * RESPONSE SHAPES:
 *   { paired: true,  tenantId, fleetId, pairingToken, pairedAt }  — success
 *   { paired: false, status: 'pending' | 'expired' | 'locked' | 'unknown' }  — waiting/error
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Same regex as federationService.ts — single canonical format
const PAIRING_REGEX = /^APEX-[A-Z0-9]{8}-[A-Z0-9]{4}-FC$/;

function sanitiseCode(raw: string): string {
  return raw.trim().replace(/\s+/g, '').toUpperCase();
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  try {
    // ── 1. Extract + sanitise code ──
    const rawCode = req.nextUrl.searchParams.get('code') ?? '';
    if (!rawCode) {
      return NextResponse.json(
        { paired: false, error: 'Missing required query parameter: code' },
        { status: 400, headers: CORS }
      );
    }

    const code = sanitiseCode(rawCode);

    // ── 2. Format validation — reject before hitting DB ──
    if (!PAIRING_REGEX.test(code)) {
      return NextResponse.json(
        { paired: false, error: 'Invalid code format. Expected: APEX-XXXXXXXX-XXXX-FC' },
        { status: 400, headers: CORS }
      );
    }

    const supabase = getSupabaseServerClient();

    // ── 3. Fetch code record ──
    const { data, error } = await supabase
      .from('pairing_codes')
      .select('id, status, tenant_id, fleet_id, expires_at, paired_at, attempts')
      .eq('code', code)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { paired: false, status: 'unknown' },
        { headers: CORS }
      );
    }

    // ── 4. Already paired ──
    if (data.status === 'used' && data.tenant_id && data.fleet_id) {
      const { data: fleetData } = await supabase
        .from('fleet_entities')
        .select('pairing_token')
        .eq('id', data.fleet_id)
        .single();

      return NextResponse.json(
        {
          paired:       true,
          tenantId:     data.tenant_id,
          fleetId:      data.fleet_id,
          pairingToken: fleetData?.pairing_token ?? null,
          pairedAt:     data.paired_at,
        },
        { headers: CORS }
      );
    }

    // ── 5. Locked ──
    if (data.status === 'locked') {
      return NextResponse.json(
        { paired: false, status: 'locked', attempts: data.attempts },
        { headers: CORS }
      );
    }

    // ── 6. Expiry check (status field + clock) ──
    const isExpiredByStatus = data.status === 'expired';
    const isExpiredByClock  = new Date(data.expires_at) < new Date();

    if (isExpiredByStatus || isExpiredByClock) {
      // If clock says expired but DB still shows pending — fix it in DB
      if (!isExpiredByStatus && isExpiredByClock) {
        // fire-and-forget — don't block response
        void supabase
          .from('pairing_codes')
          .update({ status: 'expired' })
          .eq('id', data.id);
      }
      return NextResponse.json(
        { paired: false, status: 'expired' },
        { headers: CORS }
      );
    }

    // ── 7. Still pending ──
    return NextResponse.json(
      { paired: false, status: 'pending' },
      { headers: CORS }
    );
  } catch (e) {
    console.error('[pairing-status] unhandled error:', e);
    return NextResponse.json(
      { paired: false, error: 'Internal server error' },
      { status: 500, headers: CORS }
    );
  }
}
