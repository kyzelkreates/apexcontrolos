'use client';
import React, { useMemo } from 'react';
import { useAP3XStore } from '@/store/ap3x-store';
import { MetricCard } from '@/components/shared/MetricCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { NoDataBanner } from '@/components/shared/NoDataBanner';
import { formatNumber } from '@/lib/utils';
import {
  ClipboardList, Users, Truck, Activity,
  Zap, CheckCircle2, AlertTriangle, RefreshCw,
  Network,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const s = Math.floor(d / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function DashboardPage() {
  const {
    tasks, tasksWithAssignments, drivers, vehicles,
    fleetNodes, dashboardEvents, isLoading, isConfigured,
  } = useAP3XStore();

  const stats = useMemo(() => ({
    // Tasks
    taskPending:    tasks.filter((t) => t.status === 'pending').length,
    taskAssigned:   tasks.filter((t) => t.status === 'assigned').length,
    taskInProgress: tasks.filter((t) => t.status === 'in_progress').length,
    taskCompleted:  tasks.filter((t) => t.status === 'completed').length,
    taskCancelled:  tasks.filter((t) => t.status === 'cancelled').length,
    taskTotal:      tasks.length,
    // Drivers
    driversAvailable: drivers.filter((d) => d.status === 'available').length,
    driversOnTask:    drivers.filter((d) => d.status === 'on_task').length,
    driversOffline:   drivers.filter((d) => d.status === 'offline').length,
    driversBreak:     drivers.filter((d) => d.status === 'break').length,
    driversTotal:     drivers.length,
    // Vehicles
    vehiclesActive:      vehicles.filter((v) => v.status === 'active').length,
    vehiclesMaintenance: vehicles.filter((v) => v.status === 'maintenance').length,
    vehiclesTotal:       vehicles.length,
    // Fleet nodes
    nodesOnline:  fleetNodes.filter((n) => n.status === 'online').length,
    nodesTotal:   fleetNodes.length,
  }), [tasks, drivers, vehicles, fleetNodes]);

  // Recent events for activity feed
  const recentEvents = useMemo(
    () => dashboardEvents.slice(0, 15),
    [dashboardEvents]
  );

  // Active tasks (assigned/accepted/in_progress) with driver info
  const activeTasks = useMemo(
    () => tasksWithAssignments
      .filter((t) => ['assigned', 'accepted', 'in_progress'].includes(t.status))
      .slice(0, 10),
    [tasksWithAssignments]
  );

  if (!isConfigured && !isLoading) return <NoDataBanner reason="not_configured" />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-apex-text">
          System <span className="apex-gradient-text">Overview</span>
        </h1>
        <p className="text-sm text-apex-textMuted mt-1">
          Live admin view · Supabase realtime active
        </p>
      </div>

      {/* Task KPIs */}
      <div>
        <p className="text-xs font-semibold uppercase text-apex-textMuted tracking-wider mb-3">Tasks</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard title="Pending"     value={formatNumber(stats.taskPending)}    subtitle="Awaiting assignment" icon={ClipboardList} variant="warning"  loading={isLoading} />
          <MetricCard title="Assigned"    value={formatNumber(stats.taskAssigned)}   subtitle="Driver notified"     icon={ClipboardList} variant="accent"   loading={isLoading} />
          <MetricCard title="In Progress" value={formatNumber(stats.taskInProgress)} subtitle="Active now"          icon={Zap}           variant="purple"   loading={isLoading} />
          <MetricCard title="Completed"   value={formatNumber(stats.taskCompleted)}  subtitle="All time"            icon={CheckCircle2}  variant="success"  loading={isLoading} />
          <MetricCard title="Cancelled"   value={formatNumber(stats.taskCancelled)}  subtitle="All time"            icon={AlertTriangle} variant="default"  loading={isLoading} />
        </div>
      </div>

      {/* Fleet KPIs */}
      <div>
        <p className="text-xs font-semibold uppercase text-apex-textMuted tracking-wider mb-3">Fleet</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard title="Available Drivers"  value={formatNumber(stats.driversAvailable)}  subtitle={`${stats.driversTotal} total`}  icon={Users}    variant="success" loading={isLoading} />
          <MetricCard title="Drivers On Task"    value={formatNumber(stats.driversOnTask)}     subtitle="Currently active"               icon={Users}    variant="purple"  loading={isLoading} />
          <MetricCard title="Active Vehicles"    value={formatNumber(stats.vehiclesActive)}    subtitle={`${stats.vehiclesTotal} total`} icon={Truck}    variant="accent"  loading={isLoading} />
          <MetricCard title="Fleet Nodes"        value={formatNumber(stats.nodesOnline)}       subtitle={`${stats.nodesTotal} total`}    icon={Network}  variant="success" loading={isLoading} />
        </div>
      </div>

      {/* Two-col: active tasks + event feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Active Tasks */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-apex-text">Active Tasks</p>
            <span className="rounded-full bg-apex-purple/20 px-2 py-0.5 text-[10px] font-bold text-apex-purple">
              {stats.taskAssigned + stats.taskInProgress}
            </span>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-apex-textMuted">
              <RefreshCw size={14} className="animate-spin mr-2" /> Loading…
            </div>
          ) : activeTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-apex-textMuted">
              <ClipboardList size={28} className="opacity-20" />
              <p className="text-xs">No active tasks right now</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeTasks.map((t) => (
                <div key={t.id} className="rounded-lg bg-apex-surface border border-apex-border/50 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-apex-text truncate flex-1">{t.title}</p>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[10px] text-apex-textMuted">
                    {t.driver && <span className="flex items-center gap-1"><Users size={8} /> {t.driver.name}</span>}
                    {t.vehicle && <span className="flex items-center gap-1"><Truck size={8} /> {t.vehicle.name}</span>}
                    {t.location && <span className="truncate max-w-[100px]">📍 {t.location}</span>}
                    <span className="ml-auto font-mono">{timeAgo(t.updated_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dashboard Events Feed */}
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-apex-text">System Events</p>
            <span className={cn('h-2 w-2 rounded-full animate-pulse', isConfigured ? 'bg-apex-success' : 'bg-apex-textMuted')} />
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-apex-textMuted">
              <RefreshCw size={14} className="animate-spin mr-2" /> Loading…
            </div>
          ) : recentEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-apex-textMuted">
              <Activity size={28} className="opacity-20" />
              <p className="text-xs">No events yet — they'll appear here in realtime</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {recentEvents.map((ev) => (
                <div key={ev.id} className={cn('flex items-start gap-2.5 rounded-lg px-3 py-2', {
                  'bg-apex-danger/5  border border-apex-danger/20':  ev.severity === 'critical',
                  'bg-apex-warning/5 border border-apex-warning/20': ev.severity === 'warning',
                  'bg-apex-surface   border border-apex-border/50':  ev.severity === 'info',
                })}>
                  <div className={cn('mt-0.5 h-1.5 w-1.5 rounded-full flex-shrink-0', {
                    'bg-apex-danger':  ev.severity === 'critical',
                    'bg-apex-warning': ev.severity === 'warning',
                    'bg-apex-accent':  ev.severity === 'info',
                  })} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-apex-text">{ev.title}</p>
                    {ev.description && <p className="text-[10px] text-apex-textMuted mt-0.5 truncate">{ev.description}</p>}
                  </div>
                  <span className="flex-shrink-0 font-mono text-[10px] text-apex-textMuted">{timeAgo(ev.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Driver status grid */}
      <div className="rounded-xl border border-apex-border bg-apex-card p-5">
        <p className="text-sm font-semibold text-apex-text mb-4">Driver Status</p>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-apex-textMuted">
            <RefreshCw size={14} className="animate-spin mr-2" /> Loading…
          </div>
        ) : drivers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-apex-textMuted">
            <Users size={28} className="opacity-20" />
            <p className="text-xs">No drivers in Supabase yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
            {drivers.map((d) => (
              <div key={d.id} className="rounded-lg bg-apex-surface border border-apex-border/50 px-3 py-2.5">
                <p className="text-xs font-medium text-apex-text truncate">{d.name}</p>
                <div className="mt-1.5"><StatusBadge status={d.status} /></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
