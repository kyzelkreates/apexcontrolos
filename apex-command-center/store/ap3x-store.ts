/**
 * AP3X CONTROL DASHBOARD — ZUSTAND STORE
 *
 * READ-THROUGH CACHE ONLY. Supabase always wins.
 * This store never overrides backend state.
 *
 * Permitted tables:
 *   profiles · tasks · drivers · vehicles
 *   job_assignments · driver_locations
 *   fleet_nodes · dashboard_events · settings
 */

import { create } from 'zustand';
import type {
  Profile, Task, Driver, Vehicle, JobAssignment,
  DriverLocation, TaskWithAssignment,
  FleetNode, DashboardEvent, SystemSetting,
} from '@/types/db';

export interface AppAlert {
  id: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  message: string;
  dismissed: boolean;
  createdAt: number;
}

interface AP3XStore {
  // ── Supabase mirrors ──
  tasks:                Task[];
  tasksWithAssignments: TaskWithAssignment[];
  drivers:              Driver[];
  vehicles:             Vehicle[];
  assignments:          JobAssignment[];
  driverLocations:      DriverLocation[];
  profiles:             Profile[];
  fleetNodes:           FleetNode[];
  dashboardEvents:      DashboardEvent[];
  settings:             SystemSetting[];

  // ── UI state ──
  isLoading:           boolean;
  isConfigured:        boolean;
  sidebarCollapsed:    boolean;
  mobileSidebarOpen:   boolean;
  alerts:              AppAlert[];

  // ── Bulk setters (from initial load) ──
  setTasks:                (t: Task[])             => void;
  setTasksWithAssignments: (t: TaskWithAssignment[]) => void;
  setDrivers:              (d: Driver[])            => void;
  setVehicles:             (v: Vehicle[])           => void;
  setAssignments:          (a: JobAssignment[])     => void;
  setDriverLocations:      (l: DriverLocation[])    => void;
  setProfiles:             (p: Profile[])           => void;
  setFleetNodes:           (n: FleetNode[])         => void;
  setDashboardEvents:      (e: DashboardEvent[])    => void;
  setSettings:             (s: SystemSetting[])     => void;
  setLoading:              (b: boolean)             => void;
  setConfigured:           (b: boolean)             => void;
  setSidebarCollapsed:     (b: boolean)             => void;
  setMobileSidebarOpen:    (b: boolean)             => void;

  // ── Realtime patch helpers ──
  upsertTask:             (task: Task)              => void;
  removeTask:             (id: string)              => void;
  upsertDriver:           (driver: Driver)          => void;
  upsertAssignment:       (a: JobAssignment)        => void;
  removeAssignment:       (id: string)              => void;
  upsertDriverLocation:   (loc: DriverLocation)     => void;
  prependDashboardEvent:  (e: DashboardEvent)       => void;

  // ── Alerts (transient UI — not stored in Supabase) ──
  addAlert:     (a: Omit<AppAlert, 'id' | 'dismissed' | 'createdAt'>) => void;
  dismissAlert: (id: string)                                           => void;
  clearAlerts:  ()                                                     => void;
}

export const useAP3XStore = create<AP3XStore>((set) => ({
  tasks:                [],
  tasksWithAssignments: [],
  drivers:              [],
  vehicles:             [],
  assignments:          [],
  driverLocations:      [],
  profiles:             [],
  fleetNodes:           [],
  dashboardEvents:      [],
  settings:             [],

  isLoading:         true,
  isConfigured:      false,
  sidebarCollapsed:  false,
  mobileSidebarOpen: false,
  alerts:            [],

  setTasks:                (tasks)                => set({ tasks }),
  setTasksWithAssignments: (tasksWithAssignments) => set({ tasksWithAssignments }),
  setDrivers:              (drivers)              => set({ drivers }),
  setVehicles:             (vehicles)             => set({ vehicles }),
  setAssignments:          (assignments)          => set({ assignments }),
  setDriverLocations:      (driverLocations)      => set({ driverLocations }),
  setProfiles:             (profiles)             => set({ profiles }),
  setFleetNodes:           (fleetNodes)           => set({ fleetNodes }),
  setDashboardEvents:      (dashboardEvents)      => set({ dashboardEvents }),
  setSettings:             (settings)             => set({ settings }),
  setLoading:              (isLoading)            => set({ isLoading }),
  setConfigured:           (isConfigured)         => set({ isConfigured }),
  setSidebarCollapsed:     (sidebarCollapsed)     => set({ sidebarCollapsed }),
  setMobileSidebarOpen:    (mobileSidebarOpen)    => set({ mobileSidebarOpen }),

  // ── Realtime patch helpers ──

  upsertTask: (task) => set((s) => {
    const exists = s.tasks.some((t) => t.id === task.id);
    const tasks  = exists
      ? s.tasks.map((t) => t.id === task.id ? task : t)
      : [task, ...s.tasks];
    const tasksWithAssignments = exists
      ? s.tasksWithAssignments.map((t) => t.id === task.id ? { ...t, ...task } : t)
      : [{ ...task, assignment: null, driver: null, vehicle: null }, ...s.tasksWithAssignments];
    return { tasks, tasksWithAssignments };
  }),

  removeTask: (id) => set((s) => ({
    tasks:                s.tasks.filter((t) => t.id !== id),
    tasksWithAssignments: s.tasksWithAssignments.filter((t) => t.id !== id),
  })),

  upsertDriver: (driver) => set((s) => {
    const exists = s.drivers.some((d) => d.id === driver.id);
    return {
      drivers: exists
        ? s.drivers.map((d) => d.id === driver.id ? driver : d)
        : [driver, ...s.drivers],
    };
  }),

  upsertAssignment: (a) => set((s) => {
    const exists = s.assignments.some((x) => x.id === a.id);
    const assignments = exists
      ? s.assignments.map((x) => x.id === a.id ? a : x)
      : [a, ...s.assignments];
    // Patch tasksWithAssignments to reflect new assignment
    const tasksWithAssignments = s.tasksWithAssignments.map((t) => {
      if (t.id !== a.task_id) return t;
      const driver  = s.drivers.find((d) => d.id === a.driver_id)  ?? null;
      const vehicle = s.vehicles.find((v) => v.id === a.vehicle_id) ?? null;
      return { ...t, assignment: a, driver, vehicle };
    });
    return { assignments, tasksWithAssignments };
  }),

  removeAssignment: (id) => set((s) => {
    const removed = s.assignments.find((a) => a.id === id);
    const assignments = s.assignments.filter((a) => a.id !== id);
    const tasksWithAssignments = removed
      ? s.tasksWithAssignments.map((t) =>
          t.id === removed.task_id ? { ...t, assignment: null, driver: null, vehicle: null } : t
        )
      : s.tasksWithAssignments;
    return { assignments, tasksWithAssignments };
  }),

  upsertDriverLocation: (loc) => set((s) => {
    // Keep only latest per driver — drop old, prepend new
    const filtered = s.driverLocations.filter((l) => l.driver_id !== loc.driver_id);
    return { driverLocations: [loc, ...filtered].slice(0, 200) };
  }),

  prependDashboardEvent: (e) => set((s) => ({
    dashboardEvents: [e, ...s.dashboardEvents].slice(0, 200),
  })),

  addAlert: (alert) => set((s) => ({
    alerts: [{
      ...alert,
      id:         `alert-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      dismissed:  false,
      createdAt:  Date.now(),
    }, ...s.alerts].slice(0, 50),
  })),

  dismissAlert: (id) => set((s) => ({
    alerts: s.alerts.map((a) => a.id === id ? { ...a, dismissed: true } : a),
  })),

  clearAlerts: () => set({ alerts: [] }),
}));
