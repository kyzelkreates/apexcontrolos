/**
 * AP3X CONTROL DASHBOARD — ZUSTAND STORE
 *
 * Source of truth is ALWAYS Supabase.
 * This store is a read-through cache only — it reflects Supabase state,
 * never overrides it. Any write must hit Supabase first.
 */

import { create } from 'zustand';
import type {
  Task, Driver, Vehicle, JobAssignment,
  DriverLocation, Profile, TaskWithAssignment,
} from '@/types/db';

// ─────────────────────────────────────────────────────────────────
// ALERT (local only — for transient UI messages)
// ─────────────────────────────────────────────────────────────────
export interface AppAlert {
  id: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  message: string;
  dismissed: boolean;
  createdAt: number;
}

// ─────────────────────────────────────────────────────────────────
// STORE SHAPE
// ─────────────────────────────────────────────────────────────────
interface AP3XStore {
  // ── Data (mirrors Supabase) ──
  tasks: Task[];
  tasksWithAssignments: TaskWithAssignment[];
  drivers: Driver[];
  vehicles: Vehicle[];
  assignments: JobAssignment[];
  driverLocations: DriverLocation[];
  profiles: Profile[];

  // ── UI state ──
  isLoading: boolean;
  isConfigured: boolean;         // true when Supabase env vars are set
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  alerts: AppAlert[];

  // ── Setters ──
  setTasks: (tasks: Task[]) => void;
  setTasksWithAssignments: (tasks: TaskWithAssignment[]) => void;
  setDrivers: (drivers: Driver[]) => void;
  setVehicles: (vehicles: Vehicle[]) => void;
  setAssignments: (assignments: JobAssignment[]) => void;
  setDriverLocations: (locations: DriverLocation[]) => void;
  setProfiles: (profiles: Profile[]) => void;
  setLoading: (loading: boolean) => void;
  setConfigured: (configured: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;

  // Realtime patch helpers — update single records without full reload
  upsertTask: (task: Task) => void;
  removeTask: (id: string) => void;
  upsertDriver: (driver: Driver) => void;
  upsertDriverLocation: (loc: DriverLocation) => void;

  // Alerts
  addAlert: (alert: Omit<AppAlert, 'id' | 'dismissed' | 'createdAt'>) => void;
  dismissAlert: (id: string) => void;
  clearAlerts: () => void;
}

// ─────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────
export const useAP3XStore = create<AP3XStore>((set, get) => ({
  tasks: [],
  tasksWithAssignments: [],
  drivers: [],
  vehicles: [],
  assignments: [],
  driverLocations: [],
  profiles: [],

  isLoading: true,
  isConfigured: false,
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  alerts: [],

  setTasks: (tasks) => set({ tasks }),
  setTasksWithAssignments: (tasksWithAssignments) => set({ tasksWithAssignments }),
  setDrivers: (drivers) => set({ drivers }),
  setVehicles: (vehicles) => set({ vehicles }),
  setAssignments: (assignments) => set({ assignments }),
  setDriverLocations: (driverLocations) => set({ driverLocations }),
  setProfiles: (profiles) => set({ profiles }),
  setLoading: (isLoading) => set({ isLoading }),
  setConfigured: (isConfigured) => set({ isConfigured }),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),

  // ── Realtime patch helpers ──
  upsertTask: (task) => set((s) => {
    const existing = s.tasks.find((t) => t.id === task.id);
    const tasks = existing
      ? s.tasks.map((t) => (t.id === task.id ? task : t))
      : [task, ...s.tasks];
    // Also patch tasksWithAssignments
    const tasksWithAssignments = s.tasksWithAssignments.map((t) =>
      t.id === task.id ? { ...t, ...task } : t
    );
    if (!existing) tasksWithAssignments.unshift({ ...task, assignment: null, driver: null, vehicle: null });
    return { tasks, tasksWithAssignments };
  }),

  removeTask: (id) => set((s) => ({
    tasks: s.tasks.filter((t) => t.id !== id),
    tasksWithAssignments: s.tasksWithAssignments.filter((t) => t.id !== id),
  })),

  upsertDriver: (driver) => set((s) => {
    const exists = s.drivers.find((d) => d.id === driver.id);
    return {
      drivers: exists
        ? s.drivers.map((d) => (d.id === driver.id ? driver : d))
        : [driver, ...s.drivers],
    };
  }),

  upsertDriverLocation: (loc) => set((s) => {
    // Keep only latest per driver — remove old entry, prepend new one
    const filtered = s.driverLocations.filter((l) => l.driver_id !== loc.driver_id);
    return { driverLocations: [loc, ...filtered].slice(0, 200) };
  }),

  addAlert: (alert) => set((s) => ({
    alerts: [
      {
        ...alert,
        id: `alert-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        dismissed: false,
        createdAt: Date.now(),
      },
      ...s.alerts,
    ].slice(0, 50),
  })),

  dismissAlert: (id) => set((s) => ({
    alerts: s.alerts.map((a) => (a.id === id ? { ...a, dismissed: true } : a)),
  })),

  clearAlerts: () => set({ alerts: [] }),
}));
