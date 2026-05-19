'use client';
import React, { useMemo } from 'react';
import { useApexStore } from '@/store/apex-store';
import { MetricCard } from '@/components/shared/MetricCard';
import { SectionHeader } from '@/components/shared/SectionHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatNumber, formatCurrency, timeAgo, regionLabel } from '@/lib/utils';
import {
  Globe, Building2, Truck, Users, Activity, Brain, Zap,
  TrendingUp, Shield, AlertTriangle, Rocket, DollarSign
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend
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

export default function DashboardPage() {
  const {
    globalAggregate, tenants, fleets, aiMetrics, apiUsageLogs,
    operationalMetrics, deploymentLogs, isLoading, liveFeed
  } = useApexStore();

  // AI provider breakdown
  const aiProviderData = useMemo(() => {
    const counts: Record<string, number> = {};
    aiMetrics.slice(0, 500).forEach((m) => {
      counts[m.provider] = (counts[m.provider] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [aiMetrics]);

  // Telemetry feed last 7 days
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

  // Efficiency trend from operational metrics
  const efficiencyTrend = useMemo(() => {
    const recent = operationalMetrics.slice(0, 30).sort((a, b) => a.timestamp - b.timestamp);
    const byDay: Record<string, { total: number; count: number }> = {};
    recent.forEach((m) => {
      const day = new Date(m.timestamp).toLocaleDateString('en-CA').slice(5);
      if (!byDay[day]) byDay[day] = { total: 0, count: 0 };
      byDay[day].total += m.efficiency;
      byDay[day].count++;
    });
    return Object.entries(byDay).slice(-7).map(([day, v]) => ({
      day,
      efficiency: parseFloat((v.total / v.count).toFixed(1)),
    }));
  }, [operationalMetrics]);

  // Fleet status breakdown
  const fleetStatusData = useMemo(() => {
    const counts: Record<string, number> = { online: 0, degraded: 0, offline: 0, maintenance: 0 };
    fleets.forEach((f) => { counts[f.status] = (counts[f.status] || 0) + 1; });
    return Object.entries(counts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [fleets]);

  const statusColors: Record<string, string> = {
    online: '#10b981', degraded: '#f59e0b', offline: '#ef4444', maintenance: '#64748b'
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-apex-text">
          Global Federation <span className="apex-gradient-text">Overview</span>
        </h1>
        <p className="text-sm text-apex-textMuted mt-1">
          Master control panel — all connected fleets, tenants, and AI systems
        </p>
      </div>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Tenants"
          value={formatNumber(globalAggregate?.activeTenants ?? 0)}
          subtitle={`${globalAggregate?.totalTenants ?? 0} total registered`}
          icon={Building2}
          variant="accent"
          loading={isLoading}
          trend={{ value: 12, label: 'this month' }}
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
          subtitle={`${formatNumber(globalAggregate?.totalVehicles ?? 0)} total fleet`}
          icon={Truck}
          variant="purple"
          loading={isLoading}
          trend={{ value: 5, label: 'vs yesterday' }}
        />
        <MetricCard
          title="Active Drivers"
          value={formatNumber(globalAggregate?.activeDrivers ?? 0)}
          subtitle={`${formatNumber(globalAggregate?.totalDrivers ?? 0)} total drivers`}
          icon={Users}
          variant="default"
          loading={isLoading}
        />
      </div>

      {/* KPI Row 2 */}
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
          subtitle="On-device inference rate"
          icon={Brain}
          variant="purple"
          loading={isLoading}
          trend={{ value: 8, label: 'efficiency gain' }}
        />
        <MetricCard
          title="API Cost Today"
          value={formatCurrency(globalAggregate?.totalApiCostToday ?? 0)}
          subtitle="Routing + traffic + maps"
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Telemetry Events */}
        <div className="lg:col-span-2 rounded-xl border border-apex-border bg-apex-card p-5">
          <SectionHeader
            title="Telemetry Feed"
            subtitle="Events ingested over 7 days"
            icon={Activity}
          />
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
              <Area
                type="monotone"
                dataKey="events"
                stroke="#0ea5e9"
                fill="url(#telGrad)"
                strokeWidth={2}
                dot={false}
                name="Events"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Fleet Status Pie */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <SectionHeader title="Fleet Status" subtitle="Status distribution" icon={Truck} />
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={fleetStatusData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {fleetStatusData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={statusColors[entry.name] || '#64748b'}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => (
                  <span className="text-xs text-apex-textMuted capitalize">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row: Efficiency + AI Providers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Efficiency Trend */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <SectionHeader title="Operational Efficiency" subtitle="7-day rolling average" icon={TrendingUp} />
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={efficiencyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
              <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="efficiency" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Efficiency %" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* AI Provider Breakdown */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <SectionHeader title="AI Provider Distribution" subtitle="Inference source breakdown" icon={Brain} />
          {aiProviderData.length === 0 ? (
            <div className="flex h-44 items-center justify-center text-apex-textMuted text-sm">
              No AI metrics yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={aiProviderData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} width={70} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Inferences">
                  {aiProviderData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom Row: Tenant Table + Live Deployments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Tenants */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <SectionHeader title="Connected Tenants" subtitle="Global federation registry" icon={Building2} />
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {tenants.slice(0, 10).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg border border-apex-border/50 bg-apex-surface px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-apex-text truncate">{t.name}</p>
                  <p className="text-[10px] text-apex-textMuted">
                    {regionLabel(t.region)} · {t.vehicleCount} vehicles · {t.plan}
                  </p>
                </div>
                <StatusBadge status={t.status} />
              </div>
            ))}
            {tenants.length === 0 && (
              <p className="text-center text-sm text-apex-textMuted py-8">No tenants registered</p>
            )}
          </div>
        </div>

        {/* Recent Deployments */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <SectionHeader title="Deployment Status" subtitle="Recent rollouts" icon={Rocket} />
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {deploymentLogs.slice(0, 8).map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-lg border border-apex-border/50 bg-apex-surface px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-apex-text truncate">v{d.version}</p>
                  <p className="text-[10px] text-apex-textMuted">
                    {d.region} · {d.vehiclesUpdated}/{d.vehiclesTotal} vehicles · {timeAgo(d.deployedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {d.healthCheckPassed ? (
                    <Shield size={12} className="text-apex-success" />
                  ) : (
                    <AlertTriangle size={12} className="text-apex-danger" />
                  )}
                  <StatusBadge status={d.status} />
                </div>
              </div>
            ))}
            {deploymentLogs.length === 0 && (
              <p className="text-center text-sm text-apex-textMuted py-8">No deployments found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
