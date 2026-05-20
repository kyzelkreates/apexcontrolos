/**
 * APEX COMMAND CENTER OS
 * lib/seed.ts — NO-OP
 *
 * Apex is a real-data-only master control platform.
 * All data enters via:
 *   - Fleet Control dashboards  → POST /api/fleet-heartbeat, /api/telemetry/batch
 *   - Driver apps               → POST /api/route-complete
 *   - Pairing engine            → registers tenants + fleets
 *
 * No demo data. No mock data. No seed data. Ever.
 */

export default async function seedDemoData(): Promise<{
  seeded: boolean;
  counts: { tenants: number; fleets: number; routes: number; telemetry: number; ai: number };
}> {
  return { seeded: false, counts: { tenants: 0, fleets: 0, routes: 0, telemetry: 0, ai: 0 } };
}
