/**
 * AP3X CONTROL DASHBOARD — DATABASE TYPES
 * Mirrors the LOCKED Supabase schema exactly.
 *
 * Tables: profiles · tasks · drivers · vehicles · job_assignments · driver_locations
 * DO NOT add tables (no jobs, no trips, no custom systems)
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
// tasks  (this is the job record — NOT the deprecated jobs table)
// ─────────────────────────────────────────────────────────────────
export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'complete' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  location: string | null;
  notes: string | null;
  created_by: string | null;   // profiles.id of the admin who created it
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────────
// drivers
// ─────────────────────────────────────────────────────────────────
export type DriverStatus = 'available' | 'on_task' | 'offline' | 'break';

export interface Driver {
  id: string;
  profile_id: string | null;   // links to profiles.id
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
// job_assignments  (READ-ONLY from admin — dispatch logic lives elsewhere)
// ─────────────────────────────────────────────────────────────────
export type AssignmentStatus = 'assigned' | 'accepted' | 'in_progress' | 'complete' | 'cancelled';

export interface JobAssignment {
  id: string;
  task_id: string;             // references tasks.id
  driver_id: string;           // references drivers.id
  vehicle_id: string;          // references vehicles.id
  status: AssignmentStatus;
  assigned_at: string;
  updated_at: string | null;
  notes: string | null;
}

// ─────────────────────────────────────────────────────────────────
// driver_locations  (READ-ONLY live location feed)
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
// Convenience: task with assignment + driver info (joined)
// ─────────────────────────────────────────────────────────────────
export interface TaskWithAssignment extends Task {
  assignment: JobAssignment | null;
  driver: Driver | null;
  vehicle: Vehicle | null;
}
