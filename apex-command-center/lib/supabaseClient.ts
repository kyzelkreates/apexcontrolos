/**
 * APEX COMMAND CENTER OS
 * lib/supabaseClient.ts — Supabase Client Factory
 *
 * Reads credentials from Storage.Config (set via Settings → Supabase panel).
 * Returns null when credentials are not configured — caller must check.
 *
 * RULES:
 *   - Never hardcode credentials
 *   - Never throw — always return null on missing/invalid config
 *   - Singleton per URL so we don't create duplicate connections
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Storage from '@/storage/storage';

let _client: SupabaseClient | null = null;
let _lastUrl = '';
let _lastKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  if (typeof window === 'undefined') return null; // SSR guard

  const config = Storage.Config.get() as Record<string, unknown>;
  const url  = (config.supabaseUrl  as string | undefined)?.trim() ?? '';
  const key  = (config.supabaseAnonKey as string | undefined)?.trim() ?? '';

  if (!url || !key) return null;

  // Return cached client if credentials haven't changed
  if (_client && url === _lastUrl && key === _lastKey) return _client;

  try {
    _client  = createClient(url, key, {
      auth:     { persistSession: false },
      realtime: { params: { eventsPerSecond: 10 } },
    });
    _lastUrl = url;
    _lastKey = key;
    return _client;
  } catch {
    _client = null;
    return null;
  }
}

/** True when Supabase credentials are stored and a client can be built */
export function isSupabaseConfigured(): boolean {
  return getSupabaseClient() !== null;
}
