'use client';
import React, { useMemo, useState } from 'react';
import { useApexStore } from '@/store/apex-store';
import { MetricCard } from '@/components/shared/MetricCard';
import { SectionHeader } from '@/components/shared/SectionHeader';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';
import { DollarSign, TrendingUp, TrendingDown, BarChart2, PieChartIcon, Zap, Brain, Activity } from 'lucide-react';
import { NoDataBanner } from '@/components/shared/NoDataBanner';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

const CAT_COLORS: Record<string, string> = {
  api_cost: '#0ea5e9', ai_cost: '#8b5cf6', infrastructure: '#f59e0b',
  revenue: '#10b981', optimisation_saving: '#06b6d4',
};

const CustomTooltip = ({ active, payload, label }: Record<string, unknown>) => {
  if (!(active as boolean)) return null;
  return (
    <div className="rounded-lg border border-apex-border bg-apex-card px-3 py-2 text-xs shadow-apex-card">
      <p className="text-apex-textMuted mb-1">{label as string}</p>
      {(payload as Array<{ name: string; value: number; color: string }>)?.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-mono">{p.name}: {formatCurrency(Number(p.value))}</p>
      ))}
    </div>
  );
};

export default function FinancePage() {
  const { financialEvents, tenants, isLoading } = useApexStore();
  const [selectedTenantId, setSelectedTenantId] = useState('all');

  const filtered = useMemo(() => {
    return selectedTenantId === 'all' ? financialEvents : financialEvents.filter((e) => e.tenantId === selectedTenantId);
  }, [financialEvents, selectedTenantId]);

  const hasData = financialEvents.length > 0;

  const totalRevenue = filtered.filter((e) => e.category === 'revenue').reduce((a, e) => a + e.amount, 0);
  const totalApiCost = filtered.filter((e) => e.category === 'api_cost').reduce((a, e) => a + e.amount, 0);
  const totalAiCost = filtered.filter((e) => e.category === 'ai_cost').reduce((a, e) => a + e.amount, 0);
  const totalInfra = filtered.filter((e) => e.category === 'infrastructure').reduce((a, e) => a + e.amount, 0);
  const totalSavings = filtered.filter((e) => e.category === 'optimisation_saving').reduce((a, e) => a + e.amount, 0);
  const totalCosts = totalApiCost + totalAiCost + totalInfra;
  const netMargin = totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue) * 100 : 0;

  // Daily revenue vs cost trend
  const dailyTrend = useMemo(() => {
    const byDay: Record<string, { revenue: number; costs: number; savings: number }> = {};
    const now = Date.now();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86400000).toLocaleDateString('en-CA').slice(5);
      byDay[d] = { revenue: 0, costs: 0, savings: 0 };
    }
    filtered.forEach((e) => {
      const day = new Date(e.timestamp).toLocaleDateString('en-CA').slice(5);
      if (!byDay[day]) return;
      if (e.category === 'revenue') byDay[day].revenue += e.amount;
      else if (e.category === 'optimisation_saving') byDay[day].savings += e.amount;
      else byDay[day].costs += e.amount;
    });
    return Object.entries(byDay).map(([date, v]) => ({
      date,
      revenue: parseFloat(v.revenue.toFixed(0)),
      costs: parseFloat(v.costs.toFixed(0)),
      savings: parseFloat(v.savings.toFixed(0)),
    }));
  }, [filtered]);

  // Pie: cost breakdown
  const costPie = [
    { name: 'API Cost', value: parseFloat(totalApiCost.toFixed(0)) },
    { name: 'AI Cost', value: parseFloat(totalAiCost.toFixed(0)) },
    { name: 'Infrastructure', value: parseFloat(totalInfra.toFixed(0)) },
  ].filter((d) => d.value > 0);

  // Tenant profitability
  const tenantProfit = useMemo(() => {
    const agg: Record<string, { revenue: number; costs: number; savings: number; name: string }> = {};
    filtered.forEach((e) => {
      const name = tenants.find((t) => t.id === e.tenantId)?.name || 'Unknown';
      if (!agg[e.tenantId]) agg[e.tenantId] = { revenue: 0, costs: 0, savings: 0, name };
      if (e.category === 'revenue') agg[e.tenantId].revenue += e.amount;
      else if (e.category === 'optimisation_saving') agg[e.tenantId].savings += e.amount;
      else agg[e.tenantId].costs += e.amount;
    });
    return Object.entries(agg).map(([, v]) => ({
      name: v.name.slice(0, 18),
      revenue: parseFloat(v.revenue.toFixed(0)),
      costs: parseFloat(v.costs.toFixed(0)),
      margin: v.revenue > 0 ? parseFloat(((v.revenue - v.costs) / v.revenue * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [filtered, tenants]);

  return (
    <div className="space-y-6 animate-fade-in">
      <NoDataBanner hasData={hasData} dataLabel="financial events" />
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-apex-text">Financial <span className="apex-gradient-text">Intelligence</span></h1>
          <p className="text-sm text-apex-textMuted mt-1">Revenue · Costs · AI savings · Tenant profitability</p>
        </div>
        <select
          value={selectedTenantId}
          onChange={(e) => setSelectedTenantId(e.target.value)}
          className="rounded-lg border border-apex-border bg-apex-surface px-3 py-1.5 text-xs text-apex-text focus:outline-none focus:border-apex-accent/60"
        >
          <option value="all">All Tenants</option>
          {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Revenue" value={formatCurrency(totalRevenue)} icon={DollarSign} variant="success" loading={isLoading} trend={{ value: 14, label: '30 days' }} />
        <MetricCard title="Total Costs" value={formatCurrency(totalCosts)} subtitle="API + AI + Infra" icon={TrendingDown} variant="warning" loading={isLoading} />
        <MetricCard title="Optimisation Savings" value={formatCurrency(totalSavings)} subtitle="Route efficiency gains" icon={TrendingUp} variant="accent" loading={isLoading} />
        <MetricCard title="Net Margin" value={`${netMargin.toFixed(1)}%`} icon={BarChart2} variant={netMargin > 30 ? 'success' : netMargin > 10 ? 'warning' : 'danger'} loading={isLoading} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="API Costs" value={formatCurrency(totalApiCost)} icon={Zap} variant="warning" loading={isLoading} />
        <MetricCard title="AI Costs" value={formatCurrency(totalAiCost)} subtitle="Cloud inference only" icon={Brain} variant="purple" loading={isLoading} />
        <MetricCard title="Infrastructure" value={formatCurrency(totalInfra)} icon={Activity} variant="default" loading={isLoading} />
        <MetricCard title="Gross Profit" value={formatCurrency(totalRevenue - totalCosts)} icon={TrendingUp} variant={totalRevenue - totalCosts > 0 ? 'success' : 'danger'} loading={isLoading} />
      </div>

      {/* Revenue vs Cost Trend */}
      <div className="rounded-xl border border-apex-border bg-apex-card p-5">
        <SectionHeader title="Revenue vs Costs — 30 Days" subtitle="Daily financial performance" icon={TrendingUp} />
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={dailyTrend}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickFormatter={(v) => `$${formatNumber(v)}`} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#revGrad)" strokeWidth={2} dot={false} name="Revenue" />
            <Area type="monotone" dataKey="costs" stroke="#ef4444" fill="url(#costGrad)" strokeWidth={2} dot={false} name="Costs" />
            <Area type="monotone" dataKey="savings" stroke="#0ea5e9" strokeDasharray="4 4" strokeWidth={1.5} dot={false} name="Savings" fill="none" />
            <Legend formatter={(v) => <span className="text-xs text-apex-textMuted capitalize">{v}</span>} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Cost Breakdown + Tenant Profitability */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <SectionHeader title="Cost Breakdown" subtitle="Distribution by category" icon={PieChartIcon} />
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={costPie} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                {costPie.map((entry) => (
                  <Cell key={entry.name} fill={{ 'API Cost': '#0ea5e9', 'AI Cost': '#8b5cf6', 'Infrastructure': '#f59e0b' }[entry.name] || '#64748b'} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={(v) => <span className="text-xs text-apex-textMuted">{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <SectionHeader title="Tenant Profitability" subtitle="Revenue vs cost per tenant" icon={BarChart2} />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={tenantProfit}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickFormatter={(v) => `$${formatNumber(v)}`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} name="Revenue" />
              <Bar dataKey="costs" fill="#ef4444" radius={[4, 4, 0, 0]} name="Costs" />
              <Legend formatter={(v) => <span className="text-xs text-apex-textMuted capitalize">{v}</span>} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
