'use client';
import React, { useMemo } from 'react';
import { useApexStore } from '@/store/apex-store';
import { MetricCard } from '@/components/shared/MetricCard';
import { SectionHeader } from '@/components/shared/SectionHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatNumber, formatCurrency, timeAgo } from '@/lib/utils';
import {
  Globe, Building2, Truck, Users, Activity, Brain, Zap,
  TrendingUp, Shield, Leaf, Fuel, DollarSign, TreePine, Car,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';

const CHART_COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

const CustomTooltip = ({ active, payload, label }: Record<string, unknown>) => {
  if (!(active as boolean) || !(payload as unknown[])) return null;
  return (
    <div className="rounded-lg border border-apex-border bg-apex-card px-3 py-2 shadow-apex-card text-xs">
      <p className="text-apex-textMuted mb-1">{label as string}</p>
      {(payload as Array<{ name: string; value: number; color: string }>).map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-mono">
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
        </p>
      ))}
    </div>
  );
};

// Empty state component
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-40 text-apex-textMuted text-xs text-center px-4">
      {message}
    </div>
  );
}

export default function DashboardPage() {
  const {
    globalAggregate, tenants, fleets, aiMetrics, apiUsageLogs,
    operationalMetrics, deploymentLogs, isLoading, liveFeed,
    routeMetrics, sustainability,
  } = useApexStore();

  const hasData = tenants.length > 0 || fleets.length > 0;

  // AI provider breakdown — from real data
  const aiProviderData = useMemo(() => {
    const counts: Record<string, number> = {};
    aiMetrics.slice(0, 2000).forEach((m) => {
      counts[m.provider] = (counts[m.provider] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [aiMetrics]);

  // Telemetry trend — last 7 days from live feed + stored events
  const telemetryTrend = useMemo(() => {
    const byDay: Record<string, number> = {};
    const now = Date.now();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now - i * 86400000).toLocaleDateString('en-CA');
      byDay[date] = 0;
    }
    liveFeed.forEach((e) => {
      const day = new Date(e.timestamp).toLocaleDateString('en-CA');
      if (byDay[day] !== undefined) byDay[day]++;
    });
    return Object.entries(byDay).map(([date, count]) => ({
      date: date.slice(5),
      events: count,
    }));
  }, [liveFeed]);

  // Efficiency trend from real operational metrics
  const efficiencyTrend = useMemo(() => {
    const byDay: Record<string, { total: number; count: number }> = {};
    const now = Date.now();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 86400000).toLocaleDateString('en-CA').slice(5);
      byDay[d] = { total: 0, count: 0 };
    }
    operationalMetrics.forEach((m) => {
      const day = new Date(m.timestamp).toLocaleDateString('en-CA').slice(5);
      if (byDay[day]) { byDay[day].total += m.efficiency; byDay[day].count++; }
    });
    return Object.entries(byDay).map(([day, v]) => ({
      day,
      efficiency: v.count ? parseFloat((v.total / v.count).toFixed(1)) : 0,
    }));
  }, [operationalMetrics]);

  // Fleet status breakdown
  const fleetStatusData = useMemo(() => {
    const counts: Record<string, number> = { online: 0, degraded: 0, offline: 0, maintenance: 0 };
    fleets.forEach((f) => { counts[f.status] = (counts[f.status] || 0) + 1; });
    return Object.entries(counts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [fleets]);

  // Sustainability by tenant (for bar chart)
  const tenantSustainability = useMemo(() => {
    return (sustainability?.byTenant ?? [])
      .sort((a, b) => b.co2SavedKg - a.co2SavedKg)
      .slice(0, 8)
      .map((s) => ({
        name: s.entityName.length > 14 ? s.entityName.slice(0, 14) + '…' : s.entityName,
        fuelL: s.fuelSavedL,
        co2Kg: s.co2SavedKg,
        costUSD: s.fuelCostSavedUSD,
      }));
  }, [sustainability]);

  // Fuel saved trend from route metrics (daily)
  const fuelTrend = useMemo(() => {
    const byDay: Record<string, { fuel: number; co2: number }> = {};
    const now = Date.now();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * 86400000).toLocaleDateString('en-CA').slice(5);
      byDay[d] = { fuel: 0, co2: 0 };
    }
    routeMetrics.forEach((r) => {
      const day = new Date(r.completedAt).toLocaleDateString('en-CA').slice(5);
      if (byDay[day]) {
        byDay[day].fuel += r.fuelSavedL ?? r.fuelSaved ?? 0;
        byDay[day].co2 += r.co2SavedKg ?? r.co2Saved ?? 0;
      }
    });
    return Object.entries(byDay).map(([date, v]) => ({
      date,
      fuel: parseFloat(v.fuel.toFixed(1)),
      co2: parseFloat(v.co2.toFixed(1)),
    }));
  }, [routeMetrics]);

  const statusColors: Record<string, string> = {
    online: '#10b981', degraded: '#f59e0b', offline: '#ef4444', maintenance: '#64748b',
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-apex-text">
          Global Federation <span className="apex-gradient-text">Overview</span>
        </h1>
        <p className="text-sm text-apex-textMuted mt-1">
          Live data from all connected Fleet Control dashboards and Driver apps
        </p>
      </div>

      {/* No-data banner */}
      {!isLoading && !hasData && (
        <div className="rounded-xl border border-apex-accent/30 bg-apex-accent/5 px-5 py-4 text-sm text-apex-textDim">
          <p className="font-semibold text-apex-accent mb-1">No fleet data connected yet</p>
          <p>Go to <strong>Tenants</strong> → <strong>Register Fleet</strong> to pair your first Fleet Control dashboard or Driver app. Once connected, all metrics will populate automatically.</p>
        </div>
      )}

      {/* KPI Row 1 — Fleet */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Tenants"
          value={formatNumber(globalAggregate?.activeTenants ?? 0)}
          subtitle={`${globalAggregate?.totalTenants ?? 0} total registered`}
          icon={Building2}
          variant="accent"
          loading={isLoading}
        />
        <MetricCard
          title="Online Fleets"
          value={formatNumber(globalAggregate?.activeFleets ?? 0)}
          subtitle={`${globalAggregate?.totalFleets ?? 0} total fleets`}
          icon={Globe}
          variant="success"
          loading={isLoading}
        />
        <MetricCard
          title="Active Vehicles"
          value={formatNumber(globalAggregate?.activeVehicles ?? 0)}
          subtitle={`${formatNumber(globalAggregate?.totalVehicles ?? 0)} total`}
          icon={Truck}
          variant="purple"
          loading={isLoading}
        />
        <MetricCard
          title="Active Drivers"
          value={formatNumber(globalAggregate?.activeDrivers ?? 0)}
          subtitle={`${formatNumber(globalAggregate?.totalDrivers ?? 0)} total`}
          icon={Users}
          variant="default"
          loading={isLoading}
        />
      </div>

      {/* KPI Row 2 — Performance */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Global Uptime"
          value={`${globalAggregate?.globalUptimePercent ?? 0}%`}
          subtitle="Across all fleets"
          icon={Shield}
          variant="success"
          loading={isLoading}
        />
        <MetricCard
          title="Local AI %"
          value={`${globalAggregate?.localInferencePercent ?? 0}%`}
          subtitle="On-device inference"
          icon={Brain}
          variant="purple"
          loading={isLoading}
        />
        <MetricCard
          title="API Cost Today"
          value={formatCurrency(globalAggregate?.totalApiCostToday ?? 0)}
          subtitle="Routing + maps + traffic"
          icon={Zap}
          variant="warning"
          loading={isLoading}
        />
        <MetricCard
          title="Route Optimisation"
          value={`${globalAggregate?.routeOptimisationAvg ?? 0}%`}
          subtitle="Avg savings per route"
          icon={TrendingUp}
          variant="accent"
          loading={isLoading}
        />
      </div>

      {/* Sustainability KPI Row */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Leaf size={16} className="text-apex-success" />
          <span className="text-sm font-semibold text-apex-text">Sustainability Impact</span>
          <span className="text-xs text-apex-textMuted">— last 30 days, all tenants</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard
            title="Fuel Saved"
            value={`${formatNumber(globalAggregate?.totalFuelSavedL ?? 0)} L`}
            subtitle="vs non-optimised baseline"
            icon={Fuel}
            variant="success"
            loading={isLoading}
          />
          <MetricCard
            title="CO₂ Avoided"
            value={`${formatNumber(globalAggregate?.totalCO2SavedKg ?? 0)} kg`}
            subtitle={`≈ ${formatNumber(globalAggregate?.totalTreesEquivalent ?? 0)} trees/yr`}
            icon={Leaf}
            variant="success"
            loading={isLoading}
          />
          <MetricCard
            title="Fuel Cost Saved"
            value={formatCurrency(globalAggregate?.totalFuelCostSavedUSD ?? 0)}
            subtitle="Across all fleets"
            icon={DollarSign}
            variant="accent"
            loading={isLoading}
          />
          <MetricCard
            title="Trees Equivalent"
            value={formatNumber(globalAggregate?.totalTreesEquivalent ?? 0)}
            subtitle="Annual CO₂ absorption"
            icon={TreePine}
            variant="success"
            loading={isLoading}
          />
          <MetricCard
            title="Car Km Avoided"
            value={formatNumber(globalAggregate?.totalCarKmEquivalent ?? 0)}
            subtitle="Petrol car equivalent"
            icon={Car}
            variant="purple"
            loading={isLoading}
          />
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Telemetry Events */}
        <div className="lg:col-span-2 rounded-xl border border-apex-border bg-apex-card p-5">
          <SectionHeader title="Telemetry Feed" subtitle="Events ingested — last 7 days" icon={Activity} />
          {liveFeed.length === 0 ? (
            <EmptyState message="No telemetry yet. Data will appear as fleet dashboards and driver apps connect." />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={telemetryTrend}>
                <defs>
                  <linearGradient id="telGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="events" stroke="#0ea5e9" fill="url(#telGrad)" strokeWidth={2} dot={false} name="Events" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Fleet Status Pie */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <SectionHeader title="Fleet Status" subtitle="Status distribution" icon={Truck} />
          {fleets.length === 0 ? (
            <EmptyState message="No fleets paired yet." />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={fleetStatusData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {fleetStatusData.map((entry) => (
                    <Cell key={entry.name} fill={statusColors[entry.name] || '#64748b'} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend formatter={(value) => <span className="text-xs text-apex-textMuted capitalize">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Fuel + CO₂ Savings Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <SectionHeader title="Fuel & CO₂ Saved" subtitle="14-day daily trend" icon={Fuel} />
          {routeMetrics.length === 0 ? (
            <EmptyState message="Route data will appear once drivers complete optimised routes." />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={fuelTrend}>
                <defs>
                  <linearGradient id="fuelGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="co2Grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="fuel" stroke="#10b981" fill="url(#fuelGrad)" strokeWidth={2} dot={false} name="Fuel (L)" />
                <Area type="monotone" dataKey="co2" stroke="#0ea5e9" fill="url(#co2Grad)" strokeWidth={2} dot={false} name="CO₂ (kg)" />
                <Legend formatter={(v) => <span className="text-xs text-apex-textMuted">{v}</span>} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* CO₂ Saved by Tenant */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <SectionHeader title="CO₂ Saved by Tenant" subtitle="Last 30 days (kg)" icon={Leaf} />
          {tenantSustainability.length === 0 ? (
            <EmptyState message="No tenant route data yet." />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={tenantSustainability} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} width={90} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="co2Kg" fill="#10b981" radius={[0, 4, 4, 0]} name="CO₂ Saved (kg)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Efficiency + AI Providers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <SectionHeader title="Operational Efficiency" subtitle="7-day rolling average" icon={TrendingUp} />
          {operationalMetrics.length === 0 ? (
            <EmptyState message="Efficiency metrics stream in from fleet control dashboards." />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={efficiencyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="efficiency" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Efficiency %" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <SectionHeader title="AI Provider Distribution" subtitle="Inference count by provider" icon={Brain} />
          {aiProviderData.length === 0 ? (
            <EmptyState message="AI inference data streams in as fleets run optimisation jobs." />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={aiProviderData} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {aiProviderData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Live Tenant Table */}
      <div className="rounded-xl border border-apex-border bg-apex-card p-5">
        <SectionHeader title="Connected Tenants" subtitle="Real-time status" icon={Building2} />
        {tenants.length === 0 ? (
          <EmptyState message="No tenants connected. Use Register Fleet to pair your first fleet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-apex-border">
                  {['Tenant', 'Region', 'Status', 'Fleets', 'Vehicles', 'CO₂ Saved (kg)', 'Fuel Saved (L)', 'Cost Saved ($)', 'Last Seen'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-apex-textMuted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => {
                  const sus = sustainability?.byTenant.find((s) => s.entityId === t.id);
                  return (
                    <tr key={t.id} className="border-b border-apex-border/30 hover:bg-apex-surface/40 transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-apex-text">{t.name}</p>
                        <p className="text-apex-textMuted text-[10px]">{t.plan}</p>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-apex-textDim">{t.region}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={t.status} /></td>
                      <td className="px-4 py-2.5 font-mono">{t.fleetCount}</td>
                      <td className="px-4 py-2.5 font-mono">{formatNumber(t.vehicleCount)}</td>
                      <td className="px-4 py-2.5 font-mono text-apex-success">{sus ? formatNumber(sus.co2SavedKg) : '—'}</td>
                      <td className="px-4 py-2.5 font-mono text-apex-success">{sus ? formatNumber(sus.fuelSavedL) : '—'}</td>
                      <td className="px-4 py-2.5 font-mono text-apex-accent">{sus ? formatCurrency(sus.fuelCostSavedUSD) : '—'}</td>
                      <td className="px-4 py-2.5 text-apex-textMuted">{timeAgo(t.lastSeen)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Deployments */}
      {deploymentLogs.length > 0 && (
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <SectionHeader title="Recent Deployments" subtitle="Last 5 fleet software updates" icon={Zap} />
          <div className="space-y-2">
            {deploymentLogs.slice(0, 5).map((d) => (
              <div key={d.id} className="flex items-center gap-3 rounded-lg bg-apex-surface px-4 py-2.5 text-xs">
                <StatusBadge status={d.status} />
                <span className="font-mono text-apex-text">v{d.version}</span>
                <span className="text-apex-textMuted flex-1">{d.notes}</span>
                <span className="font-mono text-apex-textDim">{d.vehiclesUpdated}/{d.vehiclesTotal} vehicles</span>
                <span className="text-apex-textMuted">{timeAgo(d.deployedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
