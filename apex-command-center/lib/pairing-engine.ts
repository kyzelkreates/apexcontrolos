/**
 * APEX COMMAND CENTER OS
 * lib/pairing-engine.ts
 *
 * Secure entity registration and pairing workflow.
 * Validates Fleet Control OS registration codes,
 * creates isolated tenant environments, establishes telemetry links.
 */

import { v4 as uuid } from 'uuid';
import Storage from '@/storage/storage';
import type { Tenant, FleetEntity, PairingRegistration, RegionCode } from '@/types';

// ============================================================
// PAIRING CODE FORMAT
// APEX-{8HEX}-{4HEX}-{ENV}
// ============================================================

export function generatePairingCode(): string {
  const hex8 = uuid().replace(/-/g, '').substring(0, 8).toUpperCase();
  const hex4 = uuid().replace(/-/g, '').substring(0, 4).toUpperCase();
  return `APEX-${hex8}-${hex4}-CC`;
}

function isValidCodeFormat(code: string): boolean {
  return /^APEX-[A-F0-9]{8}-[A-F0-9]{4}-[A-Z]{2,4}$/.test(code);
}

function generateFingerprint(code: string, userAgent: string): string {
  const raw = `${code}:${userAgent}:${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return `fp_${Math.abs(hash).toString(16)}`;
}

// ============================================================
// STEP 1 — Initiate Pairing
// Returns a pending registration for user to submit their Fleet code
// ============================================================

export async function initiatePairing(
  code: string,
  userAgent: string = 'apex-cc'
): Promise<{ success: boolean; registrationId?: string; error?: string }> {
  const normalised = code.trim().toUpperCase();

  if (!isValidCodeFormat(normalised)) {
    return {
      success: false,
      error: 'Invalid pairing code format. Expected: APEX-XXXXXXXX-XXXX-XX',
    };
  }

  // Check for existing code
  const existing = await Storage.Pairing.getByCode(normalised);
  if (existing) {
    if (existing.status === 'validated') {
      return { success: false, error: 'This code has already been used.' };
    }
    if (existing.expiresAt < Date.now()) {
      await Storage.Pairing.delete(existing.id);
    } else if (existing.attempts >= 5) {
      return { success: false, error: 'Too many validation attempts for this code.' };
    }
  }

  const registration: PairingRegistration = {
    id: `pair_${uuid()}`,
    code: normalised,
    tenantId: '',
    fleetId: '',
    status: 'pending',
    createdAt: Date.now(),
    expiresAt: Date.now() + 3600000, // 1 hour
    fingerprint: generateFingerprint(normalised, userAgent),
    ipHash: `ip_${uuid()}`, // simulated
    attempts: 0,
  };

  await Storage.Pairing.save(registration);
  Storage.Audit.log({
    action: 'pairing_initiated',
    entityType: 'pairing_registration',
    entityId: registration.id,
    code: normalised,
  });

  return { success: true, registrationId: registration.id };
}

// ============================================================
// STEP 2 — Validate and Complete Pairing
// Creates Tenant + Fleet entity upon successful validation
// ============================================================

export interface PairingDetails {
  companyName: string;
  region: RegionCode;
  contactEmail: string;
  fleetName: string;
  vehicleCount: number;
  plan: 'starter' | 'growth' | 'enterprise';
}

export async function completePairing(
  registrationId: string,
  details: PairingDetails
): Promise<{
  success: boolean;
  tenantId?: string;
  fleetId?: string;
  pairingToken?: string;
  error?: string;
}> {
  const registration = await Storage.Pairing.get(registrationId);

  if (!registration) {
    return { success: false, error: 'Registration not found.' };
  }

  if (registration.status !== 'pending') {
    return { success: false, error: `Registration status is ${registration.status}.` };
  }

  if (registration.expiresAt < Date.now()) {
    await Storage.Pairing.save({ ...registration, status: 'expired' });
    return { success: false, error: 'Registration code has expired.' };
  }

  // Increment attempts
  await Storage.Pairing.save({ ...registration, attempts: registration.attempts + 1 });

  // Validate company name (basic)
  if (!details.companyName || details.companyName.length < 2) {
    return { success: false, error: 'Company name is required.' };
  }

  // Create isolated Tenant
  const slug = details.companyName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const existingTenants = await Storage.Tenants.getAll();
  const slugExists = (existingTenants as Tenant[]).some((t: Tenant) => t.slug === slug);
  const finalSlug = slugExists ? `${slug}-${uuid().substring(0, 4)}` : slug;

  const pairingToken = uuid();
  const tenant: Tenant = {
    id: `tenant_${uuid()}`,
    name: details.companyName,
    slug: finalSlug,
    region: details.region,
    status: 'active',
    registrationCode: registration.code,
    pairingToken,
    fingerprint: registration.fingerprint,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    contactEmail: details.contactEmail,
    plan: details.plan,
    fleetCount: 1,
    vehicleCount: details.vehicleCount,
    driverCount: Math.floor(details.vehicleCount * 0.8),
    apiKeyHash: `hash_${uuid()}`,
    telemetryEnabled: true,
    lastSeen: Date.now(),
    metadata: {},
  };

  // Create isolated Fleet Entity
  const fleet: FleetEntity = {
    id: `fleet_${uuid()}`,
    tenantId: tenant.id,
    name: details.fleetName || `${details.companyName} Fleet`,
    region: details.region,
    status: 'online',
    vehicleCount: details.vehicleCount,
    activeVehicles: Math.floor(details.vehicleCount * 0.7),
    driverCount: tenant.driverCount,
    activeDrivers: Math.floor(tenant.driverCount * 0.7),
    uptimePercent: 100,
    lastHeartbeat: Date.now(),
    version: '1.0.0',
    deploymentId: `dep_${uuid()}`,
    telemetryEndpoint: `/api/telemetry/${finalSlug}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    coordinates: getRegionCoordinates(details.region),
    tags: [details.region, details.plan],
  };

  // Persist isolated entities
  await Storage.Tenants.save(tenant);
  await Storage.Fleets.save(fleet);

  // Mark registration as validated
  await Storage.Pairing.save({
    ...registration,
    status: 'validated',
    tenantId: tenant.id,
    fleetId: fleet.id,
    validatedAt: Date.now(),
  });

  Storage.Audit.log({
    action: 'pairing_completed',
    entityType: 'tenant',
    entityId: tenant.id,
    tenantName: details.companyName,
    fleetId: fleet.id,
  });

  Storage.Alerts.add({
    type: 'success',
    title: 'New Fleet Connected',
    message: `${details.companyName} (${details.region}) has been successfully paired.`,
    tenantId: tenant.id,
  });

  return {
    success: true,
    tenantId: tenant.id,
    fleetId: fleet.id,
    pairingToken,
  };
}

// ============================================================
// UNPAIR (Disconnect) Fleet
// ============================================================

export async function unpairFleet(
  tenantId: string,
  fleetId: string
): Promise<{ success: boolean; error?: string }> {
  const fleet = await Storage.Fleets.get(fleetId);
  if (!fleet || fleet.tenantId !== tenantId) {
    return { success: false, error: 'Fleet not found or tenant mismatch.' };
  }

  await Storage.Fleets.save({ ...fleet, status: 'offline', updatedAt: Date.now() });

  Storage.Audit.log({
    action: 'fleet_unpaired',
    entityType: 'fleet',
    entityId: fleetId,
    tenantId,
  });

  return { success: true };
}

// ============================================================
// SUSPEND TENANT
// ============================================================

export async function suspendTenant(
  tenantId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const tenant = await Storage.Tenants.get(tenantId);
  if (!tenant) return { success: false, error: 'Tenant not found.' };

  await Storage.Tenants.save({
    ...tenant,
    status: 'suspended',
    metadata: { ...tenant.metadata, suspendReason: reason, suspendedAt: String(Date.now()) },
  });

  Storage.Audit.log({
    action: 'tenant_suspended',
    entityType: 'tenant',
    entityId: tenantId,
    reason,
  });

  return { success: true };
}

// ============================================================
// REACTIVATE TENANT
// ============================================================

export async function reactivateTenant(
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  const tenant = await Storage.Tenants.get(tenantId);
  if (!tenant) return { success: false, error: 'Tenant not found.' };

  await Storage.Tenants.save({ ...tenant, status: 'active', updatedAt: Date.now() });

  Storage.Audit.log({
    action: 'tenant_reactivated',
    entityType: 'tenant',
    entityId: tenantId,
  });

  return { success: true };
}

// ============================================================
// HELPERS
// ============================================================

function getRegionCoordinates(region: RegionCode): { lat: number; lng: number } {
  const coords: Record<RegionCode, { lat: number; lng: number }> = {
    NA: { lat: 39.5, lng: -98.35 },
    EU: { lat: 51.5, lng: 10.0 },
    APAC: { lat: 35.0, lng: 135.0 },
    LATAM: { lat: -14.0, lng: -51.0 },
    MEA: { lat: 25.0, lng: 45.0 },
    GLOBAL: { lat: 20.0, lng: 0 },
  };
  return coords[region] || { lat: 0, lng: 0 };
}

export function getPendingRegistrations(): Promise<PairingRegistration[]> {
  return Storage.Pairing.getByStatus('pending');
}

export function getValidatedRegistrations(): Promise<PairingRegistration[]> {
  return Storage.Pairing.getByStatus('validated');
}
