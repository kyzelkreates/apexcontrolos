'use client';
/**
 * APEX COMMAND CENTER OS
 * app/(main)/deployment/page.tsx — Deployment Control
 *
 * ARCHITECTURE RULE (Step 5):
 *   This component ONLY uses deploymentProvider functions.
 *   It does NOT access external endpoints directly.
 *   It does NOT import mock data arrays.
 *   It does NOT bypass the SSOT layer.
 *
 * Data flow:
 *   DeploymentPage
 *     → getDeploymentNodes()       (deploymentProvider)
 *     → getDashboardStatus()       (deploymentProvider)
 *     → getFleetTelemetry()        (deploymentProvider)
 *     → getConnectionHealth()      (deploymentProvider)
 *     → Storage.Deployments        (local rollback ops only)
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApexStore } from '@/store/apex-store';
import { MetricCard } from '@/components/shared/MetricCard';
import { SectionHeader } from '@/components/shared/SectionHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DataTable } from '@/components/shared/DataTable';
import { timeAgo, cn } from '@/lib/utils';
import {
  Rocket, Shield, AlertTriangle, RefreshCw, CheckCircle2,
  XCircle, RotateCcw, Wifi, WifiOff, Globe, Activity,
  Radio, Server, Zap, Clock,
} from 'lucide-react';
import Storage from '@/storage/storage';
import {
  getDeploymentNodes, getDashboardStatus, getFleetTelemetry,
  getConnectionHealth, getDeploymentMode,
  type DeploymentNode, type DashboardStatus,
  type FleetTelemetrySummary, type ConnectionHealth,
  type DeploymentSourceMode,
} from '@/services/deploymentProvider';
import type { DeploymentLog } from '@/types';

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function sourceTag(source: 'live' | 'simulation' | 'fallback') {
  if (source === 'live')
    return <span className="rounded-full bg-apex-success/15 px-1.5 py-0.5 text-[9px] font-bold text-apex-success">LIVE</span>;
  if (source === 'fallback')
    return <span className="rounded-full bg-apex-warning/15 px-1.5 py-0.5 text-[9px] font-bold text-apex-warning">FALLBACK</span>;
  return <span className="rounded-full bg-apex-accent/15 px-1.5 py-0.5 text-[9px] font-bold text-apex-accent">SIM</span>;
}

function nodeStatusDot(status: DeploymentNode['status']) {
  const map: Record<string, string> = {
    online: 'bg-apex-success',
    degraded: 'bg-apex-warning',
    offline: 'bg-apex-danger',
    unreachable: 'bg-apex-textMuted',
  };
  return <span className={cn('inline-block h-2 w-2 rounded-full', map[status] ?? 'bg-apex-textMuted')} />;
}

// ─────────────────────────────────────────────────────────────────
// NODE CARD — single AP3X dashboard node
// ─────────────────────────────────────────────────────────────────

interface NodeCardProps {
  node: DeploymentNode;
  status: DashboardStatus | undefined;
  telemetry: FleetTelemetrySummary | undefined;
  health: ConnectionHealth | undefined;
}

function NodeCard({ node, status, telemetry, health }: NodeCardProps) {
  const isOnline = node.status === 'online' || node.status === 'degraded';

  return (
    <div className={cn(
      'rounded-xl border p-4 space-y-3 transition-colors',
      node.status === 'online' ? 'border-apex-border bg-apex-card' :
      node.status === 'degraded' ? 'border-apex-warning/40 bg-apex-warning/5' :
      'border-apex-danger/30 bg-apex-danger/5 opacity-80'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {nodeStatusDot(node.status)}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-apex-text truncate">{node.name}</p>
            <p className="text-[10px] font-mono text-apex-textMuted truncate">{node.endpoint}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {sourceTag(node.source)}
          <span className="rounded-full border border-apex-border px-1.5 py-0.5 text-[9px] font-mono text-apex-textDim">
            {node.region}
          </span>
        </div>
      </div>

      {/* Version + sync */}
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-mono text-apex-textDim">v{node.version}</span>
        <span className={cn(
          'font-medium',
          node.syncStatus === 'synced' ? 'text-apex-success' :
          node.syncStatus === 'behind' ? 'text-apex-warning' : 'text-apex-textMuted'
        )}>
          {node.syncStatus === 'synced' ? '● Synced' :
           node.syncStatus === 'behind' ? '◑ Behind' : '○ Unknown'}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-apex-surface px-3 py-2">
          <p className="text-[9px] uppercase tracking-wider text-apex-textMuted mb-0.5">Health</p>
          <p className={cn('text-sm font-bold font-mono',
            node.healthScore >= 80 ? 'text-apex-success' :
            node.healthScore >= 50 ? 'text-apex-warning' : 'text-apex-danger'
          )}>{node.healthScore}<span className="text-[10px] font-normal text-apex-textMuted">%</span></p>
        </div>
        <div className="rounded-lg bg-apex-surface px-3 py-2">
          <p className="text-[9px] uppercase tracking-wider text-apex-textMuted mb-0.5">Uptime</p>
          <p className="text-sm font-bold font-mono text-apex-text">{isOnline ? `${node.uptime}%` : '—'}</p>
        </div>
        <div className="rounded-lg bg-apex-surface px-3 py-2">
          <p className="text-[9px] uppercase tracking-wider text-apex-textMuted mb-0.5">Vehicles</p>
          <p className="text-sm font-bold font-mono text-apex-text">{isOnline ? node.activeVehicles : '—'}</p>
        </div>
        <div className="rounded-lg bg-apex-surface px-3 py-2">
          <p className="text-[9px] uppercase tracking-wider text-apex-textMuted mb-0.5">Latency</p>
          <p className={cn('text-sm font-bold font-mono',
            !health?.latencyMs ? 'text-apex-danger' :
            health.latencyMs < 100 ? 'text-apex-success' :
            health.latencyMs < 300 ? 'text-apex-warning' : 'text-apex-danger'
          )}>
            {health?.latencyMs != null ? `${health.latencyMs}ms` : '—'}
          </p>
        </div>
      </div>

      {/* Dashboard status bar */}
      {status && isOnline && (
        <div className="space-y-1.5">
          {[
            { label: 'CPU', value: status.cpuPercent },
            { label: 'MEM', value: status.memPercent },
            { label: 'DISK', value: status.diskPercent },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-apex-textMuted w-8">{label}</span>
              <div className="flex-1 h-1 rounded-full bg-apex-border overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    value > 85 ? 'bg-apex-danger' :
                    value > 65 ? 'bg-apex-warning' : 'bg-apex-success'
                  )}
                  style={{ width: `${value}%` }}
                />
              </div>
              <span className="text-[9px] font-mono text-apex-textMuted w-8 text-right">{value}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Telemetry quick stats */}
      {telemetry && isOnline && (
        <div className="flex gap-3 text-[10px] text-apex-textMuted border-t border-apex-border/50 pt-2.5">
          <span><span className="font-semibold text-apex-text">{telemetry.eventsLast1h.toLocaleString()}</span> events/hr</span>
          <span><span className="font-semibold text-apex-text">{telemetry.activeRoutes}</span> routes</span>
          {telemetry.alertCount > 0 && (
            <span className="text-apex-warning"><span className="font-semibold">{telemetry.alertCount}</span> alerts</span>
          )}
        </div>
      )}

      {/* Offline notice */}
      {!isOnline && (
        <div className="flex items-center gap-1.5 text-[11px] text-apex-danger border-t border-apex-danger/20 pt-2.5">
          <XCircle size={11} />
          {node.status === 'unreachable' ? 'Unreachable — no response from endpoint' : `Offline · last seen ${timeAgo(node.lastSeen)}`}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────

export default function DeploymentPage() {
  const { deploymentLogs, tenants, fleets, isLoading, addAlert, setDeploymentLogs } = useApexStore();
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRegion, setFilterRegion] = useState('all');
  const [rolling, setRolling] = useState<string | null>(null);

  // Deployment provider state
  const [deployMode, setDeployMode] = useState<DeploymentSourceMode>('simulation');
  const [nodes, setNodes] = useState<DeploymentNode[]>([]);
  const [statuses, setStatuses] = useState<DashboardStatus[]>([]);
  const [telemetry, setTelemetry] = useState<FleetTelemetrySummary[]>([]);
  const [connHealth, setConnHealth] = useState<ConnectionHealth[]>([]);
  const [nodeLoading, setNodeLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<number>(0);

  // Load deployment provider data
  const loadProviderData = useCallback(async () => {
    setNodeLoading(true);
    try {
      const [n, s, t, h] = await Promise.all([
        getDeploymentNodes(),
        getDashboardStatus(),
        getFleetTelemetry(),
        getConnectionHealth(),
      ]);
      setNodes(n);
      setStatuses(s);
      setTelemetry(t);
      setConnHealth(h);
      setLastRefreshed(Date.now());
    } finally {
      setNodeLoading(false);
    }
  }, []);

  useEffect(() => {
    setDeployMode(getDeploymentMode());
    loadProviderData();
  }, [loadProviderData]);

  // Rollback logic (local deployment log op only)
  const handleRollback = async (deployId: string) => {
    setRolling(deployId);
    const dep = deploymentLogs.find((d) => d.id === deployId);
    if (!dep) { setRolling(null); return; }
    await new Promise((r) => setTimeout(r, 1500));
    const updated = { ...dep, status: 'rolledback' as const };
    await Storage.Deployments.save(updated);
    setDeploymentLogs(deploymentLogs.map((d) => d.id === deployId ? updated : d));
    addAlert({
      type: 'warning',
      title: 'Rollback Complete',
      message: `Deployment ${dep.version} rolled back to ${dep.previousVersion}.`,
    });
    setRolling(null);
  };

  // Aggregate metrics
  const deployed   = deploymentLogs.filter((d) => d.status === 'deployed').length;
  const rolling_   = deploymentLogs.filter((d) => d.status === 'rolling').length;
  const failed     = deploymentLogs.filter((d) => d.status === 'failed').length;
  const healthPct  = deploymentLogs.length
    ? Math.round(deploymentLogs.filter((d) => d.healthCheckPassed).length / deploymentLogs.length * 100)
    : 0;

  const onlineNodes  = nodes.filter((n) => n.status === 'online').length;
  const offlineNodes = nodes.filter((n) => n.status === 'offline' || n.status === 'unreachable').length;
  const liveSource   = nodes.some((n) => n.source === 'live');

  const filtered = useMemo(() => deploymentLogs.filter((d) => {
    if (filterStatus !== 'all' && d.status !== filterStatus) return false;
    if (filterRegion !== 'all' && d.region !== filterRegion) return false;
    return true;
  }), [deploymentLogs, filterStatus, filterRegion]);

  const columns = [
    {
      key: 'version', header: 'Version', sortable: true,
      render: (row: DeploymentLog) => (
        <div>
          <p className="font-mono text-sm font-semibold text-apex-text">v{row.version}</p>
          <p className="text-[10px] text-apex-textMuted">from v{row.previousVersion}</p>
        </div>
      ),
    },
    {
      key: 'tenantId', header: 'Tenant',
      render: (row: DeploymentLog) => {
        const t = tenants.find((t) => t.id === row.tenantId);
        const f = fleets.find((f) => f.id === row.fleetId);
        return (
          <div>
            <p className="text-xs font-medium text-apex-text">{t?.name || 'Unknown'}</p>
            <p className="text-[10px] text-apex-textMuted">{f?.name}</p>
          </div>
        );
      },
    },
    {
      key: 'region', header: 'Region',
      render: (row: DeploymentLog) => (
        <span className="font-mono text-xs text-apex-textDim">{row.region}</span>
      ),
    },
    { key: 'status', header: 'Status', render: (row: DeploymentLog) => <StatusBadge status={row.status} /> },
    {
      key: 'vehiclesUpdated', header: 'Progress',
      render: (row: DeploymentLog) => (
        <div>
          <div className="w-20 h-1.5 rounded-full bg-apex-border overflow-hidden mb-1">
            <div
              className="h-full rounded-full bg-apex-accent"
              style={{ width: `${(row.vehiclesUpdated / row.vehiclesTotal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-apex-textMuted">
            {row.vehiclesUpdated}/{row.vehiclesTotal}
          </span>
        </div>
      ),
    },
    {
      key: 'healthCheckPassed', header: 'Health',
      render: (row: DeploymentLog) => row.healthCheckPassed
        ? <CheckCircle2 size={14} className="text-apex-success" />
        : <XCircle size={14} className="text-apex-danger" />,
    },
    {
      key: 'deployedAt', header: 'Deployed', sortable: true,
      render: (row: DeploymentLog) => (
        <span className="text-xs text-apex-textMuted">{timeAgo(row.deployedAt)}</span>
      ),
    },
    {
      key: 'id', header: '',
      render: (row: DeploymentLog) => row.rollbackAvailable && row.status !== 'rolledback' ? (
        <button
          onClick={() => handleRollback(row.id)}
          disabled={rolling === row.id}
          className="flex items-center gap-1 rounded-lg border border-apex-warning/40 bg-apex-warning/10 px-2 py-1 text-xs font-medium text-apex-warning hover:bg-apex-warning/20 transition-colors disabled:opacity-50"
        >
          {rolling === row.id
            ? <RefreshCw size={10} className="animate-spin" />
            : <RotateCcw size={10} />
          }
          Rollback
        </button>
      ) : null,
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-apex-text">
            Deployment <span className="apex-gradient-text">Control</span>
          </h1>
          <p className="text-sm text-apex-textMuted mt-1">
            Fleet rollouts · Version management · Rollback controls · Health monitoring
          </p>
        </div>
        {/* Mode badge + refresh */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className={cn(
            'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold',
            deployMode === 'live'
              ? 'border-apex-success/50 bg-apex-success/10 text-apex-success'
              : 'border-apex-accent/50 bg-apex-accent/10 text-apex-accent'
          )}>
            {deployMode === 'live' ? <Wifi size={11} /> : <WifiOff size={11} />}
            {deployMode === 'live' ? 'Live Mode' : 'Simulation'}
          </div>
          <button
            onClick={loadProviderData}
            disabled={nodeLoading}
            className="flex items-center gap-1.5 rounded-lg border border-apex-border px-3 py-1 text-xs text-apex-textMuted hover:text-apex-text transition-colors disabled:opacity-50"
          >
            <RefreshCw size={11} className={nodeLoading ? 'animate-spin' : ''} />
            {lastRefreshed > 0 ? timeAgo(lastRefreshed) : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Summary metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard title="Deployed"             value={deployed}   icon={CheckCircle2} variant="success"  loading={isLoading} />
        <MetricCard title="Rolling Out"           value={rolling_}   icon={RefreshCw}    variant="warning"  loading={isLoading} />
        <MetricCard title="Failed"                value={failed}     icon={AlertTriangle} variant={failed > 0 ? 'danger' : 'success'} loading={isLoading} />
        <MetricCard title="Health Checks Passed"  value={`${healthPct}%`} icon={Shield}  variant="accent"   loading={isLoading} />
      </div>

      {/* ── AP3X NODE GRID — deploymentProvider data ── */}
      <div className="rounded-xl border border-apex-border bg-apex-card p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <SectionHeader
            title="AP3X Fleet Dashboard Network"
            subtitle={`${nodes.length} nodes · ${onlineNodes} online · ${offlineNodes} offline`}
            icon={Globe}
          />
          {liveSource && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-apex-success">
              <Activity size={11} className="animate-pulse" /> Live data
            </span>
          )}
        </div>

        {nodeLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-52 rounded-xl border border-apex-border bg-apex-surface animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {nodes.map((node) => (
              <NodeCard
                key={node.id}
                node={node}
                status={statuses.find((s) => s.nodeId === node.id)}
                telemetry={telemetry.find((t) => t.nodeId === node.id)}
                health={connHealth.find((h) => h.nodeId === node.id)}
              />
            ))}
          </div>
        )}

        {/* Network summary strip */}
        {!nodeLoading && nodes.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-apex-border/50">
            <div className="rounded-lg bg-apex-surface px-3 py-2">
              <p className="text-[9px] uppercase tracking-wider text-apex-textMuted mb-0.5">Network</p>
              <p className="text-xs font-bold text-apex-text">
                {nodes.filter((n) => n.status === 'online').length}/{nodes.length} online
              </p>
            </div>
            <div className="rounded-lg bg-apex-surface px-3 py-2">
              <p className="text-[9px] uppercase tracking-wider text-apex-textMuted mb-0.5">Active Vehicles</p>
              <p className="text-xs font-bold text-apex-text">
                {nodes.reduce((a, n) => a + n.activeVehicles, 0).toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg bg-apex-surface px-3 py-2">
              <p className="text-[9px] uppercase tracking-wider text-apex-textMuted mb-0.5">Avg Health</p>
              <p className={cn(
                'text-xs font-bold',
                (() => {
                  const avg = nodes.filter((n) => n.healthScore > 0).reduce((a, n) => a + n.healthScore, 0) /
                    (nodes.filter((n) => n.healthScore > 0).length || 1);
                  return avg >= 80 ? 'text-apex-success' : avg >= 50 ? 'text-apex-warning' : 'text-apex-danger';
                })()
              )}>
                {Math.round(
                  nodes.filter((n) => n.healthScore > 0).reduce((a, n) => a + n.healthScore, 0) /
                  (nodes.filter((n) => n.healthScore > 0).length || 1)
                )}%
              </p>
            </div>
            <div className="rounded-lg bg-apex-surface px-3 py-2">
              <p className="text-[9px] uppercase tracking-wider text-apex-textMuted mb-0.5">Avg Latency</p>
              <p className="text-xs font-bold text-apex-text">
                {(() => {
                  const latencies = connHealth.filter((h) => h.latencyMs != null).map((h) => h.latencyMs as number);
                  return latencies.length
                    ? `${Math.round(latencies.reduce((a, v) => a + v, 0) / latencies.length)}ms`
                    : '—';
                })()}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        {['all', 'deployed', 'rolling', 'failed', 'rolledback'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={cn(
              'rounded-lg border px-3 py-1 text-xs font-medium transition-colors capitalize',
              filterStatus === s
                ? 'border-apex-accent/50 bg-apex-accent/10 text-apex-accent'
                : 'border-apex-border text-apex-textMuted hover:text-apex-text'
            )}
          >
            {s === 'all' ? 'All Status' : s}
          </button>
        ))}
        <div className="ml-auto flex gap-2 flex-wrap">
          {['all', 'NA', 'EU', 'APAC', 'LATAM', 'MEA'].map((r) => (
            <button
              key={r}
              onClick={() => setFilterRegion(r)}
              className={cn(
                'rounded-lg border px-3 py-1 text-xs font-medium transition-colors',
                filterRegion === r
                  ? 'border-apex-accent/50 bg-apex-accent/10 text-apex-accent'
                  : 'border-apex-border text-apex-textMuted hover:text-apex-text'
              )}
            >
              {r === 'all' ? 'All' : r}
            </button>
          ))}
        </div>
      </div>

      {/* Active rollouts */}
      {rolling_ > 0 && (
        <div className="rounded-xl border border-apex-warning/30 bg-apex-warning/5 p-4">
          <p className="text-xs font-semibold text-apex-warning mb-3 flex items-center gap-2">
            <RefreshCw size={12} className="animate-spin" />
            {rolling_} Active Rollout{rolling_ > 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {deploymentLogs.filter((d) => d.status === 'rolling').map((d) => {
              const tenant = tenants.find((t) => t.id === d.tenantId);
              const progress = (d.vehiclesUpdated / d.vehiclesTotal) * 100;
              return (
                <div key={d.id} className="rounded-lg border border-apex-warning/20 bg-apex-card px-4 py-3">
                  <div className="flex justify-between mb-2">
                    <div>
                      <p className="text-xs font-semibold text-apex-text">{tenant?.name} — v{d.version}</p>
                      <p className="text-[10px] text-apex-textMuted">
                        {d.region} · {d.vehiclesUpdated}/{d.vehiclesTotal} vehicles
                      </p>
                    </div>
                    <span className="text-xs font-mono text-apex-warning">{progress.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-apex-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-apex-warning transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Deployment history table */}
      <div className="rounded-xl border border-apex-border bg-apex-card p-5">
        <SectionHeader
          title="Deployment History"
          subtitle={`${filtered.length} records`}
          icon={Rocket}
        />
        <DataTable
          columns={columns}
          data={filtered as DeploymentLog[]}
          keyField="id"
          loading={isLoading}
          emptyMessage="No deployments found"
          pageSize={15}
        />
      </div>
    </div>
  );
}
