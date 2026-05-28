'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useAP3XStore } from '@/store/ap3x-store';
import {
  fetchTenantsWithFleets, fetchPairingCodes,
  registerFleetByCode, updateTenantStatus, deleteTenant,
  revokeFederation, generateAndIssuePairingCode, regeneratePairingCode,
  validateCodeFormat, sanitizePairingCode,
} from '@/services/federationService';
import type { TenantWithFleets, PairingCode, TenantPlan } from '@/types/federation';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { MetricCard } from '@/components/shared/MetricCard';
import { NoDataBanner } from '@/components/shared/NoDataBanner';
import {
  Building2, Plus, RefreshCw, Copy, CheckCircle2, Trash2,
  ChevronDown, ChevronUp, Wifi, WifiOff, Shield, X,
  AlertTriangle, Leaf, Key, Clock, RotateCcw, Ban,
  Activity, Zap, Users, Truck, Search, Eye, EyeOff,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function timeLeft(iso: string): { label: string; urgent: boolean } {
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return { label: 'Expired', urgent: true };
  const m = Math.floor(diffMs / 60000);
  if (m < 5)  return { label: `${m}m left`, urgent: true };
  if (m < 60) return { label: `${m}m left`, urgent: false };
  return { label: `${Math.floor(m / 60)}h left`, urgent: false };
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="flex items-center gap-1 text-apex-textMuted hover:text-apex-accent transition-colors">
      {copied ? <CheckCircle2 size={11} className="text-apex-success" /> : <Copy size={11} />}
      {label && <span className="text-[10px]">{copied ? 'Copied' : label}</span>}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// PAIRING CODE DISPLAY
// ─────────────────────────────────────────────────────────────────

const CODE_STATUS_STYLES: Record<string, string> = {
  pending: 'border-apex-accent/30  bg-apex-accent/5  text-apex-accent',
  used:    'border-apex-success/30 bg-apex-success/5 text-apex-success',
  expired: 'border-apex-border     bg-apex-surface   text-apex-textMuted',
  locked:  'border-apex-danger/30  bg-apex-danger/5  text-apex-danger',
};

function PairingCodeRow({
  pc, onRegenerate,
}: {
  pc: PairingCode;
  onRegenerate: (id: string) => void;
}) {
  const ttl = timeLeft(pc.expires_at);
  const [regen, setRegen] = useState(false);

  const handleRegen = async () => {
    if (!confirm('Expire this code and generate a new one?')) return;
    setRegen(true);
    await onRegenerate(pc.id);
    setRegen(false);
  };

  return (
    <div className={cn('flex items-center gap-3 rounded-lg border px-4 py-3', CODE_STATUS_STYLES[pc.status] ?? CODE_STATUS_STYLES.expired)}>
      {/* Code */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-bold tracking-widest">{pc.code}</span>
          {pc.status === 'pending' && <CopyButton text={pc.code} />}
        </div>
        <div className="flex items-center gap-3 mt-1 text-[10px] text-apex-textMuted flex-wrap">
          <span>Created {timeAgo(pc.created_at)}</span>
          {pc.attempts > 0 && (
            <span className={cn('flex items-center gap-0.5', pc.attempts >= 5 ? 'text-apex-danger' : 'text-apex-warning')}>
              <AlertTriangle size={8} /> {pc.attempts} attempt{pc.attempts !== 1 ? 's' : ''}
            </span>
          )}
          {pc.paired_at && <span className="text-apex-success">Paired {timeAgo(pc.paired_at)}</span>}
        </div>
      </div>

      {/* Status + TTL */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold capitalize', {
          'bg-apex-accent/15  text-apex-accent':  pc.status === 'pending',
          'bg-apex-success/15 text-apex-success': pc.status === 'used',
          'bg-apex-border     text-apex-textMuted': pc.status === 'expired',
          'bg-apex-danger/15  text-apex-danger':  pc.status === 'locked',
        })}>
          {pc.status}
        </span>
        {pc.status === 'pending' && (
          <span className={cn('text-[10px] font-mono', ttl.urgent ? 'text-apex-danger' : 'text-apex-textMuted')}>
            <Clock size={8} className="inline mr-0.5" />{ttl.label}
          </span>
        )}
      </div>

      {/* Regenerate */}
      {pc.status === 'pending' && (
        <button onClick={handleRegen} disabled={regen}
          className="flex items-center gap-1 rounded border border-apex-border px-2 py-1 text-[10px] text-apex-textMuted hover:text-apex-accent hover:border-apex-accent/30 transition-colors disabled:opacity-50 flex-shrink-0">
          {regen ? <RefreshCw size={9} className="animate-spin" /> : <RotateCcw size={9} />} Regen
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// GENERATE CODE PANEL
// ─────────────────────────────────────────────────────────────────

function GenerateCodePanel({ onGenerated }: { onGenerated: () => void }) {
  const [ttl, setTtl]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<PairingCode | null>(null);
  const [error, setError]     = useState('');
  const [shown, setShown]     = useState(false);

  const handleGenerate = async () => {
    setLoading(true); setError(''); setResult(null);
    const res = await generateAndIssuePairingCode(ttl);
    setLoading(false);
    if ('error' in res) { setError(res.error); return; }
    setResult(res.code);
    setShown(true);
    onGenerated();
  };

  return (
    <div className="rounded-xl border border-apex-accent/20 bg-apex-accent/3 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Key size={14} className="text-apex-accent" />
        <p className="text-sm font-semibold text-apex-text">Generate Pairing Code</p>
        <p className="text-[10px] text-apex-textMuted ml-1">Control OS is the authoritative issuer</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <label className="block text-[10px] text-apex-textMuted mb-1">TTL (hours)</label>
          <select value={ttl} onChange={(e) => setTtl(Number(e.target.value))}
            className="rounded-lg border border-apex-border bg-apex-surface px-3 py-1.5 text-sm text-apex-text focus:border-apex-accent focus:outline-none">
            {[0.25, 0.5, 1, 2, 4, 8, 24].map((h) => (
              <option key={h} value={h}>{h < 1 ? `${h * 60}min` : `${h}h`}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-[10px] text-apex-textMuted mb-1">&nbsp;</label>
          <button onClick={handleGenerate} disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-apex-accent px-5 py-2 text-sm font-medium text-white hover:bg-apex-accentDim transition-colors disabled:opacity-50">
            {loading ? <><RefreshCw size={12} className="animate-spin" /> Generating…</> : <><Key size={12} /> Generate Code</>}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-apex-danger">
          <AlertTriangle size={12} /> {error}
        </div>
      )}

      {result && (
        <div className="rounded-xl border-2 border-apex-accent/40 bg-apex-accent/5 p-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-apex-accent">New Pairing Code — Share with Fleet</p>
          <div className="flex items-center gap-3 flex-wrap">
            <div className={cn('flex-1 font-mono text-xl font-bold tracking-[0.2em] text-apex-accent py-2',
              shown ? '' : 'blur-sm select-none')}>
              {result.code}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => setShown(!shown)}
                className="flex items-center gap-1 rounded border border-apex-border px-2 py-1 text-[10px] text-apex-textMuted hover:text-apex-text">
                {shown ? <EyeOff size={10} /> : <Eye size={10} />} {shown ? 'Hide' : 'Reveal'}
              </button>
              <CopyButton text={result.code} label="Copy" />
            </div>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-apex-textMuted">
            <span><Clock size={8} className="inline mr-0.5" /> Expires {new Date(result.expires_at).toLocaleTimeString()}</span>
            <span>Valid for {ttl < 1 ? `${ttl * 60}min` : `${ttl}h`}</span>
            <span>Attempts allowed: 5</span>
          </div>
          <p className="text-[10px] text-apex-textMuted italic">
            Give this code to the Fleet Control OS operator. They enter it in Fleet OS → Federation → Register.
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// REGISTER FLEET MODAL (incoming code from Fleet OS)
// ─────────────────────────────────────────────────────────────────

function RegisterFleetModal({ onClose, onRegistered }: {
  onClose: () => void; onRegistered: () => void;
}) {
  const [step, setStep]     = useState<'code' | 'details' | 'done'>('code');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [result, setResult] = useState<{ pairingToken: string; tenantId: string; fleetId: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [form, setForm] = useState({
    code:             '',
    tenantName:       '',
    contactEmail:     '',
    plan:             'starter' as TenantPlan,
    region:           '',
    fleetName:        '',
    commandCenterUrl: typeof window !== 'undefined' ? window.location.origin : '',
  });

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tenantName.trim() || !form.fleetName.trim()) {
      setError('Tenant name and fleet name are required.'); return;
    }
    setSaving(true); setError('');
    const res = await registerFleetByCode(form);
    setSaving(false);
    if ('error' in res) { setError(res.error); return; }
    setResult({ pairingToken: res.pairingToken, tenantId: res.tenant.id, fleetId: res.fleet.id });
    setStep('done');
    onRegistered();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-xl border border-apex-border bg-apex-card shadow-apex-card">
        <div className="flex items-center justify-between border-b border-apex-border px-5 py-4">
          <h2 className="text-sm font-semibold text-apex-text">Register Fleet (Incoming Code)</h2>
          <button onClick={onClose}><X size={16} className="text-apex-textMuted hover:text-apex-text" /></button>
        </div>

        {step === 'code' && (
          <div className="p-5 space-y-4">
            <p className="text-xs text-apex-textDim">
              Enter the <span className="font-mono text-apex-accent">APEX-XXXXXXXX-XXXX-FC</span> code
              from Fleet Control OS, or one generated above.
            </p>
            <div>
              <label className="block text-xs text-apex-textMuted mb-1.5">Pairing Code</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: sanitizePairingCode(e.target.value) })}
                className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2.5 font-mono text-sm text-apex-accent placeholder-apex-textMuted focus:border-apex-accent focus:outline-none tracking-widest"
                placeholder="APEX-3A7F2C1B-9D4E-FC"
                autoFocus
              />
            </div>
            {error && <p className="text-xs text-apex-danger flex items-center gap-1"><AlertTriangle size={11} />{error}</p>}
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-lg border border-apex-border px-4 py-2 text-sm text-apex-textMuted hover:bg-apex-border/30 transition-colors">Cancel</button>
              <button
                onClick={() => {
                  if (!form.code.trim()) { setError('Enter a code first.'); return; }
                  if (!validateCodeFormat(form.code)) {
                    setError('Invalid format. Expected: APEX-XXXXXXXX-XXXX-FC'); return;
                  }
                  setError(''); setStep('details');
                }}
                className="flex-1 rounded-lg bg-apex-accent px-4 py-2 text-sm font-medium text-white hover:bg-apex-accentDim transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {step === 'details' && (
          <form onSubmit={handleRegister} className="p-5 space-y-4">
            <div className="rounded-lg bg-apex-surface border border-apex-accent/20 px-3 py-2 font-mono text-xs text-apex-accent tracking-widest">
              {form.code}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-apex-textMuted mb-1.5">Company / Tenant Name *</label>
                <input value={form.tenantName} onChange={(e) => setForm({ ...form, tenantName: e.target.value })}
                  className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm text-apex-text focus:border-apex-accent focus:outline-none"
                  placeholder="Acme Logistics Ltd" required />
              </div>
              <div>
                <label className="block text-xs text-apex-textMuted mb-1.5">Contact Email</label>
                <input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  type="email"
                  className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm text-apex-text focus:border-apex-accent focus:outline-none"
                  placeholder="ops@acme.com" />
              </div>
              <div>
                <label className="block text-xs text-apex-textMuted mb-1.5">Plan</label>
                <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value as TenantPlan })}
                  className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm text-apex-text focus:border-apex-accent focus:outline-none">
                  <option value="starter">Starter</option>
                  <option value="growth">Growth</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-apex-textMuted mb-1.5">Region</label>
                <input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}
                  className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm text-apex-text focus:border-apex-accent focus:outline-none"
                  placeholder="EU, NA, APAC…" />
              </div>
              <div>
                <label className="block text-xs text-apex-textMuted mb-1.5">Fleet Name *</label>
                <input value={form.fleetName} onChange={(e) => setForm({ ...form, fleetName: e.target.value })}
                  className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm text-apex-text focus:border-apex-accent focus:outline-none"
                  placeholder="Acme Main Fleet" required />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-apex-textMuted mb-1.5">Command Center URL</label>
                <input value={form.commandCenterUrl} onChange={(e) => setForm({ ...form, commandCenterUrl: e.target.value })}
                  className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm font-mono text-apex-text focus:border-apex-accent focus:outline-none"
                  placeholder="https://your-apex-cc.vercel.app" />
              </div>
            </div>
            {error && <p className="text-xs text-apex-danger flex items-center gap-1"><AlertTriangle size={11} />{error}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep('code')}
                className="flex-1 rounded-lg border border-apex-border px-4 py-2 text-sm text-apex-textMuted hover:bg-apex-border/30 transition-colors">
                ← Back
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-apex-accent px-4 py-2 text-sm font-medium text-white hover:bg-apex-accentDim transition-colors disabled:opacity-50">
                {saving ? <><RefreshCw size={12} className="animate-spin" /> Registering…</> : 'Register Fleet'}
              </button>
            </div>
          </form>
        )}

        {step === 'done' && result && (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-2 text-apex-success">
              <CheckCircle2 size={18} />
              <p className="font-semibold text-sm">Fleet registered successfully!</p>
            </div>
            <p className="text-xs text-apex-textDim">Copy these back into Fleet Control OS → Federation → Manual Pairing, or they auto-detect via the pairing-status poll.</p>
            {[
              { label: 'Tenant ID',     value: result.tenantId,     key: 'tid' },
              { label: 'Fleet ID',      value: result.fleetId,      key: 'fid' },
              { label: 'Pairing Token', value: result.pairingToken, key: 'pt' },
            ].map((row) => (
              <div key={row.key} className="rounded-lg border border-apex-border bg-apex-surface px-3 py-2.5">
                <p className="text-[10px] text-apex-textMuted mb-1">{row.label}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-apex-accent truncate">{row.value}</span>
                  <button onClick={() => copy(row.value, row.key)}
                    className="flex items-center gap-1 text-apex-textMuted hover:text-apex-accent transition-colors flex-shrink-0">
                    {copied === row.key ? <CheckCircle2 size={12} className="text-apex-success" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            ))}
            <button onClick={onClose}
              className="w-full rounded-lg bg-apex-success/10 border border-apex-success/30 px-4 py-2 text-sm text-apex-success hover:bg-apex-success/20 transition-colors">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// FLEET CARD (active tenant)
// ─────────────────────────────────────────────────────────────────

function TenantCard({
  tenant, onRefresh,
}: {
  tenant: TenantWithFleets;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded]   = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirm, setConfirm]     = useState<'revoke' | 'delete' | null>(null);
  const [error, setError]         = useState('');

  const isOnline = tenant.fleets.some((f) => f.status === 'online');
  const hbAge    = tenant.latest_heartbeat
    ? Date.now() - new Date(tenant.latest_heartbeat.received_at).getTime()
    : null;
  const hbFresh  = hbAge !== null && hbAge < 5 * 60 * 1000; // < 5 min

  const handleRevoke = async () => {
    if (!tenant.fleets.length) return;
    setActionLoading(true); setError('');
    const res = await revokeFederation(tenant.id, tenant.fleets[0].id);
    setActionLoading(false);
    setConfirm(null);
    if ('error' in res) { setError(res.error); return; }
    onRefresh();
  };

  const handleDelete = async () => {
    setActionLoading(true); setError('');
    const ok = await deleteTenant(tenant.id);
    setActionLoading(false);
    setConfirm(null);
    if (!ok) { setError('Delete failed — check Supabase connection.'); return; }
    onRefresh();
  };

  const handleToggleStatus = async () => {
    const next = tenant.status === 'active' ? 'suspended' : 'active';
    setActionLoading(true);
    await updateTenantStatus(tenant.id, next);
    setActionLoading(false);
    onRefresh();
  };

  return (
    <div className={cn('rounded-xl border bg-apex-card transition-all', {
      'border-apex-success/30': tenant.status === 'active' && isOnline,
      'border-apex-warning/30': tenant.status === 'suspended',
      'border-apex-border':     tenant.status === 'pending' || (!isOnline && tenant.status === 'active'),
    })}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className={cn('h-8 w-8 flex-shrink-0 rounded-lg flex items-center justify-center text-xs font-bold', {
          'bg-apex-success/10 text-apex-success': tenant.status === 'active' && isOnline,
          'bg-apex-warning/10 text-apex-warning': tenant.status === 'suspended',
          'bg-apex-surface    text-apex-textMuted': !isOnline,
        })}>
          {tenant.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-apex-text truncate">{tenant.name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <StatusBadge status={tenant.status} />
            <span className={cn('flex items-center gap-1 text-[10px]',
              hbFresh ? 'text-apex-success' : 'text-apex-textMuted')}>
              {hbFresh ? <Wifi size={9} /> : <WifiOff size={9} />}
              {tenant.latest_heartbeat ? timeAgo(tenant.latest_heartbeat.received_at) : 'No heartbeat'}
            </span>
            <span className="text-[10px] text-apex-textMuted capitalize">{tenant.plan}</span>
            {tenant.region && <span className="text-[10px] text-apex-textMuted">{tenant.region}</span>}
          </div>
        </div>
        {/* Quick stats */}
        <div className="hidden sm:flex items-center gap-4 text-[10px] text-apex-textMuted flex-shrink-0">
          <span className="flex items-center gap-1"><Truck size={9} /> {tenant.total_vehicles}</span>
          <span className="flex items-center gap-1"><Users size={9} /> {tenant.total_drivers}</span>
          <span className="flex items-center gap-1"><Activity size={9} /> {tenant.total_routes}</span>
        </div>
        {expanded ? <ChevronUp size={14} className="text-apex-textMuted flex-shrink-0" /> : <ChevronDown size={14} className="text-apex-textMuted flex-shrink-0" />}
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-apex-border px-4 py-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-apex-danger/30 bg-apex-danger/5 px-3 py-2 text-xs text-apex-danger">
              <AlertTriangle size={11} /> {error}
            </div>
          )}

          {/* Fleets */}
          {tenant.fleets.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-apex-textMuted mb-2">Linked Fleets</p>
              <div className="space-y-2">
                {tenant.fleets.map((fleet) => (
                  <div key={fleet.id} className="rounded-lg border border-apex-border bg-apex-surface px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-apex-text">{fleet.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <StatusBadge status={fleet.status} />
                          {fleet.version && <span className="text-[10px] text-apex-textMuted font-mono">v{fleet.version}</span>}
                          {fleet.last_heartbeat && <span className="text-[10px] text-apex-textMuted">{timeAgo(fleet.last_heartbeat)}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 text-[10px] text-apex-textMuted">
                        <span>{fleet.active_vehicles}/{fleet.vehicle_count} vehicles</span>
                        <span>{fleet.active_drivers}/{fleet.driver_count} drivers</span>
                        <span>{fleet.uptime_percent}% uptime</span>
                      </div>
                    </div>
                    {fleet.command_center_url && (
                      <p className="text-[10px] font-mono text-apex-textMuted mt-2 truncate">{fleet.command_center_url}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] text-apex-textMuted">Token:</span>
                      <span className="font-mono text-[10px] text-apex-textDim">{fleet.pairing_token.slice(0, 12)}…</span>
                      <CopyButton text={fleet.pairing_token} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Vehicles',  value: tenant.total_vehicles },
              { label: 'Drivers',   value: tenant.total_drivers },
              { label: 'Routes',    value: tenant.total_routes },
              { label: 'CO₂ Saved', value: `${tenant.total_co2_saved_kg.toFixed(1)}kg` },
            ].map((m) => (
              <div key={m.label} className="rounded-lg bg-apex-surface border border-apex-border/50 px-3 py-2 text-center">
                <p className="text-xs font-bold font-mono text-apex-text">{m.value}</p>
                <p className="text-[10px] text-apex-textMuted">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          {confirm === null ? (
            <div className="flex flex-wrap gap-2">
              <button onClick={handleToggleStatus} disabled={actionLoading}
                className={cn('flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50', {
                  'border-apex-warning/30 bg-apex-warning/5 text-apex-warning hover:bg-apex-warning/10': tenant.status === 'active',
                  'border-apex-success/30 bg-apex-success/5 text-apex-success hover:bg-apex-success/10': tenant.status === 'suspended',
                })}>
                {actionLoading ? <RefreshCw size={10} className="animate-spin" /> : tenant.status === 'active' ? <Ban size={10} /> : <CheckCircle2 size={10} />}
                {tenant.status === 'active' ? 'Suspend' : 'Reactivate'}
              </button>
              <button onClick={() => setConfirm('revoke')} disabled={actionLoading || !tenant.fleets.length}
                className="flex items-center gap-1.5 rounded-lg border border-apex-danger/30 bg-apex-danger/5 px-3 py-1.5 text-xs font-medium text-apex-danger hover:bg-apex-danger/10 transition-colors disabled:opacity-50">
                <Shield size={10} /> Revoke Federation
              </button>
              <button onClick={() => setConfirm('delete')} disabled={actionLoading}
                className="flex items-center gap-1.5 rounded-lg border border-apex-border px-3 py-1.5 text-xs font-medium text-apex-textMuted hover:text-apex-danger hover:border-apex-danger/30 transition-colors disabled:opacity-50">
                <Trash2 size={10} /> Delete
              </button>
            </div>
          ) : (
            <div className={cn('rounded-lg border px-4 py-3 space-y-2', {
              'border-apex-danger/30 bg-apex-danger/5': confirm === 'delete',
              'border-apex-warning/30 bg-apex-warning/5': confirm === 'revoke',
            })}>
              <p className="text-xs font-semibold text-apex-text flex items-center gap-2">
                <AlertTriangle size={12} className={confirm === 'delete' ? 'text-apex-danger' : 'text-apex-warning'} />
                {confirm === 'revoke'
                  ? 'Revoke federation — suspends tenant, offlines fleet, expires all pending codes. Records preserved.'
                  : 'Permanently delete tenant + all associated data. This cannot be undone.'
                }
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirm(null)}
                  className="flex-1 rounded border border-apex-border px-3 py-1.5 text-xs text-apex-textMuted hover:bg-apex-border/30">
                  Cancel
                </button>
                <button
                  onClick={confirm === 'revoke' ? handleRevoke : handleDelete}
                  disabled={actionLoading}
                  className="flex-1 flex items-center justify-center gap-1 rounded border border-apex-danger/40 bg-apex-danger/10 px-3 py-1.5 text-xs font-medium text-apex-danger hover:bg-apex-danger/20 disabled:opacity-50">
                  {actionLoading ? <RefreshCw size={10} className="animate-spin" /> : <AlertTriangle size={10} />}
                  Confirm
                </button>
              </div>
            </div>
          )}

          <p className="text-[10px] font-mono text-apex-textMuted">
            ID: {tenant.id} · Registered: {new Date(tenant.registered_at).toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PAIRING CODES PANEL
// ─────────────────────────────────────────────────────────────────

function PairingCodesPanel() {
  const { pairingCodes, setPairingCodes, isConfigured } = useAP3XStore();
  const [filter, setFilter] = useState<'all' | 'pending' | 'used' | 'expired' | 'locked'>('all');
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!isConfigured) return;
    setLoading(true);
    const codes = await fetchPairingCodes({ limit: 200 });
    if (codes) setPairingCodes(codes);
    setLoading(false);
  };

  const handleRegenerate = async (oldId: string) => {
    const res = await regeneratePairingCode(oldId);
    if ('error' in res) { alert(res.error); return; }
    await refresh();
  };

  const filtered = useMemo(() => {
    if (filter === 'all') return pairingCodes;
    return pairingCodes.filter((c) => c.status === filter);
  }, [pairingCodes, filter]);

  const counts = useMemo(() => ({
    all:     pairingCodes.length,
    pending: pairingCodes.filter((c) => c.status === 'pending').length,
    used:    pairingCodes.filter((c) => c.status === 'used').length,
    expired: pairingCodes.filter((c) => c.status === 'expired').length,
    locked:  pairingCodes.filter((c) => c.status === 'locked').length,
  }), [pairingCodes]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {(['all','pending','used','expired','locked'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('rounded-full px-3 py-1 text-xs font-medium transition-colors capitalize', {
                'bg-apex-accent text-white': filter === f,
                'bg-apex-card border border-apex-border text-apex-textMuted hover:text-apex-text': filter !== f,
              })}>
              {f} {counts[f] > 0 && <span className="ml-1 opacity-70">{counts[f]}</span>}
            </button>
          ))}
        </div>
        <button onClick={refresh} disabled={loading}
          className="flex items-center gap-1 text-xs text-apex-textMuted hover:text-apex-text transition-colors">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Failed attempts alert */}
      {counts.locked > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-apex-danger/30 bg-apex-danger/5 px-4 py-2.5 text-xs text-apex-danger">
          <AlertTriangle size={12} />
          <span><strong>{counts.locked}</strong> code{counts.locked !== 1 ? 's' : ''} locked due to too many failed attempts. Regenerate to issue a fresh code.</span>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-apex-textMuted text-xs">
          {pairingCodes.length === 0 ? 'No pairing codes yet. Generate one above.' : 'No codes match this filter.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((pc) => (
            <PairingCodeRow key={pc.id} pc={pc} onRegenerate={handleRegenerate} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ROOT PAGE
// ─────────────────────────────────────────────────────────────────

export default function TenantsPage() {
  const { tenantsWithFleets, setTenantsWithFleets, pairingCodes, setPairingCodes, isConfigured, isLoading } = useAP3XStore();
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'pending'>('all');
  const [showRegister, setShowRegister] = useState(false);
  const [refreshing, setRefreshing]     = useState(false);
  const [activeTab, setActiveTab]       = useState<'fleets' | 'codes'>('fleets');

  const refresh = useCallback(async () => {
    if (!isConfigured) return;
    setRefreshing(true);
    const [tenants, codes] = await Promise.all([
      fetchTenantsWithFleets(),
      fetchPairingCodes({ limit: 200 }),
    ]);
    if (tenants) setTenantsWithFleets(tenants);
    if (codes)   setPairingCodes(codes);
    setRefreshing(false);
  }, [isConfigured, setTenantsWithFleets, setPairingCodes]);

  // Derive filtered tenant list
  const filtered = useMemo(() => tenantsWithFleets.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.name.toLowerCase().includes(q) ||
        (t.contact_email ?? '').toLowerCase().includes(q) ||
        (t.region ?? '').toLowerCase().includes(q) ||
        t.fleets.some((f) => f.name.toLowerCase().includes(q));
    }
    return true;
  }), [tenantsWithFleets, statusFilter, search]);

  // KPIs
  const pendingCodes  = pairingCodes.filter((c) => c.status === 'pending').length;
  const lockedCodes   = pairingCodes.filter((c) => c.status === 'locked').length;
  const activeFleets  = tenantsWithFleets.filter((t) => t.status === 'active').length;
  const totalVehicles = tenantsWithFleets.reduce((s, t) => s + t.total_vehicles, 0);

  if (!isConfigured) return <NoDataBanner reason="not_configured" />;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-apex-text">
            Federation <span className="apex-gradient-text">Management</span>
          </h1>
          <p className="text-sm text-apex-textMuted mt-1">
            Pairing codes · active fleets · registration health · revocation
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={refresh} disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-apex-border bg-apex-card px-3 py-2 text-xs text-apex-textMuted hover:text-apex-text transition-colors">
            <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={() => setShowRegister(true)}
            className="flex items-center gap-2 rounded-lg bg-apex-accent px-4 py-2 text-sm font-medium text-white hover:bg-apex-accentDim transition-colors">
            <Plus size={14} /> Register Fleet
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Active Fleets"    value={activeFleets}   subtitle={`${tenantsWithFleets.length} total`}     icon={Building2} variant="success" loading={isLoading} />
        <MetricCard title="Pending Codes"    value={pendingCodes}   subtitle="Awaiting fleet pairing"                  icon={Key}       variant={pendingCodes > 0 ? 'accent' : 'default'} loading={isLoading} />
        <MetricCard title="Locked Codes"     value={lockedCodes}    subtitle="Failed attempts ≥ 5"                     icon={AlertTriangle} variant={lockedCodes > 0 ? 'danger' : 'default'} loading={isLoading} />
        <MetricCard title="Total Vehicles"   value={totalVehicles}  subtitle="Across all active fleets"                icon={Truck}     variant="purple" loading={isLoading} />
      </div>

      {/* Generate panel */}
      <GenerateCodePanel onGenerated={() => fetchPairingCodes({ limit: 200 }).then((c) => { if (c) setPairingCodes(c); })} />

      {/* Tabs */}
      <div className="flex border-b border-apex-border">
        {([
          { key: 'fleets', label: `Active Fleets (${tenantsWithFleets.length})` },
          { key: 'codes',  label: `Pairing Codes (${pairingCodes.length})` },
        ] as const).map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn('py-3 px-5 text-xs font-medium border-b-2 transition-colors', {
              'border-apex-accent text-apex-accent': activeTab === tab.key,
              'border-transparent text-apex-textMuted hover:text-apex-text': activeTab !== tab.key,
            })}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Fleets tab */}
      {activeTab === 'fleets' && (
        <div className="space-y-3">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-apex-textMuted" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tenants, fleets, region…"
                className="w-full rounded-lg border border-apex-border bg-apex-card pl-8 pr-3 py-2 text-sm text-apex-text placeholder-apex-textMuted focus:border-apex-accent focus:outline-none"
              />
            </div>
            {(['all','active','suspended','pending'] as const).map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn('rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors', {
                  'bg-apex-accent text-white': statusFilter === s,
                  'bg-apex-card border border-apex-border text-apex-textMuted hover:text-apex-text': statusFilter !== s,
                })}>
                {s}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-apex-textMuted">
              <Building2 size={36} className="opacity-20" />
              <p className="text-sm">
                {tenantsWithFleets.length === 0
                  ? 'No fleets registered yet. Generate a pairing code above, then register the fleet.'
                  : 'No fleets match your filters.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((t) => (
                <TenantCard key={t.id} tenant={t} onRefresh={refresh} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pairing codes tab */}
      {activeTab === 'codes' && <PairingCodesPanel />}

      {/* Register modal */}
      {showRegister && (
        <RegisterFleetModal
          onClose={() => setShowRegister(false)}
          onRegistered={refresh}
        />
      )}
    </div>
  );
}
