/**
 * AP3X CONTROL DASHBOARD
 * services/ap3xDataService.ts
 *
 * All Supabase reads + writes for the admin dashboard.
 * Contract:
 *   - ONLY reads from: profiles, tasks, drivers, vehicles, job_assignments, driver_locations
 *   - Admin CAN create tasks
 *   - Admin CANNOT write to job_assignments (dispatch logic belongs elsewhere)
 *   - Every function returns null on failure — caller handles empty state gracefully
 */

import { getSupabaseClient } from '@/lib/supabaseClient';
import type {
  Profile, Task, Driver, Vehicle, JobAssignment,
  DriverLocation, TaskWithAssignment, TaskPriority,
} from '@/types/db';

const sb = () => getSupabaseClient();

// ─────────────────────────────────────────────────────────────────
// PROFILES
// ─────────────────────────────────────────────────────────────────

export async function fetchProfiles(limit = 200): Promise<Profile[] | null> {
  const client = sb();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) { console.warn('[AP3X] fetchProfiles:', error.message); return null; }
    return data as Profile[];
  } catch (e) { console.warn('[AP3X] fetchProfiles exception:', e); return null; }
}

// ─────────────────────────────────────────────────────────────────
// TASKS  (admin creates + reads — no assignment logic)
// ─────────────────────────────────────────────────────────────────

export async function fetchTasks(limit = 500): Promise<Task[] | null> {
  const client = sb();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) { console.warn('[AP3X] fetchTasks:', error.message); return null; }
    return data as Task[];
  } catch (e) { console.warn('[AP3X] fetchTasks exception:', e); return null; }
}

export async function fetchTasksWithAssignments(limit = 500): Promise<TaskWithAssignment[] | null> {
  const client = sb();
  if (!client) return null;
  try {
    // Fetch tasks, assignments, drivers, vehicles in parallel
    const [tasksRes, assignmentsRes, driversRes, vehiclesRes] = await Promise.all([
      client.from('tasks').select('*').order('created_at', { ascending: false }).limit(limit),
      client.from('job_assignments').select('*').limit(1000),
      client.from('drivers').select('*').limit(500),
      client.from('vehicles').select('*').limit(500),
    ]);

    if (tasksRes.error) { console.warn('[AP3X] fetchTasksWithAssignments tasks:', tasksRes.error.message); return null; }

    const tasks = (tasksRes.data ?? []) as Task[];
    const assignments = (assignmentsRes.data ?? []) as JobAssignment[];
    const drivers = (driversRes.data ?? []) as Driver[];
    const vehicles = (vehiclesRes.data ?? []) as Vehicle[];

    const driverMap = Object.fromEntries(drivers.map((d) => [d.id, d]));
    const vehicleMap = Object.fromEntries(vehicles.map((v) => [v.id, v]));

    return tasks.map((t) => {
      const assignment = assignments.find((a) => a.task_id === t.id) ?? null;
      return {
        ...t,
        assignment,
        driver: assignment ? (driverMap[assignment.driver_id] ?? null) : null,
        vehicle: assignment ? (vehicleMap[assignment.vehicle_id] ?? null) : null,
      };
    });
  } catch (e) { console.warn('[AP3X] fetchTasksWithAssignments exception:', e); return null; }
}

/** Admin creates a task. Does NOT assign it — that is dispatcher logic. */
export async function createTask(payload: {
  title: string;
  description?: string;
  priority: TaskPriority;
  location?: string;
  notes?: string;
  created_by?: string;
}): Promise<Task | null> {
  const client = sb();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('tasks')
      .insert({
        title: payload.title,
        description: payload.description ?? null,
        priority: payload.priority,
        location: payload.location ?? null,
        notes: payload.notes ?? null,
        created_by: payload.created_by ?? null,
        status: 'pending',
      })
      .select()
      .single();
    if (error) { console.warn('[AP3X] createTask:', error.message); return null; }
    return data as Task;
  } catch (e) { console.warn('[AP3X] createTask exception:', e); return null; }
}

/** Admin can update task details or cancel it. Cannot change assignment state. */
export async function updateTask(
  taskId: string,
  patch: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'location' | 'notes' | 'status'>>
): Promise<boolean> {
  const client = sb();
  if (!client) return false;
  try {
    const { error } = await client
      .from('tasks')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', taskId);
    if (error) { console.warn('[AP3X] updateTask:', error.message); return false; }
    return true;
  } catch (e) { console.warn('[AP3X] updateTask exception:', e); return false; }
}

// ─────────────────────────────────────────────────────────────────
// DRIVERS  (read-only)
// ─────────────────────────────────────────────────────────────────

export async function fetchDrivers(limit = 500): Promise<Driver[] | null> {
  const client = sb();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('drivers')
      .select('*')
      .order('name', { ascending: true })
      .limit(limit);
    if (error) { console.warn('[AP3X] fetchDrivers:', error.message); return null; }
    return data as Driver[];
  } catch (e) { console.warn('[AP3X] fetchDrivers exception:', e); return null; }
}

// ─────────────────────────────────────────────────────────────────
// VEHICLES  (read-only)
// ─────────────────────────────────────────────────────────────────

export async function fetchVehicles(limit = 500): Promise<Vehicle[] | null> {
  const client = sb();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('vehicles')
      .select('*')
      .order('name', { ascending: true })
      .limit(limit);
    if (error) { console.warn('[AP3X] fetchVehicles:', error.message); return null; }
    return data as Vehicle[];
  } catch (e) { console.warn('[AP3X] fetchVehicles exception:', e); return null; }
}

// ─────────────────────────────────────────────────────────────────
// JOB ASSIGNMENTS  (read-only — admin never writes here)
// ─────────────────────────────────────────────────────────────────

export async function fetchJobAssignments(limit = 1000): Promise<JobAssignment[] | null> {
  const client = sb();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('job_assignments')
      .select('*')
      .order('assigned_at', { ascending: false })
      .limit(limit);
    if (error) { console.warn('[AP3X] fetchJobAssignments:', error.message); return null; }
    return data as JobAssignment[];
  } catch (e) { console.warn('[AP3X] fetchJobAssignments exception:', e); return null; }
}

// ─────────────────────────────────────────────────────────────────
// DRIVER LOCATIONS  (read-only live feed)
// ─────────────────────────────────────────────────────────────────

/** Fetch latest location per driver (last 1 hour) */
export async function fetchDriverLocations(): Promise<DriverLocation[] | null> {
  const client = sb();
  if (!client) return null;
  try {
    const since = new Date(Date.now() - 3600 * 1000).toISOString();
    const { data, error } = await client
      .from('driver_locations')
      .select('*')
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: false })
      .limit(500);
    if (error) { console.warn('[AP3X] fetchDriverLocations:', error.message); return null; }
    return data as DriverLocation[];
  } catch (e) { console.warn('[AP3X] fetchDriverLocations exception:', e); return null; }
}
