'use client';
import React, { useMemo, useState } from 'react';
import { useAP3XStore } from '@/store/ap3x-store';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { MetricCard } from '@/components/shared/MetricCard';
import { formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Truck, Search, RefreshCw } from 'lucide-react';

export default function FleetPage() {
  const { vehicles, drivers, isLoading } = useAP3XStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const driverMap = useMemo(
    () => Object.fromEntries(drivers.map((d) => [d.id, d])),
    [drivers]
  );

  const stats = useMemo(() => ({
    active:      vehicles.filter((v) => v.status === 'active').length,
    idle:        vehicles.filter((v) => v.status === 'idle').length,
    maintenance: vehicles.filter((v) => v.status === 'maintenance').length,
    offline:     vehicles.filter((v) => v.status === 'offline').length,
  }), [vehicles]);

  const filtered = useMemo(() => {
    return vehicles.filter((v) => {
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const driver = v.driver_id ? driverMap[v.driver_id] : null;
        return (
          v.name.toLowerCase().includes(q) ||
          (v.plate ?? '').toLowerCase().includes(q) ||
          (v.type ?? '').toLowerCase().includes(q) ||
          (driver?.name ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [vehicles, statusFilter, search, driverMap]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-apex-text">
          Fleet <span className="apex-gradient-text">Overview</span>
        </h1>
        <p className="text-sm text-apex-textMuted mt-1">Read-only vehicle registry · {formatNumber(vehicles.length)} vehicles</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard title="Active"      value={formatNumber(stats.active)}      subtitle="Currently on task"    icon={Truck} variant="success" loading={isLoading} />
        <MetricCard title="Idle"        value={formatNumber(stats.idle)}        subtitle="Available"            icon={Truck} variant="accent"  loading={isLoading} />
        <MetricCard title="Maintenance" value={formatNumber(stats.maintenance)} subtitle="Out of service"       icon={Truck} variant="warning" loading={isLoading} />
        <MetricCard title="Offline"     value={formatNumber(stats.offline)}     subtitle="Not reachable"        icon={Truck} variant="default" loading={isLoading} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-apex-textMuted" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, plate, driver…"
            className="w-full rounded-lg border border-apex-border bg-apex-card pl-8 pr-3 py-2 text-sm text-apex-text placeholder-apex-textMuted focus:border-apex-accent focus:outline-none"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'active', 'idle', 'maintenance', 'offline'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn('rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors',
                statusFilter === s ? 'bg-apex-accent text-white' : 'bg-apex-card border border-apex-border text-apex-textMuted hover:text-apex-text'
              )}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-apex-border bg-apex-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-apex-textMuted text-sm">
            <RefreshCw size={16} className="animate-spin mr-2" /> Loading vehicles…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-apex-textMuted gap-3">
            <Truck size={32} className="opacity-30" />
            <p className="text-sm">{search || statusFilter !== 'all' ? 'No vehicles match filters.' : 'No vehicles found in Supabase.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-apex-border bg-apex-surface/50 text-apex-textMuted">
                  <th className="px-4 py-3 text-left font-medium">Vehicle</th>
                  <th className="px-4 py-3 text-left font-medium">Plate</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Assigned Driver</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-apex-border/50">
                {filtered.map((v) => {
                  const driver = v.driver_id ? driverMap[v.driver_id] : null;
                  return (
                    <tr key={v.id} className="hover:bg-apex-surface/40 transition-colors">
                      <td className="px-4 py-3 font-medium text-apex-text">{v.name}</td>
                      <td className="px-4 py-3 font-mono text-apex-textDim">{v.plate ?? '—'}</td>
                      <td className="px-4 py-3 text-apex-textMuted capitalize">{v.type ?? '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                      <td className="px-4 py-3 text-apex-textDim hidden sm:table-cell">{driver?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-apex-textMuted font-mono hidden md:table-cell">
                        {new Date(v.updated_at).toLocaleDateString()}
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
