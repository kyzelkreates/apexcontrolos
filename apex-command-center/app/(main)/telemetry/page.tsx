'use client';
import React, { useMemo, useState } from 'react';
import { useApexStore } from '@/store/apex-store';
import { MetricCard } from '@/components/shared/MetricCard';
import { SectionHeader } from '@/components/shared/SectionHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatNumber, timeAgo, cn } from '@/lib/utils';
import { Activity, CheckCircle2, AlertTriangle, Layers, Zap, Database } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { getEngineStats } from '@/lib/telemetry-engine';
import { NoDataBanner } from '@/components/shared/NoDataBanner';

const CustomTooltip = ({ active, payload, label }: Record<string, unknown>) => {
  if (!(active as boolean)) return null;
  return (
    <div className="rounded-lg border border-apex-border bg-apex-card px-3 py-2 text-xs shadow-apex-card">
      <p className="text-apex-textMuted mb-1">{label as string}</p>
      {(payload as Array<{ name: string; value: number; color: string }>)?.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-mono">{p.name}: {formatNumber(Number(p.value))}</p>
      ))}
    </div>
  );
};

export default function TelemetryPage() {
  const { telemetryEvents, liveFeed, tenants, isLoading } = useApexStore();
  const engineStats = getEngineStats();
  const hasData = telemetryEvents.length > 0;

  const processed = telemetryEvents.filter((e) => e.processed).length;
  const unprocessed = telemetryEvents.filter((e) => !e.processed).length;

  // By event type
  const byType = useMemo(() => {
    const agg: Record<string, number> = {};
    telemetryEvents.forEach((e) => { agg[e.eventType] = (agg[e.eventType] || 0) + 1; });
    return Object.entries(agg).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value })).sort((a, b) => b.value - a.value);
  }, [telemetryEvents]);

  // Daily events
  const dailyEvents = useMemo(() => {
    const byDay: Record<string, number> = {};
    const now = Date.now();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 86400000).toLocaleDateString('en-CA').slice(5);
      byDay[d] = 0;
    }
    telemetryEvents.forEach((e) => {
      const day = new Date(e.timestamp).toLocaleDateString('en-CA').slice(5);
      if (byDay[day] !== undefined) byDay[day]++;
    });
    return Object.entries(byDay).map(([date, events]) => ({ date, events }));
  }, [telemetryEvents]);

  // By tenant
  const byTenant = useMemo(() => {
    const agg: Record<string, number> = {};
    telemetryEvents.forEach((e) => { agg[e.tenantId] = (agg[e.tenantId] || 0) + 1; });
    return Object.entries(agg).map(([id, count]) => ({
      name: tenants.find((t) => t.id === id)?.name?.slice(0, 16) || id.slice(0, 12),
      count,
    })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [telemetryEvents, tenants]);

  return (
    <div className="space-y-6 animate-fade-in">
      <NoDataBanner hasData={hasData} dataLabel="telemetry events" />
      <div>
        <h1 className="text-2xl font-bold text-apex-text">Telemetry <span className="apex-gradient-text">Ingestion</span></h1>
        <p className="text-sm text-apex-textMuted mt-1">Batched ingestion · Queue monitoring · Delta-sync · Offline reconciliation</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Events" value={formatNumber(telemetryEvents.length)} icon={Database} variant="accent" loading={isLoading} />
        <MetricCard title="Processed" value={formatNumber(processed)} icon={CheckCircle2} variant="success" loading={isLoading} />
        <MetricCard title="Pending" value={formatNumber(unprocessed)} icon={AlertTriangle} variant={unprocessed > 100 ? 'warning' : 'default'} loading={isLoading} />
        <MetricCard title="Queue Depth" value={formatNumber(engineStats.queueDepth)} icon={Layers} variant={engineStats.queueDepth > 500 ? 'danger' : 'default'} loading={isLoading} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Processed (Engine)" value={formatNumber(engineStats.totalProcessed)} icon={CheckCircle2} variant="success" loading={isLoading} />
        <MetricCard title="Dropped" value={formatNumber(engineStats.totalDropped)} icon={AlertTriangle} variant={engineStats.totalDropped > 0 ? 'danger' : 'success'} loading={isLoading} />
        <MetricCard title="Batch Size" value={engineStats.config.batchSize} icon={Layers} variant="default" loading={isLoading} />
        <MetricCard title="Live Feed" value={liveFeed.length} subtitle="Recent in-session" icon={Zap} variant="purple" loading={isLoading} />
      </div>

      {/* Engine Status */}
      <div className="rounded-xl border border-apex-border bg-apex-card p-5">
        <SectionHeader title="Engine Status" subtitle="Telemetry ingestion engine health" icon={Activity} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
          {[
            { label: 'Status', value: 'Running', color: 'text-apex-success' },
            { label: 'Flush Interval', value: `${engineStats.config.flushIntervalMs / 1000}s`, color: 'text-apex-textDim' },
            { label: 'Max Queue', value: formatNumber(engineStats.config.maxQueueDepth), color: 'text-apex-textDim' },
            { label: 'Retention', value: `${engineStats.config.retentionDays}d`, color: 'text-apex-textDim' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg border border-apex-border bg-apex-surface px-3 py-2.5">
              <p className="text-[10px] text-apex-textMuted uppercase tracking-wider">{label}</p>
              <p className={cn('text-sm font-mono font-semibold mt-1', color)}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <SectionHeader title="Events — 7 Days" subtitle="Daily ingestion volume" icon={Activity} />
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={dailyEvents}>
              <defs>
                <linearGradient id="evGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="events" stroke="#0ea5e9" fill="url(#evGrad)" strokeWidth={2} dot={false} name="Events" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <SectionHeader title="By Tenant" subtitle="Event distribution" icon={Database} />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byTenant} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} width={90} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Events" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Event Types */}
      <div className="rounded-xl border border-apex-border bg-apex-card p-5">
        <SectionHeader title="Event Type Breakdown" subtitle="All ingested event categories" icon={Layers} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
          {byType.map((item, i) => (
            <div key={item.name} className="rounded-lg border border-apex-border/50 bg-apex-surface px-3 py-3">
              <p className="text-xs font-medium text-apex-textDim capitalize">{item.name}</p>
              <p className="font-mono text-lg font-bold text-apex-text mt-1">{formatNumber(item.value)}</p>
              <div className="h-1 rounded-full bg-apex-border mt-2 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(item.value / (byType[0]?.value || 1)) * 100}%`,
                    backgroundColor: ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'][i % 8],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Feed */}
      <div className="rounded-xl border border-apex-border bg-apex-card p-5">
        <SectionHeader title="Live Telemetry Feed" subtitle="Most recent in-session events" icon={Zap} />
        <div className="space-y-1.5 max-h-64 overflow-y-auto mt-2 font-mono text-xs">
          {liveFeed.length === 0 && (
            <p className="text-center text-apex-textMuted py-8">No live events in this session</p>
          )}
          {liveFeed.map((e) => (
            <div key={e.id} className="flex items-center gap-3 rounded bg-apex-surface px-3 py-1.5">
              <span className="text-apex-textMuted w-28 flex-shrink-0">{timeAgo(e.timestamp)}</span>
              <span className="text-apex-accent w-32 flex-shrink-0">{e.eventType}</span>
              <span className="text-apex-textDim truncate">{e.fleetId}</span>
              <StatusBadge status={e.processed ? 'active' : 'pending'} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
