'use client';
import React, { useEffect, useState } from 'react';
import { SectionHeader } from '@/components/shared/SectionHeader';
import { MetricCard } from '@/components/shared/MetricCard';
import { cn } from '@/lib/utils';
import {
  Settings, Shield, Database, RefreshCw, Trash2,
  CheckCircle2, AlertTriangle, Radio, Wifi, WifiOff,
  PlusCircle, Trash, Globe, Lock,
} from 'lucide-react';
import Storage, { wipeAllData } from '@/storage/storage';
import {
  getDeploymentMode, setDeploymentMode, getLiveEndpoints, saveLiveEndpoints,
  type DeploymentSourceMode, type LiveEndpoint,
} from '@/services/deploymentProvider';
import {
  testSupabaseConnection,
  type SupabaseJob,
} from '@/services/supabaseDataService';
import { isSupabaseConfigured } from '@/lib/supabaseClient';

// ─────────────────────────────────────────────────────────────────
// DEPLOYMENT SOURCE TOGGLE — sub-component
// ─────────────────────────────────────────────────────────────────
function DeploymentSourcePanel() {
  const [mode, setMode] = useState<DeploymentSourceMode>('simulation');
  const [showLiveWarning, setShowLiveWarning] = useState(false);
  const [endpoints, setEndpoints] = useState<LiveEndpoint[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [endpointSaved, setEndpointSaved] = useState(false);

  useEffect(() => {
    setMode(getDeploymentMode());
    setEndpoints(getLiveEndpoints());
  }, []);

  const applyMode = (next: DeploymentSourceMode) => {
    setDeploymentMode(next);
    setMode(next);
    setShowLiveWarning(false);
  };

  const handleModeClick = (next: DeploymentSourceMode) => {
    if (next === 'live' && mode !== 'live') {
      setShowLiveWarning(true);
    } else {
      applyMode(next);
    }
  };

  const addEndpoint = () => {
    if (!newUrl.trim()) return;
    const ep: LiveEndpoint = {
      id: `ep_${Date.now()}`,
      label: newLabel.trim() || new URL(newUrl.trim()).hostname,
      url: newUrl.trim().replace(/\/$/, ''),
      enabled: true,
    };
    const updated = [...endpoints, ep];
    setEndpoints(updated);
    saveLiveEndpoints(updated);
    setNewUrl('');
    setNewLabel('');
    setEndpointSaved(true);
    setTimeout(() => setEndpointSaved(false), 2000);
  };

  const toggleEndpoint = (id: string) => {
    const updated = endpoints.map((e) => e.id === id ? { ...e, enabled: !e.enabled } : e);
    setEndpoints(updated);
    saveLiveEndpoints(updated);
  };

  const removeEndpoint = (id: string) => {
    const updated = endpoints.filter((e) => e.id !== id);
    setEndpoints(updated);
    saveLiveEndpoints(updated);
  };

  return (
    <div className="rounded-xl border border-apex-border bg-apex-card p-5 space-y-5">
      <SectionHeader
        title="Deployment Source"
        subtitle="Control plane data routing for AP3X Fleet dashboards"
        icon={Radio}
      />

      {/* MODE TOGGLE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* SIMULATION */}
        <button
          onClick={() => handleModeClick('simulation')}
          className={cn(
            'relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all',
            mode === 'simulation'
              ? 'border-apex-accent/60 bg-apex-accent/8 ring-1 ring-apex-accent/30'
              : 'border-apex-border bg-apex-surface hover:border-apex-accent/30'
          )}
        >
          <div className="flex items-center gap-2 w-full">
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              mode === 'simulation' ? 'bg-apex-accent/20 text-apex-accent' : 'bg-apex-border/40 text-apex-textMuted'
            )}>
              <WifiOff size={16} />
            </div>
            <div className="flex-1">
              <p className={cn('text-sm font-semibold', mode === 'simulation' ? 'text-apex-accent' : 'text-apex-text')}>
                Simulation Mode
              </p>
              <p className="text-[10px] text-apex-textMuted">Local Test Fleet</p>
            </div>
            {mode === 'simulation' && (
              <span className="flex items-center gap-1 rounded-full bg-apex-accent/15 px-2 py-0.5 text-[10px] font-semibold text-apex-accent">
                <CheckCircle2 size={9} /> ACTIVE
              </span>
            )}
          </div>
          <p className="text-[11px] text-apex-textMuted pl-10">
            Uses locally generated deployment data. Simulates fleet dashboards, nodes, and telemetry events.
            Safe for testing and development — no external connections required.
          </p>
        </button>

        {/* LIVE */}
        <button
          onClick={() => handleModeClick('live')}
          className={cn(
            'relative flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all',
            mode === 'live'
              ? 'border-apex-success/60 bg-apex-success/8 ring-1 ring-apex-success/30'
              : 'border-apex-border bg-apex-surface hover:border-apex-success/30'
          )}
        >
          <div className="flex items-center gap-2 w-full">
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              mode === 'live' ? 'bg-apex-success/20 text-apex-success' : 'bg-apex-border/40 text-apex-textMuted'
            )}>
              <Wifi size={16} />
            </div>
            <div className="flex-1">
              <p className={cn('text-sm font-semibold', mode === 'live' ? 'text-apex-success' : 'text-apex-text')}>
                Live Mode
              </p>
              <p className="text-[10px] text-apex-textMuted">Connected Dashboards</p>
            </div>
            {mode === 'live' && (
              <span className="flex items-center gap-1 rounded-full bg-apex-success/15 px-2 py-0.5 text-[10px] font-semibold text-apex-success">
                <CheckCircle2 size={9} /> ACTIVE
              </span>
            )}
          </div>
          <p className="text-[11px] text-apex-textMuted pl-10">
            Pulls real deployment status from installed AP3X Fleet Control dashboards.
            Reads external health, sync status, and telemetry reports. Unreachable nodes
            are marked offline — never removed.
          </p>
        </button>
      </div>

      {/* LIVE MODE WARNING */}
      {showLiveWarning && (
        <div className="rounded-xl border border-apex-warning/50 bg-apex-warning/8 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-apex-warning mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-apex-warning">Enable Live Mode?</p>
              <p className="text-xs text-apex-textMuted mt-1">
                Live mode connects to external AP3X Fleet Control dashboards. Ensure endpoints
                are configured below before enabling. Unreachable dashboards will be marked offline
                with safe fallback data — the system will never crash.
              </p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowLiveWarning(false)}
              className="rounded-lg border border-apex-border px-3 py-1.5 text-xs font-medium text-apex-textMuted hover:text-apex-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => applyMode('live')}
              className="rounded-lg bg-apex-success px-4 py-1.5 text-xs font-semibold text-white hover:bg-apex-success/80 transition-colors"
            >
              Enable Live Mode
            </button>
          </div>
        </div>
      )}

      {/* STATUS BADGE */}
      <div className="flex items-center gap-2 rounded-lg border border-apex-border bg-apex-surface px-4 py-2.5">
        <div className={cn(
          'h-2 w-2 rounded-full flex-shrink-0',
          mode === 'live' ? 'bg-apex-success animate-pulse' : 'bg-apex-accent'
        )} />
        <span className="text-xs text-apex-textMuted">
          Control plane is routing via{' '}
          <span className={cn('font-semibold', mode === 'live' ? 'text-apex-success' : 'text-apex-accent')}>
            {mode === 'live' ? 'Live Dashboard Network' : 'Simulation Engine'}
          </span>
          {mode === 'live' && endpoints.filter((e) => e.enabled).length > 0 && (
            <> · {endpoints.filter((e) => e.enabled).length} endpoint{endpoints.filter((e) => e.enabled).length !== 1 ? 's' : ''} active</>
          )}
          {mode === 'live' && endpoints.filter((e) => e.enabled).length === 0 && (
            <span className="text-apex-warning"> · No endpoints configured — no live data until endpoints are configured</span>
          )}
        </span>
      </div>

      {/* LIVE ENDPOINTS — only show in live mode */}
      {mode === 'live' && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-apex-textMuted flex items-center gap-1.5">
            <Globe size={11} /> AP3X Dashboard Endpoints
          </p>

          {/* Existing endpoints */}
          {endpoints.length > 0 ? (
            <div className="space-y-2">
              {endpoints.map((ep) => (
                <div key={ep.id} className="flex items-center gap-3 rounded-lg border border-apex-border bg-apex-surface px-3 py-2.5">
                  <div className={cn(
                    'h-1.5 w-1.5 rounded-full flex-shrink-0',
                    ep.enabled ? 'bg-apex-success' : 'bg-apex-textMuted'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-apex-text truncate">{ep.label}</p>
                    <p className="text-[10px] text-apex-textMuted font-mono truncate">{ep.url}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleEndpoint(ep.id)}
                      className={cn(
                        'w-8 h-4 rounded-full transition-colors relative',
                        ep.enabled ? 'bg-apex-success' : 'bg-apex-border'
                      )}
                    >
                      <span className={cn(
                        'absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform',
                        ep.enabled ? 'translate-x-4' : 'translate-x-0.5'
                      )} />
                    </button>
                    <button
                      onClick={() => removeEndpoint(ep.id)}
                      className="p-1 rounded text-apex-danger/60 hover:text-apex-danger hover:bg-apex-danger/10 transition-colors"
                    >
                      <Trash size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-apex-border px-4 py-3 text-center">
              <p className="text-xs text-apex-textMuted">No endpoints configured. Add one below.</p>
              <p className="text-[10px] text-apex-textMuted mt-0.5">System will show empty state until endpoints are configured.</p>
            </div>
          )}

          {/* Add endpoint */}
          <div className="rounded-lg border border-apex-border bg-apex-surface p-3 space-y-2">
            <p className="text-[11px] font-medium text-apex-textDim flex items-center gap-1.5">
              <Lock size={10} /> Add AP3X Dashboard Endpoint
            </p>
            <input
              type="text"
              placeholder="Label (e.g. Atlas Fleet Hub)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="w-full rounded-lg border border-apex-border bg-apex-card px-3 py-1.5 text-xs text-apex-text placeholder:text-apex-textMuted focus:outline-none focus:border-apex-accent/60"
            />
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://your-ap3x-dashboard.example.com"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEndpoint()}
                className="flex-1 rounded-lg border border-apex-border bg-apex-card px-3 py-1.5 text-xs font-mono text-apex-text placeholder:text-apex-textMuted focus:outline-none focus:border-apex-accent/60"
              />
              <button
                onClick={addEndpoint}
                disabled={!newUrl.trim()}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors flex-shrink-0',
                  endpointSaved
                    ? 'bg-apex-success/10 border border-apex-success/30 text-apex-success'
                    : 'bg-apex-accent text-white hover:bg-apex-accentDim disabled:opacity-40'
                )}
              >
                {endpointSaved ? <CheckCircle2 size={11} /> : <PlusCircle size={11} />}
                {endpointSaved ? 'Saved' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SUPABASE CREDENTIALS PANEL — sub-component
// ─────────────────────────────────────────────────────────────────
function SupabaseCredentialsPanel() {
  const [config, setConfigState] = React.useState(Storage.Config.get() as Record<string, unknown>);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{
    ok: boolean;
    tables: { name: string; reachable: boolean }[];
    error?: string;
  } | null>(null);
  const [saved, setSaved] = React.useState(false);

  const supabaseUrl     = (config.supabaseUrl as string) ?? '';
  const supabaseAnonKey = (config.supabaseAnonKey as string) ?? '';
  const configured      = supabaseUrl.trim().length > 0 && supabaseAnonKey.trim().length > 0;

  const save = () => {
    Storage.Config.set(config);
    setSaved(true);
    setTestResult(null);
    setTimeout(() => setSaved(false), 2000);
    Storage.Audit.log({
      action: 'SUPABASE_CREDENTIALS_UPDATED',
      entityType: 'system',
    });
  };

  const runTest = async () => {
    if (!configured) return;
    // Save first so the client picks up new creds
    Storage.Config.set(config);
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testSupabaseConnection();
      setTestResult(result);
    } catch {
      setTestResult({ ok: false, tables: [], error: 'Connection test failed' });
    } finally {
      setTesting(false);
    }
  };

  const TABLE_NAMES = ['jobs', 'job_assignments', 'vehicles', 'profiles', 'telemetry', 'alerts'];

  return (
    <div className="rounded-xl border border-apex-border bg-apex-card p-5 space-y-4">
      <SectionHeader
        title="Supabase Integration"
        subtitle="Connect AP3X Control OS to your Supabase project"
        icon={Database}
      />

      {/* Status badge */}
      <div className="flex items-center gap-2">
        <div className={cn(
          'h-2 w-2 rounded-full flex-shrink-0',
          configured ? 'bg-apex-success animate-pulse' : 'bg-apex-textMuted'
        )} />
        <span className="text-xs text-apex-textMuted">
          {configured
            ? <span className="text-apex-success font-medium">Credentials configured</span>
            : 'Not configured — system using IndexedDB only'}
        </span>
      </div>

      <div className="space-y-3">
        {/* Project URL */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-apex-textDim">
            Supabase Project URL
          </label>
          <input
            type="url"
            placeholder="https://xxxxxxxxxxxx.supabase.co"
            value={supabaseUrl}
            onChange={(e) =>
              setConfigState((c) => ({ ...c, supabaseUrl: e.target.value }))
            }
            className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-xs font-mono text-apex-text placeholder:text-apex-textMuted focus:outline-none focus:border-apex-accent/60"
          />
        </div>

        {/* Anon key */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-apex-textDim">
            Supabase Anon Key
          </label>
          <input
            type="password"
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            value={supabaseAnonKey}
            onChange={(e) =>
              setConfigState((c) => ({ ...c, supabaseAnonKey: e.target.value }))
            }
            className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-xs font-mono text-apex-text placeholder:text-apex-textMuted focus:outline-none focus:border-apex-accent/60"
          />
          <p className="text-[10px] text-apex-textMuted">
            Use the <span className="font-mono">anon</span> public key only. Never use the service_role key here.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={save}
            className={cn(
              'flex-1 rounded-lg px-4 py-2 text-xs font-semibold transition-colors',
              saved
                ? 'bg-apex-success/10 border border-apex-success/30 text-apex-success'
                : 'bg-apex-accent text-white hover:bg-apex-accentDim'
            )}
          >
            {saved ? '✓ Saved' : 'Save Credentials'}
          </button>
          <button
            onClick={runTest}
            disabled={!configured || testing}
            className="flex items-center gap-1.5 rounded-lg border border-apex-border px-4 py-2 text-xs font-medium text-apex-textMuted hover:text-apex-text transition-colors disabled:opacity-40"
          >
            {testing ? (
              <><RefreshCw size={11} className="animate-spin" /> Testing…</>
            ) : (
              <><CheckCircle2 size={11} /> Test Connection</>
            )}
          </button>
        </div>
      </div>

      {/* Test results */}
      {testResult && (
        <div className={cn(
          'rounded-lg border p-3 space-y-2',
          testResult.ok
            ? 'border-apex-success/30 bg-apex-success/5'
            : 'border-apex-danger/30 bg-apex-danger/5'
        )}>
          <p className={cn(
            'text-xs font-semibold flex items-center gap-1.5',
            testResult.ok ? 'text-apex-success' : 'text-apex-danger'
          )}>
            {testResult.ok
              ? <><CheckCircle2 size={12} /> Connected — Supabase responding</>
              : <><AlertTriangle size={12} /> {testResult.error ?? 'Connection failed'}</>
            }
          </p>
          {testResult.tables.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {testResult.tables.map((t) => (
                <div key={t.name} className={cn(
                  'flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-mono',
                  t.reachable
                    ? 'bg-apex-success/10 text-apex-success'
                    : 'bg-apex-danger/10 text-apex-danger'
                )}>
                  {t.reachable
                    ? <CheckCircle2 size={9} />
                    : <AlertTriangle size={9} />
                  }
                  {t.name}
                </div>
              ))}
            </div>
          )}
          {testResult.ok && (
            <p className="text-[10px] text-apex-textMuted">
              Realtime subscriptions for jobs, job_assignments, telemetry, and alerts will activate on next page load.
            </p>
          )}
        </div>
      )}

      {/* Required tables reference */}
      <div className="rounded-lg border border-apex-border bg-apex-surface px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-apex-textMuted mb-2">
          Required Supabase Tables
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TABLE_NAMES.map((t) => (
            <span key={t} className="font-mono text-[10px] rounded bg-apex-border/40 px-1.5 py-0.5 text-apex-textDim">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────
// MAIN SETTINGS PAGE
// ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [config, setConfig] = useState(Storage.Config.get());
  const [health, setHealth] = useState<Awaited<ReturnType<typeof Storage.Health.check>> | null>(null);
  const [storageEst, setStorageEst] = useState<{ usedMB: string; quotaMB: string; percentUsed: string } | null>(null);
  const [clearing, setClearing] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [wipeConfirm, setWipeConfirm] = useState(false);
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

  const handleWipeAll = async () => {
    if (!wipeConfirm) { setWipeConfirm(true); return; }
    setWiping(true);
    await wipeAllData();
    // Small delay so stores finish clearing before reload
    setTimeout(() => { window.location.reload(); }, 500);
  };

  const storeEntries = health
    ? (Object.entries(health.stores) as Array<[string, { ok: boolean; count: number; error?: string }]>)
    : [];
  const totalRecords = storeEntries.reduce((a, [, v]) => a + (v.ok ? v.count : 0), 0);

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-apex-text">
          System <span className="apex-gradient-text">Settings</span>
        </h1>
        <p className="text-sm text-apex-textMuted mt-1">
          Configuration · Deployment source · Storage health · Audit · Data management
        </p>
      </div>

      {/* ── DEPLOYMENT SOURCE TOGGLE ── */}
      <DeploymentSourcePanel />

      {/* ── SUPABASE INTEGRATION ── */}
      <SupabaseCredentialsPanel />

      {/* ── STORAGE HEALTH ── */}
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

      {/* ── SYSTEM CONFIG ── */}
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
                onChange={(e) =>
                  setConfig((c: typeof config) => ({ ...c, [field.key]: parseInt(e.target.value) }))
                }
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
                onClick={() =>
                  setConfig((c: ReturnType<typeof Storage.Config.get>) => ({
                    ...c,
                    [field.key]: !(c as Record<string, unknown>)[field.key],
                  }))
                }
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

      {/* ── DATA MANAGEMENT ── */}
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
          <div className="flex items-center justify-between rounded-lg border border-apex-danger/40 bg-apex-danger/5 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-apex-text">Wipe All Local Data</p>
              <p className="text-xs text-apex-textMuted">Permanently clears all IndexedDB stores and localStorage. App reloads clean. Supabase data is untouched.</p>
            </div>
            <button
              onClick={handleWipeAll}
              disabled={wiping}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                wipeConfirm
                  ? 'border-apex-danger bg-apex-danger text-white hover:bg-apex-danger/80'
                  : 'border-apex-danger/40 bg-apex-danger/10 text-apex-danger hover:bg-apex-danger/20'
              }`}
            >
              {wiping ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
              {wiping ? 'Wiping…' : wipeConfirm ? '⚠ Confirm — Wipe Everything' : 'Wipe All Data'}
            </button>
          </div>
        </div>
      </div>

      {/* ── AUDIT LOG ── */}
      <div className="rounded-xl border border-apex-border bg-apex-card p-5">
        <SectionHeader title="Audit Log" subtitle="Last 20 system actions" icon={Shield} />
        <div className="space-y-1 max-h-40 sm:max-h-64 overflow-y-auto font-mono text-xs">
          {Storage.Audit.getAll().slice(0, 20).map((entry: Record<string, unknown>) => (
            <div key={String(entry.id)} className="flex items-center gap-3 rounded bg-apex-surface px-3 py-1.5">
              <span className="text-apex-textMuted w-28 flex-shrink-0">
                {new Date(Number(entry.timestamp)).toLocaleTimeString()}
              </span>
              <span className="text-apex-accent flex-shrink-0">{String(entry.action)}</span>
              <span className="text-apex-textDim">
                {String(entry.entityType || '')} {entry.entityId ? String(entry.entityId).slice(0, 12) : ''}
              </span>
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
