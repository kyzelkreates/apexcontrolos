'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useAP3XStore } from '@/store/ap3x-store';
import { fetchLatestHealth, fetchHealthHistory } from '@/services/governanceService';
import { MetricCard } from '@/components/shared/MetricCard';
import { NoDataBanner } from '@/components/shared/NoDataBanner';
import type { SystemHealthMetric, HealthComponent, HealthStatus } from '@/types/governance';
import {
  Activity, RefreshCw, Zap, Database, Wifi,
  MapPin, Server, Network, AlertTriangle,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

const COMPONENT_ICONS: Record<HealthComponent, React.ReactNode> = {
  realtime_sync:      <Wifi size={14} />,
  dispatch_pipeline:  <Zap size={14} />,
  event_ingestion:    <Activity size={14} />,
  location_feed:      <MapPin size={14} />,
  assignment_engine:  <Server size={14} />,
  api_gateway:        <Network size={14} />,
};

const STATUS_STYLES: Record<HealthStatus, string> = {
  healthy:  'text-apex-success bg-apex-success/10 border-apex-success/30',
  degraded: 'text-apex-warning bg-apex-warning/10 border-apex-warning/30',
  critical: 'text-apex-danger  bg-apex-danger/10  border-apex-danger/30',
  down:     'text-apex-danger  bg-apex-danger/20  border-apex-danger/60',
};

const STATUS_DOT: Record<HealthStatus, string> = {
  healthy:  'bg-apex-success animate-pulse',
  degraded: 'bg-apex-warning animate-pulse',
  critical: 'bg-apex-danger  animate-pulse',
  down:     'bg-apex-danger',
};

const TOOLTIP_STYLE = {
  contentStyle: { background: '#0f1521', border: '1px solid #1a2235', borderRadius: 8, fontSize: 11, color: '#e2e8f0' },
};

export default function SystemHealthPage() {
  const { isConfigured, dashboardEvents } = useAP3XStore();
  const [components, setComponents]   = useState<SystemHealthMetric[]>([]);
  const [history, setHistory]         = useState<SystemHealthMetric[]>([]);
  const [selectedComp, setSelectedComp] = useState<HealthComponent | null>(null);
  const [loading, setLoading]         = useState(true);
  const [histLoading, setHistLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = () => {
    if (!isConfigured) { setLoading(false); return; }
    fetchLatestHealth().then((d) => { setComponents(d ?? []); setLoading(false); });
  };

  useEffect(() => {
    load();
    if (!autoRefresh) return;
    const t = setInterval(load, 30000); // refresh every 30s
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfigured, autoRefresh]);

  useEffect(() => {
    if (!selectedComp || !isConfigured) return;
    setHistLoading(true);
    fetchHealthHistory(selectedComp).then((d) => { setHistory(d ?? []); setHistLoading(false); });
  }, [selectedComp, isConfigured]);

  // ── Overall system status ──
  const overallStatus: HealthStatus = useMemo(() => {
    if (components.some((c) => c.status === 'down'))     return 'down';
    if (components.some((c) => c.status === 'critical')) return 'critical';
    if (components.some((c) => c.status === 'degraded')) return 'degraded';
    return 'healthy';
  }, [components]);

  // ── History chart for selected component ──
  const historyChart = useMemo(() =>
    history.map((h) => ({
      time:     new Date(h.recorded_at).toLocaleTimeString(),
      p50:      h.latency_p50_ms,
      p95:      h.latency_p95_ms,
      errors:   h.error_rate_pct !== null ? +(h.error_rate_pct * 100).toFixed(2) : null,
      epm:      h.events_per_minute,
    }))
  , [history]);

  // ── Live event pipeline health (from dashboard_events) ──
  const recentEventLag = useMemo(() => {
    if (!dashboardEvents.length) return null;
    const latest = dashboardEvents[0];
    const lagMs  = Date.now() - new Date(latest.created_at).getTime();
    return lagMs;
  }, [dashboardEvents]);

  const downCount     = components.filter((c) => c.status === 'down').length;
  const criticalCount = components.filter((c) => c.status === 'critical').length;
  const healthyCount  = components.filter((c) => c.status === 'healthy').length;
  const avgErrorRate  = components.reduce((s, c) => s + (c.error_rate_pct ?? 0), 0) / (components.length || 1);
  const avgLatP95     = components.reduce((s, c) => s + (c.latency_p95_ms ?? 0), 0) / (components.length || 1);

  if (!isConfigured) return <NoDataBanner reason="not_configured" />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-apex-text">
            System <span className="apex-gradient-text">Health Monitor</span>
          </h1>
          <p className="text-sm text-apex-textMuted mt-1">
            Event pipeline latency · failure rates · dispatch performance · realtime sync
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-apex-border bg-apex-card px-3 py-1.5 text-xs text-apex-textMuted hover:text-apex-text transition-colors">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn('flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors', {
              'bg-apex-success/10 border-apex-success/30 text-apex-success': autoRefresh,
              'bg-apex-card border-apex-border text-apex-textMuted': !autoRefresh,
            })}>
            <span className={cn('h-1.5 w-1.5 rounded-full', autoRefresh ? 'bg-apex-success animate-pulse' : 'bg-apex-textMuted')} />
            {autoRefresh ? 'Auto-refresh on' : 'Auto-refresh off'}
          </button>
        </div>
      </div>

      {/* Overall status banner */}
      <div className={cn('flex items-center gap-3 rounded-xl border px-5 py-3', STATUS_STYLES[overallStatus])}>
        <span className={cn('h-3 w-3 rounded-full flex-shrink-0', STATUS_DOT[overallStatus])} />
        <div className="flex-1">
          <p className="text-sm font-semibold capitalize">System Status: {overallStatus}</p>
          <p className="text-xs opacity-70">
            {healthyCount}/{components.length} components healthy ·
            {' '}avg P95 latency: {avgLatP95.toFixed(0)}ms ·
            {' '}avg error rate: {(avgErrorRate * 100).toFixed(2)}%
          </p>
        </div>
        {recentEventLag !== null && (
          <span className="text-[10px] font-mono opacity-70">
            Last event: {recentEventLag < 1000 ? `${recentEventLag}ms` : `${(recentEventLag/1000).toFixed(0)}s`} ago
          </span>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Healthy"   value={healthyCount}   subtitle={`${components.length} total`} icon={Activity}      variant="success" loading={loading} />
        <MetricCard title="Degraded"  value={components.filter(c=>c.status==='degraded').length} subtitle="Needs attention" icon={AlertTriangle} variant="warning" loading={loading} />
        <MetricCard title="Down"      value={downCount + criticalCount} subtitle="Immediate action" icon={AlertTriangle} variant={downCount+criticalCount > 0 ? 'danger' : 'default'} loading={loading} />
        <MetricCard title="Avg P95"   value={`${avgLatP95.toFixed(0)}ms`} subtitle="Latency" icon={Zap} variant="accent" loading={loading} />
      </div>

      {/* Component grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-apex-textMuted">
          <RefreshCw size={16} className="animate-spin mr-2" /> Loading health metrics…
        </div>
      ) : components.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-apex-textMuted">
          <Database size={36} className="opacity-20" />
          <p className="text-sm">No health metrics yet. They appear once monitoring agents write to system_health_metrics.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {components.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedComp(selectedComp === c.component ? null : c.component)}
              className={cn('text-left rounded-xl border bg-apex-card p-4 hover:border-apex-accent/30 transition-all', {
                'border-apex-success/30': c.status === 'healthy',
                'border-apex-warning/30': c.status === 'degraded',
                'border-apex-danger/30':  ['critical','down'].includes(c.status),
                'ring-2 ring-apex-accent/50': selectedComp === c.component,
              })}>
              <div className="flex items-center gap-2 mb-3">
                <span className={cn('p-1.5 rounded-lg', STATUS_STYLES[c.status as HealthStatus])}>
                  {COMPONENT_ICONS[c.component as HealthComponent] ?? <Server size={14} />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-apex-text capitalize">
                    {c.component.replace(/_/g,' ')}
                  </p>
                  <p className={cn('text-[10px] capitalize font-medium', STATUS_STYLES[c.status as HealthStatus])}>
                    {c.status}
                  </p>
                </div>
                <span className={cn('h-2 w-2 rounded-full flex-shrink-0', STATUS_DOT[c.status as HealthStatus])} />
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <p className="text-apex-textMuted">P50 latency</p>
                  <p className="font-mono text-apex-text">{c.latency_p50_ms !== null ? `${c.latency_p50_ms.toFixed(0)}ms` : '—'}</p>
                </div>
                <div>
                  <p className="text-apex-textMuted">P95 latency</p>
                  <p className="font-mono text-apex-text">{c.latency_p95_ms !== null ? `${c.latency_p95_ms.toFixed(0)}ms` : '—'}</p>
                </div>
                <div>
                  <p className="text-apex-textMuted">Error rate</p>
                  <p className={cn('font-mono', (c.error_rate_pct ?? 0) > 0.05 ? 'text-apex-danger' : 'text-apex-text')}>
                    {c.error_rate_pct !== null ? `${(c.error_rate_pct * 100).toFixed(2)}%` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-apex-textMuted">Events/min</p>
                  <p className="font-mono text-apex-text">{c.events_per_minute?.toFixed(0) ?? '—'}</p>
                </div>
              </div>

              {c.queue_depth !== null && (
                <div className="mt-2 flex items-center justify-between text-[10px]">
                  <span className="text-apex-textMuted">Queue depth</span>
                  <span className={cn('font-mono', c.queue_depth > 100 ? 'text-apex-warning' : 'text-apex-text')}>
                    {c.queue_depth}
                  </span>
                </div>
              )}

              {c.detail && (
                <p className="mt-2 text-[10px] text-apex-textMuted italic truncate">{c.detail}</p>
              )}

              <p className="mt-2 text-[10px] font-mono text-apex-textMuted">
                {new Date(c.recorded_at).toLocaleTimeString()}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* History chart for selected component */}
      {selectedComp && (
        <div className="rounded-xl border border-apex-accent/30 bg-apex-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={14} className="text-apex-accent" />
            <p className="text-sm font-semibold text-apex-text capitalize">
              {selectedComp.replace(/_/g,' ')} — 1-hour history
            </p>
            {histLoading && <RefreshCw size={12} className="animate-spin text-apex-textMuted ml-2" />}
          </div>
          {historyChart.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-apex-textMuted text-xs italic">
              No history data for this component in the last hour.
            </div>
          ) : (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={historyChart} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                  <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} unit="ms" />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
                  <Line type="monotone" dataKey="p50" name="P50 ms" stroke="#10b981" strokeWidth={1.5} dot={false} connectNulls />
                  <Line type="monotone" dataKey="p95" name="P95 ms" stroke="#f59e0b" strokeWidth={1.5} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
              <ResponsiveContainer width="100%" height={100}>
                <AreaChart data={historyChart} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 9 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} unit="%" />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => `${v}%`} />
                  <Area type="monotone" dataKey="errors" name="Error %" stroke="#ef4444" fill="url(#errGrad)" strokeWidth={1.5} dot={false} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
