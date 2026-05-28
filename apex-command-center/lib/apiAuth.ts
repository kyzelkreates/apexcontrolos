/**
 * AP3X API Authentication helper
 * Used by all incoming Fleet Control OS API routes.
 *
 * Fleet Control OS must send:
 *   X-Tenant-Id:  string
 *   X-Fleet-Id:   string
 *   X-Apex-Key:   pairingToken
 */

import { SupabaseClient } from '@supabase/supabase-js';

export type AuthResult =
  | { ok: true;  tenantId: string; fleetId: string }
  | { ok: false; error: string;    status: number  };

export async function authenticateFleetRequest(
  req: Request,
  supabase: SupabaseClient
): Promise<AuthResult> {
  const tenantId = req.headers.get('x-tenant-id');
  const fleetId  = req.headers.get('x-fleet-id');
  const apexKey  = req.headers.get('x-apex-key');

  if (!tenantId || !fleetId || !apexKey) {
    return { ok: false, error: 'Missing headers: X-Tenant-Id, X-Fleet-Id, X-Apex-Key', status: 401 };
  }

  try {
    const { data, error } = await supabase
      .from('fleet_entities')
      .select('id, tenant_id, pairing_token, status')
      .eq('id', fleetId)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) return { ok: false, error: 'Fleet not found', status: 401 };
    if (data.pairing_token !== apexKey) return { ok: false, error: 'Invalid pairing token', status: 403 };
    if (data.status === 'offline') return { ok: false, error: 'Fleet is marked offline', status: 403 };

    return { ok: true, tenantId, fleetId };
  } catch {
    return { ok: false, error: 'Auth check failed', status: 500 };
  }
}
