'use client';
import React, { useMemo, useState } from 'react';
import { useApexStore } from '@/store/apex-store';
import { MetricCard } from '@/components/shared/MetricCard';
import { SectionHeader } from '@/components/shared/SectionHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatNumber, formatCurrency, cn } from '@/lib/utils';
import {
  Brain, Cpu, Cloud, Zap, TrendingUp, Clock, DollarSign,
  BarChart2, CheckCircle2, AlertTriangle, RefreshCw
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import type { AIProvider } from '@/types';

const PROVIDER_COLORS: Record<string, string> = {
  ollama: '#10b981', llama: '#059669', mistral: '#8b5cf6', deepseek: '#7c3aed',
  qwen: '#06b6d4', openai: '#0ea5e9', anthropic: '#f59e0b', gemini: '#ef4444',
};

const CustomTooltip = ({ active, payload, label }: Record<string, unknown>) => {
  if (!(active as boolean)) return null;
  return (
    <div className="rounded-lg border border-apex-border bg-apex-card px-3 py-2 text-xs shadow-apex-card">
      <p className="text-apex-textMuted mb-1">{label as string}</p>
      {(payload as Array<{ name: string; value: number; color: string }>)?.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-mono">
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
};

const AI_PROVIDER_LABELS: Record<string, { label: string; type: 'local' | 'cloud' }> = {
  ollama: { label: 'Ollama', type: 'local' },
  llama: { label: 'Llama', type: 'local' },
  mistral: { label: 'Mistral', type: 'local' },
  deepseek: { label: 'DeepSeek', type: 'local' },
  qwen: { label: 'Qwen', type: 'local' },
  openai: { label: 'OpenAI', type: 'cloud' },
  anthropic: { label: 'Anthropic', type: 'cloud' },
  gemini: { label: 'Gemini', type: 'cloud' },
};

export default function AICenterPage() {
  const { aiMetrics, tenants, isLoading } = useApexStore();
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | 'all'>('all');
  const [selectedTenantId, setSelectedTenantId] = useState<string>('all');

  const filtered = useMemo(() => {
    return aiMetrics.filter((m) => {
      if (selectedProvider !== 'all' && m.provider !== selectedProvider) return false;
      if (selectedTenantId !== 'all' && m.tenantId !== selectedTenantId) return false;
      return true;
    });
  }, [aiMetrics, selectedProvider, selectedTenantId]);

  // ── Aggregates ──────────────────────────────────────────────
  const totalTokens = filtered.reduce((a, m) => a + m.tokensUsed, 0);
  const totalCost = filtered.reduce((a, m) => a + m.cost, 0);
  const localInferences = filtered.filter((m) => m.inferenceSource === 'local').length;
  const cacheHits = filtered.filter((m) => m.cacheHit).length;
  const fallbacks = filtered.filter((m) => m.fallbackTriggered).length;
  const avgLatency = filtered.length ? filtered.reduce((a, m) => a + m.latencyMs, 0) / filtered.length : 0;
  const localPct = filtered.length ? (localInferences / filtered.length) * 100 : 0;
  const cacheHitPct = filtered.length ? (cacheHits / filtered.length) * 100 : 0;
  const successRate = filtered.length
    ? (filtered.filter((m) => m.success).length / filtered.length) * 100
    : 0;

  // ── Provider Breakdown ──────────────────────────────────────
  const providerBreakdown = useMemo(() => {
    const agg: Record<string, { calls: number; tokens: number; cost: number; latency: number; local: boolean }> = {};
    filtered.forEach((m) => {
      if (!agg[m.provider]) {
        agg[m.provider] = { calls: 0, tokens: 0, cost: 0, latency: 0, local: m.inferenceSource === 'local' };
      }
      agg[m.provider].calls++;
      agg[m.provider].tokens += m.tokensUsed;
      agg[m.provider].cost += m.cost;
      agg[m.provider].latency += m.latencyMs;
    });
    return Object.entries(agg).map(([provider, v]) => ({
      provider,
      label: AI_PROVIDER_LABELS[provider]?.label || provider,
      calls: v.calls,
      tokens: v.tokens,
      cost: parseFloat(v.cost.toFixed(4)),
      avgLatency: parseFloat((v.latency / v.calls).toFixed(0)),
      local: AI_PROVIDER_LABELS[provider]?.type === 'local',
    })).sort((a, b) => b.calls - a.calls);
  }, [filtered]);

  // ── Inference Source Pie ────────────────────────────────────
  const sourcePieData = useMemo(() => {
    const src = { local: 0, cloud: 0, cached: 0 };
    filtered.forEach((m) => { src[m.inferenceSource]++; });
    return Object.entries(src).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [filtered]);
  const sourceColors = { local: '#10b981', cloud: '#0ea5e9', cached: '#8b5cf6' };

  // ── Task Type Breakdown ─────────────────────────────────────
  const taskBreakdown = useMemo(() => {
    const agg: Record<string, number> = {};
    filtered.forEach((m) => { agg[m.taskType] = (agg[m.taskType] || 0) + 1; });
    return Object.entries(agg).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  // ── Daily Token Trend ───────────────────────────────────────
  const tokenTrend = useMemo(() => {
    const byDay: Record<string, { local: number; cloud: number }> = {};
    const now = Date.now();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * 86400000).toLocaleDateString('en-CA').slice(5);
      byDay[d] = { local: 0, cloud: 0 };
    }
    filtered.forEach((m) => {
      const day = new Date(m.timestamp).toLocaleDateString('en-CA').slice(5);
      if (byDay[day]) {
        if (m.inferenceSource === 'local') byDay[day].local += m.tokensUsed;
        else byDay[day].cloud += m.tokensUsed;
      }
    });
    return Object.entries(byDay).map(([date, v]) => ({ date, ...v }));
  }, [filtered]);

  // ── Model Comparison ────────────────────────────────────────
  const modelComparison = useMemo(() => {
    const agg: Record<string, { latency: number; count: number; cost: number; tokens: number }> = {};
    filtered.slice(0, 1000).forEach((m) => {
      if (!agg[m.model]) agg[m.model] = { latency: 0, count: 0, cost: 0, tokens: 0 };
      agg[m.model].latency += m.latencyMs;
      agg[m.model].count++;
      agg[m.model].cost += m.cost;
      agg[m.model].tokens += m.tokensUsed;
    });
    return Object.entries(agg)
      .map(([model, v]) => ({
        model: model.length > 16 ? model.slice(0, 14) + '…' : model,
        avgLatency: Math.round(v.latency / v.count),
        totalCost: parseFloat(v.cost.toFixed(4)),
        totalTokens: v.tokens,
        calls: v.count,
      }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 8);
  }, [filtered]);

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-apex-text">
            AI <span className="apex-gradient-text">Intelligence Center</span>
          </h1>
          <p className="text-sm text-apex-textMuted mt-1">
            Multi-provider AI monitoring · Local vs Cloud · Efficiency scoring
          </p>
        </div>
        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
            className="rounded-lg border border-apex-border bg-apex-surface px-3 py-1.5 text-xs text-apex-text focus:outline-none focus:border-apex-accent/60"
          >
            <option value="all">All Tenants</option>
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value as AIProvider | 'all')}
            className="rounded-lg border border-apex-border bg-apex-surface px-3 py-1.5 text-xs text-apex-text focus:outline-none focus:border-apex-accent/60"
          >
            <option value="all">All Providers</option>
            {Object.entries(AI_PROVIDER_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v.label} ({v.type})</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          title="Local Inference"
          value={`${localPct.toFixed(1)}%`}
          subtitle={`${formatNumber(localInferences)} of ${formatNumber(filtered.length)} calls`}
          icon={Cpu}
          variant="success"
          loading={isLoading}
          trend={{ value: 8, label: 'vs last period' }}
        />
        <MetricCard
          title="Total Tokens"
          value={formatNumber(totalTokens)}
          subtitle={`Across all providers`}
          icon={Brain}
          variant="purple"
          loading={isLoading}
        />
        <MetricCard
          title="AI Cost"
          value={formatCurrency(totalCost)}
          subtitle="Cloud inference only"
          icon={DollarSign}
          variant="warning"
          loading={isLoading}
        />
        <MetricCard
          title="Avg Latency"
          value={`${avgLatency.toFixed(0)}ms`}
          subtitle={`${cacheHitPct.toFixed(1)}% cache hit rate`}
          icon={Clock}
          variant="accent"
          loading={isLoading}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard title="Success Rate" value={`${successRate.toFixed(1)}%`} icon={CheckCircle2} variant="success" loading={isLoading} />
        <MetricCard title="Cache Hits" value={formatNumber(cacheHits)} subtitle={`${cacheHitPct.toFixed(1)}%`} icon={Zap} variant="accent" loading={isLoading} />
        <MetricCard title="Fallbacks" value={formatNumber(fallbacks)} subtitle="Cloud fallback triggers" icon={AlertTriangle} variant={fallbacks > 10 ? 'danger' : 'warning'} loading={isLoading} />
        <MetricCard title="Total Calls" value={formatNumber(filtered.length)} icon={BarChart2} variant="default" loading={isLoading} />
      </div>

      {/* Token Trend + Inference Source */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-apex-border bg-apex-card p-5">
          <SectionHeader
            title="Token Usage — 14 Days"
            subtitle="Local vs Cloud inference volume"
            icon={TrendingUp}
          />
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={tokenTrend}>
              <defs>
                <linearGradient id="localGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cloudGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickFormatter={(v) => formatNumber(v)} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="local" stroke="#10b981" fill="url(#localGrad)" strokeWidth={2} dot={false} name="Local" />
              <Area type="monotone" dataKey="cloud" stroke="#0ea5e9" fill="url(#cloudGrad)" strokeWidth={2} dot={false} name="Cloud" />
              <Legend formatter={(v) => <span className="text-xs text-apex-textMuted capitalize">{v}</span>} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Source Pie */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <SectionHeader title="Inference Source" subtitle="Distribution" icon={Cloud} />
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={sourcePieData}
                cx="50%" cy="50%"
                innerRadius={60} outerRadius={85}
                paddingAngle={3}
                dataKey="value"
              >
                {sourcePieData.map((entry) => (
                  <Cell key={entry.name} fill={(sourceColors as Record<string, string>)[entry.name] || '#64748b'} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={(v) => <span className="text-xs text-apex-textMuted capitalize">{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Provider Performance Table + Task Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Provider Table */}
        <div className="lg:col-span-2 rounded-xl border border-apex-border bg-apex-card p-5">
          <SectionHeader title="Provider Performance" subtitle="All AI providers ranked by usage" icon={Brain} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-apex-border">
                  {['Provider', 'Type', 'Calls', 'Tokens', 'Cost', 'Avg Latency'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-apex-textMuted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {providerBreakdown.map((row) => (
                  <tr key={row.provider} className="border-b border-apex-border/30 hover:bg-apex-surface/30 transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: PROVIDER_COLORS[row.provider] || '#64748b' }}
                        />
                        <span className="font-medium text-apex-text text-xs">{row.label}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        row.local ? 'bg-apex-success/10 text-apex-success' : 'bg-apex-accent/10 text-apex-accent'
                      )}>
                        {row.local ? 'Local' : 'Cloud'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-apex-textDim">{formatNumber(row.calls)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-apex-textDim">{formatNumber(row.tokens)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-apex-warning">{row.local ? '—' : `$${row.cost}`}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-apex-textDim">{row.avgLatency}ms</td>
                  </tr>
                ))}
                {providerBreakdown.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-xs text-apex-textMuted">No AI metrics available</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Task Types */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <SectionHeader title="Task Types" subtitle="AI inference by purpose" icon={BarChart2} />
          <div className="space-y-2.5 mt-2">
            {taskBreakdown.slice(0, 7).map((item, i) => {
              const max = taskBreakdown[0]?.value || 1;
              return (
                <div key={item.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-apex-textDim capitalize">{item.name.replace(/_/g, ' ')}</span>
                    <span className="font-mono text-apex-textMuted">{item.value}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-apex-border overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(item.value / max) * 100}%`,
                        backgroundColor: ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'][i % 7],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Model Comparison */}
      <div className="rounded-xl border border-apex-border bg-apex-card p-5">
        <SectionHeader title="Model Performance Comparison" subtitle="Latency vs usage across all models" icon={RefreshCw} />
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={modelComparison}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
            <XAxis dataKey="model" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} />
            <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar yAxisId="left" dataKey="avgLatency" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Avg Latency (ms)" />
            <Bar yAxisId="right" dataKey="calls" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Calls" />
            <Legend formatter={(v) => <span className="text-xs text-apex-textMuted">{v}</span>} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
