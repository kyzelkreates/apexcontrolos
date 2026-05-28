/**
 * AP3X CONTROL DASHBOARD — DATA BOOTSTRAP HOOK
 *
 * - Loads all data from Supabase on mount
 * - Subscribes to realtime on: tasks, drivers, driver_locations
 * - No mock data. No IndexedDB. No fallbacks.
 * - Supabase ALWAYS wins on conflict.
 */

'use client';
import { useEffect, useRef } from 'react';
import { useAP3XStore } from '@/store/ap3x-store';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabaseClient';
import {
  fetchTasks,
  fetchTasksWithAssignments,
  fetchDrivers,
  fetchVehicles,
  fetchJobAssignments,
  fetchDriverLocations,
  fetchProfiles,
} from '@/services/ap3xDataService';
import type { Task, Driver, DriverLocation } from '@/types/db';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useAP3XData() {
  const {
    setTasks, setTasksWithAssignments, setDrivers, setVehicles,
    setAssignments, setDriverLocations, setProfiles,
    setLoading, setConfigured, addAlert,
    upsertTask, removeTask, upsertDriver, upsertDriverLocation,
  } = useAP3XStore();

  const channelsRef = useRef<RealtimeChannel[]>([]);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    const configured = isSupabaseConfigured();
    setConfigured(configured);

    if (!configured) {
      setLoading(false);
      addAlert({
        type: 'warning',
        title: 'Supabase Not Configured',
        message: 'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment to connect.',
      });
      return;
    }

    async function loadAll() {
      setLoading(true);
      try {
        // Load everything in parallel
        const [tasksWithAssign, tasks, drivers, vehicles, assignments, locations, profiles] =
          await Promise.all([
            fetchTasksWithAssignments(),
            fetchTasks(),
            fetchDrivers(),
            fetchVehicles(),
            fetchJobAssignments(),
            fetchDriverLocations(),
            fetchProfiles(),
          ]);

        if (tasksWithAssign) setTasksWithAssignments(tasksWithAssign);
        if (tasks) setTasks(tasks);
        if (drivers) setDrivers(drivers);
        if (vehicles) setVehicles(vehicles);
        if (assignments) setAssignments(assignments);
        if (locations) setDriverLocations(locations);
        if (profiles) setProfiles(profiles);

      } catch (e) {
        console.error('[AP3X] loadAll failed:', e);
        addAlert({ type: 'danger', title: 'Load Error', message: 'Failed to load data from Supabase.' });
      } finally {
        setLoading(false);
      }
    }

    loadAll().then(() => subscribeRealtime());

    function subscribeRealtime() {
      const client = getSupabaseClient();
      if (!client) return;

      // ── tasks ──
      const tasksCh = client
        .channel('ap3x-tasks')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
          if (payload.eventType === 'DELETE') {
            removeTask(payload.old.id as string);
          } else {
            upsertTask(payload.new as Task);
          }
        })
        .subscribe();

      // ── drivers ──
      const driversCh = client
        .channel('ap3x-drivers')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, (payload) => {
          if (payload.eventType !== 'DELETE') {
            upsertDriver(payload.new as Driver);
          }
        })
        .subscribe();

      // ── driver_locations ──
      const locationsCh = client
        .channel('ap3x-driver-locations')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'driver_locations' }, (payload) => {
          upsertDriverLocation(payload.new as DriverLocation);
        })
        .subscribe();

      channelsRef.current = [tasksCh, driversCh, locationsCh];
    }

    return () => {
      const client = getSupabaseClient();
      channelsRef.current.forEach((ch) => {
        try { client?.removeChannel(ch); } catch { /* noop */ }
      });
      channelsRef.current = [];
      loadedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
