'use client';
import React, { useMemo, useState } from 'react';
import { useApexStore } from '@/store/apex-store';
import { MetricCard } from '@/components/shared/MetricCard';
import { SectionHeader } from '@/components/shared/SectionHeader';
import { formatNumber, formatCurrency, cn } from '@/lib/utils';
import {
  Zap, DollarSign, AlertTriangle, TrendingUp,
  Activity, BarChart2, Globe, Clock
} from 'lucide-react';
import { NoDataBanner } from '@/components/shared/NoDataBanner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';

const CAT_COLORS: Record<string, string> = {
  routing: '#0ea5e9', ai: '#8b5cf6', traffic: '#f59e0b',
  geocoding: '#10b981', maps: '#06b6d4', other: '#64748b',
};

const CustomTooltip = ({ active, payload, label }: Record<string, unknown>) => {
  if (!(active as boolean)) return null;
  return (
    <div className="rounded-lg border border-apex-border bg-apex-card px-3 py-2 text-xs shadow-apex-card">
      <p className="text-apex-textMuted mb-1">{label as string}</p>
      {(payload as Array<{ name: string; value: number; color: string }>)?.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-mono">
          {p.name}: {p.name.toLowerCase().includes('cost') ? `$${Number(p.value).toFixed(3)}` : formatNumber(Number(p.value))}
        </p>
      ))}
    </div>
  );
};

export default function APIControlPage() {
  const { apiUsageLogs, tenants, isLoading } = useApexStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTenantId, setSelectedTenantId] = useState<string>('all');

  const filtered = useMemo(() => {
    return apiUsageLogs.filter((l) => {
      if (selectedCategory !== 'all' && l.category !== selectedCategory) return false;
      if (selectedTenantId !== 'all' && l.tenantId !== selectedTenantId) return false;
      return true;
    });
  }, [apiUsageLogs, selectedCategory, selectedTenantId]);

  const hasData = apiUsageLogs.length > 0;

  // Aggregates
  const totalCalls = filtered.reduce((a, l) => a + l.calls, 0);
  const totalCost = filtered.reduce((a, l) => a + l.cost, 0);
  const avgLatency = filtered.length ? filtered.reduce((a, l) => a + l.latencyAvgMs, 0) / filtered.length : 0;
  const avgErrorRate = filtered.length ? filtered.reduce((a, l) => a + l.errorRate, 0) / filtered.length : 0;
  const highErrorServices = filtered.filter((l) => l.errorRate > 2).length;

  // By category
  const byCategory = useMemo(() => {
    const agg: Record<string, { calls: number; cost: number; latency: number; count: number }> = {};
    filtered.forEach((l) => {
      if (!agg[l.category]) agg[l.category] = { calls: 0, cost: 0, latency: 0, count: 0 };
      agg[l.category].calls += l.calls;
      agg[l.category].cost += l.cost;
      agg[l.category].latency += l.latencyAvgMs;
      agg[l.category].count++;
    });
    return Object.entries(agg).map(([cat, v]) => ({
      category: cat,
      calls: v.calls,
      cost: parseFloat(v.cost.toFixed(2)),
      avgLatency: Math.round(v.latency / v.count),
    })).sort((a, b) => b.calls - a.calls);
  }, [filtered]);

  // By service
  const byService = useMemo(() => {
    const agg: Record<string, { calls: number; cost: number; errors: number; latency: number; count: number; category: string }> = {};
    filtered.forEach((l) => {
      if (!agg[l.service]) agg[l.service] = { calls: 0, cost: 0, errors: 0, latency: 0, count: 0, category: l.category };
      agg[l.service].calls += l.calls;
      agg[l.service].cost += l.cost;
      agg[l.service].errors += l.errorRate;
      agg[l.service].latency += l.latencyAvgMs;
      agg[l.service].count++;
    });
    return Object.entries(agg).map(([service, v]) => ({
      service,
      calls: v.calls,
      cost: parseFloat(v.cost.toFixed(2)),
      errorRate: parseFloat((v.errors / v.count).toFixed(2)),
      avgLatency: Math.round(v.latency / v.count),
      category: v.category,
    })).sort((a, b) => b.cost - a.cost);
  }, [filtered]);

  // Daily cost trend
  const costTrend = useMemo(() => {
    const byDay: Record<string, { routing: number; ai: number; maps: number; other: number }> = {};
    const now = Date.now();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * 86400000).toLocaleDateString('en-CA').slice(5);
      byDay[d] = { routing: 0, ai: 0, maps: 0, other: 0 };
    }
    filtered.forEach((l) => {
      const day = new Date(l.timestamp).toLocaleDateString('en-CA').slice(5);
      if (!byDay[day]) return;
      const k = l.category === 'routing' ? 'routing' : l.category === 'ai' ? 'ai' : l.category === 'maps' ? 'maps' : 'other';
      byDay[day][k] += l.cost;
    });
    return Object.entries(byDay).map(([date, v]) => ({
      date,
      routing: parseFloat(v.routing.toFixed(2)),
      ai: parseFloat(v.ai.toFixed(2)),
      maps: parseFloat(v.maps.toFixed(2)),
      other: parseFloat(v.other.toFixed(2)),
    }));
  }, [filtered]);

  // Cost by tenant
  const tenantCosts = useMemo(() => {
    const agg: Record<string, { cost: number; calls: number; tenantName: string }> = {};
    filtered.forEach((l) => {
      const name = tenants.find((t) => t.id === l.tenantId)?.name || 'Unknown';
      if (!agg[l.tenantId]) agg[l.tenantId] = { cost: 0, calls: 0, tenantName: name };
      agg[l.tenantId].cost += l.cost;
      agg[l.tenantId].calls += l.calls;
    });
    return Object.entries(agg).map(([, v]) => v).sort((a, b) => b.cost - a.cost).slice(0, 8);
  }, [filtered, tenants]);

  // Pie for category cost
  const categoryPie = byCategory.map((c) => ({ name: c.category, value: parseFloat(c.cost.toFixed(2)) }));

  return (
    <div className="space-y-6 animate-fade-in">
      <NoDataBanner hasData={hasData} dataLabel="API usage logs" />
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-apex-text">
            API <span className="apex-gradient-text">Cost Control</span>
          </h1>
          <p className="text-sm text-apex-textMuted mt-1">
            Usage tracking · Cost-per-tenant · Anomaly detection · Scaling forecasts
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
            className="rounded-lg border border-apex-border bg-apex-surface px-3 py-1.5 text-xs text-apex-text focus:outline-none focus:border-apex-accent/60"
          >
            <option value="all">All Tenants</option>
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total API Calls" value={formatNumber(totalCalls)} icon={Zap} variant="accent" loading={isLoading} />
        <MetricCard title="Total Cost" value={formatCurrency(totalCost)} subtitle="30-day period" icon={DollarSign} variant="warning" loading={isLoading} trend={{ value: -5, label: 'vs prev period' }} />
        <MetricCard title="Avg Latency" value={`${avgLatency.toFixed(0)}ms`} icon={Clock} variant="default" loading={isLoading} />
        <MetricCard
          title="Error Rate"
          value={`${avgErrorRate.toFixed(2)}%`}
          subtitle={`${highErrorServices} services flagged`}
          icon={AlertTriangle}
          variant={avgErrorRate > 2 ? 'danger' : 'success'}
          loading={isLoading}
        />
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {['all', 'routing', 'ai', 'traffic', 'geocoding', 'maps', 'other'].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              'rounded-lg border px-3 py-1 text-xs font-medium transition-colors capitalize',
              selectedCategory === cat
                ? 'border-apex-accent/50 bg-apex-accent/10 text-apex-accent'
                : 'border-apex-border text-apex-textMuted hover:text-apex-text'
            )}
          >
            {cat === 'all' ? 'All Categories' : cat}
          </button>
        ))}
      </div>

      {/* Cost Trend + Category Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-apex-border bg-apex-card p-5">
          <SectionHeader title="Cost Trend — 14 Days" subtitle="Stacked by category" icon={TrendingUp} />
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={costTrend}>
              <defs>
                {['routing', 'ai', 'maps', 'other'].map((k) => (
                  <linearGradient key={k} id={`grad_${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CAT_COLORS[k] || '#64748b'} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CAT_COLORS[k] || '#64748b'} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip content={<CustomTooltip />} />
              {['routing', 'ai', 'maps', 'other'].map((k) => (
                <Area key={k} type="monotone" dataKey={k} stroke={CAT_COLORS[k] || '#64748b'}
                  fill={`url(#grad_${k})`} stackId="1" strokeWidth={1.5} dot={false} name={k} />
              ))}
              <Legend formatter={(v) => <span className="text-xs text-apex-textMuted capitalize">{v}</span>} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Cost by Category Pie */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <SectionHeader title="Cost by Category" subtitle="Distribution" icon={BarChart2} />
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={categoryPie} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                {categoryPie.map((entry) => (
                  <Cell key={entry.name} fill={CAT_COLORS[entry.name] || '#64748b'} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={(v) => <span className="text-xs text-apex-textMuted capitalize">{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Service Table + Tenant Cost */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Service Breakdown */}
        <div className="lg:col-span-2 rounded-xl border border-apex-border bg-apex-card p-5">
          <SectionHeader title="Service Breakdown" subtitle="Cost & performance per API service" icon={Globe} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-apex-border">
                  {['Service', 'Category', 'Calls', 'Cost', 'Latency', 'Error Rate'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-apex-textMuted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byService.slice(0, 12).map((row) => (
                  <tr key={row.service} className="border-b border-apex-border/30 hover:bg-apex-surface/30 transition-colors">
                    <td className="px-3 py-2.5 text-xs font-medium text-apex-text">{row.service}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium capitalize"
                        style={{ background: (CAT_COLORS[row.category] || '#64748b') + '20', color: CAT_COLORS[row.category] || '#64748b' }}>
                        {row.category}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-apex-textDim">{formatNumber(row.calls)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-apex-warning">${row.cost}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-apex-textDim">{row.avgLatency}ms</td>
                    <td className="px-3 py-2.5">
                      <span className={cn('font-mono text-xs', row.errorRate > 2 ? 'text-apex-danger' : 'text-apex-success')}>
                        {row.errorRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cost by Tenant */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <SectionHeader title="Cost by Tenant" subtitle="Top spenders" icon={DollarSign} />
          <div className="space-y-3 mt-1">
            {tenantCosts.map((t, i) => {
              const max = tenantCosts[0]?.cost || 1;
              return (
                <div key={t.tenantName}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-apex-textDim truncate max-w-[120px]">{t.tenantName}</span>
                    <span className="font-mono text-apex-warning">{formatCurrency(t.cost)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-apex-border overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(t.cost / max) * 100}%`,
                        backgroundColor: ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'][i % 8],
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {tenantCosts.length === 0 && (
              <p className="text-xs text-apex-textMuted text-center py-6">No cost data</p>
            )}
          </div>
        </div>
      </div>

      {/* Anomaly Detection Panel */}
      <div className="rounded-xl border border-apex-warning/30 bg-apex-warning/5 p-5">
        <SectionHeader title="API Anomaly Detection" subtitle="Services exceeding error thresholds" icon={AlertTriangle} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-2">
          {byService.filter((s) => s.errorRate > 1.5).slice(0, 6).map((s) => (
            <div key={s.service} className="flex items-center justify-between rounded-lg border border-apex-warning/20 bg-apex-card px-3 py-2.5">
              <div>
                <p className="text-xs font-medium text-apex-text">{s.service}</p>
                <p className="text-[10px] text-apex-textMuted capitalize">{s.category}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-mono text-apex-danger">{s.errorRate}% errors</p>
                <p className="text-[10px] text-apex-textMuted">{s.avgLatency}ms avg</p>
              </div>
            </div>
          ))}
          {byService.filter((s) => s.errorRate > 1.5).length === 0 && (
            <div className="col-span-3 text-center py-4">
              <p className="text-xs text-apex-success flex items-center justify-center gap-2">
                <span className="h-2 w-2 rounded-full bg-apex-success animate-pulse" />
                All services operating within normal error thresholds
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
