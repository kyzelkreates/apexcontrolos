'use client';
import React, { useState } from 'react';
import { Bell, RefreshCw, Search, ChevronDown, Shield } from 'lucide-react';
import { useApexStore } from '@/store/apex-store';
import { cn, timeAgo } from '@/lib/utils';

export function TopBar() {
  const { alerts, dismissAlert, clearAlerts, globalAggregate, isLoading } = useApexStore();
  const [showAlerts, setShowAlerts] = useState(false);
  const activeAlerts = alerts.filter((a) => !a.dismissed);

  return (
    <header className="flex items-center justify-between border-b border-apex-border bg-apex-surface/80 backdrop-blur px-6 py-3 flex-shrink-0">
      {/* Left: Breadcrumb / Module title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-apex-textMuted">
          <Shield size={12} className="text-apex-accent" />
          <span>APEX COMMAND CENTER OS</span>
          <span>/</span>
          <span className="text-apex-text font-medium">Master Federation Control</span>
        </div>
      </div>

      {/* Centre: Quick stats */}
      <div className="hidden lg:flex items-center gap-6 text-xs font-mono">
        <div className="flex items-center gap-1.5 text-apex-textMuted">
          <span className="h-1.5 w-1.5 rounded-full bg-apex-success animate-pulse" />
          <span className="text-apex-success font-medium">{globalAggregate?.activeFleets ?? 0}</span>
          <span>fleets online</span>
        </div>
        <div className="flex items-center gap-1.5 text-apex-textMuted">
          <span className="text-apex-accent font-medium">{globalAggregate?.activeVehicles ?? 0}</span>
          <span>vehicles active</span>
        </div>
        <div className="flex items-center gap-1.5 text-apex-textMuted">
          <span className="text-apex-warning font-medium">{globalAggregate?.alertsActive ?? 0}</span>
          <span>alerts</span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {isLoading && (
          <RefreshCw size={14} className="text-apex-accent animate-spin" />
        )}

        {/* Alerts Bell */}
        <div className="relative">
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-apex-border text-apex-textMuted hover:text-apex-text hover:bg-apex-border/30 transition-colors"
          >
            <Bell size={15} />
            {activeAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-apex-danger text-[9px] font-bold text-white">
                {Math.min(activeAlerts.length, 9)}
              </span>
            )}
          </button>

          {showAlerts && (
            <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-apex-border bg-apex-card shadow-apex-card overflow-hidden">
              <div className="flex items-center justify-between border-b border-apex-border px-4 py-2.5">
                <span className="text-xs font-semibold text-apex-text">Alerts ({activeAlerts.length})</span>
                <button
                  onClick={() => { clearAlerts(); setShowAlerts(false); }}
                  className="text-[10px] text-apex-textMuted hover:text-apex-danger transition-colors"
                >
                  Clear all
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {activeAlerts.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-apex-textMuted">No active alerts</div>
                ) : (
                  activeAlerts.slice(0, 10).map((alert) => (
                    <div
                      key={alert.id}
                      className={cn(
                        'flex items-start gap-3 border-b border-apex-border/50 px-4 py-3',
                        alert.type === 'danger' ? 'bg-apex-danger/5' :
                        alert.type === 'warning' ? 'bg-apex-warning/5' :
                        alert.type === 'success' ? 'bg-apex-success/5' : ''
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-xs font-medium',
                          alert.type === 'danger' ? 'text-apex-danger' :
                          alert.type === 'warning' ? 'text-apex-warning' :
                          alert.type === 'success' ? 'text-apex-success' : 'text-apex-text'
                        )}>
                          {alert.title}
                        </p>
                        <p className="text-[10px] text-apex-textMuted mt-0.5 truncate">{alert.message}</p>
                        <p className="text-[10px] text-apex-textMuted mt-1">{timeAgo(alert.createdAt)}</p>
                      </div>
                      <button
                        onClick={() => dismissAlert(alert.id)}
                        className="text-apex-textMuted hover:text-apex-text text-[10px]"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Owner badge */}
        <div className="flex items-center gap-2 rounded-lg border border-apex-border bg-apex-bg px-3 py-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-apex-accent/20 text-apex-accent text-[10px] font-bold">
            M
          </div>
          {<span className="text-xs text-apex-textDim hidden sm:block">Master Owner</span>}
        </div>
      </div>
    </header>
  );
}

export default TopBar;
