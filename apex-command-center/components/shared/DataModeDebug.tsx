'use client';
/**
 * APEX COMMAND CENTER OS
 * components/shared/DataModeDebug.tsx
 *
 * Admin-only debug overlay. Shown only when DATA_DEBUG = true in core/dataMode.ts.
 * Floats bottom-right, does NOT affect layout.
 * Shows: current DATA_MODE, live data availability, fallback usage, mock %.
 */

import React, { useState, useEffect } from 'react';
import { DATA_MODE, DATA_DEBUG, ENABLE_MOCK, ENABLE_FALLBACK } from '@/core/dataMode';
import { getResolverStats } from '@/core/dataResolver';
import { useApexStore } from '@/store/apex-store';
import { cn } from '@/lib/utils';

const MODE_COLORS: Record<string, string> = {
  mock:   'text-amber-400 border-amber-400/30 bg-amber-400/10',
  hybrid: 'text-sky-400 border-sky-400/30 bg-sky-400/10',
  live:   'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
};

export function DataModeDebug() {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<Record<string, { live: number; local: number; mock: number }>>({});
  const { tenants, fleets, telemetryEvents, aiMetrics, apiUsageLogs,
          routeMetrics, operationalMetrics, deploymentLogs, financialEvents } = useApexStore();

  useEffect(() => {
    if (!DATA_DEBUG) return;
    const interval = setInterval(() => setStats({ ...getResolverStats() }), 2000);
    return () => clearInterval(interval);
  }, []);

  // Only renders when DATA_DEBUG = true
  if (!DATA_DEBUG) return null;

  const liveStatus = [
    { label: 'Tenants',     count: tenants.length },
    { label: 'Fleets',      count: fleets.length },
    { label: 'Telemetry',   count: telemetryEvents.length },
    { label: 'AI Metrics',  count: aiMetrics.length },
    { label: 'API Logs',    count: apiUsageLogs.length },
    { label: 'Routes',      count: routeMetrics.length },
    { label: 'Ops',         count: operationalMetrics.length },
    { label: 'Deployments', count: deploymentLogs.length },
    { label: 'Finance',     count: financialEvents.length },
  ];

  const totalResolutions = Object.values(stats).reduce(
    (acc, s) => ({ live: acc.live + s.live, local: acc.local + s.local, mock: acc.mock + s.mock }),
    { live: 0, local: 0, mock: 0 }
  );
  const totalAll = totalResolutions.live + totalResolutions.local + totalResolutions.mock;
  const mockPct = totalAll > 0 ? ((totalResolutions.mock / totalAll) * 100).toFixed(0) : '0';

  return (
    <div className="fixed bottom-4 right-4 z-[9999] font-mono text-[10px]">
      {/* Toggle pill */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold shadow-lg transition-all',
          MODE_COLORS[DATA_MODE] ?? 'text-apex-text border-apex-border bg-apex-card'
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
        {DATA_MODE.toUpperCase()} DEBUG
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute bottom-8 right-0 w-64 rounded-xl border border-apex-border bg-apex-card/95 backdrop-blur shadow-apex-card p-3 space-y-3">
          {/* Mode row */}
          <div className="flex items-center justify-between border-b border-apex-border pb-2">
            <span className="text-apex-textMuted">DATA_MODE</span>
            <span className={cn('font-bold rounded px-1.5 py-0.5 border text-[10px]', MODE_COLORS[DATA_MODE])}>
              {DATA_MODE}
            </span>
          </div>

          {/* Flags */}
          <div className="space-y-0.5">
            <div className="flex justify-between">
              <span className="text-apex-textMuted">ENABLE_MOCK</span>
              <span className={ENABLE_MOCK ? 'text-amber-400' : 'text-apex-textMuted'}>{String(ENABLE_MOCK)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-apex-textMuted">ENABLE_FALLBACK</span>
              <span className={ENABLE_FALLBACK ? 'text-sky-400' : 'text-apex-textMuted'}>{String(ENABLE_FALLBACK)}</span>
            </div>
          </div>

          {/* Live data availability */}
          <div className="border-t border-apex-border pt-2 space-y-0.5">
            <p className="text-apex-textMuted mb-1">Live Data Status</p>
            {liveStatus.map((s) => (
              <div key={s.label} className="flex justify-between">
                <span className="text-apex-textMuted">{s.label}</span>
                <span className={s.count > 0 ? 'text-emerald-400' : 'text-apex-textMuted'}>
                  {s.count > 0 ? `${s.count} records` : 'empty'}
                </span>
              </div>
            ))}
          </div>

          {/* Resolver stats */}
          <div className="border-t border-apex-border pt-2 space-y-0.5">
            <p className="text-apex-textMuted mb-1">Resolver Usage</p>
            <div className="flex justify-between">
              <span className="text-apex-textMuted">Live resolutions</span>
              <span className="text-emerald-400">{totalResolutions.live}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-apex-textMuted">Local fallbacks</span>
              <span className="text-sky-400">{totalResolutions.local}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-apex-textMuted">Mock fallbacks</span>
              <span className="text-amber-400">{totalResolutions.mock}</span>
            </div>
            <div className="flex justify-between border-t border-apex-border/50 pt-1 mt-1">
              <span className="text-apex-textMuted">Mock usage %</span>
              <span className={Number(mockPct) > 50 ? 'text-amber-400' : 'text-emerald-400'}>{mockPct}%</span>
            </div>
          </div>

          {/* Per-module breakdown */}
          {Object.keys(stats).length > 0 && (
            <div className="border-t border-apex-border pt-2 space-y-0.5">
              <p className="text-apex-textMuted mb-1">Per Module</p>
              {Object.entries(stats).map(([mod, s]) => (
                <div key={mod} className="flex justify-between">
                  <span className="text-apex-textMuted truncate max-w-[100px]">{mod}</span>
                  <span className="text-apex-textMuted">
                    <span className="text-emerald-400">{s.live}L</span>
                    {' '}<span className="text-sky-400">{s.local}P</span>
                    {' '}<span className="text-amber-400">{s.mock}M</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DataModeDebug;
