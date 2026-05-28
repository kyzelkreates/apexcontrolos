/**
 * AP3X CONTROL DASHBOARD — DATA BOOTSTRAP + REALTIME HOOK
 *
 * Loads all permitted tables from Supabase on mount.
 * Subscribes to realtime on:
 *   tasks · drivers · job_assignments · driver_locations · dashboard_events
 *   pairing_codes  (federation sync)
 *
 * Rules:
 *   - No mock data
 *   - No IndexedDB or localStorage fallbacks
 *   - Supabase ALWAYS overwrites local state
 *   - UI never pushes state into Supabase (except via explicit service calls)
 */

'use client';
import { useEffect, useRef } from 'react';
import { useAP3XStore } from '@/store/ap3x-store';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabaseClient';
import {
  fetchTasks, fetchTasksWithAssignments, fetchDrivers, fetchVehicles,
  fetchJobAssignments, fetchDriverLocations, fetchProfiles,
  fetchFleetNodes, fetchDashboardEvents, fetchSettings,
} from '@/services/ap3xDataService';
import {
  fetchPairingCodes, fetchTenantsWithFleets,
} from '@/services/federationService';
import type { Task, Driver, DriverLocation, JobAssignment, DashboardEvent } from '@/types/db';
import type { PairingCode } from '@/types/federation';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useAP3XData() {
  const store = useAP3XStore();
  const channelsRef    = useRef<RealtimeChannel[]>([]);
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    const configured = isSupabaseConfigured();
    store.setConfigured(configured);

    if (!configured) {
      store.setLoading(false);
      store.addAlert({
        type:    'warning',
        title:   'Supabase Not Configured',
        message: 'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to connect.',
      });
      return;
    }

    async function bootstrap() {
      store.setLoading(true);
      try {
        const [
          tasksWithAssign, tasks, drivers, vehicles,
          assignments, locations, profiles,
          fleetNodes, events, settings,
          pairingCodes, tenantsWithFleets,
        ] = await Promise.all([
          fetchTasksWithAssignments(),
          fetchTasks(),
          fetchDrivers(),
          fetchVehicles(),
          fetchJobAssignments(),
          fetchDriverLocations(),
          fetchProfiles(),
          fetchFleetNodes(),
          fetchDashboardEvents(),
          fetchSettings(),
          fetchPairingCodes({ limit: 200 }),
          fetchTenantsWithFleets(),
        ]);

        if (tasksWithAssign)    store.setTasksWithAssignments(tasksWithAssign);
        if (tasks)              store.setTasks(tasks);
        if (drivers)            store.setDrivers(drivers);
        if (vehicles)           store.setVehicles(vehicles);
        if (assignments)        store.setAssignments(assignments);
        if (locations)          store.setDriverLocations(locations);
        if (profiles)           store.setProfiles(profiles);
        if (fleetNodes)         store.setFleetNodes(fleetNodes);
        if (events)             store.setDashboardEvents(events);
        if (settings)           store.setSettings(settings);
        if (pairingCodes)       store.setPairingCodes(pairingCodes);
        if (tenantsWithFleets)  store.setTenantsWithFleets(tenantsWithFleets);
      } catch (e) {
        console.error('[AP3X] bootstrap failed:', e);
        store.addAlert({ type: 'danger', title: 'Load Error', message: 'Failed to load data from Supabase.' });
      } finally {
        store.setLoading(false);
      }
    }

    function subscribeRealtime() {
      const client = getSupabaseClient();
      if (!client) return;

      // ── tasks ──
      const tasksCh = client
        .channel('ap3x:tasks')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (p) => {
          if (p.eventType === 'DELETE') store.removeTask(p.old.id as string);
          else store.upsertTask(p.new as Task);
        })
        .subscribe();

      // ── drivers ──
      const driversCh = client
        .channel('ap3x:drivers')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, (p) => {
          if (p.eventType !== 'DELETE') store.upsertDriver(p.new as Driver);
        })
        .subscribe();

      // ── job_assignments ──
      const assignmentsCh = client
        .channel('ap3x:job_assignments')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'job_assignments' }, (p) => {
          if (p.eventType === 'DELETE') store.removeAssignment(p.old.id as string);
          else store.upsertAssignment(p.new as JobAssignment);
        })
        .subscribe();

      // ── driver_locations ──
      const locationsCh = client
        .channel('ap3x:driver_locations')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'driver_locations' }, (p) => {
          store.upsertDriverLocation(p.new as DriverLocation);
        })
        .subscribe();

      // ── dashboard_events ──
      const eventsCh = client
        .channel('ap3x:dashboard_events')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dashboard_events' }, (p) => {
          store.prependDashboardEvent(p.new as DashboardEvent);
        })
        .subscribe();

      // ── pairing_codes (federation sync) ──
      const pairingCh = client
        .channel('ap3x:pairing_codes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pairing_codes' }, (p) => {
          if (p.eventType === 'DELETE') {
            store.removePairingCode(p.old.id as string);
          } else {
            store.upsertPairingCode(p.new as PairingCode);
            // When a code is used (Fleet Control OS paired), refresh the full tenant list
            if ((p.new as PairingCode).status === 'used') {
              fetchTenantsWithFleets().then((t) => { if (t) store.setTenantsWithFleets(t); });
            }
          }
        })
        .subscribe();

      channelsRef.current = [tasksCh, driversCh, assignmentsCh, locationsCh, eventsCh, pairingCh];
    }

    bootstrap().then(() => subscribeRealtime());

    return () => {
      const client = getSupabaseClient();
      channelsRef.current.forEach((ch) => {
        try { client?.removeChannel(ch); } catch { /* noop */ }
      });
      channelsRef.current = [];
      bootstrappedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
