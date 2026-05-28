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
  if (typeof window === 'undefined') return null; // SSR guard

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

export function isSupabaseConfigured(): boolean {
  return getSupabaseClient() !== null;
}
