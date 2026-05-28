'use client';
import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAP3XStore } from '@/store/ap3x-store';
import {
  LayoutDashboard, ClipboardList, Users, Truck,
  Activity, Settings, ChevronLeft, ChevronRight, X,
  Shield, Zap,
} from 'lucide-react';

const NAV = [
  { label: 'Overview',   href: '/dashboard',    icon: LayoutDashboard },
  { label: 'Tasks',      href: '/tasks',         icon: ClipboardList },
  { label: 'Fleet',      href: '/fleet',         icon: Truck },
  { label: 'Drivers',    href: '/drivers',       icon: Users },
  { label: 'Live Feed',  href: '/live',          icon: Activity },
  { label: 'Settings',   href: '/settings',      icon: Settings },
];

export function AP3XSidebar() {
  const pathname = usePathname();
  const {
    sidebarCollapsed, setSidebarCollapsed,
    mobileSidebarOpen, setMobileSidebarOpen,
    alerts, tasks, drivers,
  } = useAP3XStore();

  const activeAlerts = alerts.filter((a) => !a.dismissed).length;
  const pendingTasks = tasks.filter((t) => t.status === 'pending').length;
  const onlineDrivers = drivers.filter((d) => d.status !== 'offline').length;

  useEffect(() => { setMobileSidebarOpen(false); }, [pathname, setMobileSidebarOpen]);

  const NavContent = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-apex-border flex-shrink-0">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-apex-accent/20 border border-apex-accent/40 text-apex-accent font-bold text-xs">
          A3
        </div>
        {(mobile || !sidebarCollapsed) && (
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-apex-text leading-tight">AP3X CONTROL</p>
            <p className="text-[10px] text-apex-textMuted leading-tight">Admin Dashboard</p>
          </div>
        )}
        {mobile && (
          <button onClick={() => setMobileSidebarOpen(false)} className="ml-auto text-apex-textMuted hover:text-apex-text">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Quick stats */}
      {(mobile || !sidebarCollapsed) && (
        <div className="mx-3 my-3 rounded-lg bg-apex-bg border border-apex-border/50 px-3 py-2 space-y-1.5 flex-shrink-0">
          <div className="flex items-center justify-between text-[10px] text-apex-textMuted">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-apex-success animate-pulse" />
              System Online
            </span>
            <span className="font-mono text-apex-success">{onlineDrivers} drivers</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-apex-textMuted">
            <span className="flex items-center gap-1"><Zap size={9} /> Pending Tasks</span>
            <span className={cn('font-mono', pendingTasks > 0 ? 'text-apex-warning' : 'text-apex-textDim')}>
              {pendingTasks}
            </span>
          </div>
          {activeAlerts > 0 && (
            <div className="flex items-center justify-between text-[10px] text-apex-warning">
              <span>⚠ Alerts</span>
              <span className="font-mono">{activeAlerts}</span>
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-apex-accent/10 text-apex-accent border border-apex-accent/20'
                  : 'text-apex-textMuted hover:bg-apex-border/30 hover:text-apex-text border border-transparent'
              )}
              title={(!mobile && sidebarCollapsed) ? item.label : undefined}
            >
              <Icon size={16} className={cn('flex-shrink-0', isActive ? 'text-apex-accent' : '')} />
              {(mobile || !sidebarCollapsed) && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {(mobile || !sidebarCollapsed) && (
        <div className="border-t border-apex-border px-3 py-3 flex-shrink-0">
          <div className="flex items-center gap-1.5 text-[10px] text-apex-textMuted">
            <Shield size={9} className="text-apex-accent" />
            <span>Admin access only</span>
          </div>
        </div>
      )}

      {/* Collapse toggle (desktop) */}
      {!mobile && (
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="flex items-center justify-center border-t border-apex-border py-3 text-apex-textMuted hover:text-apex-text transition-colors flex-shrink-0"
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      )}
    </>
  );

  return (
    <>
      <aside className={cn(
        'hidden md:flex flex-col bg-apex-surface border-r border-apex-border transition-all duration-300 flex-shrink-0',
        sidebarCollapsed ? 'w-16' : 'w-60'
      )}>
        <NavContent />
      </aside>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setMobileSidebarOpen(false)} />
      )}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex flex-col w-72 bg-apex-surface border-r border-apex-border transition-transform duration-300 md:hidden',
        mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <NavContent mobile />
      </aside>
    </>
  );
}
