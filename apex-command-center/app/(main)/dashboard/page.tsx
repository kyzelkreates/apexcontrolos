'use client';
import React, { useMemo } from 'react';
import { useAP3XStore } from '@/store/ap3x-store';
import { MetricCard } from '@/components/shared/MetricCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatNumber } from '@/lib/utils';
import {
  ClipboardList, Users, Truck, Activity,
  CheckCircle2, Clock, AlertTriangle, Network, Zap,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

// ─── Empty state placeholder ─────────────────────────────────────
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-36 text-apex-textMuted text-xs text-center px-4 italic">
      {message}
    </div>
  );
}

// ─── Shared tooltip style ────────────────────────────────────────
const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#0f1521',
    border: '1px solid #1a2235',
    borderRadius: 8,
    fontSize: 11,
    color: '#e2e8f0',
  },
};

// ─── Dashboard Page ───────────────────────────────────────────────
export default function DashboardPage() {
  const {
    tasks, drivers, vehicles, assignments,
    fleetNodes, dashboardEvents,
    isLoading, isConfigured,
  } = useAP3XStore();

  // ── Task status counts ──
  const taskStats = useMemo(() => {
    const c = { pending: 0, assigned: 0, accepted: 0, in_progress: 0, completed: 0, cancelled: 0 };
    tasks.forEach((t) => { const k = t.status as keyof typeof c; if (k in c) c[k]++; });
    return c;
  }, [tasks]);

  // ── Driver status counts ──
  const driverStats = useMemo(() => {
    const c = { available: 0, on_task: 0, offline: 0, break: 0 };
    drivers.forEach((d) => { const k = d.status as keyof typeof c; if (k in c) c[k]++; });
    return c;
  }, [drivers]);

  // ── Vehicle status counts ──
  const vehicleStats = useMemo(() => {
    const c = { active: 0, idle: 0, maintenance: 0, offline: 0 };
    vehicles.forEach((v) => { const k = v.status as keyof typeof c; if (k in c) c[k]++; });
    return c;
  }, [vehicles]);

  // ── Fleet node status counts ──
  const nodeStats = useMemo(() => {
    const c = { online: 0, degraded: 0, offline: 0, maintenance: 0 };
    fleetNodes.forEach((n) => { const k = n.status as keyof typeof c; if (k in c) c[k]++; });
    return c;
  }, [fleetNodes]);

  // ── CHART DATA ────────────────────────────────────────

  // 1. Task status pie
  const taskPieData = useMemo(() => [
    { name: 'Pending',     value: taskStats.pending,     color: '#f59e0b' },
    { name: 'Assigned',    value: taskStats.assigned,    color: '#0ea5e9' },
    { name: 'Accepted',    value: taskStats.accepted,    color: '#06b6d4' },
    { name: 'In Progress', value: taskStats.in_progress, color: '#8b5cf6' },
    { name: 'Completed',   value: taskStats.completed,   color: '#10b981' },
    { name: 'Cancelled',   value: taskStats.cancelled,   color: '#ef4444' },
  ].filter((d) => d.value > 0), [taskStats]);

  // 2. Driver status pie
  const driverPieData = useMemo(() => [
    { name: 'Available', value: driverStats.available, color: '#10b981' },
    { name: 'On Task',   value: driverStats.on_task,   color: '#8b5cf6' },
    { name: 'Break',     value: driverStats.break,     color: '#f59e0b' },
    { name: 'Offline',   value: driverStats.offline,   color: '#64748b' },
  ].filter((d) => d.value > 0), [driverStats]);

  // 3. Tasks created per day — last 7 days
  const taskTrend = useMemo(() => {
    const now = Date.now();
    const byDay: Record<string, { date: string; created: number; completed: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now - i * 86400000).toLocaleDateString('en-CA').slice(5);
      byDay[day] = { date: day, created: 0, completed: 0 };
    }
    tasks.forEach((t) => {
      const day = new Date(t.created_at).toLocaleDateString('en-CA').slice(5);
      if (byDay[day]) byDay[day].created++;
      if (t.status === 'completed') {
        const upDay = new Date(t.updated_at).toLocaleDateString('en-CA').slice(5);
        if (byDay[upDay]) byDay[upDay].completed++;
      }
    });
    return Object.values(byDay);
  }, [tasks]);

  // 4. Fleet overview bar chart
  const fleetBarData = useMemo(() => [
    { label: 'Active',       vehicles: vehicleStats.active,      drivers: driverStats.on_task   },
    { label: 'Idle',         vehicles: vehicleStats.idle,        drivers: driverStats.break     },
    { label: 'Available',    vehicles: vehicleStats.active,      drivers: driverStats.available },
    { label: 'Maintenance',  vehicles: vehicleStats.maintenance, drivers: 0                     },
    { label: 'Offline',      vehicles: vehicleStats.offline,     drivers: driverStats.offline   },
  ], [vehicleStats, driverStats]);

  // 5. Event severity bar chart — last 7 days
  const eventTrend = useMemo(() => {
    const now = Date.now();
    const byDay: Record<string, { date: string; info: number; warning: number; critical: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now - i * 86400000).toLocaleDateString('en-CA').slice(5);
      byDay[day] = { date: day, info: 0, warning: 0, critical: 0 };
    }
    dashboardEvents.forEach((e) => {
      const day = new Date(e.created_at).toLocaleDateString('en-CA').slice(5);
      if (byDay[day]) {
        const k = e.severity as keyof (typeof byDay)[string];
        if (k in byDay[day]) (byDay[day][k] as number)++;
      }
    });
    return Object.values(byDay);
  }, [dashboardEvents]);

  // 6. Priority distribution bar
  const priorityData = useMemo(() => [
    { name: 'Critical', count: tasks.filter((t) => t.priority === 'critical').length, color: '#ef4444' },
    { name: 'High',     count: tasks.filter((t) => t.priority === 'high').length,     color: '#f59e0b' },
    { name: 'Medium',   count: tasks.filter((t) => t.priority === 'medium').length,   color: '#0ea5e9' },
    { name: 'Low',      count: tasks.filter((t) => t.priority === 'low').length,      color: '#64748b' },
  ], [tasks]);

  const hasData = tasks.length > 0 || drivers.length > 0;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-apex-text">
          System <span className="apex-gradient-text">Overview</span>
        </h1>
        <p className="text-sm text-apex-textMuted mt-1">
          Live analytics · Supabase realtime active
        </p>
      </div>

      {/* Not configured */}
      {!isConfigured && (
        <div className="rounded-xl border border-apex-warning/30 bg-apex-warning/5 px-5 py-4 text-sm">
          <p className="font-semibold text-apex-warning mb-1">Supabase not connected</p>
          <p className="text-apex-textDim text-xs">
            Add <code className="font-mono bg-apex-surface px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code className="font-mono bg-apex-surface px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your Vercel environment.
          </p>
        </div>
      )}

      {isConfigured && !isLoading && !hasData && (
        <div className="rounded-xl border border-apex-border bg-apex-card/50 px-5 py-4 text-sm text-apex-textDim">
          <p className="font-semibold text-apex-text mb-1">No data yet</p>
          <p>Create your first task using the Tasks page. Driver and vehicle data will appear once Fleet Control OS and Driver PWA are connected to the same Supabase project.</p>
        </div>
      )}

      {/* ── KPI Row 1: Tasks ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-apex-textMuted mb-3">Tasks</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <MetricCard title="Pending"     value={formatNumber(taskStats.pending)}     subtitle="Awaiting assignment"           icon={Clock}        variant="warning" loading={isLoading} />
          <MetricCard title="In Progress" value={formatNumber(taskStats.in_progress)} subtitle="Active right now"               icon={Zap}          variant="purple"  loading={isLoading} />
          <MetricCard title="Completed"   value={formatNumber(taskStats.completed)}   subtitle="All time"                      icon={CheckCircle2} variant="success" loading={isLoading} />
          <MetricCard title="Total Tasks" value={formatNumber(tasks.length)}          subtitle={`${assignments.length} assigned`} icon={ClipboardList} variant="accent" loading={isLoading} />
        </div>
      </div>

      {/* ── KPI Row 2: Fleet ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-apex-textMuted mb-3">Fleet</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <MetricCard title="Drivers On Task"   value={formatNumber(driverStats.on_task)}     subtitle={`${driverStats.available} available`}        icon={Users}        variant="success" loading={isLoading} />
          <MetricCard title="Offline Drivers"   value={formatNumber(driverStats.offline)}     subtitle={`${drivers.length} total`}                   icon={Users}        variant="default" loading={isLoading} />
          <MetricCard title="Active Vehicles"   value={formatNumber(vehicleStats.active)}     subtitle={`${vehicleStats.idle} idle`}                 icon={Truck}        variant="accent"  loading={isLoading} />
          <MetricCard title="Fleet Nodes"       value={formatNumber(nodeStats.online)}        subtitle={`${fleetNodes.length} total · ${nodeStats.degraded} degraded`} icon={Network} variant="purple" loading={isLoading} />
        </div>
      </div>

      {/* ── Charts Row 1: Area + Pie ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Area: Tasks created + completed — last 7 days */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <p className="text-sm font-semibold text-apex-text mb-1">Task Trend — Last 7 Days</p>
          <p className="text-[10px] text-apex-textMuted mb-4">Created vs completed per day</p>
          {tasks.length === 0
            ? <EmptyState message="Tasks will appear here once created in Supabase." />
            : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={taskTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="createdGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#0ea5e9" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
                  <Area type="monotone" dataKey="created"   name="Created"   stroke="#0ea5e9" fill="url(#createdGrad)"   strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="completed" name="Completed" stroke="#10b981" fill="url(#completedGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Pie: Task status breakdown */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <p className="text-sm font-semibold text-apex-text mb-1">Task Status Breakdown</p>
          <p className="text-[10px] text-apex-textMuted mb-4">Distribution across all statuses</p>
          {taskPieData.length === 0
            ? <EmptyState message="No task data yet." />
            : (
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <PieChart width={160} height={160}>
                    <Pie data={taskPieData} cx={75} cy={75} innerRadius={44} outerRadius={70} dataKey="value" strokeWidth={0}>
                      {taskPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} />
                  </PieChart>
                </div>
                <div className="space-y-2 flex-1 min-w-0">
                  {taskPieData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-xs gap-2">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                        <span className="text-apex-textMuted truncate">{d.name}</span>
                      </span>
                      <span className="font-mono text-apex-text flex-shrink-0">{d.value}</span>
                    </div>
                  ))}
                  <p className="text-[10px] text-apex-textMuted pt-1 border-t border-apex-border">Total: {tasks.length}</p>
                </div>
              </div>
            )
          }
        </div>
      </div>

      {/* ── Charts Row 2: Fleet Bar + Driver Pie ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Bar: Fleet status (vehicles + drivers) */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <p className="text-sm font-semibold text-apex-text mb-1">Fleet Status Overview</p>
          <p className="text-[10px] text-apex-textMuted mb-4">Vehicles and drivers by status category</p>
          {drivers.length === 0 && vehicles.length === 0
            ? <EmptyState message="Fleet data will appear once Fleet Control OS connects to Supabase." />
            : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={fleetBarData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                  <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
                  <Bar dataKey="vehicles" name="Vehicles" fill="#0ea5e9" radius={[3, 3, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="drivers"  name="Drivers"  fill="#8b5cf6" radius={[3, 3, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Pie: Driver status */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <p className="text-sm font-semibold text-apex-text mb-1">Driver Status Distribution</p>
          <p className="text-[10px] text-apex-textMuted mb-4">Current driver availability breakdown</p>
          {driverPieData.length === 0
            ? <EmptyState message="No driver data yet." />
            : (
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <PieChart width={160} height={160}>
                    <Pie data={driverPieData} cx={75} cy={75} innerRadius={44} outerRadius={70} dataKey="value" strokeWidth={0}>
                      {driverPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} />
                  </PieChart>
                </div>
                <div className="space-y-2 flex-1 min-w-0">
                  {driverPieData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-xs gap-2">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                        <span className="text-apex-textMuted truncate">{d.name}</span>
                      </span>
                      <span className="font-mono text-apex-text flex-shrink-0">{d.value}</span>
                    </div>
                  ))}
                  <p className="text-[10px] text-apex-textMuted pt-1 border-t border-apex-border">Total: {drivers.length}</p>
                </div>
              </div>
            )
          }
        </div>
      </div>

      {/* ── Charts Row 3: Event severity + Priority bar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Bar: Dashboard events by severity — last 7 days */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <p className="text-sm font-semibold text-apex-text mb-1">System Events — Last 7 Days</p>
          <p className="text-[10px] text-apex-textMuted mb-4">Event severity distribution from <code className="font-mono">dashboard_events</code></p>
          {dashboardEvents.length === 0
            ? <EmptyState message="System events will appear here once Fleet Control OS or Driver PWA emit them." />
            : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={eventTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
                  <Bar dataKey="info"     name="Info"     fill="#0ea5e9" stackId="a" maxBarSize={32} />
                  <Bar dataKey="warning"  name="Warning"  fill="#f59e0b" stackId="a" maxBarSize={32} />
                  <Bar dataKey="critical" name="Critical" fill="#ef4444" stackId="a" radius={[3, 3, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Bar: Task priority distribution */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <p className="text-sm font-semibold text-apex-text mb-1">Task Priority Distribution</p>
          <p className="text-[10px] text-apex-textMuted mb-4">Count of tasks per priority level</p>
          {tasks.length === 0
            ? <EmptyState message="No task data yet." />
            : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={priorityData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="count" name="Tasks" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {priorityData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>
      </div>

      {/* ── Recent Tasks Table ── */}
      <div className="rounded-xl border border-apex-border bg-apex-card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-apex-text">Recent Tasks</p>
          <span className="text-[10px] text-apex-textMuted font-mono">{tasks.length} total</span>
        </div>
        {tasks.length === 0
          ? <EmptyState message="No tasks yet. Create one from the Tasks page." />
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-apex-border text-apex-textMuted">
                    <th className="pb-2.5 text-left font-medium">Title</th>
                    <th className="pb-2.5 text-left font-medium">Priority</th>
                    <th className="pb-2.5 text-left font-medium">Status</th>
                    <th className="pb-2.5 text-left font-medium hidden sm:table-cell">Location</th>
                    <th className="pb-2.5 text-left font-medium hidden sm:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-apex-border/50">
                  {tasks.slice(0, 10).map((t) => (
                    <tr key={t.id} className="hover:bg-apex-surface/50 transition-colors">
                      <td className="py-2.5 text-apex-text font-medium truncate max-w-[160px]">{t.title}</td>
                      <td className="py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          t.priority === 'critical' ? 'bg-apex-danger/20  text-apex-danger'  :
                          t.priority === 'high'     ? 'bg-apex-warning/20 text-apex-warning' :
                          t.priority === 'medium'   ? 'bg-apex-accent/20  text-apex-accent'  :
                                                      'bg-apex-border     text-apex-textMuted'
                        }`}>
                          {t.priority.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5"><StatusBadge status={t.status} /></td>
                      <td className="py-2.5 text-apex-textMuted hidden sm:table-cell truncate max-w-[120px]">{t.location ?? '—'}</td>
                      <td className="py-2.5 text-apex-textMuted font-mono hidden sm:table-cell">
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>

      {/* ── System Events Feed ── */}
      {dashboardEvents.length > 0 && (
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={14} className="text-apex-accent" />
            <p className="text-sm font-semibold text-apex-text">Recent System Events</p>
            <span className="ml-auto h-2 w-2 rounded-full bg-apex-success animate-pulse" />
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {dashboardEvents.slice(0, 20).map((ev) => (
              <div key={ev.id} className={`flex items-start gap-2.5 rounded-lg px-3 py-2 ${
                ev.severity === 'critical' ? 'bg-apex-danger/5  border border-apex-danger/20'  :
                ev.severity === 'warning'  ? 'bg-apex-warning/5 border border-apex-warning/20' :
                                             'bg-apex-surface   border border-apex-border/50'
              }`}>
                <div className={`mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                  ev.severity === 'critical' ? 'bg-apex-danger'  :
                  ev.severity === 'warning'  ? 'bg-apex-warning' : 'bg-apex-accent'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-apex-text">{ev.title}</p>
                  {ev.description && <p className="text-[10px] text-apex-textMuted mt-0.5 truncate">{ev.description}</p>}
                </div>
                <span className="flex-shrink-0 font-mono text-[10px] text-apex-textMuted">
                  {new Date(ev.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
