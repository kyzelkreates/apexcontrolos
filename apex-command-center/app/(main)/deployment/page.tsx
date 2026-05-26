'use client';
import React, { useMemo, useState } from 'react';
import { useApexStore } from '@/store/apex-store';
import { MetricCard } from '@/components/shared/MetricCard';
import { SectionHeader } from '@/components/shared/SectionHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DataTable } from '@/components/shared/DataTable';
import { timeAgo, cn } from '@/lib/utils';
import { Rocket, Shield, AlertTriangle, RefreshCw, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import Storage from '@/storage/storage';
import type { DeploymentLog } from '@/types';

export default function DeploymentPage() {
  const { deploymentLogs, tenants, fleets, isLoading, addAlert, setDeploymentLogs } = useApexStore();
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRegion, setFilterRegion] = useState('all');
  const [rolling, setRolling] = useState<string | null>(null);

  const filtered = useMemo(() => deploymentLogs.filter((d) => {
    if (filterStatus !== 'all' && d.status !== filterStatus) return false;
    if (filterRegion !== 'all' && d.region !== filterRegion) return false;
    return true;
  }), [deploymentLogs, filterStatus, filterRegion]);

  const deployed = deploymentLogs.filter((d) => d.status === 'deployed').length;
  const rolling_ = deploymentLogs.filter((d) => d.status === 'rolling').length;
  const failed = deploymentLogs.filter((d) => d.status === 'failed').length;
  const healthPassed = deploymentLogs.filter((d) => d.healthCheckPassed).length;

  const handleRollback = async (deployId: string) => {
    setRolling(deployId);
    const dep = deploymentLogs.find((d) => d.id === deployId);
    if (!dep) { setRolling(null); return; }
    await new Promise((r) => setTimeout(r, 1500));
    const updated = { ...dep, status: 'rolledback' as const };
    await Storage.Deployments.save(updated);
    setDeploymentLogs(deploymentLogs.map((d) => d.id === deployId ? updated : d));
    addAlert({ type: 'warning', title: 'Rollback Complete', message: `Deployment ${dep.version} rolled back to ${dep.previousVersion}.` });
    setRolling(null);
  };

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
    { key: 'region', header: 'Region', render: (row: DeploymentLog) => <span className="font-mono text-xs text-apex-textDim">{row.region}</span> },
    { key: 'status', header: 'Status', render: (row: DeploymentLog) => <StatusBadge status={row.status} /> },
    {
      key: 'vehiclesUpdated', header: 'Progress',
      render: (row: DeploymentLog) => (
        <div>
          <div className="w-20 h-1.5 rounded-full bg-apex-border overflow-hidden mb-1">
            <div className="h-full rounded-full bg-apex-accent" style={{ width: `${(row.vehiclesUpdated / row.vehiclesTotal) * 100}%` }} />
          </div>
          <span className="text-[10px] font-mono text-apex-textMuted">{row.vehiclesUpdated}/{row.vehiclesTotal}</span>
        </div>
      ),
    },
    {
      key: 'healthCheckPassed', header: 'Health',
      render: (row: DeploymentLog) => row.healthCheckPassed
        ? <CheckCircle2 size={14} className="text-apex-success" />
        : <XCircle size={14} className="text-apex-danger" />,
    },
    { key: 'deployedAt', header: 'Deployed', sortable: true, render: (row: DeploymentLog) => <span className="text-xs text-apex-textMuted">{timeAgo(row.deployedAt)}</span> },
    {
      key: 'id', header: '',
      render: (row: DeploymentLog) => row.rollbackAvailable && row.status !== 'rolledback' ? (
        <button
          onClick={() => handleRollback(row.id)}
          disabled={rolling === row.id}
          className="flex items-center gap-1 rounded-lg border border-apex-warning/40 bg-apex-warning/10 px-2 py-1 text-xs font-medium text-apex-warning hover:bg-apex-warning/20 transition-colors disabled:opacity-50"
        >
          {rolling === row.id ? <RefreshCw size={10} className="animate-spin" /> : <RotateCcw size={10} />}
          Rollback
        </button>
      ) : null,
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-apex-text">Deployment <span className="apex-gradient-text">Control</span></h1>
        <p className="text-sm text-apex-textMuted mt-1">Fleet rollouts · Version management · Rollback controls · Health monitoring</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard title="Deployed" value={deployed} icon={CheckCircle2} variant="success" loading={isLoading} />
        <MetricCard title="Rolling Out" value={rolling_} icon={RefreshCw} variant="warning" loading={isLoading} />
        <MetricCard title="Failed" value={failed} icon={AlertTriangle} variant={failed > 0 ? 'danger' : 'success'} loading={isLoading} />
        <MetricCard title="Health Checks Passed" value={`${deploymentLogs.length ? Math.round(healthPassed / deploymentLogs.length * 100) : 0}%`} icon={Shield} variant="accent" loading={isLoading} />
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        {['all', 'deployed', 'rolling', 'failed', 'rolledback'].map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={cn('rounded-lg border px-3 py-1 text-xs font-medium transition-colors capitalize', filterStatus === s ? 'border-apex-accent/50 bg-apex-accent/10 text-apex-accent' : 'border-apex-border text-apex-textMuted hover:text-apex-text')}>
            {s === 'all' ? 'All Status' : s}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          {['all', 'NA', 'EU', 'APAC', 'LATAM', 'MEA'].map((r) => (
            <button key={r} onClick={() => setFilterRegion(r)}
              className={cn('rounded-lg border px-3 py-1 text-xs font-medium transition-colors', filterRegion === r ? 'border-apex-accent/50 bg-apex-accent/10 text-apex-accent' : 'border-apex-border text-apex-textMuted hover:text-apex-text')}>
              {r === 'all' ? 'All' : r}
            </button>
          ))}
        </div>
      </div>

      {/* Active Rollouts */}
      {rolling_ > 0 && (
        <div className="rounded-xl border border-apex-warning/30 bg-apex-warning/5 p-4">
          <p className="text-xs font-semibold text-apex-warning mb-3 flex items-center gap-2">
            <RefreshCw size={12} className="animate-spin" /> {rolling_} Active Rollout{rolling_ > 1 ? 's' : ''}
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
                      <p className="text-[10px] text-apex-textMuted">{d.region} · {d.vehiclesUpdated}/{d.vehiclesTotal} vehicles</p>
                    </div>
                    <span className="text-xs font-mono text-apex-warning">{progress.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-apex-border overflow-hidden">
                    <div className="h-full rounded-full bg-apex-warning transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-apex-border bg-apex-card p-5">
        <SectionHeader title="Deployment History" subtitle={`${filtered.length} records`} icon={Rocket} />
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
