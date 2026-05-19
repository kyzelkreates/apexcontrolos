'use client';
import React, { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/shared/SectionHeader';
import { MetricCard } from '@/components/shared/MetricCard';
import { cn } from '@/lib/utils';
import { Settings, Shield, Database, RefreshCw, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import Storage from '@/storage/storage';

export default function SettingsPage() {
  const [config, setConfig] = useState(Storage.Config.get());
  const [health, setHealth] = useState<Awaited<ReturnType<typeof Storage.Health.check>> | null>(null);
  const [storageEst, setStorageEst] = useState<{ usedMB: string; quotaMB: string; percentUsed: string } | null>(null);
  const [clearing, setClearing] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Storage.Health.check().then(setHealth);
    Storage.Health.getStorageSizeEstimate().then((e) => { if (e) setStorageEst(e); });
  }, []);

  const saveConfig = () => {
    Storage.Config.set(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const clearTelemetry = async () => {
    setClearing(true);
    const cutoff = Date.now() - 7 * 86400000;
    await Storage.Telemetry.pruneOlderThan(cutoff);
    setClearing(false);
  };

  const storeEntries = health ? (Object.entries(health.stores) as Array<[string, { ok: boolean; count: number; error?: string }]>) : [];
  const totalRecords = storeEntries.reduce((a, [, v]) => a + (v.ok ? v.count : 0), 0);

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-apex-text">System <span className="apex-gradient-text">Settings</span></h1>
        <p className="text-sm text-apex-textMuted mt-1">Configuration · Storage health · Audit · Data management</p>
      </div>

      {/* Storage Health */}
      <div className="rounded-xl border border-apex-border bg-apex-card p-5">
        <SectionHeader title="Storage Health" subtitle="IndexedDB + localStorage status" icon={Database} />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          <MetricCard title="IndexedDB" value={health?.indexedDB ? 'Online' : 'Offline'} variant={health?.indexedDB ? 'success' : 'danger'} />
          <MetricCard title="LocalStorage" value={health?.localStorage ? 'Online' : 'Offline'} variant={health?.localStorage ? 'success' : 'danger'} />
          <MetricCard title="Total Records" value={totalRecords.toLocaleString()} variant="accent" />
          {storageEst && (
            <>
              <MetricCard title="Storage Used" value={`${storageEst.usedMB} MB`} variant="default" />
              <MetricCard title="Quota" value={`${storageEst.quotaMB} MB`} variant="default" />
              <MetricCard title="Used %" value={`${storageEst.percentUsed}%`} variant={parseFloat(storageEst.percentUsed) > 80 ? 'danger' : 'success'} />
            </>
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border border-apex-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-apex-border bg-apex-surface/50">
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-apex-textMuted">Store</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-apex-textMuted">Status</th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-apex-textMuted">Records</th>
              </tr>
            </thead>
            <tbody>
              {storeEntries.map(([store, v]) => (
                <tr key={store} className="border-b border-apex-border/30">
                  <td className="px-4 py-2 font-mono text-apex-textDim">{store}</td>
                  <td className="px-4 py-2">
                    {v.ok
                      ? <span className="flex items-center gap-1 text-apex-success"><CheckCircle2 size={10} /> OK</span>
                      : <span className="flex items-center gap-1 text-apex-danger"><AlertTriangle size={10} /> Error</span>
                    }
                  </td>
                  <td className="px-4 py-2 font-mono">{v.ok ? v.count.toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Config */}
      <div className="rounded-xl border border-apex-border bg-apex-card p-5">
        <SectionHeader title="System Configuration" subtitle="Telemetry & storage settings" icon={Settings} />
        <div className="space-y-4">
          {[
            { label: 'Telemetry Batch Size', key: 'telemetryBatchSize', type: 'number', min: 10, max: 500 },
            { label: 'Flush Interval (ms)', key: 'telemetryFlushIntervalMs', type: 'number', min: 5000, max: 60000 },
            { label: 'Max Local Telemetry Events', key: 'maxLocalTelemetryEvents', type: 'number', min: 1000, max: 200000 },
            { label: 'Retention (days)', key: 'telemetryRetentionDays', type: 'number', min: 1, max: 365 },
          ].map((field) => (
            <div key={field.key} className="flex items-center justify-between">
              <label className="text-sm text-apex-textDim">{field.label}</label>
              <input
                type={field.type}
                min={field.min}
                max={field.max}
                value={(config as Record<string, unknown>)[field.key] as number}
                onChange={(e) => setConfig((c: typeof config) => ({ ...c, [field.key]: parseInt(e.target.value) }))}
                className="w-32 rounded-lg border border-apex-border bg-apex-surface px-3 py-1.5 text-sm font-mono text-apex-text focus:outline-none focus:border-apex-accent/60 text-right"
              />
            </div>
          ))}

          {[
            { label: 'Audit Logging', key: 'auditLogEnabled' },
            { label: 'Backend Migration Ready', key: 'backendMigrationReady' },
          ].map((field) => (
            <div key={field.key} className="flex items-center justify-between">
              <label className="text-sm text-apex-textDim">{field.label}</label>
              <button
                onClick={() => setConfig((c: ReturnType<typeof Storage.Config.get>) => ({ ...c, [field.key]: !(c as Record<string, unknown>)[field.key] }))}
                className={cn(
                  'w-10 h-5 rounded-full transition-colors relative flex-shrink-0',
                  (config as Record<string, unknown>)[field.key] ? 'bg-apex-success' : 'bg-apex-border'
                )}
              >
                <span className={cn(
                  'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                  (config as Record<string, unknown>)[field.key] ? 'translate-x-5' : 'translate-x-0.5'
                )} />
              </button>
            </div>
          ))}

          <button
            onClick={saveConfig}
            className={cn(
              'w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors mt-2',
              saved
                ? 'bg-apex-success/10 border border-apex-success/30 text-apex-success'
                : 'bg-apex-accent text-white hover:bg-apex-accentDim'
            )}
          >
            {saved ? '✓ Saved' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {/* Data Management */}
      <div className="rounded-xl border border-apex-warning/30 bg-apex-warning/5 p-5">
        <SectionHeader title="Data Management" subtitle="Pruning · Cleanup · Storage operations" icon={Trash2} />
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-apex-border bg-apex-card px-4 py-3">
            <div>
              <p className="text-sm font-medium text-apex-text">Prune Old Telemetry</p>
              <p className="text-xs text-apex-textMuted">Remove telemetry events older than 7 days</p>
            </div>
            <button
              onClick={clearTelemetry}
              disabled={clearing}
              className="flex items-center gap-1.5 rounded-lg border border-apex-warning/40 bg-apex-warning/10 px-3 py-1.5 text-xs font-medium text-apex-warning hover:bg-apex-warning/20 transition-colors disabled:opacity-50"
            >
              {clearing ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
              {clearing ? 'Pruning…' : 'Prune'}
            </button>
          </div>
        </div>
      </div>

      {/* Audit Log */}
      <div className="rounded-xl border border-apex-border bg-apex-card p-5">
        <SectionHeader title="Audit Log" subtitle="Last 20 system actions" icon={Shield} />
        <div className="space-y-1 max-h-64 overflow-y-auto font-mono text-xs">
          {Storage.Audit.getAll().slice(0, 20).map((entry: Record<string, unknown>) => (
            <div key={String(entry.id)} className="flex items-center gap-3 rounded bg-apex-surface px-3 py-1.5">
              <span className="text-apex-textMuted w-28 flex-shrink-0">{new Date(Number(entry.timestamp)).toLocaleTimeString()}</span>
              <span className="text-apex-accent flex-shrink-0">{String(entry.action)}</span>
              <span className="text-apex-textDim">{String(entry.entityType || '')} {entry.entityId ? String(entry.entityId).slice(0, 12) : ''}</span>
            </div>
          ))}
          {Storage.Audit.getAll().length === 0 && (
            <p className="text-center text-apex-textMuted py-4">No audit log entries</p>
          )}
        </div>
      </div>
    </div>
  );
}
