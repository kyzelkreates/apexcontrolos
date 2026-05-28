'use client';
import React, { useMemo } from 'react';
import { useAP3XStore } from '@/store/ap3x-store';
import { MetricCard } from '@/components/shared/MetricCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { formatNumber } from '@/lib/utils';
import {
  ClipboardList, Users, Truck, Activity,
  CheckCircle2, Clock, AlertTriangle, XCircle,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-32 text-apex-textMuted text-xs text-center px-4">
      {message}
    </div>
  );
}

export default function DashboardPage() {
  const { tasks, drivers, vehicles, assignments, isLoading, isConfigured } = useAP3XStore();

  // Task status breakdown
  const taskStats = useMemo(() => {
    const counts = { pending: 0, assigned: 0, in_progress: 0, complete: 0, cancelled: 0 };
    tasks.forEach((t) => { if (t.status in counts) counts[t.status as keyof typeof counts]++; });
    return counts;
  }, [tasks]);

  // Driver status breakdown
  const driverStats = useMemo(() => {
    const counts = { available: 0, on_task: 0, offline: 0, break: 0 };
    drivers.forEach((d) => { if (d.status in counts) counts[d.status as keyof typeof counts]++; });
    return counts;
  }, [drivers]);

  // Vehicle status breakdown
  const vehicleStats = useMemo(() => {
    const counts = { active: 0, idle: 0, maintenance: 0, offline: 0 };
    vehicles.forEach((v) => { if (v.status in counts) counts[v.status as keyof typeof counts]++; });
    return counts;
  }, [vehicles]);

  // Task pie data
  const taskPieData = useMemo(() => [
    { name: 'Pending',     value: taskStats.pending,     color: '#f59e0b' },
    { name: 'Assigned',    value: taskStats.assigned,    color: '#0ea5e9' },
    { name: 'In Progress', value: taskStats.in_progress, color: '#8b5cf6' },
    { name: 'Complete',    value: taskStats.complete,    color: '#10b981' },
    { name: 'Cancelled',   value: taskStats.cancelled,   color: '#ef4444' },
  ].filter((d) => d.value > 0), [taskStats]);

  // Tasks created per day (last 7 days from current data)
  const taskTrend = useMemo(() => {
    const byDay: Record<string, number> = {};
    const now = Date.now();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 86400000).toLocaleDateString('en-CA').slice(5);
      byDay[d] = 0;
    }
    tasks.forEach((t) => {
      const day = new Date(t.created_at).toLocaleDateString('en-CA').slice(5);
      if (byDay[day] !== undefined) byDay[day]++;
    });
    return Object.entries(byDay).map(([date, count]) => ({ date, count }));
  }, [tasks]);

  const hasData = tasks.length > 0 || drivers.length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-apex-text">
          System <span className="apex-gradient-text">Overview</span>
        </h1>
        <p className="text-sm text-apex-textMuted mt-1">
          Live data from Supabase · Admin read-only view
        </p>
      </div>

      {/* Not configured banner */}
      {!isConfigured && (
        <div className="rounded-xl border border-apex-warning/30 bg-apex-warning/5 px-5 py-4 text-sm">
          <p className="font-semibold text-apex-warning mb-1">Supabase not connected</p>
          <p className="text-apex-textDim">Add <code className="font-mono text-xs bg-apex-surface px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="font-mono text-xs bg-apex-surface px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your Vercel environment variables.</p>
        </div>
      )}

      {/* No data banner */}
      {isConfigured && !isLoading && !hasData && (
        <div className="rounded-xl border border-apex-border bg-apex-card/50 px-5 py-4 text-sm text-apex-textDim">
          <p className="font-semibold text-apex-text mb-1">No data yet</p>
          <p>Create your first task using the Tasks page. Driver and vehicle data will appear once the Fleet Control OS and Driver PWA are connected to the same Supabase project.</p>
        </div>
      )}

      {/* KPI Row — Tasks */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard title="Pending Tasks"    value={formatNumber(taskStats.pending)}    subtitle="Awaiting assignment"  icon={Clock}        variant="warning" loading={isLoading} />
        <MetricCard title="In Progress"      value={formatNumber(taskStats.in_progress)} subtitle="Currently active"    icon={Activity}     variant="purple"  loading={isLoading} />
        <MetricCard title="Completed Today"  value={formatNumber(taskStats.complete)}   subtitle="All time"             icon={CheckCircle2} variant="success" loading={isLoading} />
        <MetricCard title="Total Tasks"      value={formatNumber(tasks.length)}         subtitle={`${assignments.length} assignments`} icon={ClipboardList} variant="accent" loading={isLoading} />
      </div>

      {/* KPI Row — Fleet */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard title="Active Drivers"   value={formatNumber(driverStats.on_task)}  subtitle={`${driverStats.available} available`}  icon={Users}  variant="success" loading={isLoading} />
        <MetricCard title="Offline Drivers"  value={formatNumber(driverStats.offline)}  subtitle={`${drivers.length} total`}             icon={Users}  variant="default" loading={isLoading} />
        <MetricCard title="Active Vehicles"  value={formatNumber(vehicleStats.active)}  subtitle={`${vehicleStats.idle} idle`}           icon={Truck}  variant="accent"  loading={isLoading} />
        <MetricCard title="Maintenance"      value={formatNumber(vehicleStats.maintenance)} subtitle="Vehicles in maintenance"            icon={AlertTriangle} variant="warning" loading={isLoading} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Task trend */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <p className="text-sm font-semibold text-apex-text mb-4">Tasks Created — Last 7 Days</p>
          {tasks.length === 0 ? <EmptyState message="Tasks will appear here once created." /> : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={taskTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="taskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2235" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#0f1521', border: '1px solid #1a2235', borderRadius: 8, fontSize: 11 }} />
                <Area type="monotone" dataKey="count" name="Tasks" stroke="#0ea5e9" fill="url(#taskGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Task status pie */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <p className="text-sm font-semibold text-apex-text mb-4">Task Status Breakdown</p>
          {taskPieData.length === 0 ? <EmptyState message="No task data yet." /> : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={taskPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" strokeWidth={0}>
                    {taskPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {taskPieData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                      <span className="text-apex-textMuted">{d.name}</span>
                    </span>
                    <span className="font-mono text-apex-text">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent tasks table */}
      <div className="rounded-xl border border-apex-border bg-apex-card p-5">
        <p className="text-sm font-semibold text-apex-text mb-4">Recent Tasks</p>
        {tasks.length === 0 ? <EmptyState message="No tasks yet. Create one from the Tasks page." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-apex-border text-apex-textMuted">
                  <th className="pb-2 text-left font-medium">Title</th>
                  <th className="pb-2 text-left font-medium">Priority</th>
                  <th className="pb-2 text-left font-medium">Status</th>
                  <th className="pb-2 text-left font-medium hidden sm:table-cell">Location</th>
                  <th className="pb-2 text-left font-medium hidden sm:table-cell">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-apex-border/50">
                {tasks.slice(0, 10).map((t) => (
                  <tr key={t.id} className="hover:bg-apex-surface/50 transition-colors">
                    <td className="py-2.5 text-apex-text font-medium truncate max-w-[160px]">{t.title}</td>
                    <td className="py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        t.priority === 'critical' ? 'bg-apex-danger/20 text-apex-danger' :
                        t.priority === 'high'     ? 'bg-apex-warning/20 text-apex-warning' :
                        t.priority === 'medium'   ? 'bg-apex-accent/20 text-apex-accent' :
                                                    'bg-apex-border text-apex-textMuted'
                      }`}>{t.priority.toUpperCase()}</span>
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
        )}
      </div>
    </div>
  );
}
