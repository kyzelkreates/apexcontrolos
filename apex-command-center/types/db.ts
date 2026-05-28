/**
 * AP3X CONTROL DASHBOARD — LOCKED DATABASE TYPES
 *
 * PERMITTED TABLES (read from contract):
 *   profiles · tasks · drivers · vehicles
 *   job_assignments · driver_locations
 *   fleet_nodes · dashboard_events · settings
 *
 * DO NOT add, rename, or reinterpret any field or table.
 * Supabase is the only source of truth.
 */

// ─────────────────────────────────────────────────────────────────
// profiles
// ─────────────────────────────────────────────────────────────────
export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: 'admin' | 'driver' | 'dispatcher' | string;
  avatar_url: string | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────
// tasks
// ─────────────────────────────────────────────────────────────────
export type TaskStatus =
  | 'pending'
  | 'assigned'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  location: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────
// drivers
// ─────────────────────────────────────────────────────────────────
export type DriverStatus = 'available' | 'on_task' | 'offline' | 'break';

export interface Driver {
  id: string;
  profile_id: string | null;
  name: string;
  phone: string | null;
  status: DriverStatus;
  vehicle_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────
// vehicles
// ─────────────────────────────────────────────────────────────────
export type VehicleStatus = 'active' | 'idle' | 'maintenance' | 'offline';

export interface Vehicle {
  id: string;
  name: string;
  plate: string | null;
  type: string | null;
  status: VehicleStatus;
  driver_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────
// job_assignments  — READ-ONLY from this app
// ─────────────────────────────────────────────────────────────────
export type AssignmentStatus =
  | 'assigned'
  | 'accepted'
  | 'in_progress'
  | 'complete'
  | 'cancelled';

export interface JobAssignment {
  id: string;
  task_id: string;
  driver_id: string;
  vehicle_id: string;
  status: AssignmentStatus;
  assigned_at: string;
  updated_at: string | null;
  notes: string | null;
}

// ─────────────────────────────────────────────────────────────────
// driver_locations  — READ-ONLY live location feed
// ─────────────────────────────────────────────────────────────────
export interface DriverLocation {
  id: string;
  driver_id: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed_kmh: number | null;
  recorded_at: string;
}

// ─────────────────────────────────────────────────────────────────
// fleet_nodes  — READ-ONLY fleet infrastructure status
// ─────────────────────────────────────────────────────────────────
export type FleetNodeStatus = 'online' | 'degraded' | 'offline' | 'maintenance';
export type FleetNodeType   = 'hub' | 'depot' | 'checkpoint' | 'relay' | string;

export interface FleetNode {
  id: string;
  name: string;
  type: FleetNodeType;
  status: FleetNodeStatus;
  lat: number | null;
  lng: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────
// dashboard_events  — READ-ONLY system event feed
// ─────────────────────────────────────────────────────────────────
export type DashboardEventSeverity = 'info' | 'warning' | 'critical';
export type DashboardEventType =
  | 'task_created'
  | 'task_assigned'
  | 'task_accepted'
  | 'task_in_progress'
  | 'task_completed'
  | 'task_cancelled'
  | 'driver_online'
  | 'driver_offline'
  | 'driver_on_task'
  | 'vehicle_alert'
  | 'fleet_node_alert'
  | 'system'
  | string;

export interface DashboardEvent {
  id: string;
  event_type: DashboardEventType;
  severity: DashboardEventSeverity;
  title: string;
  description: string | null;
  entity_type: string | null;  // 'task' | 'driver' | 'vehicle' | 'fleet_node' etc.
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────
// settings  — READ/WRITE admin configuration
// ─────────────────────────────────────────────────────────────────
export interface SystemSetting {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

// ─────────────────────────────────────────────────────────────────
// Convenience: task with joined assignment + driver + vehicle
// ─────────────────────────────────────────────────────────────────
export interface TaskWithAssignment extends Task {
  assignment: JobAssignment | null;
  driver: Driver | null;
  vehicle: Vehicle | null;
}
