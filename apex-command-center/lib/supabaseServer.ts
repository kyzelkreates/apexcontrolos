/**
 * Server-side Supabase client — uses SERVICE_ROLE key.
 * Only import this in API routes (app/api/*) — NEVER in client components.
 * The service role key bypasses RLS.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function getSupabaseServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !key) throw new Error('Missing SUPABASE env vars on server');
  return createClient(url, key, { auth: { persistSession: false } });
}
