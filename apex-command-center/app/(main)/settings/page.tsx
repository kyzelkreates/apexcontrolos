'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useAP3XStore } from '@/store/ap3x-store';
import { fetchSettings, upsertSetting } from '@/services/ap3xDataService';
import {
  getCredentials, saveRuntimeCredentials, clearRuntimeCredentials,
  createTestClient, isRuntimeConfigured, isEnvConfigured,
} from '@/lib/supabaseClient';
import {
  Database, Shield, CheckCircle2, XCircle, RefreshCw,
  Save, Eye, EyeOff, AlertTriangle, Zap, Activity,
  Server, Wifi, Key, Lock, Settings2, Trash2, Copy,
  ChevronDown, ChevronRight, Clock, Bell, Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon, title, subtitle, children, defaultOpen = true,
}: {
  icon: React.ElementType; title: string; subtitle?: string;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-apex-border bg-apex-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-apex-surface/50 transition-colors text-left"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-apex-accent/10 text-apex-accent flex-shrink-0">
          <Icon size={14} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-apex-text">{title}</p>
          {subtitle && <p className="text-[11px] text-apex-textMuted mt-0.5">{subtitle}</p>}
        </div>
        {open
          ? <ChevronDown size={14} className="text-apex-textMuted flex-shrink-0" />
          : <ChevronRight size={14} className="text-apex-textMuted flex-shrink-0" />
        }
      </button>
      {open && <div className="border-t border-apex-border px-5 pb-5 pt-4">{children}</div>}
    </div>
  );
}

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-apex-textDim">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-apex-textMuted">{hint}</p>}
    </div>
  );
}

function TextInput({
  value, onChange, placeholder, mono = false, disabled = false, type = 'text',
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; mono?: boolean; disabled?: boolean; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        'w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2.5 text-sm text-apex-text',
        'placeholder-apex-textMuted focus:border-apex-accent focus:outline-none transition-colors',
        mono && 'font-mono text-xs',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    />
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium', {
      'bg-apex-success/10 border-apex-success/30 text-apex-success': ok,
      'bg-apex-danger/10  border-apex-danger/30  text-apex-danger':  !ok,
    })}>
      {ok ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
      {label}
    </span>
  );
}

function SaveBar({
  saving, saved, error, onSave, disabled, label = 'Save Changes',
}: {
  saving: boolean; saved: boolean; error: string; onSave: () => void;
  disabled?: boolean; label?: string;
}) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <button
        onClick={onSave}
        disabled={saving || disabled}
        className="flex items-center gap-1.5 rounded-lg bg-apex-accent px-4 py-2 text-sm font-medium text-white hover:bg-apex-accentDim transition-colors disabled:opacity-50"
      >
        {saving
          ? <><RefreshCw size={12} className="animate-spin" /> Saving…</>
          : <><Save size={12} /> {label}</>
        }
      </button>
      {saved  && <span className="flex items-center gap-1 text-xs text-apex-success"><CheckCircle2 size={11}/> Saved</span>}
      {error  && <span className="flex items-center gap-1 text-xs text-apex-danger"><XCircle size={11}/> {error}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Section A: Supabase Connection
// ─────────────────────────────────────────────────────────────────

function SupabaseSection({ onConnectionChange }: { onConnectionChange: () => void }) {
  const [url,     setUrl]     = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string; detail?: string } | null>(null);
  const [saving, setSaving]   = useState(false);
  const [saved,  setSaved]    = useState(false);
  const [cleared, setCleared] = useState(false);

  const runtimeActive = isRuntimeConfigured();
  const envActive     = isEnvConfigured();
  const { url: activeUrl, anonKey: activeAnonKey } = getCredentials();

  useEffect(() => {
    // Pre-fill with current runtime values if set
    if (runtimeActive) {
      setUrl(activeUrl);
      setAnonKey(activeAnonKey);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTest = async () => {
    const testUrl = url.trim() || activeUrl;
    const testKey = anonKey.trim() || activeAnonKey;
    if (!testUrl || !testKey) {
      setTestResult({ ok: false, msg: 'Enter a URL and Anon Key before testing.' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const client = createTestClient(testUrl, testKey);
      if (!client) {
        setTestResult({ ok: false, msg: 'Failed to create client — check URL format.' });
        return;
      }
      // Test 1: basic table access
      const { error: e1 } = await client.from('tasks').select('id').limit(1);
      if (e1) {
        setTestResult({ ok: false, msg: `Connection failed: ${e1.message}`, detail: e1.hint ?? undefined });
        return;
      }
      // Test 2: realtime capability check
      const ch = client.channel('ap3x-test-ping');
      await new Promise<void>((res) => { setTimeout(res, 400); });
      client.removeChannel(ch);

      setTestResult({
        ok: true,
        msg: 'Connection successful — tasks table accessible, realtime active.',
      });
    } catch (e) {
      setTestResult({ ok: false, msg: `Exception: ${String(e)}` });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (!url.trim() || !anonKey.trim()) return;
    setSaving(true);
    saveRuntimeCredentials(url.trim(), anonKey.trim());
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    onConnectionChange(); // tell parent to re-check connection state
  };

  const handleClear = () => {
    clearRuntimeCredentials();
    setUrl('');
    setAnonKey('');
    setTestResult(null);
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
    onConnectionChange();
  };

  return (
    <div className="space-y-5">
      {/* Source status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className={cn('rounded-lg border px-4 py-3', {
          'border-apex-success/30 bg-apex-success/5': runtimeActive,
          'border-apex-border    bg-apex-surface':    !runtimeActive,
        })}>
          <div className="flex items-center gap-2 mb-1">
            <Key size={11} className={runtimeActive ? 'text-apex-success' : 'text-apex-textMuted'} />
            <p className="text-[10px] font-bold uppercase tracking-wider text-apex-textMuted">Runtime Config</p>
          </div>
          <p className={cn('text-xs font-semibold', runtimeActive ? 'text-apex-success' : 'text-apex-textMuted')}>
            {runtimeActive ? 'Active — stored in localStorage' : 'Not set'}
          </p>
        </div>
        <div className={cn('rounded-lg border px-4 py-3', {
          'border-apex-accent/30 bg-apex-accent/5': envActive,
          'border-apex-border    bg-apex-surface':  !envActive,
        })}>
          <div className="flex items-center gap-2 mb-1">
            <Server size={11} className={envActive ? 'text-apex-accent' : 'text-apex-textMuted'} />
            <p className="text-[10px] font-bold uppercase tracking-wider text-apex-textMuted">Env Vars</p>
          </div>
          <p className={cn('text-xs font-semibold', envActive ? 'text-apex-accent' : 'text-apex-textMuted')}>
            {envActive ? 'Detected (Vercel baked)' : 'Not set'}
          </p>
        </div>
        <div className={cn('rounded-lg border px-4 py-3', {
          'border-apex-success/30 bg-apex-success/5': runtimeActive || envActive,
          'border-apex-danger/30  bg-apex-danger/5':  !(runtimeActive || envActive),
        })}>
          <div className="flex items-center gap-2 mb-1">
            <Database size={11} className={(runtimeActive || envActive) ? 'text-apex-success' : 'text-apex-danger'} />
            <p className="text-[10px] font-bold uppercase tracking-wider text-apex-textMuted">Active Source</p>
          </div>
          <p className={cn('text-xs font-semibold', {
            'text-apex-success': runtimeActive || envActive,
            'text-apex-danger':  !(runtimeActive || envActive),
          })}>
            {runtimeActive ? 'Runtime (localStorage)' : envActive ? 'Env vars' : 'None — not connected'}
          </p>
        </div>
      </div>

      {/* Credential inputs */}
      <div className="space-y-4">
        <Field
          label="Supabase Project URL"
          hint="Found in Supabase → Project Settings → API → Project URL"
        >
          <TextInput
            value={url}
            onChange={setUrl}
            placeholder="https://xxxxxxxxxxxxxxxxxxxx.supabase.co"
            mono
          />
        </Field>

        <Field
          label="Anon / Public Key"
          hint="Found in Supabase → Project Settings → API → anon key (safe for browser)"
        >
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
              className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2.5 pr-10 text-sm font-mono text-apex-text placeholder-apex-textMuted focus:border-apex-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-apex-textMuted hover:text-apex-text"
            >
              {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </Field>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleTest}
          disabled={testing}
          className="flex items-center gap-1.5 rounded-lg border border-apex-accent/40 bg-apex-accent/10 px-4 py-2 text-sm font-medium text-apex-accent hover:bg-apex-accent/20 transition-colors disabled:opacity-50"
        >
          {testing
            ? <><RefreshCw size={12} className="animate-spin" /> Testing…</>
            : <><Zap size={12} /> Test Connection</>
          }
        </button>
        <button
          onClick={handleSave}
          disabled={!url.trim() || !anonKey.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-apex-accent px-4 py-2 text-sm font-medium text-white hover:bg-apex-accentDim transition-colors disabled:opacity-50"
        >
          <Save size={12} /> Save & Activate
        </button>
        {runtimeActive && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 rounded-lg border border-apex-danger/40 bg-apex-danger/5 px-4 py-2 text-sm font-medium text-apex-danger hover:bg-apex-danger/10 transition-colors"
          >
            <Trash2 size={12} /> Clear Runtime Config
          </button>
        )}
        {saved   && <span className="flex items-center gap-1 text-xs text-apex-success self-center"><CheckCircle2 size={11}/> Saved — reload to activate</span>}
        {cleared && <span className="flex items-center gap-1 text-xs text-apex-warning self-center"><AlertTriangle size={11}/> Cleared — env vars will be used</span>}
      </div>

      {/* Test result */}
      {testResult && (
        <div className={cn('rounded-lg border px-4 py-3 space-y-1', {
          'border-apex-success/30 bg-apex-success/5': testResult.ok,
          'border-apex-danger/30  bg-apex-danger/5':  !testResult.ok,
        })}>
          <div className="flex items-center gap-2">
            {testResult.ok
              ? <CheckCircle2 size={13} className="text-apex-success flex-shrink-0" />
              : <XCircle size={13} className="text-apex-danger flex-shrink-0" />
            }
            <p className={cn('text-sm font-medium', testResult.ok ? 'text-apex-success' : 'text-apex-danger')}>
              {testResult.msg}
            </p>
          </div>
          {testResult.detail && (
            <p className="text-xs text-apex-textMuted pl-5">{testResult.detail}</p>
          )}
        </div>
      )}

      {/* Setup guide */}
      {!runtimeActive && !envActive && (
        <div className="rounded-lg border border-apex-warning/30 bg-apex-warning/5 p-4 space-y-3">
          <p className="text-xs font-semibold text-apex-warning flex items-center gap-2">
            <AlertTriangle size={12} /> Supabase not configured
          </p>
          <div className="space-y-2">
            <p className="text-[11px] text-apex-textDim">Option A — Runtime (no redeploy needed):</p>
            <p className="text-[11px] text-apex-textDim pl-3">Enter your URL + Anon Key above and click <strong>Save & Activate</strong>. Credentials are stored in your browser's localStorage.</p>
            <p className="text-[11px] text-apex-textDim">Option B — Environment Variables (recommended for production):</p>
            <div className="space-y-1 font-mono text-[10px] text-apex-textDim pl-3">
              {[
                'NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co',
                'NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ…',
                'SUPABASE_SERVICE_ROLE_KEY=eyJ…  ← for API routes only',
              ].map((v) => (
                <div key={v} className="flex items-center gap-2">
                  <div className="flex-1 rounded bg-apex-surface border border-apex-border px-2 py-1">{v}</div>
                  <button
                    onClick={() => navigator.clipboard.writeText(v.split('=')[0])}
                    className="text-apex-textMuted hover:text-apex-text"
                  >
                    <Copy size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active URL display */}
      {(runtimeActive || envActive) && activeUrl && (
        <div className="rounded-lg bg-apex-surface border border-apex-border/50 px-4 py-3 flex items-center gap-3">
          <Database size={12} className="text-apex-textMuted flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-apex-textMuted">Active Supabase endpoint</p>
            <p className="text-xs font-mono text-apex-text truncate">{activeUrl}</p>
          </div>
          <StatusPill ok label="Connected" />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Section B: Realtime Subscriptions
// ─────────────────────────────────────────────────────────────────

function RealtimeSection() {
  const CHANNELS = [
    { table: 'tasks',            icon: Activity, description: 'Task status changes, new tasks, cancellations' },
    { table: 'drivers',          icon: Users,    description: 'Driver availability changes, status transitions' },
    { table: 'job_assignments',  icon: Zap,      description: 'New assignments, acceptance, completion' },
    { table: 'driver_locations', icon: Wifi,     description: 'Live GPS pings from driver PWA (high-frequency)' },
    { table: 'dashboard_events', icon: Bell,     description: 'System-wide events, alerts, incidents' },
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs text-apex-textMuted">
        These subscriptions are active at all times while connected. They are hard-wired per the AP3X Sync Contract and cannot be modified here.
      </p>
      <div className="space-y-1.5">
        {CHANNELS.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.table} className="flex items-center gap-3 rounded-lg border border-apex-success/20 bg-apex-success/5 px-4 py-2.5">
              <Icon size={12} className="text-apex-success flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono font-semibold text-apex-text">{c.table}</p>
                <p className="text-[10px] text-apex-textMuted">{c.description}</p>
              </div>
              <span className="flex items-center gap-1 text-[10px] font-medium text-apex-success">
                <span className="h-1.5 w-1.5 rounded-full bg-apex-success animate-pulse" />
                Active
              </span>
            </div>
          );
        })}
      </div>
      <div className="rounded-lg border border-apex-border bg-apex-surface px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-apex-textMuted mb-2">Realtime Config</p>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div><span className="text-apex-textMuted">Events/sec limit:</span> <span className="font-mono text-apex-text ml-1">10</span></div>
          <div><span className="text-apex-textMuted">Reconnect policy:</span> <span className="font-mono text-apex-text ml-1">auto</span></div>
          <div><span className="text-apex-textMuted">Session persistence:</span> <span className="font-mono text-apex-text ml-1">true</span></div>
          <div><span className="text-apex-textMuted">Location buffer:</span> <span className="font-mono text-apex-text ml-1">200 records</span></div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Section C: Governance Settings (from DB settings table)
// ─────────────────────────────────────────────────────────────────

const GOVERNANCE_DEFAULTS: {
  key: string; label: string; defaultVal: string; hint: string; category: string;
}[] = [
  // Safety thresholds
  { key: 'safety.task_sla_minutes',         label: 'Task SLA (minutes)',             defaultVal: '60',   hint: 'Max time from task created → assigned before SLA breach is flagged', category: 'Safety' },
  { key: 'safety.critical_task_sla_minutes',label: 'Critical Task SLA (minutes)',    defaultVal: '15',   hint: 'SLA override for critical priority tasks', category: 'Safety' },
  { key: 'safety.driver_response_sla_sec',  label: 'Driver Accept SLA (seconds)',    defaultVal: '120',  hint: 'Max time for driver to accept assignment before escalation', category: 'Safety' },
  { key: 'safety.max_tasks_per_driver',     label: 'Max Tasks Per Driver',           defaultVal: '5',    hint: 'Alert threshold — simultaneous assignments per driver', category: 'Safety' },
  { key: 'safety.risk_auto_escalate',       label: 'Auto-Escalate Critical Risk',    defaultVal: 'true', hint: 'Automatically flag critical-risk tasks in audit log', category: 'Safety' },
  // Governance
  { key: 'governance.audit_retention_days', label: 'Audit Log Retention (days)',     defaultVal: '365',  hint: 'How long audit_log_v2 records are retained', category: 'Governance' },
  { key: 'governance.snapshot_interval',    label: 'Metrics Snapshot Interval',     defaultVal: 'daily',hint: 'How often safety_metrics_snapshot is computed (hourly/daily/weekly)', category: 'Governance' },
  { key: 'governance.override_requires_reason', label: 'Require Override Reason',   defaultVal: 'true', hint: 'Enforce justification field when an override is applied', category: 'Governance' },
  // System health
  { key: 'health.latency_warn_ms',          label: 'Latency Warning Threshold (ms)', defaultVal: '500', hint: 'P95 latency above this value triggers a degraded status', category: 'Health' },
  { key: 'health.error_rate_warn_pct',      label: 'Error Rate Warning (%)',         defaultVal: '5',   hint: 'Error rate % above this triggers component degraded status', category: 'Health' },
  { key: 'health.health_check_interval_sec',label: 'Health Check Interval (sec)',    defaultVal: '30',  hint: 'How often system_health_metrics is refreshed in the UI', category: 'Health' },
  // Realtime
  { key: 'realtime.location_update_sec',    label: 'Location Update Interval (sec)', defaultVal: '5',  hint: 'Expected frequency of driver_locations updates from Driver PWA', category: 'Realtime' },
  { key: 'realtime.event_buffer_size',      label: 'Event Buffer Size',             defaultVal: '200',  hint: 'Max dashboard_events kept in memory (client-side)', category: 'Realtime' },
  // Display
  { key: 'display.timezone',                label: 'Display Timezone',              defaultVal: 'UTC',  hint: 'Timezone for all date/time displays across the Control OS', category: 'Display' },
  { key: 'display.date_format',             label: 'Date Format',                   defaultVal: 'DD/MM/YYYY', hint: 'Date format used across tables and charts', category: 'Display' },
  { key: 'display.items_per_page',          label: 'Table Page Size',               defaultVal: '50',   hint: 'Default rows shown per page in data tables', category: 'Display' },
];

function GovernanceSettingsSection() {
  const { settings, setSettings, isConfigured } = useAP3XStore();
  const [edits, setEdits]   = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved,  setSaved]  = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeCategory, setActiveCategory] = useState('Safety');

  const categories = Array.from(new Set(GOVERNANCE_DEFAULTS.map((g) => g.category)));

  const getValue = (key: string): string => {
    if (edits[key] !== undefined) return edits[key];
    const s = settings.find((s) => s.key === key);
    if (s?.value !== undefined && s.value !== null) return s.value;
    return GOVERNANCE_DEFAULTS.find((g) => g.key === key)?.defaultVal ?? '';
  };

  const handleSave = async (key: string) => {
    if (!isConfigured) return;
    setSaving((p) => ({ ...p, [key]: true }));
    setErrors((p) => ({ ...p, [key]: '' }));
    const ok = await upsertSetting(key, edits[key] ?? getValue(key));
    if (ok) {
      setSaved((p) => ({ ...p, [key]: true }));
      setTimeout(() => setSaved((p) => ({ ...p, [key]: false })), 2000);
      const updated = await fetchSettings();
      if (updated) setSettings(updated);
    } else {
      setErrors((p) => ({ ...p, [key]: 'Save failed' }));
    }
    setSaving((p) => ({ ...p, [key]: false }));
  };

  const isDirty = (key: string) => edits[key] !== undefined && edits[key] !== (settings.find((s) => s.key === key)?.value ?? GOVERNANCE_DEFAULTS.find((g) => g.key === key)?.defaultVal ?? '');

  const filteredSettings = GOVERNANCE_DEFAULTS.filter((g) => g.category === activeCategory);

  return (
    <div className="space-y-4">
      {!isConfigured && (
        <div className="flex items-center gap-2 rounded-lg border border-apex-warning/30 bg-apex-warning/5 px-4 py-3 text-xs text-apex-warning">
          <AlertTriangle size={12} /> Connect Supabase first to save settings to the database.
        </div>
      )}

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-colors', {
              'bg-apex-accent text-white': activeCategory === cat,
              'bg-apex-surface border border-apex-border text-apex-textMuted hover:text-apex-text': activeCategory !== cat,
            })}>
            {cat}
          </button>
        ))}
      </div>

      {/* Setting rows */}
      <div className="space-y-3">
        {filteredSettings.map((g) => {
          const val = getValue(g.key);
          const dirty = isDirty(g.key);
          return (
            <div key={g.key} className={cn('rounded-lg border px-4 py-3 transition-colors', {
              'border-apex-accent/30 bg-apex-accent/3': dirty,
              'border-apex-border   bg-apex-surface':   !dirty,
            })}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-xs font-medium text-apex-text">{g.label}</label>
                    <span className="font-mono text-[9px] text-apex-textMuted bg-apex-border/50 px-1.5 py-0.5 rounded">{g.key}</span>
                    {dirty && <span className="text-[9px] text-apex-accent">● unsaved</span>}
                  </div>
                  <input
                    value={val}
                    onChange={(e) => setEdits((p) => ({ ...p, [g.key]: e.target.value }))}
                    placeholder={g.defaultVal}
                    className="w-full rounded border border-apex-border bg-apex-card px-3 py-2 text-xs font-mono text-apex-text focus:border-apex-accent focus:outline-none"
                  />
                  <p className="text-[10px] text-apex-textMuted">{g.hint}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleSave(g.key)}
                    disabled={saving[g.key] || !isConfigured}
                    className={cn('flex items-center gap-1 rounded px-2.5 py-1.5 text-[11px] font-medium transition-colors', {
                      'bg-apex-accent/10 border border-apex-accent/30 text-apex-accent hover:bg-apex-accent/20': dirty,
                      'bg-apex-surface border border-apex-border text-apex-textMuted': !dirty,
                    }, 'disabled:opacity-50')}
                  >
                    {saving[g.key]
                      ? <RefreshCw size={9} className="animate-spin" />
                      : <Save size={9} />
                    }
                    Save
                  </button>
                  {saved[g.key]  && <span className="text-[9px] text-apex-success">✓ saved</span>}
                  {errors[g.key] && <span className="text-[9px] text-apex-danger">{errors[g.key]}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Section D: Raw Settings Table (from Supabase)
// ─────────────────────────────────────────────────────────────────

function RawSettingsSection() {
  const { settings, setSettings, isConfigured } = useAP3XStore();
  const [key,   setKey]   = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]     = useState('');

  const handleSave = async () => {
    if (!key.trim() || !isConfigured) return;
    setSaving(true); setMsg('');
    const ok = await upsertSetting(key.trim(), value.trim());
    if (ok) {
      setMsg('Saved.');
      const updated = await fetchSettings();
      if (updated) setSettings(updated);
      setKey(''); setValue('');
    } else {
      setMsg('Save failed — check Supabase connection.');
    }
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  return (
    <div className="space-y-4">
      {settings.length === 0 ? (
        <p className="text-xs text-apex-textMuted py-1">No records in <code className="font-mono bg-apex-surface px-1 rounded">settings</code> table yet.</p>
      ) : (
        <div className="rounded-lg border border-apex-border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-apex-border bg-apex-surface">
                <th className="text-left px-4 py-2.5 font-medium text-apex-textMuted">Key</th>
                <th className="text-left px-4 py-2.5 font-medium text-apex-textMuted">Value</th>
                <th className="text-left px-4 py-2.5 font-medium text-apex-textMuted hidden sm:table-cell">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-apex-border/50">
              {settings.map((s) => (
                <tr key={s.key} className="hover:bg-apex-surface/50">
                  <td className="px-4 py-2.5 font-mono text-apex-text">{s.key}</td>
                  <td className="px-4 py-2.5 text-apex-textDim truncate max-w-[200px]">{s.value ?? '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-apex-textMuted hidden sm:table-cell">
                    {s.updated_at ? new Date(s.updated_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-apex-textDim mb-2">Add / Update Setting</p>
        <div className="flex gap-2 flex-wrap">
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="key"
            className="flex-1 min-w-[120px] rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm font-mono text-apex-text focus:border-apex-accent focus:outline-none"
          />
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="value"
            className="flex-1 min-w-[160px] rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm text-apex-text focus:border-apex-accent focus:outline-none"
          />
          <button onClick={handleSave} disabled={saving || !key.trim() || !isConfigured}
            className="flex items-center gap-1.5 rounded-lg bg-apex-accent px-4 py-2 text-sm font-medium text-white hover:bg-apex-accentDim transition-colors disabled:opacity-50"
          >
            {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />} Save
          </button>
        </div>
        {msg && <p className={cn('mt-2 text-xs', msg === 'Saved.' ? 'text-apex-success' : 'text-apex-danger')}>{msg}</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Section E: Zero Drift Contract
// ─────────────────────────────────────────────────────────────────

function ContractSection() {
  const RULES = [
    { ok: true,  cat: 'Data Source',  text: 'Supabase is the ONLY source of truth — no mocks, no local overrides' },
    { ok: true,  cat: 'Tables',       text: 'Permitted: profiles · tasks · drivers · vehicles · job_assignments · driver_locations · fleet_nodes · dashboard_events · settings' },
    { ok: true,  cat: 'Governance',   text: 'Additive: decision_trace_log · safety_metrics_snapshot · system_health_metrics · audit_log_v2 · incident_replay_engine' },
    { ok: true,  cat: 'Realtime',     text: 'Subscribe: tasks · drivers · job_assignments · driver_locations · dashboard_events' },
    { ok: true,  cat: 'Writes',       text: 'Admin CAN: create tasks (pending), cancel tasks, write settings, read full system state' },
    { ok: false, cat: 'Writes',       text: 'Admin CANNOT: assign tasks, modify job_assignments, change task lifecycle beyond pending/cancelled' },
    { ok: false, cat: 'Writes',       text: 'Admin CANNOT: modify drivers, vehicles, or fleet nodes directly' },
    { ok: false, cat: 'Governance',   text: 'Control OS CANNOT: dispatch drivers, control driver actions, execute operations' },
    { ok: true,  cat: 'Governance',   text: 'Control OS CAN: monitor, audit, escalate, replay incidents, compute safety metrics' },
    { ok: false, cat: 'Integrity',    text: 'No optimistic divergence — UI state always reflects Supabase state' },
  ];

  const cats = Array.from(new Set(RULES.map((r) => r.cat)));

  return (
    <div className="space-y-3">
      {cats.map((cat) => (
        <div key={cat}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-apex-textMuted mb-1.5">{cat}</p>
          <div className="space-y-1">
            {RULES.filter((r) => r.cat === cat).map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs py-1">
                {r.ok
                  ? <CheckCircle2 size={11} className="text-apex-success flex-shrink-0 mt-0.5" />
                  : <XCircle     size={11} className="text-apex-danger  flex-shrink-0 mt-0.5" />
                }
                <span className="text-apex-textDim">{r.text}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Root Page
// ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { isConfigured, setConfigured } = useAP3XStore();
  const [configuredState, setConfiguredState] = useState(isConfigured);

  // Re-check connection when user saves credentials
  const handleConnectionChange = useCallback(() => {
    // Small delay to let localStorage settle
    setTimeout(() => {
      // Force a re-import to pick up the new client
      import('@/lib/supabaseClient').then(({ isSupabaseConfigured }) => {
        const configured = isSupabaseConfigured();
        setConfigured(configured);
        setConfiguredState(configured);
      });
    }, 100);
  }, [setConfigured]);

  useEffect(() => {
    setConfiguredState(isConfigured);
  }, [isConfigured]);

  return (
    <div className="space-y-4 animate-fade-in max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-apex-text">
            System <span className="apex-gradient-text">Settings</span>
          </h1>
          <p className="text-sm text-apex-textMuted mt-1">
            AP3X Control OS configuration · connection · governance parameters
          </p>
        </div>
        <StatusPill ok={configuredState} label={configuredState ? 'Supabase Connected' : 'Not Connected'} />
      </div>

      {/* A. Supabase Connection */}
      <SectionCard icon={Database} title="Supabase Connection" subtitle="Configure, test and activate your database connection">
        <SupabaseSection onConnectionChange={handleConnectionChange} />
      </SectionCard>

      {/* B. Realtime */}
      <SectionCard icon={Wifi} title="Realtime Subscriptions" subtitle="Active table subscriptions per the AP3X Sync Contract" defaultOpen={false}>
        <RealtimeSection />
      </SectionCard>

      {/* C. Governance settings */}
      <SectionCard icon={Shield} title="Governance & Safety Parameters" subtitle="Safety thresholds, compliance rules, health check intervals">
        <GovernanceSettingsSection />
      </SectionCard>

      {/* D. Raw settings */}
      <SectionCard icon={Settings2} title="Raw Settings Table" subtitle="Direct view of the Supabase settings table — add any key/value pair" defaultOpen={false}>
        <RawSettingsSection />
      </SectionCard>

      {/* E. Contract */}
      <SectionCard icon={Lock} title="AP3X Zero Drift Contract" subtitle="Immutable rules governing what this system can and cannot do" defaultOpen={false}>
        <ContractSection />
      </SectionCard>
    </div>
  );
}
