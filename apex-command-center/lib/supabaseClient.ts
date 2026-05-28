/**
 * AP3X CONTROL DASHBOARD
 * lib/supabaseClient.ts
 *
 * Single Supabase client. Reads URL + anon key from env vars.
 * Returns null if not configured — callers must guard.
 *
 * CONTRACT: Supabase is the ONLY source of truth. No mocks. No fallbacks.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  // SSR guard — browser-only singleton
  if (typeof window === 'undefined') return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

  if (!url || !key) return null;
  if (_client) return _client;

  try {
    _client = createClient(url, key, {
      auth: { persistSession: true },
      realtime: { params: { eventsPerSecond: 10 } },
    });
    return _client;
  } catch {
    return null;
  }
}

/**
 * SSR-safe configuration check.
 * On the server we check env vars directly (no window needed).
 * On the client we also verify the client can be created.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';
  if (!url || !key) return false;
  // On server, env vars being present is enough
  if (typeof window === 'undefined') return true;
  // On client, try to get/create the actual client
  return getSupabaseClient() !== null;
}
