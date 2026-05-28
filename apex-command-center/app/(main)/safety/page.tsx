'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useAP3XStore } from '@/store/ap3x-store';
import { fetchSafetySnapshots } from '@/services/governanceService';
import { MetricCard } from '@/components/shared/MetricCard';
import { NoDataBanner } from '@/components/shared/NoDataBanner';
import type { SafetyMetricsSnapshot, RiskLevel, SnapshotPeriod } from '@/types/governance';
import {
  Shield, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, RefreshCw, Users, Zap, Clock,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, LineChart, Line, ReferenceLine,
} from 'recharts';
import { cn } from '@/lib/utils';

const RISK_COLORS: Record<RiskLevel, string> = {
  low:      'text-apex-success  bg-apex-success/10  border-apex-success/30',
  medium:   'text-apex-warning  bg-apex-warning/10  border-apex-warning/30',
  high:     'text-apex-danger   bg-apex-danger/10   border-apex-danger/30',
  critical: 'text-apex-danger   bg-apex-danger/20   border-apex-danger/60',
};

const TOOLTIP_STYLE = {
  contentStyle: { background: '#0f1521', border: '1px solid #1a2235', borderRadius: 8, fontSize: 11, color: '#e2e8f0' },
};

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-40 text-apex-textMuted text-xs italic text-center px-4">
      {message}
    </div>
  );
}

export default function SafetyPage() {
  const { isConfigured, tasks, drivers, vehicles } = useAP3XStore();
  const [snapshots, setSnapshots] = useState<SafetyMetricsSnapshot[]>([]);
  const [loading, setLoading]     = useState(true);
  const [period, setPeriod]       = useState<SnapshotPeriod>('daily');

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return; }
    setLoading(true);
    fetchSafetySnapshots({ period, limit: 60 }).then((d) => {
      setSnapshots(d ?? []);
      setLoading(false);
    });
  }, [isConfigured, period]);

  // ── Compute live KPIs from existing Supabase tables (always up-to-date) ──
  const liveKPIs = useMemo(() => {
    const total      = tasks.length;
    const completed  = tasks.filter((t) => t.status === 'completed').length;
    const cancelled  = tasks.filter((t) => t.status === 'cancelled').length;
    const pending    = tasks.filter((t) => t.status === 'pending').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const critical   = tasks.filter((t) => t.priority === 'critical').length;
    const completionRate = total ? ((completed / total) * 100).toFixed(1) : '—';
    const activeDrivers  = drivers.filter((d) => d.status !== 'offline').length;
    const utilPct        = drivers.length ? ((drivers.filter((d) => d.status === 'on_task').length / drivers.length) * 100).toFixed(1) : '—';
    const maintenanceVehicles = vehicles.filter((v) => v.status === 'maintenance').length;

    // Risk level derived from live data
    let riskLevel: RiskLevel = 'low';
    if (critical > 0)                     riskLevel = 'critical';
    else if (cancelled / (total || 1) > 0.2) riskLevel = 'high';
    else if (pending > 20)                riskLevel = 'medium';

    return { total, completed, cancelled, pending, inProgress, critical, completionRate, activeDrivers, utilPct, maintenanceVehicles, riskLevel };
  }, [tasks, drivers, vehicles]);

  // ── Chart data from snapshots ──
  const complianceChart = useMemo(() =>
    [...snapshots].reverse().slice(-30).map((s) => ({
      date:       new Date(s.period_start).toLocaleDateString('en-CA').slice(5),
      compliance: s.compliance_rate !== null ? +(s.compliance_rate * 100).toFixed(1) : null,
      completion: s.task_completion_rate !== null ? +(s.task_completion_rate * 100).toFixed(1) : null,
    }))
  , [snapshots]);

  const incidentChart = useMemo(() =>
    [...snapshots].reverse().slice(-30).map((s) => ({
      date:      new Date(s.period_start).toLocaleDateString('en-CA').slice(5),
      incidents: s.incidents_total,
      critical:  s.incidents_critical,
      escalations: s.escalations_total,
      overrides: s.overrides_total,
    }))
  , [snapshots]);

  const assignmentChart = useMemo(() =>
    [...snapshots].reverse().slice(-14).map((s) => ({
      date:   new Date(s.period_start).toLocaleDateString('en-CA').slice(5),
      auto:   s.assignments_auto,
      manual: s.assignments_manual,
      avg_ms: s.avg_assignment_time_ms !== null ? +(s.avg_assignment_time_ms / 1000).toFixed(1) : null,
    }))
  , [snapshots]);

  if (!isConfigured) return <NoDataBanner reason="not_configured" />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-apex-text">
          Safety <span className="apex-gradient-text">Metrics Engine</span>
        </h1>
        <p className="text-sm text-apex-textMuted mt-1">
          System-wide safety performance · compliance rates · risk trends
        </p>
      </div>

      {/* Live risk banner */}
      <div className={cn('flex items-center gap-3 rounded-xl border px-5 py-3', RISK_COLORS[liveKPIs.riskLevel])}>
        <Shield size={18} className="flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold capitalize">System Risk Level: {liveKPIs.riskLevel}</p>
          <p className="text-xs opacity-70">
            {liveKPIs.critical > 0 ? `${liveKPIs.critical} critical priority tasks pending · ` : ''}
            {liveKPIs.completionRate}% task completion rate · {liveKPIs.maintenanceVehicles} vehicles in maintenance
          </p>
        </div>
        <span className={cn('h-3 w-3 rounded-full animate-pulse flex-shrink-0', {
          'bg-apex-success': liveKPIs.riskLevel === 'low',
          'bg-apex-warning': liveKPIs.riskLevel === 'medium',
          'bg-apex-danger':  ['high','critical'].includes(liveKPIs.riskLevel),
        })} />
      </div>

      {/* Live KPIs */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-apex-textMuted mb-3">Live System State</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard title="Task Completion" value={`${liveKPIs.completionRate}%`}  subtitle={`${liveKPIs.completed}/${liveKPIs.total} tasks`} icon={CheckCircle2} variant="success" loading={loading} />
          <MetricCard title="Driver Utilisation" value={`${liveKPIs.utilPct}%`}     subtitle={`${liveKPIs.activeDrivers} active`}               icon={Users}        variant="purple"  loading={loading} />
          <MetricCard title="Critical Tasks"  value={String(liveKPIs.critical)}      subtitle="Require immediate action"                          icon={AlertTriangle} variant={liveKPIs.critical > 0 ? 'danger' : 'default'} loading={loading} />
          <MetricCard title="In Progress"     value={String(liveKPIs.inProgress)}    subtitle={`${liveKPIs.pending} pending`}                     icon={Zap}          variant="accent"  loading={loading} />
        </div>
      </div>

      {/* Snapshot period selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-apex-textMuted">Snapshot period:</span>
        {(['hourly','daily','weekly','monthly'] as SnapshotPeriod[]).map((p) => (
          <button key={p} onClick={() => setPeriod(p)}
            className={cn('rounded-full px-3 py-1 text-xs font-medium transition-colors capitalize',
              period === p ? 'bg-apex-accent text-white' : 'bg-apex-card border border-apex-border text-apex-textMuted hover:text-apex-text'
            )}>
            {p}
          </button>
        ))}
        {loading && <RefreshCw size={12} className="animate-spin text-apex-textMuted ml-2" />}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Compliance + completion rate */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <p className="text-sm font-semibold text-apex-text mb-1">Compliance & Completion Rate</p>
          <p className="text-[10px] text-apex-textMuted mb-4">% over time from safety_metrics_snapshot</p>
          {snapshots.length === 0
            ? <EmptyChart message="Snapshots appear here once the safety metrics engine runs." />
            : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={complianceChart} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} unit="%" />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => `${v}%`} />
                  <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
                  <ReferenceLine y={95} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'SLA 95%', fill: '#10b981', fontSize: 9 }} />
                  <Line type="monotone" dataKey="compliance" name="Compliance %"  stroke="#10b981" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="completion" name="Completion %"  stroke="#0ea5e9" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Incidents + escalations */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <p className="text-sm font-semibold text-apex-text mb-1">Incidents & Escalations</p>
          <p className="text-[10px] text-apex-textMuted mb-4">Event count per period</p>
          {snapshots.length === 0
            ? <EmptyChart message="Incident data appears once safety snapshots are computed." />
            : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={incidentChart} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
                  <Bar dataKey="incidents"   name="Incidents"    fill="#ef4444" stackId="a" maxBarSize={32} />
                  <Bar dataKey="critical"    name="Critical"     fill="#dc2626" stackId="a" maxBarSize={32} />
                  <Bar dataKey="escalations" name="Escalations"  fill="#f59e0b" radius={[3,3,0,0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Assignment performance */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <p className="text-sm font-semibold text-apex-text mb-1">Assignment Performance</p>
          <p className="text-[10px] text-apex-textMuted mb-4">Auto vs manual assignments per period</p>
          {snapshots.length === 0
            ? <EmptyChart message="Assignment performance data appears once snapshots are computed." />
            : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={assignmentChart} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
                  <Bar dataKey="auto"   name="Auto-assigned"   fill="#0ea5e9" radius={[3,3,0,0]} maxBarSize={24} />
                  <Bar dataKey="manual" name="Manual override"  fill="#8b5cf6" radius={[3,3,0,0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Overrides trend */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <p className="text-sm font-semibold text-apex-text mb-1">Override & SLA Breach Trend</p>
          <p className="text-[10px] text-apex-textMuted mb-4">System governance health over time</p>
          {snapshots.length === 0
            ? <EmptyChart message="Override data appears once safety snapshots are computed." />
            : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={incidentChart} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="overrideGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
                  <Area type="monotone" dataKey="overrides" name="Overrides" stroke="#8b5cf6" fill="url(#overrideGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )
          }
        </div>
      </div>

      {/* Snapshot table */}
      {snapshots.length > 0 && (
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <p className="text-sm font-semibold text-apex-text mb-4">Recent Snapshots</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-apex-border text-apex-textMuted">
                  {['Period','Start','Risk','Completion','Compliance','Incidents','Overrides','Drivers Active'].map((h) => (
                    <th key={h} className="pb-2.5 text-left font-medium pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-apex-border/50">
                {snapshots.slice(0,10).map((s) => (
                  <tr key={s.id} className="hover:bg-apex-surface/50 transition-colors">
                    <td className="py-2.5 pr-4 font-mono text-apex-textDim capitalize">{s.snapshot_period}</td>
                    <td className="py-2.5 pr-4 font-mono">{new Date(s.period_start).toLocaleDateString()}</td>
                    <td className="py-2.5 pr-4">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold capitalize',
                        RISK_COLORS[s.risk_level])}>
                        {s.risk_level}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-apex-success">
                      {s.task_completion_rate !== null ? `${(s.task_completion_rate*100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-apex-accent">
                      {s.compliance_rate !== null ? `${(s.compliance_rate*100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="py-2.5 pr-4 font-mono">{s.incidents_total}</td>
                    <td className="py-2.5 pr-4 font-mono">{s.overrides_total}</td>
                    <td className="py-2.5 pr-4 font-mono">{s.drivers_active}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
