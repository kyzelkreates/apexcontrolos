'use client';
import React, { useMemo } from 'react';
import { useAP3XStore } from '@/store/ap3x-store';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { NoDataBanner } from '@/components/shared/NoDataBanner';
import { Activity, MapPin, Users, Zap, RefreshCw, Network, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

function timeAgoShort(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const s = Math.floor(d / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

export default function LiveFeedPage() {
  const {
    drivers, vehicles, driverLocations,
    tasksWithAssignments, dashboardEvents,
    fleetNodes, assignments, isLoading, isConfigured,
  } = useAP3XStore();

  // Latest location per driver
  const locationMap = useMemo(() => {
    const map: Record<string, typeof driverLocations[0]> = {};
    driverLocations.forEach((loc) => {
      if (!map[loc.driver_id] || loc.recorded_at > map[loc.driver_id].recorded_at)
        map[loc.driver_id] = loc;
    });
    return map;
  }, [driverLocations]);

  const vehicleMap = useMemo(() => Object.fromEntries(vehicles.map((v) => [v.id, v])), [vehicles]);

  // Current task per driver from job_assignments
  const driverTaskMap = useMemo(() => {
    const map: Record<string, string> = {};
    tasksWithAssignments.forEach((t) => {
      if (t.assignment && ['assigned', 'accepted', 'in_progress'].includes(t.status)) {
        map[t.assignment.driver_id] = t.title;
      }
    });
    return map;
  }, [tasksWithAssignments]);

  // Active drivers
  const activeDrivers = useMemo(
    () => drivers.filter((d) => d.status !== 'offline').sort((a, b) => a.name.localeCompare(b.name)),
    [drivers]
  );

  // Recent task events
  const recentTaskActivity = useMemo(
    () => [...tasksWithAssignments]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 20),
    [tasksWithAssignments]
  );

  // Recent pings
  const recentPings = useMemo(
    () => [...driverLocations]
      .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())
      .slice(0, 30),
    [driverLocations]
  );

  const driverMap = useMemo(() => Object.fromEntries(drivers.map((d) => [d.id, d])), [drivers]);

  // Critical/warning events
  const criticalEvents = useMemo(
    () => dashboardEvents.filter((e) => e.severity !== 'info').slice(0, 10),
    [dashboardEvents]
  );

  if (!isConfigured && !isLoading) return <NoDataBanner reason="not_configured" />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-apex-text">
          Live <span className="apex-gradient-text">Monitor</span>
        </h1>
        <p className="text-sm text-apex-textMuted mt-1">
          Realtime · tasks · drivers · job_assignments · driver_locations · dashboard_events
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-apex-textMuted">
          <RefreshCw size={13} className="animate-spin" /> Connecting to Supabase Realtime…
        </div>
      )}

      {/* Alerts row */}
      {criticalEvents.length > 0 && (
        <div className="space-y-2">
          {criticalEvents.slice(0, 3).map((ev) => (
            <div key={ev.id} className={cn('flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm', {
              'bg-apex-danger/5  border-apex-danger/30  text-apex-danger':  ev.severity === 'critical',
              'bg-apex-warning/5 border-apex-warning/30 text-apex-warning': ev.severity === 'warning',
            })}>
              <AlertTriangle size={14} className="flex-shrink-0" />
              <p className="font-medium">{ev.title}</p>
              {ev.description && <p className="text-xs opacity-70 truncate">{ev.description}</p>}
              <span className="ml-auto font-mono text-xs opacity-50">{timeAgoShort(ev.created_at)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Active drivers */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={14} className="text-apex-accent" />
            <span className="text-sm font-semibold text-apex-text">Active Drivers</span>
            <span className="ml-auto rounded-full bg-apex-accent/20 px-2 py-0.5 text-[10px] font-bold text-apex-accent">
              {activeDrivers.length}
            </span>
          </div>
          {activeDrivers.length === 0 ? (
            <p className="text-xs text-apex-textMuted py-6 text-center">No active drivers</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {activeDrivers.map((d) => {
                const loc     = locationMap[d.id];
                const vehicle = d.vehicle_id ? vehicleMap[d.vehicle_id] : null;
                const task    = driverTaskMap[d.id];
                return (
                  <div key={d.id} className="flex items-start gap-3 rounded-lg bg-apex-surface px-3 py-2.5 border border-apex-border/50">
                    <div className={cn('mt-1.5 h-2 w-2 rounded-full flex-shrink-0', {
                      'bg-apex-success animate-pulse': d.status === 'available',
                      'bg-apex-purple  animate-pulse': d.status === 'on_task',
                      'bg-apex-warning':               d.status === 'break',
                    })} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-apex-text">{d.name}</p>
                      <p className="text-[10px] text-apex-textMuted capitalize">
                        {d.status.replace('_', ' ')}
                        {vehicle ? ` · ${vehicle.name}` : ''}
                      </p>
                      {task && <p className="text-[10px] text-apex-accent mt-0.5 truncate">▶ {task}</p>}
                      {loc && (
                        <p className="text-[10px] text-apex-textMuted font-mono mt-0.5 flex items-center gap-1">
                          <MapPin size={8} className="text-apex-success" />
                          {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                          {loc.speed_kmh !== null ? ` · ${loc.speed_kmh.toFixed(0)} km/h` : ''}
                          <span className="ml-1 opacity-50">{timeAgoShort(loc.recorded_at)}</span>
                        </p>
                      )}
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Task activity */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={14} className="text-apex-warning" />
            <span className="text-sm font-semibold text-apex-text">Task Activity</span>
            <span className="ml-auto flex items-center gap-1 rounded-full bg-apex-warning/20 px-2 py-0.5 text-[10px] font-bold text-apex-warning">
              <span className="h-1.5 w-1.5 rounded-full bg-apex-warning animate-pulse" /> LIVE
            </span>
          </div>
          {recentTaskActivity.length === 0 ? (
            <p className="text-xs text-apex-textMuted py-6 text-center">No task activity yet</p>
          ) : (
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {recentTaskActivity.map((t) => (
                <div key={t.id} className="flex items-start gap-2.5 rounded-lg bg-apex-surface px-3 py-2.5 border border-apex-border/50">
                  <Activity size={11} className={cn('mt-0.5 flex-shrink-0', {
                    'text-apex-warning': t.status === 'pending',
                    'text-apex-accent':  t.status === 'assigned',
                    'text-apex-cyan':    t.status === 'accepted',
                    'text-apex-purple':  t.status === 'in_progress',
                    'text-apex-success': t.status === 'completed',
                    'text-apex-danger':  t.status === 'cancelled',
                  })} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-apex-text truncate">{t.title}</p>
                    <p className="text-[10px] text-apex-textMuted mt-0.5">
                      {t.driver ? `→ ${t.driver.name}` : 'Unassigned'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <StatusBadge status={t.status} />
                    <span className="text-[10px] font-mono text-apex-textMuted">{timeAgoShort(t.updated_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Location pings + Fleet Nodes */}
        <div className="space-y-4">
          <div className="rounded-xl border border-apex-border bg-apex-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin size={14} className="text-apex-success" />
              <span className="text-sm font-semibold text-apex-text">Location Pings</span>
              <span className="ml-auto rounded-full bg-apex-success/20 px-2 py-0.5 text-[10px] font-bold text-apex-success">
                {recentPings.length}
              </span>
            </div>
            {recentPings.length === 0 ? (
              <p className="text-xs text-apex-textMuted py-4 text-center">No location data yet</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {recentPings.map((loc) => {
                  const driver = driverMap[loc.driver_id];
                  return (
                    <div key={loc.id} className="rounded-lg bg-apex-surface px-3 py-2 border border-apex-border/50">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-apex-text">{driver?.name ?? loc.driver_id.slice(0, 8) + '…'}</p>
                        <p className="text-[10px] font-mono text-apex-textMuted">{timeAgoShort(loc.recorded_at)}</p>
                      </div>
                      <p className="text-[10px] font-mono text-apex-textMuted mt-0.5">
                        {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                        {loc.speed_kmh !== null ? ` · ${loc.speed_kmh.toFixed(0)} km/h` : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Fleet nodes */}
          {fleetNodes.length > 0 && (
            <div className="rounded-xl border border-apex-border bg-apex-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Network size={14} className="text-apex-accent" />
                <span className="text-sm font-semibold text-apex-text">Fleet Nodes</span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {fleetNodes.map((n) => (
                  <div key={n.id} className="flex items-center gap-3 rounded-lg bg-apex-surface px-3 py-2 border border-apex-border/50">
                    <div className={cn('h-2 w-2 rounded-full flex-shrink-0', {
                      'bg-apex-success animate-pulse': n.status === 'online',
                      'bg-apex-warning':               n.status === 'degraded',
                      'bg-apex-danger':                n.status === 'maintenance',
                      'bg-apex-textMuted':             n.status === 'offline',
                    })} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-apex-text">{n.name}</p>
                      <p className="text-[10px] text-apex-textMuted capitalize">{n.type}</p>
                    </div>
                    <StatusBadge status={n.status} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
