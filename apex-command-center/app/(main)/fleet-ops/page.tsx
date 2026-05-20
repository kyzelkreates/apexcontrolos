'use client';
import React, { useMemo, useState } from 'react';
import { useApexStore } from '@/store/apex-store';
import { MetricCard } from '@/components/shared/MetricCard';
import { SectionHeader } from '@/components/shared/SectionHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DataTable, Column } from '@/components/shared/DataTable';
import { formatNumber, formatCurrency, timeAgo, cn } from '@/lib/utils';
import {
  Truck, Users, TrendingUp, Shield, MapPin, Activity,
  BarChart2, Fuel, Leaf, DollarSign, TreePine, Car, UserCheck,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Legend,
} from 'recharts';
import type { FleetEntity, SustainabilityMetrics, DriverMetric } from '@/types';

const CustomTooltip = ({ active, payload, label }: Record<string, unknown>) => {
  if (!(active as boolean)) return null;
  return (
    <div className="rounded-lg border border-apex-border bg-apex-card px-3 py-2 text-xs shadow-apex-card">
      <p className="text-apex-textMuted mb-1">{label as string}</p>
      {(payload as Array<{ name: string; value: number; color: string }>)?.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-mono">{p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</p>
      ))}
    </div>
  );
};

function EmptyState({ message }: { message: string }) {
  return <div className="flex items-center justify-center h-40 text-apex-textMuted text-xs text-center px-4">{message}</div>;
}

export default function FleetOpsPage() {
  const { fleets, routeMetrics, operationalMetrics, tenants, isLoading, sustainability } = useApexStore();
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [activeTab, setActiveTab] = useState<'fleets' | 'sustainability' | 'drivers'>('fleets');

  const filteredFleets = useMemo(() => fleets.filter((f) => {
    if (selectedRegion !== 'all' && f.region !== selectedRegion) return false;
    if (selectedStatus !== 'all' && f.status !== selectedStatus) return false;
    return true;
  }), [fleets, selectedRegion, selectedStatus]);

  // KPI aggregates from real fleet data
  const totalVehicles = filteredFleets.reduce((a, f) => a + f.vehicleCount, 0);
  const activeVehicles = filteredFleets.reduce((a, f) => a + f.activeVehicles, 0);
  const totalDrivers = filteredFleets.reduce((a, f) => a + f.driverCount, 0);
  const activeDrivers = filteredFleets.reduce((a, f) => a + f.activeDrivers, 0);
  const avgUptime = filteredFleets.length
    ? filteredFleets.reduce((a, f) => a + f.uptimePercent, 0) / filteredFleets.length
    : 0;

  // Route summary from real route data
  const routeSummary = useMemo(() => {
    const totalFuel = routeMetrics.reduce((a, r) => a + (r.fuelSavedL ?? r.fuelSaved ?? 0), 0);
    const totalCO2 = routeMetrics.reduce((a, r) => a + (r.co2SavedKg ?? r.co2Saved ?? 0), 0);
    const totalCost = routeMetrics.reduce((a, r) => a + (r.fuelCostSavedUSD ?? 0), 0);
    const avgOpt = routeMetrics.length
      ? routeMetrics.reduce((a, r) => a + r.optimisationSavingPercent, 0) / routeMetrics.length
      : 0;
    const onTime = routeMetrics.length
      ? routeMetrics.filter((r) => r.onTimeDelivery).length / routeMetrics.length * 100
      : 0;
    return {
      totalFuel: totalFuel.toFixed(0),
      totalCO2: totalCO2.toFixed(0),
      totalCost: totalCost.toFixed(2),
      avgOpt: avgOpt.toFixed(1),
      onTime: onTime.toFixed(1),
      trees: (totalCO2 / 21).toFixed(0),
      carKm: (totalCO2 / 0.12).toFixed(0),
    };
  }, [routeMetrics]);

  // Fleet uptime chart
  const uptimeChart = filteredFleets.slice(0, 10).map((f) => ({
    name: f.name.length > 15 ? f.name.slice(0, 15) + '…' : f.name,
    uptime: f.uptimePercent,
    active: f.activeVehicles,
    total: f.vehicleCount,
  }));

  // Efficiency trend from real operational data
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

  // Sustainability by fleet (sorted)
  const fleetSustainability: SustainabilityMetrics[] = useMemo(() => {
    return (sustainability?.byFleet ?? []).sort((a, b) => b.co2SavedKg - a.co2SavedKg);
  }, [sustainability]);

  // Driver leaderboard
  const driverLeaderboard: DriverMetric[] = useMemo(() => {
    return (sustainability?.byDriver ?? []).sort((a, b) => b.co2SavedKg - a.co2SavedKg);
  }, [sustainability]);

  // Fleet columns
  const fleetColumns: Column<FleetEntity>[] = [
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
    {
      key: 'co2', header: 'CO₂ Saved (kg)', sortable: false,
      render: (row: FleetEntity) => {
        const sus = fleetSustainability.find((s) => s.entityId === row.id);
        return <span className="font-mono text-xs text-apex-success">{sus ? formatNumber(sus.co2SavedKg) : '—'}</span>;
      },
    },
    {
      key: 'fuel', header: 'Fuel Saved (L)', sortable: false,
      render: (row: FleetEntity) => {
        const sus = fleetSustainability.find((s) => s.entityId === row.id);
        return <span className="font-mono text-xs text-apex-success">{sus ? formatNumber(sus.fuelSavedL) : '—'}</span>;
      },
    },
    { key: 'version', header: 'Version', render: (row: FleetEntity) => <span className="font-mono text-xs text-apex-textMuted">v{row.version}</span> },
    { key: 'lastHeartbeat', header: 'Heartbeat', sortable: true, render: (row: FleetEntity) => <span className="text-xs text-apex-textMuted">{timeAgo(row.lastHeartbeat)}</span> },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-apex-text">Fleet <span className="apex-gradient-text">Operations</span></h1>
        <p className="text-sm text-apex-textMuted mt-1">Live fleet monitoring · Route analytics · Sustainability · Driver performance</p>
      </div>

      {/* KPI Row — Fleet */}
      <div className="grid grid-cols-2 lg:grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard title="Total Vehicles" value={formatNumber(totalVehicles)} subtitle={`${formatNumber(activeVehicles)} active`} icon={Truck} variant="accent" loading={isLoading} />
        <MetricCard title="Active Drivers" value={formatNumber(activeDrivers)} subtitle={`${formatNumber(totalDrivers)} total`} icon={Users} variant="purple" loading={isLoading} />
        <MetricCard title="Avg Fleet Uptime" value={`${avgUptime.toFixed(1)}%`} icon={Shield} variant={avgUptime > 95 ? 'success' : avgUptime > 85 ? 'warning' : 'danger'} loading={isLoading} />
        <MetricCard title="Route Optimisation" value={`${routeSummary.avgOpt}%`} subtitle="Avg savings per route" icon={TrendingUp} variant="success" loading={isLoading} />
      </div>

      {/* Sustainability KPI Row */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Leaf size={14} className="text-apex-success" />
          <span className="text-xs font-semibold text-apex-text uppercase tracking-wider">Sustainability — Last 30 Days</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <MetricCard title="Fuel Saved" value={`${formatNumber(parseFloat(routeSummary.totalFuel))} L`} icon={Fuel} variant="success" loading={isLoading} />
          <MetricCard title="CO₂ Avoided" value={`${formatNumber(parseFloat(routeSummary.totalCO2))} kg`} icon={Leaf} variant="success" loading={isLoading} />
          <MetricCard title="Fuel Cost Saved" value={formatCurrency(parseFloat(routeSummary.totalCost))} icon={DollarSign} variant="accent" loading={isLoading} />
          <MetricCard title="Trees Equivalent" value={formatNumber(parseFloat(routeSummary.trees))} subtitle="Annual CO₂ trees" icon={TreePine} variant="success" loading={isLoading} />
          <MetricCard title="On-Time Delivery" value={`${routeSummary.onTime}%`} icon={Shield} variant={parseFloat(routeSummary.onTime) > 90 ? 'success' : 'warning'} loading={isLoading} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-apex-border bg-apex-surface p-1 w-fit">
        {(['fleets', 'sustainability', 'drivers'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn('rounded-md px-4 py-1.5 text-xs font-medium capitalize transition-colors',
              activeTab === tab ? 'bg-apex-accent text-white' : 'text-apex-textMuted hover:text-apex-text')}>
            {tab === 'sustainability' ? '🌿 Sustainability' : tab === 'drivers' ? '👤 Drivers' : '🚛 Fleets'}
          </button>
        ))}
      </div>

      {/* Tab: Fleets */}
      {activeTab === 'fleets' && (
        <>
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
          <div className="grid grid-cols-1 lg:grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="rounded-xl border border-apex-border bg-apex-card p-5">
              <SectionHeader title="Fleet Uptime" subtitle="Top 10 fleets" icon={Shield} />
              {uptimeChart.length === 0
                ? <EmptyState message="No fleet data yet." />
                : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={uptimeChart} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickFormatter={(v) => `${v}%`} />
                      <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} width={90} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="uptime" fill="#10b981" radius={[0, 4, 4, 0]} name="Uptime %" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
            </div>
            <div className="rounded-xl border border-apex-border bg-apex-card p-5">
              <SectionHeader title="Operational Efficiency" subtitle="14-day trend" icon={BarChart2} />
              {operationalMetrics.length === 0
                ? <EmptyState message="Efficiency data streams from fleet dashboards." />
                : (
                  <ResponsiveContainer width="100%" height={220}>
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
                )}
            </div>
          </div>

          {/* Fleet Table */}
          {fleets.length === 0
            ? <EmptyState message="No fleets paired yet. Register a fleet to see data." />
            : <DataTable data={filteredFleets} columns={fleetColumns} keyField="id" pageSize={10} searchable searchFields={['name'] as (keyof FleetEntity)[]} emptyMessage="No fleets match the selected filters." />
          }
        </>
      )}

      {/* Tab: Sustainability */}
      {activeTab === 'sustainability' && (
        <div className="space-y-4 sm:space-y-6">
          {fleetSustainability.length === 0 ? (
            <EmptyState message="No route data yet. Sustainability metrics appear once drivers complete optimised routes." />
          ) : (
            <>
              {/* Fleet sustainability bar */}
              <div className="rounded-xl border border-apex-border bg-apex-card p-5">
                <SectionHeader title="CO₂ Saved by Fleet" subtitle="Last 30 days (kg)" icon={Leaf} />
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={fleetSustainability.slice(0, 12).map((s) => ({
                    name: s.entityName.length > 16 ? s.entityName.slice(0, 16) + '…' : s.entityName,
                    co2: s.co2SavedKg,
                    fuel: s.fuelSavedL,
                    cost: s.fuelCostSavedUSD,
                  }))} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} width={110} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="co2" fill="#10b981" name="CO₂ (kg)" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="fuel" fill="#0ea5e9" name="Fuel (L)" radius={[0, 4, 4, 0]} />
                    <Legend formatter={(v) => <span className="text-xs text-apex-textMuted">{v}</span>} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Per-fleet sustainability table */}
              <div className="rounded-xl border border-apex-border bg-apex-card p-5">
                <SectionHeader title="Fleet Sustainability Detail" subtitle="Full breakdown per fleet" icon={TreePine} />
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-apex-border">
                        {['Fleet', 'CO₂ Saved (kg)', 'Fuel Saved (L)', 'Cost Saved ($)', 'Trees Eq.', 'Car Km Avoided', 'Routes Opt.', 'On-Time %', 'Avg Saving %'].map((h) => (
                          <th key={h} className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-apex-textMuted">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fleetSustainability.map((s) => (
                        <tr key={s.entityId} className="border-b border-apex-border/30 hover:bg-apex-surface/40 transition-colors">
                          <td className="px-4 py-2.5 font-medium text-apex-text">{s.entityName}</td>
                          <td className="px-4 py-2.5 font-mono text-apex-success">{formatNumber(s.co2SavedKg)}</td>
                          <td className="px-4 py-2.5 font-mono text-apex-success">{formatNumber(s.fuelSavedL)}</td>
                          <td className="px-4 py-2.5 font-mono text-apex-accent">{formatCurrency(s.fuelCostSavedUSD)}</td>
                          <td className="px-4 py-2.5 font-mono">{formatNumber(s.treesEquivalent)}</td>
                          <td className="px-4 py-2.5 font-mono">{formatNumber(s.carKmEquivalent)}</td>
                          <td className="px-4 py-2.5 font-mono">{s.routesOptimised}<span className="text-apex-textMuted">/{s.totalRoutes}</span></td>
                          <td className="px-4 py-2.5 font-mono">{s.onTimeRate}%</td>
                          <td className="px-4 py-2.5 font-mono text-apex-success">{s.avgSavingPercent}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab: Drivers */}
      {activeTab === 'drivers' && (
        <div className="space-y-4 sm:space-y-6">
          {driverLeaderboard.length === 0 ? (
            <EmptyState message="No driver data yet. Driver metrics appear once routes complete with a driverId." />
          ) : (
            <>
              {/* Driver leaderboard bar */}
              <div className="rounded-xl border border-apex-border bg-apex-card p-5">
                <SectionHeader title="Top Drivers — CO₂ Saved" subtitle="Last 30 days" icon={UserCheck} />
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={driverLeaderboard.slice(0, 10).map((d) => ({
                    name: d.driverId.slice(0, 10),
                    co2: d.co2SavedKg,
                    fuel: d.fuelSavedL,
                  }))} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} width={80} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="co2" fill="#10b981" name="CO₂ Saved (kg)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Driver table */}
              <div className="rounded-xl border border-apex-border bg-apex-card p-5">
                <SectionHeader title="Driver Performance — Sustainability" subtitle="All drivers, last 30 days" icon={Users} />
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-apex-border">
                        {['Driver ID', 'Fleet', 'Routes', 'On-Time %', 'CO₂ Saved (kg)', 'Fuel Saved (L)', 'Cost Saved ($)', 'Avg Opt %', 'Dist (km)', 'Last Active'].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-apex-textMuted">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {driverLeaderboard.map((d, i) => {
                        const fleet = fleets.find((f) => f.id === d.fleetId);
                        const onTimeRate = d.totalRoutes ? ((d.onTimeRoutes / d.totalRoutes) * 100).toFixed(1) : '0';
                        return (
                          <tr key={d.driverId} className="border-b border-apex-border/30 hover:bg-apex-surface/40 transition-colors">
                            <td className="px-3 py-2.5 font-mono text-apex-text">
                              <span className="text-apex-textMuted text-[9px] mr-1">#{i + 1}</span>
                              {d.driverId.slice(0, 14)}
                            </td>
                            <td className="px-3 py-2.5 text-apex-textDim text-[10px]">{fleet?.name?.slice(0, 16) || d.fleetId.slice(0, 10)}</td>
                            <td className="px-3 py-2.5 font-mono">{d.totalRoutes}</td>
                            <td className="px-3 py-2.5 font-mono">
                              <span className={parseFloat(onTimeRate) >= 90 ? 'text-apex-success' : 'text-apex-warning'}>{onTimeRate}%</span>
                            </td>
                            <td className="px-3 py-2.5 font-mono text-apex-success">{formatNumber(d.co2SavedKg)}</td>
                            <td className="px-3 py-2.5 font-mono text-apex-success">{formatNumber(d.fuelSavedL)}</td>
                            <td className="px-3 py-2.5 font-mono text-apex-accent">{formatCurrency(d.fuelCostSavedUSD)}</td>
                            <td className="px-3 py-2.5 font-mono">{d.avgOptimisationPercent}%</td>
                            <td className="px-3 py-2.5 font-mono">{formatNumber(d.totalDistanceKm)}</td>
                            <td className="px-3 py-2.5 text-apex-textMuted">{timeAgo(d.lastActive)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
