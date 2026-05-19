'use client';
import React, { useMemo, useState } from 'react';
import { useApexStore } from '@/store/apex-store';
import { MetricCard } from '@/components/shared/MetricCard';
import { SectionHeader } from '@/components/shared/SectionHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DataTable } from '@/components/shared/DataTable';
import { formatNumber, timeAgo, regionLabel, cn } from '@/lib/utils';
import { Truck, Users, TrendingUp, Shield, MapPin, Activity, BarChart2, Fuel } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ScatterChart, Scatter, AreaChart, Area, Legend
} from 'recharts';
import type { FleetEntity } from '@/types';

const CustomTooltip = ({ active, payload, label }: Record<string, unknown>) => {
  if (!(active as boolean)) return null;
  return (
    <div className="rounded-lg border border-apex-border bg-apex-card px-3 py-2 text-xs shadow-apex-card">
      <p className="text-apex-textMuted mb-1">{label as string}</p>
      {(payload as Array<{ name: string; value: number; color: string }>)?.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-mono">{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export default function FleetOpsPage() {
  const { fleets, routeMetrics, operationalMetrics, tenants, isLoading } = useApexStore();
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const filteredFleets = useMemo(() => fleets.filter((f) => {
    if (selectedRegion !== 'all' && f.region !== selectedRegion) return false;
    if (selectedStatus !== 'all' && f.status !== selectedStatus) return false;
    return true;
  }), [fleets, selectedRegion, selectedStatus]);

  const totalVehicles = filteredFleets.reduce((a, f) => a + f.vehicleCount, 0);
  const activeVehicles = filteredFleets.reduce((a, f) => a + f.activeVehicles, 0);
  const totalDrivers = filteredFleets.reduce((a, f) => a + f.driverCount, 0);
  const avgUptime = filteredFleets.length ? filteredFleets.reduce((a, f) => a + f.uptimePercent, 0) / filteredFleets.length : 0;

  const routeSavings = useMemo(() => {
    const totalSaved = routeMetrics.reduce((a, r) => a + r.fuelSaved, 0);
    const totalCO2 = routeMetrics.reduce((a, r) => a + r.co2Saved, 0);
    const avgOpt = routeMetrics.length ? routeMetrics.reduce((a, r) => a + r.optimisationSavingPercent, 0) / routeMetrics.length : 0;
    const onTime = routeMetrics.length ? routeMetrics.filter((r) => r.onTimeDelivery).length / routeMetrics.length * 100 : 0;
    return { totalSaved: totalSaved.toFixed(0), totalCO2: totalCO2.toFixed(0), avgOpt: avgOpt.toFixed(1), onTime: onTime.toFixed(1) };
  }, [routeMetrics]);

  // Uptime by fleet (bar chart)
  const uptimeChart = filteredFleets.slice(0, 10).map((f) => ({
    name: f.name.slice(0, 15),
    uptime: f.uptimePercent,
    active: f.activeVehicles,
    total: f.vehicleCount,
  }));

  // Efficiency trend
  const effTrend = useMemo(() => {
    const byDay: Record<string, { total: number; count: number }> = {};
    const now = Date.now();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * 86400000).toLocaleDateString('en-CA').slice(5);
      byDay[d] = { total: 0, count: 0 };
    }
    operationalMetrics.forEach((m) => {
      const day = new Date(m.timestamp).toLocaleDateString('en-CA').slice(5);
      if (byDay[day]) { byDay[day].total += m.efficiency; byDay[day].count++; }
    });
    return Object.entries(byDay).map(([date, v]) => ({
      date, efficiency: v.count ? parseFloat((v.total / v.count).toFixed(1)) : 0,
    }));
  }, [operationalMetrics]);

  const columns = [
    {
      key: 'name', header: 'Fleet', sortable: true,
      render: (row: FleetEntity) => {
        const tenant = tenants.find((t) => t.id === row.tenantId);
        return (
          <div>
            <p className="font-medium text-apex-text text-sm">{row.name}</p>
            <p className="text-[10px] text-apex-textMuted">{tenant?.name || 'Unknown'}</p>
          </div>
        );
      },
    },
    { key: 'region', header: 'Region', render: (row: FleetEntity) => <span className="font-mono text-xs text-apex-textDim">{row.region}</span> },
    { key: 'status', header: 'Status', render: (row: FleetEntity) => <StatusBadge status={row.status} /> },
    {
      key: 'vehicleCount', header: 'Vehicles', sortable: true,
      render: (row: FleetEntity) => (
        <span className="font-mono text-xs">{row.activeVehicles}<span className="text-apex-textMuted">/{row.vehicleCount}</span></span>
      ),
    },
    {
      key: 'driverCount', header: 'Drivers', sortable: true,
      render: (row: FleetEntity) => (
        <span className="font-mono text-xs">{row.activeDrivers}<span className="text-apex-textMuted">/{row.driverCount}</span></span>
      ),
    },
    {
      key: 'uptimePercent', header: 'Uptime', sortable: true,
      render: (row: FleetEntity) => (
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 rounded-full bg-apex-border overflow-hidden">
            <div className="h-full rounded-full bg-apex-success" style={{ width: `${row.uptimePercent}%` }} />
          </div>
          <span className={cn('font-mono text-xs', row.uptimePercent > 95 ? 'text-apex-success' : row.uptimePercent > 85 ? 'text-apex-warning' : 'text-apex-danger')}>
            {row.uptimePercent.toFixed(1)}%
          </span>
        </div>
      ),
    },
    { key: 'version', header: 'Version', render: (row: FleetEntity) => <span className="font-mono text-xs text-apex-textMuted">v{row.version}</span> },
    { key: 'lastHeartbeat', header: 'Heartbeat', sortable: true, render: (row: FleetEntity) => <span className="text-xs text-apex-textMuted">{timeAgo(row.lastHeartbeat)}</span> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-apex-text">Fleet <span className="apex-gradient-text">Operations</span></h1>
        <p className="text-sm text-apex-textMuted mt-1">Live fleet monitoring · Route analytics · Driver performance</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Vehicles" value={formatNumber(totalVehicles)} subtitle={`${formatNumber(activeVehicles)} active`} icon={Truck} variant="accent" loading={isLoading} />
        <MetricCard title="Active Drivers" value={formatNumber(filteredFleets.reduce((a, f) => a + f.activeDrivers, 0))} subtitle={`${formatNumber(totalDrivers)} total`} icon={Users} variant="purple" loading={isLoading} />
        <MetricCard title="Avg Fleet Uptime" value={`${avgUptime.toFixed(1)}%`} icon={Shield} variant={avgUptime > 95 ? 'success' : 'warning'} loading={isLoading} />
        <MetricCard title="Route Optimisation" value={`${routeSavings.avgOpt}%`} subtitle="Avg savings per route" icon={TrendingUp} variant="success" loading={isLoading} />
      </div>

      {/* Route savings */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Fuel Saved (L)" value={formatNumber(parseFloat(routeSavings.totalSaved))} icon={Fuel} variant="success" loading={isLoading} />
        <MetricCard title="CO₂ Saved (kg)" value={formatNumber(parseFloat(routeSavings.totalCO2))} icon={Activity} variant="success" loading={isLoading} />
        <MetricCard title="On-Time Rate" value={`${routeSavings.onTime}%`} icon={Shield} variant={parseFloat(routeSavings.onTime) > 90 ? 'success' : 'warning'} loading={isLoading} />
        <MetricCard title="Routes Completed" value={formatNumber(routeMetrics.length)} icon={MapPin} variant="accent" loading={isLoading} />
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        {['all', 'NA', 'EU', 'APAC', 'LATAM', 'MEA'].map((r) => (
          <button key={r} onClick={() => setSelectedRegion(r)}
            className={cn('rounded-lg border px-3 py-1 text-xs font-medium transition-colors', selectedRegion === r ? 'border-apex-accent/50 bg-apex-accent/10 text-apex-accent' : 'border-apex-border text-apex-textMuted hover:text-apex-text')}>
            {r === 'all' ? 'All Regions' : r}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          {['all', 'online', 'degraded', 'offline', 'maintenance'].map((s) => (
            <button key={s} onClick={() => setSelectedStatus(s)}
              className={cn('rounded-lg border px-3 py-1 text-xs font-medium transition-colors capitalize', selectedStatus === s ? 'border-apex-accent/50 bg-apex-accent/10 text-apex-accent' : 'border-apex-border text-apex-textMuted hover:text-apex-text')}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <SectionHeader title="Fleet Uptime" subtitle="Top 10 fleets" icon={Shield} />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={uptimeChart} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} width={80} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="uptime" fill="#10b981" radius={[0, 4, 4, 0]} name="Uptime %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <SectionHeader title="Operational Efficiency" subtitle="14-day trend" icon={BarChart2} />
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={effTrend}>
              <defs>
                <linearGradient id="effGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="efficiency" stroke="#8b5cf6" fill="url(#effGrad)" strokeWidth={2} dot={false} name="Efficiency %" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Fleet Table */}
      <div className="rounded-xl border border-apex-border bg-apex-card p-5">
        <SectionHeader title="Fleet Registry" subtitle={`${filteredFleets.length} fleet entities`} icon={Truck} />
        <DataTable
          columns={columns}
          data={filteredFleets}
          keyField="id"
          searchable
          searchFields={['name', 'region', 'status'] as (keyof FleetEntity)[]}
          loading={isLoading}
          emptyMessage="No fleets found"
          pageSize={15}
        />
      </div>
    </div>
  );
}
