/**
 * AP3X CONTROL DASHBOARD
 * lib/supabaseClient.ts
 *
 * Priority order for credentials:
 *   1. Runtime credentials stored in localStorage (set via Settings UI)
 *   2. NEXT_PUBLIC_* environment variables (baked at build time)
 *
 * This allows operators to configure Supabase without a redeploy.
 *
 * CONTRACT: Supabase is the ONLY source of truth. No mocks. No fallbacks.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const LS_URL_KEY  = 'ap3x_supabase_url';
const LS_KEY_KEY  = 'ap3x_supabase_anon_key';

let _client: SupabaseClient | null = null;

/** Read credentials — runtime localStorage wins over env vars */
export function getCredentials(): { url: string; anonKey: string } {
  if (typeof window === 'undefined') {
    return {
      url:     process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()       ?? '',
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()  ?? '',
    };
  }
  const url     = localStorage.getItem(LS_URL_KEY)  || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()      || '';
  const anonKey = localStorage.getItem(LS_KEY_KEY)  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';
  return { url, anonKey };
}

/** Persist runtime credentials to localStorage and reset the client singleton */
export function saveRuntimeCredentials(url: string, anonKey: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_URL_KEY, url.trim());
  localStorage.setItem(LS_KEY_KEY, anonKey.trim());
  _client = null; // force re-create on next getSupabaseClient()
}

/** Clear runtime credentials (revert to env vars) */
export function clearRuntimeCredentials(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LS_URL_KEY);
  localStorage.removeItem(LS_KEY_KEY);
  _client = null;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (typeof window === 'undefined') return null;

  const { url, anonKey } = getCredentials();
  if (!url || !anonKey) return null;
  if (_client) return _client;

  try {
    _client = createClient(url, anonKey, {
      auth: { persistSession: true },
      realtime: { params: { eventsPerSecond: 10 } },
    });
    return _client;
  } catch {
    return null;
  }
}

/** Create a one-off test client (never stored as singleton) */
export function createTestClient(url: string, anonKey: string): SupabaseClient | null {
  try {
    return createClient(url.trim(), anonKey.trim(), {
      auth: { persistSession: false },
    });
  } catch {
    return null;
  }
}

/** SSR-safe: true if credentials exist from any source */
export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getCredentials();
  if (!url || !anonKey) return false;
  if (typeof window === 'undefined') return true;
  return getSupabaseClient() !== null;
}

/** True if credentials came from localStorage (runtime-configured) */
export function isRuntimeConfigured(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(localStorage.getItem(LS_URL_KEY) && localStorage.getItem(LS_KEY_KEY));
}

/** True if credentials came from env vars */
export function isEnvConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}
