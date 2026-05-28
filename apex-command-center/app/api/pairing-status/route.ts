/**
 * GET /api/pairing-status?code=APEX-XXXXXXXX-XXXX-FC
 *
 * Polled by Fleet Control OS every 10 seconds while awaiting pairing.
 * Returns pairing result once the admin has registered the fleet in Command Center.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabaseServer';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get('code')?.trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ paired: false, error: 'Missing code parameter' }, { status: 400, headers: CORS });
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('pairing_codes')
      .select('status, tenant_id, fleet_id, expires_at, paired_at')
      .eq('code', code)
      .single();

    if (error || !data) {
      return NextResponse.json({ paired: false, status: 'unknown' }, { headers: CORS });
    }

    if (data.status === 'used' && data.tenant_id && data.fleet_id) {
      // Fetch pairing token so Fleet Control OS can authenticate future requests
      const { data: fleetData } = await supabase
        .from('fleet_entities')
        .select('pairing_token')
        .eq('id', data.fleet_id)
        .single();

      return NextResponse.json({
        paired: true,
        tenantId: data.tenant_id,
        fleetId: data.fleet_id,
        pairingToken: fleetData?.pairing_token ?? null,
        pairedAt: data.paired_at,
      }, { headers: CORS });
    }

    if (data.status === 'expired' || new Date(data.expires_at) < new Date()) {
      return NextResponse.json({ paired: false, status: 'expired' }, { headers: CORS });
    }

    if (data.status === 'locked') {
      return NextResponse.json({ paired: false, status: 'locked' }, { headers: CORS });
    }

    return NextResponse.json({ paired: false, status: 'pending' }, { headers: CORS });
  } catch (e) {
    console.error('[pairing-status] error:', e);
    return NextResponse.json({ paired: false, error: 'Server error' }, { status: 500, headers: CORS });
  }
}
