// ============================================================
// APEX COMMAND CENTER OS — MASTER TYPE DEFINITIONS
// Single Source of Truth for all entity types
// ============================================================

export type TenantStatus = 'active' | 'suspended' | 'pending' | 'offline';
export type FleetStatus = 'online' | 'degraded' | 'offline' | 'maintenance';
export type VehicleStatus = 'active' | 'idle' | 'maintenance' | 'offline';
export type DeploymentStatus = 'deployed' | 'rolling' | 'failed' | 'rolledback' | 'pending';
export type AIProvider = 'ollama' | 'llama' | 'mistral' | 'deepseek' | 'qwen' | 'openai' | 'anthropic' | 'gemini';
export type AIInferenceSource = 'local' | 'cloud' | 'cached';
export type ExportFormat = 'pdf' | 'docx' | 'csv';
export type ExportType = 'executive' | 'tenant' | 'api_usage' | 'ai_optimisation' | 'fleet_performance' | 'operational';
export type RegionCode = 'NA' | 'EU' | 'APAC' | 'LATAM' | 'MEA' | 'GLOBAL';
export type TelemetryEventType = 'fleet_update' | 'vehicle_event' | 'route_complete' | 'ai_inference' | 'api_call' | 'error' | 'alert' | 'deployment' | 'heartbeat';

// ============================================================
// TENANT
// ============================================================
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  region: RegionCode;
  status: TenantStatus;
  registrationCode: string;
  pairingToken: string;
  fingerprint: string;
  createdAt: number;
  updatedAt: number;
  contactEmail: string;
  plan: 'starter' | 'growth' | 'enterprise';
  fleetCount: number;
  vehicleCount: number;
  driverCount: number;
  apiKeyHash: string;
  telemetryEnabled: boolean;
  lastSeen: number;
  metadata: Record<string, string>;
}

// ============================================================
// FLEET ENTITY
// ============================================================
export interface FleetEntity {
  id: string;
  tenantId: string;
  name: string;
  region: RegionCode;
  status: FleetStatus;
  vehicleCount: number;
  activeVehicles: number;
  driverCount: number;
  activeDrivers: number;
  uptimePercent: number;
  lastHeartbeat: number;
  version: string;
  deploymentId: string;
  telemetryEndpoint: string;
  createdAt: number;
  updatedAt: number;
  coordinates: { lat: number; lng: number };
  tags: string[];
}

// ============================================================
// TELEMETRY EVENT
// ============================================================
export interface TelemetryEvent {
  id: string;
  tenantId: string;
  fleetId: string;
  eventType: TelemetryEventType;
  timestamp: number;
  payload: Record<string, unknown>;
  processed: boolean;
  batchId: string;
  signature: string;
  size: number;
}

// ============================================================
// AI METRICS
// ============================================================
export interface AIMetric {
  id: string;
  tenantId: string;
  fleetId: string;
  provider: AIProvider;
  inferenceSource: AIInferenceSource;
  model: string;
  tokensUsed: number;
  latencyMs: number;
  cacheHit: boolean;
  cost: number;
  taskType: string;
  timestamp: number;
  success: boolean;
  fallbackTriggered: boolean;
}

// ============================================================
// API USAGE LOG
// ============================================================
export interface APIUsageLog {
  id: string;
  tenantId: string;
  fleetId: string;
  service: string;
  endpoint: string;
  method: string;
  calls: number;
  cost: number;
  tokens?: number;
  latencyAvgMs: number;
  errorRate: number;
  timestamp: number;
  category: 'routing' | 'traffic' | 'ai' | 'geocoding' | 'maps' | 'other';
}

// ============================================================
// ROUTE METRICS
// ============================================================
export interface RouteMetric {
  id: string;
  tenantId: string;
  fleetId: string;
  vehicleId: string;
  driverId: string;
  routeId: string;
  distanceKm: number;
  durationMin: number;
  optimisationSavingPercent: number;
  fuelSaved: number;
  co2Saved: number;
  startTime: number;
  endTime: number;
  completedAt: number;
  aiOptimised: boolean;
  stops: number;
  onTimeDelivery: boolean;
}

// ============================================================
// OPERATIONAL METRICS
// ============================================================
export interface OperationalMetric {
  id: string;
  tenantId: string;
  fleetId: string;
  period: string;
  efficiency: number;
  uptimePercent: number;
  deliverySuccessRate: number;
  avgRouteOptimisation: number;
  driverUtilisation: number;
  vehicleUtilisation: number;
  incidentCount: number;
  timestamp: number;
}

// ============================================================
// DEPLOYMENT LOG
// ============================================================
export interface DeploymentLog {
  id: string;
  tenantId: string;
  fleetId: string;
  version: string;
  previousVersion: string;
  status: DeploymentStatus;
  deployedAt: number;
  deployedBy: string;
  region: RegionCode;
  rollbackAvailable: boolean;
  notes: string;
  healthCheckPassed: boolean;
  vehiclesUpdated: number;
  vehiclesTotal: number;
  changelogs: string[];
}

// ============================================================
// FINANCIAL EVENT
// ============================================================
export interface FinancialEvent {
  id: string;
  tenantId: string;
  category: 'api_cost' | 'ai_cost' | 'infrastructure' | 'revenue' | 'optimisation_saving';
  amount: number;
  currency: string;
  description: string;
  timestamp: number;
  period: string;
  tags: string[];
}

// ============================================================
// PAIRING REGISTRATION
// ============================================================
export interface PairingRegistration {
  id: string;
  code: string;
  tenantId: string;
  fleetId: string;
  status: 'pending' | 'validated' | 'expired' | 'rejected';
  createdAt: number;
  expiresAt: number;
  validatedAt?: number;
  fingerprint: string;
  ipHash: string;
  attempts: number;
}

// ============================================================
// SYNC SNAPSHOT
// ============================================================
export interface SyncSnapshot {
  id: string;
  tenantId: string;
  snapshotAt: number;
  entityCounts: Record<string, number>;
  deltaHash: string;
  reconciled: boolean;
  size: number;
}

// ============================================================
// INFRASTRUCTURE METRIC
// ============================================================
export interface InfrastructureMetric {
  id: string;
  tenantId: string;
  timestamp: number;
  storageUsedMB: number;
  telemetryQueueDepth: number;
  processingLatencyMs: number;
  indexedDBSizeMB: number;
  localStorageSizeKB: number;
  activeFleets: number;
  batchesProcessed: number;
  droppedEvents: number;
}

// ============================================================
// EXPORT JOB
// ============================================================
export interface ExportJob {
  id: string;
  tenantId?: string;
  format: ExportFormat;
  type: ExportType;
  status: 'queued' | 'processing' | 'complete' | 'failed';
  createdAt: number;
  completedAt?: number;
  fileUrl?: string;
  fileSize?: number;
  params: Record<string, unknown>;
  error?: string;
}

// ============================================================
// DASHBOARD STATE
// ============================================================
export interface DashboardState {
  selectedTenantId: string | null;
  selectedFleetId: string | null;
  activeModule: string;
  sidebarCollapsed: boolean;
  dateRange: { from: number; to: number };
  refreshInterval: number;
  theme: 'dark';
  alertsVisible: boolean;
  mapCenter: { lat: number; lng: number; zoom: number };
}

// ============================================================
// GLOBAL AGGREGATE (computed)
// ============================================================
export interface GlobalAggregate {
  totalTenants: number;
  activeTenants: number;
  totalFleets: number;
  activeFleets: number;
  totalVehicles: number;
  activeVehicles: number;
  totalDrivers: number;
  activeDrivers: number;
  globalUptimePercent: number;
  globalEfficiency: number;
  totalApiCostToday: number;
  totalAiCostToday: number;
  totalAiTokensToday: number;
  localInferencePercent: number;
  telemetryEventsToday: number;
  deploymentsActive: number;
  alertsActive: number;
  routeOptimisationAvg: number;
}
