/**
 * APEX COMMAND CENTER OS
 * core/dataMode.ts
 *
 * SINGLE SOURCE OF TRUTH for the system data mode.
 *
 * DATA_MODE values:
 *   "mock"   — use existing mock/seed data only (legacy fallback)
 *   "hybrid" — real IndexedDB/event data first, mock as fallback  ← DEFAULT
 *   "live"   — real data only, no mock fallback ever
 *
 * Switch manually in this file only. Never auto-switch to "live".
 */

export type DataMode = 'mock' | 'hybrid' | 'live';

export const DATA_MODE: DataMode = 'hybrid';

/** True when mock data is the primary source */
export const ENABLE_MOCK: boolean = DATA_MODE === 'mock';

/** True when mock data is allowed as a fallback */
export const ENABLE_FALLBACK: boolean = DATA_MODE !== 'live';

/** When true, the debug panel will expose mode + usage stats */
export const DATA_DEBUG: boolean = false;

export default { DATA_MODE, ENABLE_MOCK, ENABLE_FALLBACK, DATA_DEBUG };
