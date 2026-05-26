/**
 * APEX COMMAND CENTER OS
 * core/dataResolver.ts
 *
 * UNIFIED DATA RESOLVER
 *
 * Priority order (always):
 *   1. live   — IndexedDB / event stores (most current)
 *   2. local  — localStorage / IndexedDB persisted fallback
 *   3. mock   — static mock/seed data (only when ENABLE_FALLBACK is true)
 *
 * All functions are null-safe and never throw.
 * Tracks fallback usage for DATA_DEBUG panel.
 */

import { ENABLE_FALLBACK, DATA_DEBUG } from './dataMode';

// ── Internal debug counters ──────────────────────────────────────────────────

const _stats: Record<string, { live: number; local: number; mock: number }> = {};

function _track(module: string, source: 'live' | 'local' | 'mock') {
  if (!DATA_DEBUG) return;
  if (!_stats[module]) _stats[module] = { live: 0, local: 0, mock: 0 };
  _stats[module][source]++;
}

/** Returns raw debug stats (only useful when DATA_DEBUG = true) */
export function getResolverStats() {
  return { ..._stats };
}

/** Resets debug counters */
export function resetResolverStats() {
  Object.keys(_stats).forEach((k) => delete _stats[k]);
}

// ── Type helpers ─────────────────────────────────────────────────────────────

type Nullable<T> = T | null | undefined;

function hasValue<T>(v: Nullable<T>): v is T {
  if (v === null || v === undefined) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

// ── Core resolvers ───────────────────────────────────────────────────────────

/**
 * resolveValue — picks the first non-empty value in priority order.
 *
 * @param live   Data from IndexedDB / live event store
 * @param local  Data from localStorage / secondary IndexedDB store
 * @param mock   Static mock/seed data
 * @param module Optional module name for debug tracking
 */
export function resolveValue<T>(
  live: Nullable<T>,
  local: Nullable<T>,
  mock: Nullable<T>,
  module = 'unknown'
): T | null {
  if (hasValue(live)) {
    _track(module, 'live');
    return live as T;
  }
  if (hasValue(local)) {
    _track(module, 'local');
    return local as T;
  }
  if (ENABLE_FALLBACK && hasValue(mock)) {
    _track(module, 'mock');
    return mock as T;
  }
  return null;
}

/**
 * resolveArray — picks the first non-empty array in priority order.
 * Always returns an array (never null).
 *
 * @param live   Array from IndexedDB / live event store
 * @param local  Array from localStorage / secondary IndexedDB store
 * @param mock   Static mock array
 * @param module Optional module name for debug tracking
 */
export function resolveArray<T>(
  live: Nullable<T[]>,
  local: Nullable<T[]>,
  mock: Nullable<T[]>,
  module = 'unknown'
): T[] {
  if (Array.isArray(live) && live.length > 0) {
    _track(module, 'live');
    return live;
  }
  if (Array.isArray(local) && local.length > 0) {
    _track(module, 'local');
    return local;
  }
  if (ENABLE_FALLBACK && Array.isArray(mock) && mock.length > 0) {
    _track(module, 'mock');
    return mock;
  }
  return [];
}

/**
 * safeSum — sums a numeric field across an array.
 * Returns 0 if array is empty or field is missing.
 *
 * @param source  Array of objects
 * @param key     Field name to sum (must be numeric)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safeSum<T extends object>(
  source: Nullable<T[]>,
  key: keyof T
): number {
  if (!Array.isArray(source) || source.length === 0) return 0;
  return source.reduce((acc, item) => {
    const v = (item as Record<string | symbol, unknown>)[key as string | symbol];
    return acc + (typeof v === 'number' ? v : parseFloat(String(v ?? 0)) || 0);
  }, 0);
}

/**
 * safeGroupBy — groups array items by a string key.
 * Returns an empty object if source is empty.
 *
 * @param source  Array of objects
 * @param key     Field name to group by
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safeGroupBy<T extends object>(
  source: Nullable<T[]>,
  key: keyof T
): Record<string, T[]> {
  if (!Array.isArray(source) || source.length === 0) return {};
  return source.reduce<Record<string, T[]>>((acc, item) => {
    const k = String((item as Record<string | symbol, unknown>)[key as string | symbol] ?? '__unknown__');
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

/**
 * safeAvg — averages a numeric field across an array.
 * Returns 0 if array is empty.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safeAvg<T extends object>(
  source: Nullable<T[]>,
  key: keyof T
): number {
  if (!Array.isArray(source) || source.length === 0) return 0;
  return safeSum(source, key) / source.length;
}

/**
 * safeFilter — filters an array, returning [] if source is null/undefined.
 */
export function safeFilter<T>(
  source: Nullable<T[]>,
  predicate: (item: T) => boolean
): T[] {
  if (!Array.isArray(source)) return [];
  return source.filter(predicate);
}

/**
 * safeLatest — returns the N most recent items sorted by a timestamp key.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safeLatest<T extends object>(
  source: Nullable<T[]>,
  timestampKey: keyof T,
  n = 10
): T[] {
  if (!Array.isArray(source) || source.length === 0) return [];
  return [...source]
    .sort((a, b) => Number((b as Record<string|symbol,unknown>)[timestampKey as string|symbol]) - Number((a as Record<string|symbol,unknown>)[timestampKey as string|symbol]))
    .slice(0, n);
}

export default {
  resolveValue,
  resolveArray,
  safeSum,
  safeGroupBy,
  safeAvg,
  safeFilter,
  safeLatest,
  getResolverStats,
  resetResolverStats,
};
