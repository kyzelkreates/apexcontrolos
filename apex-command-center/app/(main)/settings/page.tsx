'use client';
import React, { useState, useEffect } from 'react';
import { useAP3XStore } from '@/store/ap3x-store';
import { fetchSettings, upsertSetting } from '@/services/ap3xDataService';
import { isSupabaseConfigured, getSupabaseClient } from '@/lib/supabaseClient';
import {
  Settings, Database, Shield, CheckCircle2, XCircle,
  RefreshCw, Save, AlertTriangle,
} from 'lucide-react';

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-apex-border/50 last:border-0">
      <p className="text-xs text-apex-textMuted">{label}</p>
      <p className={`text-xs text-apex-text ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

export default function SettingsPage() {
  const { settings, setSettings } = useAP3XStore();
  const configured = isSupabaseConfigured();

  const [testing, setTesting]     = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [editKey, setEditKey]     = useState('');
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState('');

  // Contract rules listed here
  const CONTRACT = [
    { ok: true,  text: 'Supabase is the ONLY source of truth' },
    { ok: true,  text: 'Tables: profiles · tasks · drivers · vehicles · job_assignments · driver_locations · fleet_nodes · dashboard_events · settings' },
    { ok: true,  text: 'Realtime: tasks · drivers · job_assignments · driver_locations · dashboard_events' },
    { ok: true,  text: 'Admin CAN create tasks (status: pending only)' },
    { ok: true,  text: 'Admin CAN cancel tasks' },
    { ok: true,  text: 'Admin CAN read full system state' },
    { ok: false, text: 'Admin CANNOT assign drivers to tasks' },
    { ok: false, text: 'Admin CANNOT modify job_assignments' },
    { ok: false, text: 'Admin CANNOT change task lifecycle beyond pending/cancelled' },
    { ok: false, text: 'Admin CANNOT modify drivers, vehicles, or fleet nodes' },
    { ok: false, text: 'No mock data · No local state overrides · No optimistic divergence' },
  ];

  const testConnection = async () => {
    setTesting(true); setTestResult(null);
    try {
      const client = getSupabaseClient();
      if (!client) { setTestResult({ ok: false, msg: 'Not configured — env vars missing.' }); return; }
      const { error } = await client.from('tasks').select('id').limit(1);
      if (error) setTestResult({ ok: false, msg: `Error: ${error.message}` });
      else setTestResult({ ok: true, msg: 'Connected to Supabase successfully.' });
    } catch (e) {
      setTestResult({ ok: false, msg: `Exception: ${String(e)}` });
    } finally {
      setTesting(false); }
  };

  const handleSaveSetting = async () => {
    if (!editKey.trim()) return;
    setSaving(true); setSaveMsg('');
    const ok = await upsertSetting(editKey.trim(), editValue.trim());
    if (ok) {
      setSaveMsg('Saved.');
      // Refresh settings
      const updated = await fetchSettings();
      if (updated) setSettings(updated);
      setEditKey(''); setEditValue('');
    } else {
      setSaveMsg('Failed to save.');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-apex-text">
          System <span className="apex-gradient-text">Settings</span>
        </h1>
        <p className="text-sm text-apex-textMuted mt-1">AP3X Control Dashboard configuration</p>
      </div>

      {/* Supabase connection */}
      <div className="rounded-xl border border-apex-border bg-apex-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Database size={14} className="text-apex-accent" />
          <p className="text-sm font-semibold text-apex-text">Supabase Connection</p>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-apex-border bg-apex-surface px-4 py-3 mb-3">
          <div className="flex items-center gap-2">
            {configured
              ? <CheckCircle2 size={14} className="text-apex-success" />
              : <XCircle size={14} className="text-apex-danger" />}
            <div>
              <p className="text-sm font-medium text-apex-text">{configured ? 'Configured' : 'Not configured'}</p>
              <p className="text-xs text-apex-textMuted mt-0.5">
                {configured
                  ? 'NEXT_PUBLIC_SUPABASE_URL and ANON_KEY detected'
                  : 'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'}
              </p>
            </div>
          </div>
          <button onClick={testConnection} disabled={testing || !configured}
            className="flex items-center gap-1.5 rounded-lg border border-apex-accent/40 bg-apex-accent/10 px-3 py-1.5 text-xs font-medium text-apex-accent hover:bg-apex-accent/20 transition-colors disabled:opacity-50">
            {testing ? <RefreshCw size={11} className="animate-spin" /> : <Database size={11} />}
            {testing ? 'Testing…' : 'Test'}
          </button>
        </div>
        {testResult && (
          <div className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs ${
            testResult.ok ? 'border-apex-success/30 bg-apex-success/5 text-apex-success' : 'border-apex-danger/30 bg-apex-danger/5 text-apex-danger'
          }`}>
            {testResult.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
            {testResult.msg}
          </div>
        )}
        {!configured && (
          <div className="mt-3 rounded-lg border border-apex-warning/30 bg-apex-warning/5 p-4">
            <p className="text-xs font-medium text-apex-warning mb-2">Required Vercel env vars:</p>
            <div className="space-y-1.5 font-mono text-[11px] text-apex-textDim">
              {[
                'NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co',
                'NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ…',
                'SUPABASE_SERVICE_ROLE_KEY=eyJ… (for API routes)',
              ].map((v) => (
                <div key={v} className="rounded-lg bg-apex-surface border border-apex-border px-3 py-1.5">{v}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* System settings from DB */}
      {configured && (
        <div className="rounded-xl border border-apex-border bg-apex-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings size={14} className="text-apex-accent" />
            <p className="text-sm font-semibold text-apex-text">System Settings</p>
            <p className="text-xs text-apex-textMuted ml-1">from <span className="font-mono">settings</span> table</p>
          </div>
          {settings.length === 0 ? (
            <p className="text-xs text-apex-textMuted py-2">No settings records in Supabase yet.</p>
          ) : (
            <div className="rounded-lg bg-apex-surface border border-apex-border/50 px-4 py-1 mb-4">
              {settings.map((s) => (
                <Row key={s.key} label={s.key} value={s.value ?? '—'} mono />
              ))}
            </div>
          )}
          {/* Upsert setting */}
          <p className="text-xs font-medium text-apex-textDim mb-3">Add / Update Setting</p>
          <div className="flex gap-2 flex-wrap">
            <input value={editKey} onChange={(e) => setEditKey(e.target.value)}
              placeholder="Key"
              className="flex-1 min-w-[120px] rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm font-mono text-apex-text focus:border-apex-accent focus:outline-none"
            />
            <input value={editValue} onChange={(e) => setEditValue(e.target.value)}
              placeholder="Value"
              className="flex-1 min-w-[160px] rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm text-apex-text focus:border-apex-accent focus:outline-none"
            />
            <button onClick={handleSaveSetting} disabled={saving || !editKey.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-apex-accent px-4 py-2 text-sm font-medium text-white hover:bg-apex-accentDim transition-colors disabled:opacity-50">
              {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
              Save
            </button>
          </div>
          {saveMsg && <p className={`mt-2 text-xs ${saveMsg === 'Saved.' ? 'text-apex-success' : 'text-apex-danger'}`}>{saveMsg}</p>}
        </div>
      )}

      {/* System contract */}
      <div className="rounded-xl border border-apex-border bg-apex-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={14} className="text-apex-accent" />
          <p className="text-sm font-semibold text-apex-text">AP3X Zero Drift Contract</p>
        </div>
        <div className="space-y-2">
          {CONTRACT.map((c, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              {c.ok
                ? <CheckCircle2 size={12} className="text-apex-success flex-shrink-0 mt-0.5" />
                : <XCircle size={12} className="text-apex-danger flex-shrink-0 mt-0.5" />}
              <span className="text-apex-textDim">{c.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
