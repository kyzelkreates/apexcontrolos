'use client';
import React, { useMemo } from 'react';
import { useAP3XStore } from '@/store/ap3x-store';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Activity, MapPin, Truck, Users, Zap, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

function timeAgoShort(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export default function LiveFeedPage() {
  const { drivers, vehicles, driverLocations, tasksWithAssignments, isLoading } = useAP3XStore();

  // Latest location per driver
  const locationMap = useMemo(() => {
    const map: Record<string, typeof driverLocations[0]> = {};
    driverLocations.forEach((loc) => {
      if (!map[loc.driver_id] || loc.recorded_at > map[loc.driver_id].recorded_at) {
        map[loc.driver_id] = loc;
      }
    });
    return map;
  }, [driverLocations]);

  const vehicleMap = useMemo(() => Object.fromEntries(vehicles.map((v) => [v.id, v])), [vehicles]);

  // Active drivers (not offline)
  const activeDrivers = useMemo(
    () => drivers.filter((d) => d.status !== 'offline').sort((a, b) => a.name.localeCompare(b.name)),
    [drivers]
  );

  // Recent tasks (last 20 updated)
  const recentTasks = useMemo(
    () => [...tasksWithAssignments]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 20),
    [tasksWithAssignments]
  );

  // Recent location pings (last 30)
  const recentPings = useMemo(
    () => [...driverLocations]
      .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())
      .slice(0, 30),
    [driverLocations]
  );

  const driverMap = useMemo(() => Object.fromEntries(drivers.map((d) => [d.id, d])), [drivers]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-apex-text">
          Live <span className="apex-gradient-text">Feed</span>
        </h1>
        <p className="text-sm text-apex-textMuted mt-1">
          Real-time updates via Supabase Realtime · tasks · drivers · locations
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-apex-textMuted">
          <RefreshCw size={13} className="animate-spin" /> Connecting to Supabase Realtime…
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
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {activeDrivers.map((d) => {
                const loc = locationMap[d.id];
                const vehicle = d.vehicle_id ? vehicleMap[d.vehicle_id] : null;
                return (
                  <div key={d.id} className="flex items-start gap-3 rounded-lg bg-apex-surface px-3 py-2.5">
                    <div className={cn('mt-1 h-2 w-2 rounded-full flex-shrink-0', {
                      'bg-apex-success animate-pulse': d.status === 'available',
                      'bg-apex-purple animate-pulse':  d.status === 'on_task',
                      'bg-apex-warning':               d.status === 'break',
                    })} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-apex-text">{d.name}</p>
                      <p className="text-[10px] text-apex-textMuted capitalize">{d.status.replace('_', ' ')} {vehicle ? `· ${vehicle.name}` : ''}</p>
                      {loc && (
                        <p className="text-[10px] text-apex-textMuted font-mono mt-0.5 flex items-center gap-1">
                          <MapPin size={8} className="text-apex-accent" />
                          {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)} · {timeAgoShort(loc.recorded_at)}
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

        {/* Recent task activity */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={14} className="text-apex-warning" />
            <span className="text-sm font-semibold text-apex-text">Task Activity</span>
            <span className="ml-auto rounded-full bg-apex-warning/20 px-2 py-0.5 text-[10px] font-bold text-apex-warning">
              LIVE
            </span>
          </div>
          {recentTasks.length === 0 ? (
            <p className="text-xs text-apex-textMuted py-6 text-center">No task activity yet</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {recentTasks.map((t) => (
                <div key={t.id} className="flex items-start gap-3 rounded-lg bg-apex-surface px-3 py-2.5">
                  <Activity size={12} className={cn('mt-0.5 flex-shrink-0', {
                    'text-apex-warning': t.status === 'pending',
                    'text-apex-accent':  t.status === 'assigned',
                    'text-apex-purple':  t.status === 'in_progress',
                    'text-apex-success': t.status === 'complete',
                    'text-apex-danger':  t.status === 'cancelled',
                  })} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-apex-text truncate">{t.title}</p>
                    <p className="text-[10px] text-apex-textMuted mt-0.5">
                      {t.driver ? `→ ${t.driver.name}` : 'Unassigned'} · {timeAgoShort(t.updated_at)}
                    </p>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Location pings */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <MapPin size={14} className="text-apex-success" />
            <span className="text-sm font-semibold text-apex-text">Location Pings</span>
            <span className="ml-auto rounded-full bg-apex-success/20 px-2 py-0.5 text-[10px] font-bold text-apex-success">
              {recentPings.length}
            </span>
          </div>
          {recentPings.length === 0 ? (
            <p className="text-xs text-apex-textMuted py-6 text-center">No location data yet</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {recentPings.map((loc) => {
                const driver = driverMap[loc.driver_id];
                return (
                  <div key={loc.id} className="rounded-lg bg-apex-surface px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-apex-text">{driver?.name ?? loc.driver_id.slice(0, 8)}</p>
                      <p className="text-[10px] text-apex-textMuted">{timeAgoShort(loc.recorded_at)}</p>
                    </div>
                    <p className="text-[10px] text-apex-textMuted font-mono mt-0.5">
                      {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                      {loc.speed_kmh !== null ? ` · ${loc.speed_kmh.toFixed(0)} km/h` : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
