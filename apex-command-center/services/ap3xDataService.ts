/**
 * AP3X CONTROL DASHBOARD — DATA SERVICE
 *
 * PERMITTED TABLES:
 *   profiles · tasks · drivers · vehicles
 *   job_assignments · driver_locations
 *   fleet_nodes · dashboard_events · settings
 *
 * WRITE RULES:
 *   ✔ Admin can CREATE tasks (status: 'pending' only)
 *   ✔ Admin can update task title/description/priority/location/notes
 *   ✔ Admin can cancel tasks (set status: 'cancelled')
 *   ✔ Admin can read/write settings
 *   ❌ Admin CANNOT write job_assignments
 *   ❌ Admin CANNOT change task status beyond 'pending'/'cancelled'
 *   ❌ Admin CANNOT modify drivers, vehicles, fleet_nodes
 */

import { getSupabaseClient } from '@/lib/supabaseClient';
import type {
  Profile, Task, Driver, Vehicle, JobAssignment,
  DriverLocation, TaskWithAssignment, TaskPriority,
  FleetNode, DashboardEvent, SystemSetting,
} from '@/types/db';

const sb = () => getSupabaseClient();

// ─────────────────────────────────────────────────────────────────
// PROFILES
// ─────────────────────────────────────────────────────────────────
export async function fetchProfiles(limit = 200): Promise<Profile[] | null> {
  const client = sb(); if (!client) return null;
  try {
    const { data, error } = await client.from('profiles').select('*')
      .order('created_at', { ascending: false }).limit(limit);
    if (error) { console.warn('[AP3X] fetchProfiles:', error.message); return null; }
    return data as Profile[];
  } catch (e) { console.warn('[AP3X] fetchProfiles ex:', e); return null; }
}

// ─────────────────────────────────────────────────────────────────
// TASKS
// ─────────────────────────────────────────────────────────────────
export async function fetchTasks(limit = 500): Promise<Task[] | null> {
  const client = sb(); if (!client) return null;
  try {
    const { data, error } = await client.from('tasks').select('*')
      .order('created_at', { ascending: false }).limit(limit);
    if (error) { console.warn('[AP3X] fetchTasks:', error.message); return null; }
    return data as Task[];
  } catch (e) { console.warn('[AP3X] fetchTasks ex:', e); return null; }
}

export async function fetchTasksWithAssignments(limit = 500): Promise<TaskWithAssignment[] | null> {
  const client = sb(); if (!client) return null;
  try {
    const [tasksRes, assignRes, driversRes, vehiclesRes] = await Promise.all([
      client.from('tasks').select('*').order('created_at', { ascending: false }).limit(limit),
      client.from('job_assignments').select('*').limit(1000),
      client.from('drivers').select('*').limit(500),
      client.from('vehicles').select('*').limit(500),
    ]);
    if (tasksRes.error) { console.warn('[AP3X] fetchTasksWithAssignments:', tasksRes.error.message); return null; }

    const tasks       = (tasksRes.data   ?? []) as Task[];
    const assignments = (assignRes.data  ?? []) as JobAssignment[];
    const drivers     = (driversRes.data ?? []) as Driver[];
    const vehicles    = (vehiclesRes.data ?? []) as Vehicle[];

    const driverMap  = Object.fromEntries(drivers.map((d) => [d.id, d]));
    const vehicleMap = Object.fromEntries(vehicles.map((v) => [v.id, v]));

    return tasks.map((t) => {
      const assignment = assignments.find((a) => a.task_id === t.id) ?? null;
      return {
        ...t,
        assignment,
        driver:  assignment ? (driverMap[assignment.driver_id]   ?? null) : null,
        vehicle: assignment ? (vehicleMap[assignment.vehicle_id] ?? null) : null,
      };
    });
  } catch (e) { console.warn('[AP3X] fetchTasksWithAssignments ex:', e); return null; }
}

/** Create a task. Status is always 'pending'. */
export async function createTask(payload: {
  title: string;
  description?: string;
  priority: TaskPriority;
  location?: string;
  notes?: string;
  created_by?: string;
}): Promise<Task | null> {
  const client = sb(); if (!client) return null;
  try {
    const { data, error } = await client.from('tasks').insert({
      title:       payload.title,
      description: payload.description ?? null,
      priority:    payload.priority,
      location:    payload.location    ?? null,
      notes:       payload.notes       ?? null,
      created_by:  payload.created_by  ?? null,
      status:      'pending',
    }).select().single();
    if (error) { console.warn('[AP3X] createTask:', error.message); return null; }
    return data as Task;
  } catch (e) { console.warn('[AP3X] createTask ex:', e); return null; }
}

/** Update task metadata. Cannot change status beyond 'cancelled'. */
export async function updateTask(
  taskId: string,
  patch: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'location' | 'notes' | 'status'>>
): Promise<boolean> {
  const client = sb(); if (!client) return false;
  // Enforce: only 'cancelled' is a status change we allow
  if (patch.status && !['cancelled'].includes(patch.status)) {
    console.warn('[AP3X] updateTask: blocked status change to', patch.status);
    delete patch.status;
  }
  try {
    const { error } = await client.from('tasks').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', taskId);
    if (error) { console.warn('[AP3X] updateTask:', error.message); return false; }
    return true;
  } catch (e) { console.warn('[AP3X] updateTask ex:', e); return false; }
}

// ─────────────────────────────────────────────────────────────────
// DRIVERS  — READ-ONLY
// ─────────────────────────────────────────────────────────────────
export async function fetchDrivers(limit = 500): Promise<Driver[] | null> {
  const client = sb(); if (!client) return null;
  try {
    const { data, error } = await client.from('drivers').select('*')
      .order('name', { ascending: true }).limit(limit);
    if (error) { console.warn('[AP3X] fetchDrivers:', error.message); return null; }
    return data as Driver[];
  } catch (e) { console.warn('[AP3X] fetchDrivers ex:', e); return null; }
}

// ─────────────────────────────────────────────────────────────────
// VEHICLES  — READ-ONLY
// ─────────────────────────────────────────────────────────────────
export async function fetchVehicles(limit = 500): Promise<Vehicle[] | null> {
  const client = sb(); if (!client) return null;
  try {
    const { data, error } = await client.from('vehicles').select('*')
      .order('name', { ascending: true }).limit(limit);
    if (error) { console.warn('[AP3X] fetchVehicles:', error.message); return null; }
    return data as Vehicle[];
  } catch (e) { console.warn('[AP3X] fetchVehicles ex:', e); return null; }
}

// ─────────────────────────────────────────────────────────────────
// JOB ASSIGNMENTS  — READ-ONLY
// ─────────────────────────────────────────────────────────────────
export async function fetchJobAssignments(limit = 1000): Promise<JobAssignment[] | null> {
  const client = sb(); if (!client) return null;
  try {
    const { data, error } = await client.from('job_assignments').select('*')
      .order('assigned_at', { ascending: false }).limit(limit);
    if (error) { console.warn('[AP3X] fetchJobAssignments:', error.message); return null; }
    return data as JobAssignment[];
  } catch (e) { console.warn('[AP3X] fetchJobAssignments ex:', e); return null; }
}

// ─────────────────────────────────────────────────────────────────
// DRIVER LOCATIONS  — READ-ONLY live feed
// ─────────────────────────────────────────────────────────────────
export async function fetchDriverLocations(): Promise<DriverLocation[] | null> {
  const client = sb(); if (!client) return null;
  try {
    const since = new Date(Date.now() - 3600 * 1000).toISOString();
    const { data, error } = await client.from('driver_locations').select('*')
      .gte('recorded_at', since).order('recorded_at', { ascending: false }).limit(500);
    if (error) { console.warn('[AP3X] fetchDriverLocations:', error.message); return null; }
    return data as DriverLocation[];
  } catch (e) { console.warn('[AP3X] fetchDriverLocations ex:', e); return null; }
}

// ─────────────────────────────────────────────────────────────────
// FLEET NODES  — READ-ONLY
// ─────────────────────────────────────────────────────────────────
export async function fetchFleetNodes(limit = 200): Promise<FleetNode[] | null> {
  const client = sb(); if (!client) return null;
  try {
    const { data, error } = await client.from('fleet_nodes').select('*')
      .order('name', { ascending: true }).limit(limit);
    if (error) { console.warn('[AP3X] fetchFleetNodes:', error.message); return null; }
    return data as FleetNode[];
  } catch (e) { console.warn('[AP3X] fetchFleetNodes ex:', e); return null; }
}

// ─────────────────────────────────────────────────────────────────
// DASHBOARD EVENTS  — READ-ONLY system event feed
// ─────────────────────────────────────────────────────────────────
export async function fetchDashboardEvents(limit = 100): Promise<DashboardEvent[] | null> {
  const client = sb(); if (!client) return null;
  try {
    const { data, error } = await client.from('dashboard_events').select('*')
      .order('created_at', { ascending: false }).limit(limit);
    if (error) { console.warn('[AP3X] fetchDashboardEvents:', error.message); return null; }
    return data as DashboardEvent[];
  } catch (e) { console.warn('[AP3X] fetchDashboardEvents ex:', e); return null; }
}

// ─────────────────────────────────────────────────────────────────
// SETTINGS  — READ + WRITE (admin only)
// ─────────────────────────────────────────────────────────────────
export async function fetchSettings(): Promise<SystemSetting[] | null> {
  const client = sb(); if (!client) return null;
  try {
    const { data, error } = await client.from('settings').select('*').order('key');
    if (error) { console.warn('[AP3X] fetchSettings:', error.message); return null; }
    return data as SystemSetting[];
  } catch (e) { console.warn('[AP3X] fetchSettings ex:', e); return null; }
}

export async function upsertSetting(key: string, value: string, updatedBy?: string): Promise<boolean> {
  const client = sb(); if (!client) return false;
  try {
    const { error } = await client.from('settings').upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy ?? null,
    }, { onConflict: 'key' });
    if (error) { console.warn('[AP3X] upsertSetting:', error.message); return false; }
    return true;
  } catch (e) { console.warn('[AP3X] upsertSetting ex:', e); return false; }
}
