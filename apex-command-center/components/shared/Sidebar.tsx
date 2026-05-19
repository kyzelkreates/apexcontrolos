'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useApexStore } from '@/store/apex-store';
import {
  LayoutDashboard, Building2, Activity, Brain, Zap, Truck,
  DollarSign, Rocket, FileDown, Settings, ChevronLeft, ChevronRight,
  Shield, Globe, AlertTriangle
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Overview', href: '/dashboard', icon: LayoutDashboard, module: 'overview' },
  { label: 'Tenants', href: '/tenants', icon: Building2, module: 'tenants' },
  { label: 'Telemetry', href: '/telemetry', icon: Activity, module: 'telemetry' },
  { label: 'AI Center', href: '/ai-center', icon: Brain, module: 'ai' },
  { label: 'API Control', href: '/api-control', icon: Zap, module: 'api' },
  { label: 'Fleet Ops', href: '/fleet-ops', icon: Truck, module: 'fleet' },
  { label: 'Finance', href: '/finance', icon: DollarSign, module: 'finance' },
  { label: 'Deployment', href: '/deployment', icon: Rocket, module: 'deployment' },
  { label: 'Export', href: '/export', icon: FileDown, module: 'export' },
  { label: 'Settings', href: '/settings', icon: Settings, module: 'settings' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, setSidebarCollapsed, alerts, globalAggregate } = useApexStore();
  const activeAlerts = alerts.filter((a) => !a.dismissed).length;

  return (
    <aside
      className={cn(
        'flex flex-col bg-apex-surface border-r border-apex-border transition-all duration-300 ease-in-out flex-shrink-0',
        sidebarCollapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-apex-border">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-apex-accent text-white font-bold text-sm">
          A
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="text-xs font-bold text-apex-text leading-tight truncate">APEX</p>
            <p className="text-[10px] text-apex-textMuted leading-tight truncate">Command Center OS</p>
          </div>
        )}
      </div>

      {/* System Status */}
      {!sidebarCollapsed && (
        <div className="mx-3 my-3 rounded-lg bg-apex-bg border border-apex-border/50 px-3 py-2">
          <div className="flex items-center justify-between text-[10px] text-apex-textMuted">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-apex-success animate-pulse" />
              Federation Online
            </span>
            <span className="font-mono text-apex-success">
              {globalAggregate?.activeTenants ?? 0} tenants
            </span>
          </div>
          {activeAlerts > 0 && (
            <div className="mt-1.5 flex items-center gap-1 text-[10px] text-apex-warning">
              <AlertTriangle size={10} />
              <span>{activeAlerts} active alerts</span>
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
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
              title={sidebarCollapsed ? item.label : undefined}
            >
              <Icon
                size={16}
                className={cn('flex-shrink-0', isActive ? 'text-apex-accent' : '')}
              />
              {!sidebarCollapsed && (
                <span className="truncate">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Stats */}
      {!sidebarCollapsed && (
        <div className="border-t border-apex-border px-3 py-3 space-y-1">
          <div className="flex items-center justify-between text-[10px] text-apex-textMuted">
            <span className="flex items-center gap-1"><Globe size={10} /> Fleets</span>
            <span className="font-mono">{globalAggregate?.totalFleets ?? 0}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-apex-textMuted">
            <span className="flex items-center gap-1"><Truck size={10} /> Vehicles</span>
            <span className="font-mono">{globalAggregate?.totalVehicles ?? 0}</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-apex-textMuted">
            <span className="flex items-center gap-1"><Shield size={10} /> Uptime</span>
            <span className="font-mono text-apex-success">{globalAggregate?.globalUptimePercent ?? 0}%</span>
          </div>
        </div>
      )}

      {/* Collapse Toggle */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="flex items-center justify-center border-t border-apex-border py-3 text-apex-textMuted hover:text-apex-text transition-colors"
      >
        {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
}

export default Sidebar;
