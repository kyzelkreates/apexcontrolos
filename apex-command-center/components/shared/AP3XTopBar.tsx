'use client';
import React from 'react';
import { useAP3XStore } from '@/store/ap3x-store';
import { cn } from '@/lib/utils';
import { Menu, Wifi, WifiOff, Users, ClipboardList, Truck } from 'lucide-react';

export function AP3XTopBar() {
  const {
    isConfigured, isLoading,
    tasks, drivers, vehicles,
    setMobileSidebarOpen,
  } = useAP3XStore();

  const pendingTasks    = tasks.filter((t) => t.status === 'pending').length;
  const activeDrivers   = drivers.filter((d) => d.status !== 'offline').length;
  const activeVehicles  = vehicles.filter((v) => v.status === 'active').length;

  return (
    <header className="flex items-center justify-between gap-4 border-b border-apex-border bg-apex-surface px-4 py-3 flex-shrink-0">
      {/* Mobile menu toggle */}
      <button
        className="md:hidden text-apex-textMuted hover:text-apex-text transition-colors"
        onClick={() => setMobileSidebarOpen(true)}
      >
        <Menu size={20} />
      </button>

      {/* Live stats */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-apex-textMuted">
          <ClipboardList size={11} className="text-apex-warning" />
          <span><span className="font-mono font-semibold text-apex-text">{pendingTasks}</span> pending</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-apex-textMuted">
          <Users size={11} className="text-apex-success" />
          <span><span className="font-mono font-semibold text-apex-text">{activeDrivers}</span> drivers active</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-apex-textMuted">
          <Truck size={11} className="text-apex-accent" />
          <span><span className="font-mono font-semibold text-apex-text">{activeVehicles}</span> vehicles active</span>
        </div>
      </div>

      {/* Connection status */}
      <div className="flex items-center gap-2 ml-auto">
        {isLoading ? (
          <div className="flex items-center gap-1.5 text-xs text-apex-textMuted">
            <div className="h-2 w-2 rounded-full bg-apex-warning animate-pulse" />
            <span className="hidden sm:inline">Syncing…</span>
          </div>
        ) : isConfigured ? (
          <div className="flex items-center gap-1.5 text-xs text-apex-success">
            <Wifi size={12} />
            <span className="hidden sm:inline">Supabase Live</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-apex-danger">
            <WifiOff size={12} />
            <span className="hidden sm:inline">Not connected</span>
          </div>
        )}
        <div className={cn(
          'h-2 w-2 rounded-full',
          isLoading ? 'bg-apex-warning animate-pulse' :
          isConfigured ? 'bg-apex-success animate-pulse' : 'bg-apex-danger'
        )} />
      </div>
    </header>
  );
}
