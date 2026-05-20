/**
 * APEX COMMAND CENTER OS
 * lib/seed.ts — DISABLED
 *
 * All data now comes from real Fleet Control dashboards and Driver apps
 * via the telemetry ingestion API (see storage/storage.js ingest methods).
 *
 * This file is a no-op placeholder kept for import compatibility.
 */

export default async function seedDemoData(): Promise<{
  seeded: boolean;
  counts: { tenants: number; fleets: number; telemetry: number };
}> {
  return { seeded: false, counts: { tenants: 0, fleets: 0, telemetry: 0 } };
}
