/**
 * APEX COMMAND CENTER OS
 * core/dataMode.ts
 *
 * Data mode: 'live' — Supabase + IndexedDB only.
 * Demo/seed data is permanently disabled.
 */

export type DataMode = 'mock' | 'hybrid' | 'live';

export const DATA_MODE: DataMode = 'live';

/** Always false in live mode — no mock data ever */
export const ENABLE_MOCK: boolean = false;

/** Always false in live mode — no fallback seeding ever */
export const ENABLE_FALLBACK: boolean = false;

/** Set true in local dev to log data-source decisions */
export const DATA_DEBUG: boolean = false;

export default { DATA_MODE, ENABLE_MOCK, ENABLE_FALLBACK, DATA_DEBUG };
