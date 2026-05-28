'use client';
import React, { useMemo, useState } from 'react';
import { useAP3XStore } from '@/store/ap3x-store';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { MetricCard } from '@/components/shared/MetricCard';
import { formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Users, Search, RefreshCw, MapPin } from 'lucide-react';

export default function DriversPage() {
  const { drivers, vehicles, driverLocations, tasksWithAssignments, isLoading } = useAP3XStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const vehicleMap = useMemo(
    () => Object.fromEntries(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );

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

  // Active task per driver
  const driverTaskMap = useMemo(() => {
    const map: Record<string, string> = {};
    tasksWithAssignments.forEach((t) => {
      if (t.assignment && (t.status === 'in_progress' || t.status === 'assigned')) {
        map[t.assignment.driver_id] = t.title;
      }
    });
    return map;
  }, [tasksWithAssignments]);

  const stats = useMemo(() => ({
    available: drivers.filter((d) => d.status === 'available').length,
    on_task:   drivers.filter((d) => d.status === 'on_task').length,
    offline:   drivers.filter((d) => d.status === 'offline').length,
    break:     drivers.filter((d) => d.status === 'break').length,
  }), [drivers]);

  const filtered = useMemo(() => {
    return drivers.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return d.name.toLowerCase().includes(q) || (d.phone ?? '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [drivers, statusFilter, search]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-apex-text">
          Driver <span className="apex-gradient-text">Registry</span>
        </h1>
        <p className="text-sm text-apex-textMuted mt-1">Read-only driver status · {formatNumber(drivers.length)} drivers</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard title="Available"  value={formatNumber(stats.available)} subtitle="Ready for tasks"   icon={Users} variant="success" loading={isLoading} />
        <MetricCard title="On Task"    value={formatNumber(stats.on_task)}   subtitle="Currently working" icon={Users} variant="purple"  loading={isLoading} />
        <MetricCard title="On Break"   value={formatNumber(stats.break)}     subtitle="Temporarily off"   icon={Users} variant="warning" loading={isLoading} />
        <MetricCard title="Offline"    value={formatNumber(stats.offline)}   subtitle="Not reachable"     icon={Users} variant="default" loading={isLoading} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-apex-textMuted" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone…"
            className="w-full rounded-lg border border-apex-border bg-apex-card pl-8 pr-3 py-2 text-sm text-apex-text placeholder-apex-textMuted focus:border-apex-accent focus:outline-none"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'available', 'on_task', 'break', 'offline'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn('rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors',
                statusFilter === s ? 'bg-apex-accent text-white' : 'bg-apex-card border border-apex-border text-apex-textMuted hover:text-apex-text'
              )}>
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-apex-border bg-apex-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-apex-textMuted text-sm">
            <RefreshCw size={16} className="animate-spin mr-2" /> Loading drivers…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-apex-textMuted gap-3">
            <Users size={32} className="opacity-30" />
            <p className="text-sm">{search || statusFilter !== 'all' ? 'No drivers match filters.' : 'No drivers found in Supabase.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-apex-border bg-apex-surface/50 text-apex-textMuted">
                  <th className="px-4 py-3 text-left font-medium">Driver</th>
                  <th className="px-4 py-3 text-left font-medium">Phone</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Vehicle</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Current Task</th>
                  <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Last Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-apex-border/50">
                {filtered.map((d) => {
                  const vehicle = d.vehicle_id ? vehicleMap[d.vehicle_id] : null;
                  const loc = locationMap[d.id];
                  const task = driverTaskMap[d.id];
                  return (
                    <tr key={d.id} className="hover:bg-apex-surface/40 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-apex-text">{d.name}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-apex-textMuted">{d.phone ?? '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                      <td className="px-4 py-3 text-apex-textDim hidden sm:table-cell">{vehicle?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-apex-textDim hidden md:table-cell truncate max-w-[160px]">{task ?? '—'}</td>
                      <td className="px-4 py-3 text-apex-textMuted hidden lg:table-cell">
                        {loc ? (
                          <span className="flex items-center gap-1 font-mono">
                            <MapPin size={10} className="text-apex-accent" />
                            {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
