'use client';

/**
 * APEX COMMAND CENTER OS
 * app/(main)/tenants/page.tsx
 *
 * Fleet Entity Registration & Tenant Management
 * UI style mirrors Fleet Control OS Federation page — dark code blocks,
 * 5-char registration codes, copy buttons, entity IDs, connection status.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useApexStore } from '@/store/apex-store';
import { SectionHeader } from '@/components/shared/SectionHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { MetricCard } from '@/components/shared/MetricCard';
import {
  Building2, Plus, Search, Globe, Truck, Users,
  Shield, AlertTriangle, X, CheckCircle2, RefreshCw,
  Copy, Check, Wifi, WifiOff, Activity, ChevronRight,
  Key, Hash, Clock, Zap, Brain, Link2, MoreHorizontal,
  Unlink2, Ban, RotateCcw,
} from 'lucide-react';
import { formatNumber, timeAgo, regionLabel, cn } from '@/lib/utils';
import { completePairing, initiatePairing, suspendTenant, reactivateTenant } from '@/lib/pairing-engine';
import type { Tenant, FleetEntity, RegionCode } from '@/types';
import { v4 as uuid } from 'uuid';

// ── Copy-to-clipboard hook ────────────────────────────────────────────────────
function useCopy(timeout = 1800) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), timeout);
  }, [timeout]);
  return { copied, copy };
}

// ── Tiny copy button ─────────────────────────────────────────────────────────
function CopyBtn({ value, label, className }: { value: string; label?: string; className?: string }) {
  const { copied, copy } = useCopy();
  const key = `btn_${value.slice(0, 8)}`;
  return (
    <button
      onClick={() => copy(value, key)}
      title={`Copy ${label || value}`}
      className={cn(
        'flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium border transition-colors',
        copied === key
          ? 'border-apex-success/40 bg-apex-success/10 text-apex-success'
          : 'border-apex-border bg-apex-surface text-apex-textMuted hover:text-apex-text hover:border-apex-accent/40',
        className
      )}
    >
      {copied === key ? <Check size={10} /> : <Copy size={10} />}
      {label && <span>{copied === key ? 'Copied' : label}</span>}
    </button>
  );
}

// ── Generate 5-char human-readable registration code (like Fleet Control OS) ──
function generateRegistrationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ─── Pairing Modal ────────────────────────────────────────────────────────────
function PairingModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [code, setCode] = useState('');
  const [registrationId, setRegistrationId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pairedData, setPairedData] = useState<{ tenantId: string; fleetId: string; token: string } | null>(null);
  const [details, setDetails] = useState({
    companyName: '',
    region: 'EU' as RegionCode,
    contactEmail: '',
    fleetName: '',
    vehicleCount: 50,
    plan: 'growth' as 'starter' | 'growth' | 'enterprise',
  });
  const { addTenant, addFleet, addAlert } = useApexStore();

  const handleInitiate = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await initiatePairing(code);
      if (!res.success) { setError(res.error || 'Validation failed'); return; }
      setRegistrationId(res.registrationId!);
      setStep(2);
    } finally { setLoading(false); }
  };

  const handleComplete = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await completePairing(registrationId, details);
      if (!res.success) { setError(res.error || 'Registration failed'); return; }
      const Storage = (await import('@/storage/storage')).default;
      const tenant = await Storage.Tenants.get(res.tenantId!);
      const fleet = await Storage.Fleets.get(res.fleetId!);
      if (tenant) addTenant(tenant);
      if (fleet) addFleet(fleet);
      addAlert({ type: 'success', title: 'Fleet Paired', message: `${details.companyName} connected successfully.` });
      setPairedData({ tenantId: res.tenantId!, fleetId: res.fleetId!, token: res.pairingToken! });
      setStep(3);
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-apex-border bg-apex-card shadow-apex-card animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-apex-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-apex-accent/10">
              <Shield size={14} className="text-apex-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-apex-text">Register Fleet Entity</p>
              <p className="text-[10px] text-apex-textMuted">Enter your Fleet Control OS pairing code</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-apex-textMuted hover:text-apex-text hover:bg-apex-border/50 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 border-b border-apex-border">
          {[
            { n: 1, label: 'Enter Code' },
            { n: 2, label: 'Fleet Details' },
            { n: 3, label: 'Connected' },
          ].map((s, i) => (
            <React.Fragment key={s.n}>
              <div className={cn(
                'flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors',
                step === s.n ? 'text-apex-accent border-b-2 border-apex-accent' : step > s.n ? 'text-apex-success' : 'text-apex-textMuted'
              )}>
                <div className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                  step === s.n ? 'bg-apex-accent text-white' : step > s.n ? 'bg-apex-success text-white' : 'bg-apex-border text-apex-textMuted'
                )}>
                  {step > s.n ? <Check size={10} /> : s.n}
                </div>
                {s.label}
              </div>
              {i < 2 && <div className="w-px h-8 bg-apex-border" />}
            </React.Fragment>
          ))}
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* ── Step 1: Enter code ─────────────────────────────────── */}
          {step === 1 && (
            <>
              <div className="rounded-xl border border-apex-border bg-apex-bg p-4 space-y-3">
                <p className="text-[10px] uppercase tracking-wider text-apex-textMuted font-medium">
                  Registration Code
                </p>
                <p className="text-xs text-apex-textDim leading-relaxed">
                  Open your Fleet Control OS → Settings → Federation to find your registration code.
                  Enter it below to link this fleet to Apex Command Center.
                </p>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9\-]/g, ''))}
                  placeholder="APEX-XXXXXXXX-XXXX-CC"
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full rounded-lg border border-apex-border bg-apex-surface px-4 py-3 font-mono text-base tracking-widest text-apex-text placeholder:text-apex-textMuted/50 focus:outline-none focus:border-apex-accent/70 transition-colors text-center"
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-apex-danger/30 bg-apex-danger/5 px-3 py-2.5 text-xs text-apex-danger">
                  <AlertTriangle size={12} />
                  {error}
                </div>
              )}
              <button
                onClick={handleInitiate}
                disabled={loading || code.length < 8}
                className="w-full rounded-lg bg-apex-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-apex-accentDim disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <RefreshCw size={14} className="animate-spin" /> Validating…
                  </span>
                ) : 'Validate Code →'}
              </button>
            </>
          )}

          {/* ── Step 2: Fleet details ──────────────────────────────── */}
          {step === 2 && (
            <>
              <div className="rounded-xl border border-apex-border/50 bg-apex-bg px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check size={13} className="text-apex-success" />
                  <span className="text-xs text-apex-success font-medium">Code validated</span>
                </div>
                <span className="font-mono text-[10px] text-apex-textMuted">{code}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Company Name', key: 'companyName', type: 'text', placeholder: 'Apex Logistics Ltd', span: 2 },
                  { label: 'Contact Email', key: 'contactEmail', type: 'email', placeholder: 'admin@company.com', span: 2 },
                  { label: 'Fleet Name', key: 'fleetName', type: 'text', placeholder: 'Main Fleet', span: 1 },
                  { label: 'Vehicle Count', key: 'vehicleCount', type: 'number', placeholder: '50', span: 1 },
                ].map((field) => (
                  <div key={field.key} className={`col-span-${field.span}`}>
                    <label className="block text-[10px] font-medium text-apex-textDim uppercase tracking-wider mb-1.5">
                      {field.label}
                    </label>
                    <input
                      type={field.type}
                      placeholder={field.placeholder}
                      value={(details as Record<string, unknown>)[field.key] as string}
                      onChange={(e) => setDetails((d) => ({
                        ...d,
                        [field.key]: field.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value,
                      }))}
                      className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm text-apex-text placeholder:text-apex-textMuted/50 focus:outline-none focus:border-apex-accent/60 transition-colors"
                    />
                  </div>
                ))}

                <div>
                  <label className="block text-[10px] font-medium text-apex-textDim uppercase tracking-wider mb-1.5">Region</label>
                  <select
                    value={details.region}
                    onChange={(e) => setDetails((d) => ({ ...d, region: e.target.value as RegionCode }))}
                    className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm text-apex-text focus:outline-none focus:border-apex-accent/60"
                  >
                    {['NA', 'EU', 'APAC', 'LATAM', 'MEA'].map((r) => (
                      <option key={r} value={r}>{regionLabel(r)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-apex-textDim uppercase tracking-wider mb-1.5">Plan</label>
                  <select
                    value={details.plan}
                    onChange={(e) => setDetails((d) => ({ ...d, plan: e.target.value as 'starter' | 'growth' | 'enterprise' }))}
                    className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm text-apex-text focus:outline-none focus:border-apex-accent/60"
                  >
                    <option value="starter">Starter</option>
                    <option value="growth">Growth</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-apex-danger/30 bg-apex-danger/5 px-3 py-2.5 text-xs text-apex-danger">
                  <AlertTriangle size={12} /> {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 rounded-lg border border-apex-border px-4 py-2.5 text-sm font-medium text-apex-textMuted hover:text-apex-text hover:border-apex-accent/40 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleComplete}
                  disabled={loading || !details.companyName}
                  className="flex-1 rounded-lg bg-apex-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-apex-accentDim disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <RefreshCw size={14} className="animate-spin" /> Registering…
                    </span>
                  ) : 'Complete Registration →'}
                </button>
              </div>
            </>
          )}

          {/* ── Step 3: Success ────────────────────────────────────── */}
          {step === 3 && pairedData && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-apex-success/10 ring-1 ring-apex-success/30">
                  <CheckCircle2 size={28} className="text-apex-success" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-apex-text text-base">{details.companyName}</p>
                  <p className="text-xs text-apex-success mt-0.5">Fleet entity registered · Telemetry link active</p>
                </div>
              </div>

              {/* Entity IDs — matching Fleet Control OS style */}
              <div className="rounded-xl border border-apex-border bg-apex-bg p-4 space-y-2.5">
                <p className="text-[10px] uppercase tracking-wider text-apex-textMuted font-medium mb-3">Entity Identifiers</p>
                {[
                  { label: 'Tenant ID', value: pairedData.tenantId },
                  { label: 'Fleet Entity ID', value: pairedData.fleetId },
                  { label: 'Pairing Token', value: pairedData.token },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3">
                    <span className="text-[10px] text-apex-textMuted w-24 flex-shrink-0">{item.label}</span>
                    <span className="font-mono text-[10px] text-apex-textDim truncate flex-1">{item.value}</span>
                    <CopyBtn value={item.value} label="Copy" />
                  </div>
                ))}
              </div>

              <button
                onClick={() => { onSuccess(); onClose(); }}
                className="w-full rounded-lg bg-apex-success/10 border border-apex-success/30 px-4 py-2.5 text-sm font-semibold text-apex-success hover:bg-apex-success/20 transition-colors"
              >
                View Dashboard →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Fleet Registration Code Card (mirrors Fleet Control OS Federation UI) ────
function RegistrationCodeCard({ tenant, fleet }: { tenant: Tenant; fleet?: FleetEntity }) {
  const [regCode, setRegCode] = useState(() => generateRegistrationCode());
  const { copy, copied } = useCopy();

  const regenerate = () => setRegCode(generateRegistrationCode());

  const isOnline = fleet?.status === 'online';

  return (
    <div className="rounded-2xl border border-apex-border bg-apex-card p-5 space-y-4">
      {/* Connection status header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            'flex h-2.5 w-2.5 rounded-full',
            isOnline ? 'bg-apex-success animate-pulse' : 'bg-apex-textMuted'
          )} />
          <span className={cn('text-sm font-semibold', isOnline ? 'text-apex-success' : 'text-apex-textMuted')}>
            {isOnline ? 'Active — Paired' : 'Standalone — Not yet paired'}
          </span>
        </div>
        <StatusBadge status={tenant.status} />
      </div>

      <p className="text-xs text-apex-textMuted">
        {isOnline
          ? 'This fleet entity is actively connected and pushing telemetry to Apex Command Center.'
          : 'Enter registration code in Command Center to pair this fleet entity.'}
      </p>

      {/* Big code display — matches Fleet Control OS style */}
      <div className="rounded-xl border border-apex-border/70 bg-apex-bg px-6 py-5 text-center space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-apex-textMuted font-medium">Registration Code</p>
        <p className="font-mono text-3xl font-bold tracking-[0.3em] text-apex-text letter-spacing-wide">
          {regCode.split('').join(' ')}
        </p>
        <p className="text-[10px] text-apex-textMuted">Enter this code in Apex Command Center to pair this installation</p>
        <div className="flex items-center justify-center gap-3 pt-1">
          <button
            onClick={() => copy(regCode, 'regcode')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              copied === 'regcode'
                ? 'border-apex-success/40 bg-apex-success/10 text-apex-success'
                : 'border-apex-border bg-apex-surface text-apex-textMuted hover:text-apex-text'
            )}
          >
            {copied === 'regcode' ? <Check size={11} /> : <Copy size={11} />}
            {copied === 'regcode' ? 'Copied' : 'Copy Code'}
          </button>
          <button
            onClick={regenerate}
            className="flex items-center gap-1.5 rounded-lg border border-apex-border px-3 py-1.5 text-xs font-medium text-apex-textMuted hover:text-apex-text transition-colors"
          >
            <RefreshCw size={11} /> Regenerate
          </button>
        </div>
      </div>

      {/* Entity IDs — matching Fleet Control OS layout */}
      <div className="space-y-2">
        {[
          { label: 'Tenant ID', value: tenant.id },
          { label: 'Fleet Entity ID', value: fleet?.id || '—' },
          { label: 'Sync Identity', value: tenant.pairingToken || tenant.fingerprint || '—' },
          { label: 'Created', value: new Date(tenant.createdAt).toLocaleString() },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-2 py-1 border-b border-apex-border/30 last:border-0">
            <span className="text-[10px] text-apex-textMuted w-28 flex-shrink-0">{row.label}</span>
            <span className="font-mono text-[10px] text-apex-textDim truncate flex-1 text-right">{row.value}</span>
            {row.value !== '—' && <CopyBtn value={row.value} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tenant Row Card ──────────────────────────────────────────────────────────
function TenantCard({
  tenant,
  fleet,
  onSelect,
}: {
  tenant: Tenant;
  fleet?: FleetEntity;
  onSelect: () => void;
}) {
  const isOnline = fleet?.status === 'online';
  const lastSeen = fleet?.lastHeartbeat ? timeAgo(fleet.lastHeartbeat) : 'Never';

  return (
    <button
      onClick={onSelect}
      className="w-full text-left rounded-xl border border-apex-border bg-apex-card hover:border-apex-accent/30 hover:bg-apex-card/80 transition-all p-4 group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-apex-accent/10">
            <Building2 size={16} className="text-apex-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-apex-text truncate">{tenant.name}</p>
            <p className="text-[10px] text-apex-textMuted">{regionLabel(tenant.region)} · {tenant.plan}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={tenant.status} />
          <ChevronRight size={14} className="text-apex-textMuted group-hover:text-apex-accent transition-colors" />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-apex-bg border border-apex-border/50 px-2.5 py-2 text-center">
          <p className="text-xs font-bold font-mono text-apex-text">{formatNumber(fleet?.vehicleCount || tenant.vehicleCount)}</p>
          <p className="text-[9px] text-apex-textMuted mt-0.5">Vehicles</p>
        </div>
        <div className="rounded-lg bg-apex-bg border border-apex-border/50 px-2.5 py-2 text-center">
          <p className="text-xs font-bold font-mono text-apex-text">{formatNumber(fleet?.driverCount || tenant.driverCount)}</p>
          <p className="text-[9px] text-apex-textMuted mt-0.5">Drivers</p>
        </div>
        <div className="rounded-lg bg-apex-bg border border-apex-border/50 px-2.5 py-2 text-center">
          <p className={cn('text-xs font-bold font-mono', isOnline ? 'text-apex-success' : 'text-apex-textMuted')}>
            {fleet?.uptimePercent?.toFixed(1) ?? '—'}%
          </p>
          <p className="text-[9px] text-apex-textMuted mt-0.5">Uptime</p>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isOnline
            ? <Wifi size={10} className="text-apex-success" />
            : <WifiOff size={10} className="text-apex-textMuted" />}
          <span className={cn('text-[10px]', isOnline ? 'text-apex-success' : 'text-apex-textMuted')}>
            {isOnline ? 'Telemetry active' : 'Offline'}
          </span>
        </div>
        <span className="text-[10px] text-apex-textMuted font-mono">Last seen {lastSeen}</span>
      </div>
    </button>
  );
}

// ─── Tenant Detail Panel ──────────────────────────────────────────────────────
function TenantDetailPanel({
  tenant,
  fleet,
  onClose,
}: {
  tenant: Tenant;
  fleet?: FleetEntity;
  onClose: () => void;
}) {
  const { updateTenant, addAlert } = useApexStore();
  const [actionLoading, setActionLoading] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [showSuspendInput, setShowSuspendInput] = useState(false);

  const handleSuspend = async () => {
    if (!suspendReason) { setShowSuspendInput(true); return; }
    setActionLoading(true);
    const res = await suspendTenant(tenant.id, suspendReason);
    if (res.success) {
      updateTenant(tenant.id, { status: 'suspended' });
      addAlert({ type: 'warning', title: 'Tenant Suspended', message: `${tenant.name} has been suspended.` });
      setSuspendReason('');
      setShowSuspendInput(false);
    }
    setActionLoading(false);
  };

  const handleReactivate = async () => {
    setActionLoading(true);
    const res = await reactivateTenant(tenant.id);
    if (res.success) {
      updateTenant(tenant.id, { status: 'active' });
      addAlert({ type: 'success', title: 'Tenant Reactivated', message: `${tenant.name} is now active.` });
    }
    setActionLoading(false);
  };

  const isOnline = fleet?.status === 'online';

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-md bg-apex-card border-l border-apex-border overflow-y-auto animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-apex-border sticky top-0 bg-apex-card z-10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-apex-accent/10">
              <Building2 size={14} className="text-apex-accent" />
            </div>
            <div>
              <p className="text-sm font-bold text-apex-text">{tenant.name}</p>
              <p className="text-[10px] text-apex-textMuted">{regionLabel(tenant.region)} · {tenant.plan}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={tenant.status} />
            <button onClick={onClose} className="rounded-lg p-1.5 text-apex-textMuted hover:text-apex-text hover:bg-apex-border/50 transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Connection status bar */}
          <div className={cn(
            'flex items-center gap-3 rounded-xl border px-4 py-3',
            isOnline ? 'border-apex-success/30 bg-apex-success/5' : 'border-apex-border bg-apex-bg'
          )}>
            <div className={cn('h-2 w-2 rounded-full flex-shrink-0', isOnline ? 'bg-apex-success animate-pulse' : 'bg-apex-textMuted')} />
            <div className="flex-1 min-w-0">
              <p className={cn('text-xs font-semibold', isOnline ? 'text-apex-success' : 'text-apex-textMuted')}>
                {isOnline ? 'Fleet Connected — Telemetry Active' : 'Fleet Offline'}
              </p>
              <p className="text-[10px] text-apex-textMuted truncate">
                {fleet?.telemetryEndpoint || 'No telemetry endpoint configured'}
              </p>
            </div>
          </div>

          {/* Registration code card */}
          <RegistrationCodeCard tenant={tenant} fleet={fleet} />

          {/* Fleet metrics */}
          {fleet && (
            <div className="rounded-xl border border-apex-border bg-apex-bg p-4 space-y-3">
              <p className="text-[10px] uppercase tracking-wider text-apex-textMuted font-medium">Fleet Metrics</p>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Active Vehicles', value: `${fleet.activeVehicles} / ${fleet.vehicleCount}`, icon: Truck },
                  { label: 'Active Drivers', value: `${fleet.activeDrivers} / ${fleet.driverCount}`, icon: Users },
                  { label: 'Uptime', value: `${fleet.uptimePercent?.toFixed(1)}%`, icon: Activity },
                  { label: 'Version', value: fleet.version || '—', icon: Zap },
                ].map((m) => (
                  <div key={m.label} className="flex items-center gap-2.5 rounded-lg border border-apex-border/50 bg-apex-surface px-3 py-2.5">
                    <m.icon size={13} className="text-apex-accent flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold text-apex-text truncate">{m.value}</p>
                      <p className="text-[9px] text-apex-textMuted">{m.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contact & plan */}
          <div className="rounded-xl border border-apex-border bg-apex-bg p-4 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-apex-textMuted font-medium mb-3">Account Details</p>
            {[
              { label: 'Contact', value: tenant.contactEmail || '—' },
              { label: 'Plan', value: tenant.plan },
              { label: 'Fleet Count', value: String(tenant.fleetCount) },
              { label: 'Registered', value: new Date(tenant.createdAt).toLocaleDateString() },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between border-b border-apex-border/30 last:border-0 pb-2 last:pb-0">
                <span className="text-[10px] text-apex-textMuted">{row.label}</span>
                <span className="text-xs text-apex-text font-medium">{row.value}</span>
              </div>
            ))}
          </div>

          {/* Danger zone */}
          <div className="rounded-xl border border-apex-border/50 bg-apex-bg p-4 space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-apex-textMuted font-medium">Fleet Control</p>

            {showSuspendInput && (
              <input
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Reason for suspension…"
                className="w-full rounded-lg border border-apex-warning/40 bg-apex-surface px-3 py-2 text-xs text-apex-text placeholder:text-apex-textMuted focus:outline-none focus:border-apex-warning/60"
              />
            )}

            <div className="flex gap-2">
              {tenant.status === 'active' ? (
                <button
                  onClick={handleSuspend}
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-apex-warning/30 bg-apex-warning/5 px-3 py-2 text-xs font-medium text-apex-warning hover:bg-apex-warning/10 disabled:opacity-50 transition-colors"
                >
                  <Ban size={11} />
                  {showSuspendInput ? 'Confirm Suspend' : 'Suspend Tenant'}
                </button>
              ) : (
                <button
                  onClick={handleReactivate}
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-apex-success/30 bg-apex-success/5 px-3 py-2 text-xs font-medium text-apex-success hover:bg-apex-success/10 disabled:opacity-50 transition-colors"
                >
                  <RotateCcw size={11} /> Reactivate
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TenantsPage() {
  const { tenants, fleets, isLoading, globalAggregate } = useApexStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  const filtered = useMemo(() => {
    return tenants.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (search && !t.name.toLowerCase().includes(search.toLowerCase()) &&
        !t.contactEmail?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tenants, search, statusFilter]);

  const getFleet = (tenantId: string) => fleets.find((f) => f.tenantId === tenantId);
  const selectedFleet = selectedTenant ? getFleet(selectedTenant.id) : undefined;

  const activeCount = tenants.filter((t) => t.status === 'active').length;
  const suspendedCount = tenants.filter((t) => t.status === 'suspended').length;
  const onlineFleets = fleets.filter((f) => f.status === 'online').length;
  const hasData = tenants.length > 0;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">

      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-apex-text">
            Fleet <span className="apex-gradient-text">Registry</span>
          </h1>
          <p className="text-sm text-apex-textMuted mt-1">
            Register, manage and monitor all connected fleet entities across your federation
          </p>
        </div>
        <button
          onClick={() => setShowPairingModal(true)}
          className="flex items-center gap-2 rounded-xl bg-apex-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-apex-accentDim transition-all shadow-lg shadow-apex-accent/20"
        >
          <Plus size={15} /> Register Fleet
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard title="Total Tenants" value={tenants.length} icon={Building2} variant="accent" loading={isLoading} />
        <MetricCard title="Active Tenants" value={activeCount} icon={CheckCircle2} variant="success" loading={isLoading} />
        <MetricCard title="Online Fleets" value={onlineFleets} icon={Wifi} variant="default" loading={isLoading} />
        <MetricCard title="Suspended" value={suspendedCount} icon={Ban} variant={suspendedCount > 0 ? 'warning' : 'default'} loading={isLoading} />
      </div>

      {/* No-data prompt */}
      {!hasData && !isLoading && (
        <div className="rounded-2xl border border-dashed border-apex-accent/30 bg-apex-accent/3 p-8 text-center space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-apex-accent/10 mx-auto">
            <Link2 size={24} className="text-apex-accent" />
          </div>
          <div>
            <p className="text-base font-bold text-apex-text">No Fleet Entities Registered</p>
            <p className="text-sm text-apex-textMuted mt-1 max-w-sm mx-auto">
              Click <strong className="text-apex-text">Register Fleet</strong> and enter the pairing code
              from your Fleet Control OS → Settings → Federation page.
            </p>
          </div>
          <button
            onClick={() => setShowPairingModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-apex-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-apex-accentDim transition-all"
          >
            <Plus size={15} /> Register First Fleet
          </button>
        </div>
      )}

      {/* Search + filter */}
      {hasData && (
        <>
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-apex-textMuted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tenants…"
                className="w-full rounded-xl border border-apex-border bg-apex-surface pl-8 pr-4 py-2 text-sm text-apex-text placeholder:text-apex-textMuted focus:outline-none focus:border-apex-accent/60 transition-colors"
              />
            </div>
            <div className="flex gap-1.5">
              {['all', 'active', 'suspended', 'offline', 'pending'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-colors',
                    statusFilter === s
                      ? 'border-apex-accent/40 bg-apex-accent/10 text-apex-accent'
                      : 'border-apex-border text-apex-textMuted hover:text-apex-text'
                  )}
                >
                  {s === 'all' ? 'All' : s}
                </button>
              ))}
            </div>
          </div>

          {/* Tenant grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-apex-textMuted text-sm">
              No tenants match your filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {filtered.map((tenant) => (
                <TenantCard
                  key={tenant.id}
                  tenant={tenant}
                  fleet={getFleet(tenant.id)}
                  onSelect={() => setSelectedTenant(tenant)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Pairing modal */}
      {showPairingModal && (
        <PairingModal
          onClose={() => setShowPairingModal(false)}
          onSuccess={() => setShowPairingModal(false)}
        />
      )}

      {/* Tenant detail panel */}
      {selectedTenant && (
        <TenantDetailPanel
          tenant={selectedTenant}
          fleet={selectedFleet}
          onClose={() => setSelectedTenant(null)}
        />
      )}
    </div>
  );
}
