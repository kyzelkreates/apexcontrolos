'use client';
import React, { useState } from 'react';
import { Bell, Shield, Menu, RefreshCw } from 'lucide-react';
import { useAP3XStore } from '@/store/ap3x-store';
import { cn, timeAgo } from '@/lib/utils';

export function AP3XTopBar() {
  const {
    alerts, dismissAlert, clearAlerts,
    isLoading, setMobileSidebarOpen, tasks, drivers,
  } = useAP3XStore();

  const [showAlerts, setShowAlerts] = useState(false);
  const activeAlerts = alerts.filter((a) => !a.dismissed);
  const onlineTasks = tasks.filter((t) => t.status === 'in_progress').length;
  const onlineDrivers = drivers.filter((d) => d.status === 'on_task').length;

  return (
    <header className="flex items-center justify-between border-b border-apex-border bg-apex-surface/80 backdrop-blur px-3 sm:px-6 py-3 flex-shrink-0 gap-2">
      {/* Left */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="flex md:hidden h-8 w-8 items-center justify-center rounded-lg border border-apex-border text-apex-textMuted hover:text-apex-text transition-colors flex-shrink-0"
        >
          <Menu size={16} />
        </button>
        <div className="flex items-center gap-1.5 text-xs text-apex-textMuted min-w-0">
          <Shield size={12} className="text-apex-accent flex-shrink-0" />
          <span className="hidden sm:inline font-medium text-apex-text">AP3X CONTROL</span>
          <span className="sm:hidden font-bold text-apex-accent text-xs">AP3X</span>
          <span className="hidden sm:inline">/</span>
          <span className="hidden sm:inline">Admin Dashboard</span>
        </div>
      </div>

      {/* Centre stats */}
      <div className="hidden lg:flex items-center gap-6 text-xs font-mono flex-shrink-0">
        <div className="flex items-center gap-1.5 text-apex-textMuted">
          <span className="h-1.5 w-1.5 rounded-full bg-apex-success animate-pulse" />
          <span>{onlineDrivers} active drivers</span>
        </div>
        <div className="flex items-center gap-1.5 text-apex-textMuted">
          <span className="h-1.5 w-1.5 rounded-full bg-apex-warning" />
          <span>{onlineTasks} tasks in progress</span>
        </div>
        {isLoading && (
          <div className="flex items-center gap-1.5 text-apex-textMuted">
            <RefreshCw size={10} className="animate-spin" />
            <span>syncing…</span>
          </div>
        )}
      </div>

      {/* Right — alerts */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setShowAlerts(!showAlerts)}
          className={cn(
            'relative flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
            activeAlerts.length > 0
              ? 'border-apex-warning/40 text-apex-warning hover:bg-apex-warning/10'
              : 'border-apex-border text-apex-textMuted hover:text-apex-text hover:bg-apex-border/30'
          )}
        >
          <Bell size={14} />
          {activeAlerts.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-apex-warning text-[9px] font-bold text-apex-bg">
              {activeAlerts.length > 9 ? '9+' : activeAlerts.length}
            </span>
          )}
        </button>

        {showAlerts && (
          <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-apex-border bg-apex-card shadow-apex-card">
            <div className="flex items-center justify-between border-b border-apex-border px-4 py-3">
              <span className="text-xs font-semibold text-apex-text">Alerts</span>
              {activeAlerts.length > 0 && (
                <button onClick={clearAlerts} className="text-[10px] text-apex-textMuted hover:text-apex-danger">
                  Clear all
                </button>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-apex-border/50">
              {activeAlerts.length === 0 ? (
                <p className="py-6 text-center text-xs text-apex-textMuted">No active alerts</p>
              ) : (
                activeAlerts.map((a) => (
                  <div key={a.id} className="px-4 py-3 flex gap-3">
                    <span className={cn('mt-0.5 h-2 w-2 rounded-full flex-shrink-0', {
                      'bg-apex-accent': a.type === 'info',
                      'bg-apex-success': a.type === 'success',
                      'bg-apex-warning': a.type === 'warning',
                      'bg-apex-danger': a.type === 'danger',
                    })} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-apex-text">{a.title}</p>
                      <p className="text-[11px] text-apex-textMuted mt-0.5">{a.message}</p>
                      <p className="text-[10px] text-apex-textMuted mt-1">{timeAgo(a.createdAt)}</p>
                    </div>
                    <button onClick={() => dismissAlert(a.id)} className="text-apex-textMuted hover:text-apex-danger text-[10px] flex-shrink-0">✕</button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
