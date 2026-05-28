'use client';
import React, { useState } from 'react';
import { Settings, Database, Shield, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { SectionHeader } from '@/components/shared/SectionHeader';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { getSupabaseClient } from '@/lib/supabaseClient';

export default function SettingsPage() {
  const configured = isSupabaseConfigured();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const client = getSupabaseClient();
      if (!client) { setTestResult({ ok: false, message: 'Supabase not configured — env vars missing.' }); return; }
      const { error } = await client.from('tasks').select('id').limit(1);
      if (error) setTestResult({ ok: false, message: `Connection failed: ${error.message}` });
      else setTestResult({ ok: true, message: 'Connected to Supabase successfully.' });
    } catch (e) {
      setTestResult({ ok: false, message: `Exception: ${String(e)}` });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-apex-text">
          System <span className="apex-gradient-text">Settings</span>
        </h1>
        <p className="text-sm text-apex-textMuted mt-1">AP3X Control Dashboard configuration</p>
      </div>

      {/* Supabase status */}
      <div className="rounded-xl border border-apex-border bg-apex-card p-5">
        <SectionHeader title="Supabase Connection" subtitle="Single source of truth" icon={Database} />
        <div className="space-y-4 mt-4">
          <div className="flex items-center justify-between rounded-lg border border-apex-border bg-apex-surface px-4 py-3">
            <div className="flex items-center gap-2">
              {configured
                ? <CheckCircle2 size={14} className="text-apex-success" />
                : <XCircle size={14} className="text-apex-danger" />
              }
              <div>
                <p className="text-sm font-medium text-apex-text">
                  {configured ? 'Configured' : 'Not configured'}
                </p>
                <p className="text-xs text-apex-textMuted mt-0.5">
                  {configured
                    ? 'NEXT_PUBLIC_SUPABASE_URL and ANON_KEY are set'
                    : 'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel'}
                </p>
              </div>
            </div>
            <button
              onClick={testConnection}
              disabled={testing || !configured}
              className="flex items-center gap-1.5 rounded-lg border border-apex-accent/40 bg-apex-accent/10 px-3 py-1.5 text-xs font-medium text-apex-accent hover:bg-apex-accent/20 transition-colors disabled:opacity-50"
            >
              {testing ? <RefreshCw size={11} className="animate-spin" /> : <Database size={11} />}
              {testing ? 'Testing…' : 'Test'}
            </button>
          </div>
          {testResult && (
            <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
              testResult.ok ? 'border-apex-success/30 bg-apex-success/5 text-apex-success' : 'border-apex-danger/30 bg-apex-danger/5 text-apex-danger'
            }`}>
              {testResult.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
              {testResult.message}
            </div>
          )}
        </div>
      </div>

      {/* Contract summary */}
      <div className="rounded-xl border border-apex-border bg-apex-card p-5">
        <SectionHeader title="System Contract" subtitle="AP3X Sync Rules" icon={Shield} />
        <div className="mt-4 space-y-2 text-xs">
          {[
            { ok: true,  text: 'Supabase is the only source of truth' },
            { ok: true,  text: 'Data: profiles · tasks · drivers · vehicles · job_assignments · driver_locations' },
            { ok: true,  text: 'Realtime subscriptions: tasks · drivers · driver_locations' },
            { ok: true,  text: 'Admin can create and cancel tasks' },
            { ok: false, text: 'Admin CANNOT assign drivers to tasks (dispatcher logic)' },
            { ok: false, text: 'Admin CANNOT modify job_assignments' },
            { ok: false, text: 'No mock data · No IndexedDB · No fallbacks' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-apex-textDim">
              {item.ok
                ? <CheckCircle2 size={12} className="text-apex-success flex-shrink-0" />
                : <XCircle size={12} className="text-apex-danger flex-shrink-0" />
              }
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Environment variables guide */}
      {!configured && (
        <div className="rounded-xl border border-apex-warning/30 bg-apex-warning/5 p-5">
          <p className="text-sm font-semibold text-apex-warning mb-3">Setup Required</p>
          <p className="text-xs text-apex-textDim mb-3">Add these to your Vercel project environment variables:</p>
          <div className="space-y-2 font-mono text-xs">
            {[
              'NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co',
              'NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs…',
            ].map((v) => (
              <div key={v} className="rounded-lg bg-apex-surface border border-apex-border px-3 py-2 text-apex-textDim">
                {v}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
