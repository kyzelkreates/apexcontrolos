'use client';
import React, { useEffect, useState } from 'react';
import { useApexStore } from '@/store/apex-store';
import { SectionHeader } from '@/components/shared/SectionHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { timeAgo, cn } from '@/lib/utils';
import { FileDown, FileText, Table2, FileCode, Download, RefreshCw } from 'lucide-react';
import {
  exportExecutiveReport, exportCSV, exportTenantReport
} from '@/lib/export-engine';
import Storage from '@/storage/storage';
import type { ExportJob } from '@/types';

const EXPORT_TYPES = [
  {
    id: 'executive_pdf',
    title: 'Executive Report',
    description: 'Full federation overview — tenants, fleets, AI & API performance (30 days)',
    format: 'pdf' as const,
    icon: FileText,
    accent: 'accent',
  },
  {
    id: 'api_usage_csv',
    title: 'API Usage Export',
    description: 'Full API call logs with costs, latency, and error rates',
    format: 'csv' as const,
    icon: Table2,
    accent: 'warning',
  },
  {
    id: 'ai_optimisation_csv',
    title: 'AI Optimisation Export',
    description: 'Inference data, model performance, cache rates, local vs cloud',
    format: 'csv' as const,
    icon: FileCode,
    accent: 'purple',
  },
  {
    id: 'fleet_performance_csv',
    title: 'Fleet Performance Export',
    description: 'Vehicle counts, uptime, heartbeat, and version data per fleet',
    format: 'csv' as const,
    icon: Table2,
    accent: 'success',
  },
  {
    id: 'operational_csv',
    title: 'Operational Metrics Export',
    description: 'Efficiency, delivery success, utilisation data per fleet',
    format: 'csv' as const,
    icon: Table2,
    accent: 'default',
  },
];

export default function ExportPage() {
  const { tenants, addAlert } = useApexStore();
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState('all');

  const loadJobs = async () => {
    const all = await Storage.Exports.getAll(30);
    setJobs(all);
  };

  useEffect(() => { loadJobs(); }, []);

  const run = async (typeId: string) => {
    setRunning(typeId);
    try {
      if (typeId === 'executive_pdf') {
        await exportExecutiveReport();
        addAlert({ type: 'success', title: 'Report Generated', message: 'Executive PDF downloaded.' });
      } else if (typeId === 'api_usage_csv') {
        await exportCSV('api_usage', selectedTenantId === 'all' ? undefined : selectedTenantId);
        addAlert({ type: 'success', title: 'Export Complete', message: 'API usage CSV downloaded.' });
      } else if (typeId === 'ai_optimisation_csv') {
        await exportCSV('ai_optimisation', selectedTenantId === 'all' ? undefined : selectedTenantId);
        addAlert({ type: 'success', title: 'Export Complete', message: 'AI optimisation CSV downloaded.' });
      } else if (typeId === 'fleet_performance_csv') {
        await exportCSV('fleet_performance', selectedTenantId === 'all' ? undefined : selectedTenantId);
        addAlert({ type: 'success', title: 'Export Complete', message: 'Fleet performance CSV downloaded.' });
      } else if (typeId === 'operational_csv') {
        await exportCSV('operational', selectedTenantId === 'all' ? undefined : selectedTenantId);
        addAlert({ type: 'success', title: 'Export Complete', message: 'Operational metrics CSV downloaded.' });
      }
    } catch {
      addAlert({ type: 'danger', title: 'Export Failed', message: 'An error occurred during export.' });
    } finally {
      setRunning(null);
      await loadJobs();
    }
  };

  const runTenantReport = async (tenantId: string) => {
    setRunning(`tenant_${tenantId}`);
    try {
      await exportTenantReport(tenantId);
      const t = tenants.find((t) => t.id === tenantId);
      addAlert({ type: 'success', title: 'Report Generated', message: `${t?.name} PDF downloaded.` });
    } catch {
      addAlert({ type: 'danger', title: 'Export Failed', message: 'Could not generate tenant report.' });
    } finally {
      setRunning(null);
      await loadJobs();
    }
  };

  const accentClass: Record<string, string> = {
    accent: 'border-apex-accent/30 bg-apex-accent/5',
    warning: 'border-apex-warning/30 bg-apex-warning/5',
    purple: 'border-apex-purple/30 bg-apex-purple/5',
    success: 'border-apex-success/30 bg-apex-success/5',
    default: 'border-apex-border bg-apex-card',
  };

  const iconAccent: Record<string, string> = {
    accent: 'text-apex-accent bg-apex-accent/10',
    warning: 'text-apex-warning bg-apex-warning/10',
    purple: 'text-apex-purple bg-apex-purple/10',
    success: 'text-apex-success bg-apex-success/10',
    default: 'text-apex-textDim bg-apex-border/50',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-apex-text">Export <span className="apex-gradient-text">Engine</span></h1>
          <p className="text-sm text-apex-textMuted mt-1">PDF reports · CSV exports · Tenant reports · Executive analytics</p>
        </div>
        <select
          value={selectedTenantId}
          onChange={(e) => setSelectedTenantId(e.target.value)}
          className="rounded-lg border border-apex-border bg-apex-surface px-3 py-1.5 text-xs text-apex-text focus:outline-none focus:border-apex-accent/60"
        >
          <option value="all">All Tenants (Global)</option>
          {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {/* Export Types */}
      <div>
        <SectionHeader title="Available Exports" subtitle="Click to generate and download" icon={FileDown} />
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {EXPORT_TYPES.map((type) => {
            const Icon = type.icon;
            const isRunning = running === type.id;
            return (
              <div key={type.id} className={cn('rounded-xl border p-4 transition-all', accentClass[type.accent])}>
                <div className="flex items-start gap-3 mb-3">
                  <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0', iconAccent[type.accent])}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-apex-text">{type.title}</p>
                    <p className="text-[11px] text-apex-textMuted mt-0.5 leading-relaxed">{type.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className={cn(
                    'rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase',
                    type.format === 'pdf' ? 'border-apex-danger/30 text-apex-danger' : 'border-apex-success/30 text-apex-success'
                  )}>
                    {type.format}
                  </span>
                  <button
                    onClick={() => run(type.id)}
                    disabled={!!running}
                    className="flex items-center gap-1.5 rounded-lg bg-apex-accent/10 border border-apex-accent/30 px-3 py-1.5 text-xs font-semibold text-apex-accent hover:bg-apex-accent/20 transition-colors disabled:opacity-50"
                  >
                    {isRunning ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
                    {isRunning ? 'Generating…' : 'Generate'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-Tenant Reports */}
      <div>
        <SectionHeader title="Tenant Reports" subtitle="Individual PDF reports per connected tenant" icon={FileText} />
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {tenants.slice(0, 12).map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-xl border border-apex-border bg-apex-card px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-apex-text truncate">{t.name}</p>
                <p className="text-[10px] text-apex-textMuted">{t.region} · {t.plan} · {t.vehicleCount} vehicles</p>
              </div>
              <button
                onClick={() => runTenantReport(t.id)}
                disabled={!!running}
                className="flex-shrink-0 flex items-center gap-1.5 rounded-lg border border-apex-border bg-apex-surface px-2.5 py-1.5 text-xs text-apex-textDim hover:text-apex-text hover:bg-apex-border/50 transition-colors disabled:opacity-50 ml-2"
              >
                {running === `tenant_${t.id}` ? <RefreshCw size={11} className="animate-spin" /> : <Download size={11} />}
                PDF
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Job History */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <SectionHeader title="Export History" subtitle="Recent export jobs" icon={FileDown} />
          <button onClick={loadJobs} className="text-xs text-apex-textMuted hover:text-apex-text flex items-center gap-1">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
        <div className="rounded-xl border border-apex-border bg-apex-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-apex-border bg-apex-surface/50">
                {['Type', 'Format', 'Status', 'Created', 'Size'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-apex-textMuted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-xs text-apex-textMuted">No exports yet</td></tr>
              )}
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-apex-border/30 hover:bg-apex-surface/30">
                  <td className="px-4 py-3 text-xs font-medium text-apex-text capitalize">{job.type?.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs uppercase text-apex-textDim">{job.format}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status === 'complete' ? 'active' : job.status === 'failed' ? 'offline' : 'pending'} />
                  </td>
                  <td className="px-4 py-3 text-xs text-apex-textMuted">{timeAgo(job.createdAt)}</td>
                  <td className="px-4 py-3 text-xs font-mono text-apex-textMuted">
                    {job.fileSize ? `${(job.fileSize / 1024).toFixed(1)} KB` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
