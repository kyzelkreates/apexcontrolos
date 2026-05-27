'use client';

/**
 * APEX COMMAND CENTER OS
 * app/(main)/tenants/page.tsx
 *
 * Fleet Registry — Add, Delete, Activate & Deactivate fleets/tenants
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
  Unlink2, Ban, RotateCcw, Trash2, PowerOff, Power,
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

// ── Generate 5-char human-readable registration code ─────────────────────────
function generateRegistrationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ─── Add Fleet/Tenant Modal ───────────────────────────────────────────────────
function AddFleetModal({ onClose }: { onClose: () => void }) {
  const { addTenant, addFleet, addAlert } = useApexStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    companyName: '',
    contactEmail: '',
    fleetName: '',
    vehicleCount: 50,
    driverCount: 20,
    region: 'EU' as RegionCode,
    plan: 'growth' as 'starter' | 'growth' | 'enterprise',
    status: 'active' as 'active' | 'pending',
  });

  const handleAdd = async () => {
    if (!form.companyName || !form.fleetName) return;
    setLoading(true);

    const now = Date.now();
    const tenantId = uuid();
    const fleetId = uuid();

    const tenant: Tenant = {
      id: tenantId,
      name: form.companyName,
      slug: form.companyName.toLowerCase().replace(/\s+/g, '-'),
      region: form.region,
      status: form.status,
      registrationCode: generateRegistrationCode(),
      pairingToken: uuid(),
      fingerprint: uuid().slice(0, 16),
      createdAt: now,
      updatedAt: now,
      contactEmail: form.contactEmail,
      plan: form.plan,
      fleetCount: 1,
      vehicleCount: form.vehicleCount,
      driverCount: form.driverCount,
      apiKeyHash: uuid().replace(/-/g, ''),
      telemetryEnabled: true,
      lastSeen: now,
      metadata: {},
    };

    const fleet: FleetEntity = {
      id: fleetId,
      tenantId,
      name: form.fleetName,
      region: form.region,
      status: form.status === 'active' ? 'online' : 'offline',
      vehicleCount: form.vehicleCount,
      activeVehicles: form.status === 'active' ? Math.floor(form.vehicleCount * 0.8) : 0,
      driverCount: form.driverCount,
      activeDrivers: form.status === 'active' ? Math.floor(form.driverCount * 0.75) : 0,
      uptimePercent: form.status === 'active' ? 97.5 : 0,
      lastHeartbeat: now,
      version: '2.4.1',
      deploymentId: uuid(),
      telemetryEndpoint: `https://telemetry.apexcontrolos.io/${tenantId}`,
      createdAt: now,
      updatedAt: now,
      coordinates: { lat: 51.5, lng: -0.1 },
      tags: [form.region, form.plan],
    };

    addTenant(tenant);
    addFleet(fleet);
    addAlert({
      type: 'success',
      title: 'Fleet Registered',
      message: `${form.companyName} — ${form.fleetName} added to the registry.`,
    });

    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-apex-border bg-apex-card shadow-apex-card animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-apex-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-apex-accent/10">
              <Plus size={14} className="text-apex-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-apex-text">Add Fleet / Tenant</p>
              <p className="text-[10px] text-apex-textMuted">Manually register a new fleet entity</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-apex-textMuted hover:text-apex-text hover:bg-apex-border/50 transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Company Name */}
            <div className="col-span-2">
              <label className="block text-[10px] font-medium text-apex-textDim uppercase tracking-wider mb-1.5">Company / Tenant Name *</label>
              <input
                value={form.companyName}
                onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                placeholder="Apex Logistics Ltd"
                className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm text-apex-text placeholder:text-apex-textMuted/50 focus:outline-none focus:border-apex-accent/60 transition-colors"
              />
            </div>

            {/* Contact Email */}
            <div className="col-span-2">
              <label className="block text-[10px] font-medium text-apex-textDim uppercase tracking-wider mb-1.5">Contact Email</label>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                placeholder="admin@company.com"
                className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm text-apex-text placeholder:text-apex-textMuted/50 focus:outline-none focus:border-apex-accent/60 transition-colors"
              />
            </div>

            {/* Fleet Name */}
            <div className="col-span-2">
              <label className="block text-[10px] font-medium text-apex-textDim uppercase tracking-wider mb-1.5">Fleet Name *</label>
              <input
                value={form.fleetName}
                onChange={(e) => setForm((f) => ({ ...f, fleetName: e.target.value }))}
                placeholder="Main Fleet"
                className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm text-apex-text placeholder:text-apex-textMuted/50 focus:outline-none focus:border-apex-accent/60 transition-colors"
              />
            </div>

            {/* Vehicle Count */}
            <div>
              <label className="block text-[10px] font-medium text-apex-textDim uppercase tracking-wider mb-1.5">Vehicles</label>
              <input
                type="number"
                value={form.vehicleCount}
                onChange={(e) => setForm((f) => ({ ...f, vehicleCount: parseInt(e.target.value) || 0 }))}
                className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm text-apex-text focus:outline-none focus:border-apex-accent/60 transition-colors"
              />
            </div>

            {/* Driver Count */}
            <div>
              <label className="block text-[10px] font-medium text-apex-textDim uppercase tracking-wider mb-1.5">Drivers</label>
              <input
                type="number"
                value={form.driverCount}
                onChange={(e) => setForm((f) => ({ ...f, driverCount: parseInt(e.target.value) || 0 }))}
                className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm text-apex-text focus:outline-none focus:border-apex-accent/60 transition-colors"
              />
            </div>

            {/* Region */}
            <div>
              <label className="block text-[10px] font-medium text-apex-textDim uppercase tracking-wider mb-1.5">Region</label>
              <select
                value={form.region}
                onChange={(e) => setForm((f) => ({ ...f, region: e.target.value as RegionCode }))}
                className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm text-apex-text focus:outline-none focus:border-apex-accent/60"
              >
                {['NA', 'EU', 'APAC', 'LATAM', 'MEA', 'GLOBAL'].map((r) => (
                  <option key={r} value={r}>{regionLabel(r)}</option>
                ))}
              </select>
            </div>

            {/* Plan */}
            <div>
              <label className="block text-[10px] font-medium text-apex-textDim uppercase tracking-wider mb-1.5">Plan</label>
              <select
                value={form.plan}
                onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value as 'starter' | 'growth' | 'enterprise' }))}
                className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm text-apex-text focus:outline-none focus:border-apex-accent/60"
              >
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>

            {/* Initial Status */}
            <div className="col-span-2">
              <label className="block text-[10px] font-medium text-apex-textDim uppercase tracking-wider mb-1.5">Initial Status</label>
              <div className="flex gap-2">
                {(['active', 'pending'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setForm((f) => ({ ...f, status: s }))}
                    className={cn(
                      'flex-1 rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-colors',
                      form.status === s
                        ? s === 'active'
                          ? 'border-apex-success/50 bg-apex-success/10 text-apex-success'
                          : 'border-apex-warning/50 bg-apex-warning/10 text-apex-warning'
                        : 'border-apex-border text-apex-textMuted hover:text-apex-text'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-apex-border px-4 py-2.5 text-sm font-medium text-apex-textMuted hover:text-apex-text hover:border-apex-accent/40 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={loading || !form.companyName || !form.fleetName}
              className="flex-1 rounded-lg bg-apex-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-apex-accentDim disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw size={14} className="animate-spin" /> Adding…
                </span>
              ) : 'Add to Registry'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────
function ConfirmDeleteModal({
  tenant,
  fleet,
  onConfirm,
  onClose,
}: {
  tenant: Tenant;
  fleet?: FleetEntity;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-apex-danger/40 bg-apex-card shadow-apex-card animate-fade-in">
        <div className="px-6 py-5 space-y-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-apex-danger/10 ring-1 ring-apex-danger/30">
              <Trash2 size={22} className="text-apex-danger" />
            </div>
            <div>
              <p className="font-bold text-apex-text">Delete Fleet Entity?</p>
              <p className="text-xs text-apex-textMuted mt-1">
                This will permanently remove <strong className="text-apex-text">{tenant.name}</strong>
                {fleet && <> and fleet <strong className="text-apex-text">{fleet.name}</strong></>} from the registry.
              </p>
              <p className="text-[10px] text-apex-danger mt-2">This action cannot be undone.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-apex-border px-4 py-2.5 text-sm font-medium text-apex-textMuted hover:text-apex-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 rounded-lg bg-apex-danger px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-all"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Generate Registration Code Card ─────────────────────────────────────────
function RegistrationCodeCard({ tenant, fleet }: { tenant: Tenant; fleet?: FleetEntity }) {
  const [regCode, setRegCode] = useState(() => generateRegistrationCode());
  const { copy, copied } = useCopy();
  const regenerate = () => setRegCode(generateRegistrationCode());
  const isOnline = fleet?.status === 'online';

  return (
    <div className="rounded-2xl border border-apex-border bg-apex-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={cn('flex h-2.5 w-2.5 rounded-full', isOnline ? 'bg-apex-success animate-pulse' : 'bg-apex-textMuted')} />
          <span className={cn('text-sm font-semibold', isOnline ? 'text-apex-success' : 'text-apex-textMuted')}>
            {isOnline ? 'Active — Paired' : 'Standalone — Not yet paired'}
          </span>
        </div>
        <StatusBadge status={tenant.status} />
      </div>
      <p className="text-xs text-apex-textMuted">
        {isOnline
          ? 'This fleet entity is actively connected and pushing telemetry.'
          : 'Enter registration code in Fleet Control OS to pair this installation.'}
      </p>
      <div className="rounded-xl border border-apex-border/70 bg-apex-bg px-6 py-5 text-center space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-apex-textMuted font-medium">Registration Code</p>
        <p className="font-mono text-3xl font-bold tracking-[0.3em] text-apex-text">{regCode.split('').join(' ')}</p>
        <p className="text-[10px] text-apex-textMuted">Enter this code in Fleet Control OS → Settings → Federation</p>
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
            <RefreshCw size={11} /> New Code
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tenant Row Card ──────────────────────────────────────────────────────────
function TenantCard({
  tenant,
  fleet,
  onSelect,
  onActivate,
  onDeactivate,
  onDelete,
}: {
  tenant: Tenant;
  fleet?: FleetEntity;
  onSelect: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
}) {
  const isOnline = fleet?.status === 'online';
  const isActive = tenant.status === 'active';
  const lastSeen = fleet?.lastHeartbeat ? timeAgo(fleet.lastHeartbeat) : 'Never';

  return (
    <div className="w-full rounded-xl border border-apex-border bg-apex-card hover:border-apex-accent/20 transition-all group">
      {/* Clickable main area */}
      <button onClick={onSelect} className="w-full text-left p-4">
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
            {isOnline ? <Wifi size={10} className="text-apex-success" /> : <WifiOff size={10} className="text-apex-textMuted" />}
            <span className={cn('text-[10px]', isOnline ? 'text-apex-success' : 'text-apex-textMuted')}>
              {isOnline ? 'Telemetry active' : 'Offline'}
            </span>
          </div>
          <span className="text-[10px] text-apex-textMuted font-mono">Last seen {lastSeen}</span>
        </div>
      </button>

      {/* Action row */}
      <div className="border-t border-apex-border/50 px-4 py-2.5 flex items-center gap-2">
        {isActive ? (
          <button
            onClick={(e) => { e.stopPropagation(); onDeactivate(); }}
            title="Deactivate / Suspend"
            className="flex items-center gap-1.5 rounded-lg border border-apex-warning/30 bg-apex-warning/5 px-3 py-1.5 text-[11px] font-medium text-apex-warning hover:bg-apex-warning/10 transition-colors"
          >
            <PowerOff size={11} /> Deactivate
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onActivate(); }}
            title="Activate"
            className="flex items-center gap-1.5 rounded-lg border border-apex-success/30 bg-apex-success/5 px-3 py-1.5 text-[11px] font-medium text-apex-success hover:bg-apex-success/10 transition-colors"
          >
            <Power size={11} /> Activate
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete fleet & tenant"
          className="flex items-center gap-1.5 rounded-lg border border-apex-danger/30 bg-apex-danger/5 px-3 py-1.5 text-[11px] font-medium text-apex-danger hover:bg-apex-danger/10 transition-colors"
        >
          <Trash2 size={11} /> Delete
        </button>
        <span className="ml-auto text-[10px] text-apex-textMuted font-mono">{fleet?.name ?? '—'}</span>
      </div>
    </div>
  );
}

// ─── Tenant Detail Panel ──────────────────────────────────────────────────────
function TenantDetailPanel({
  tenant,
  fleet,
  onClose,
  onActivate,
  onDeactivate,
  onDelete,
}: {
  tenant: Tenant;
  fleet?: FleetEntity;
  onClose: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
}) {
  const isOnline = fleet?.status === 'online';
  const isActive = tenant.status === 'active';

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
          {/* Connection status */}
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

          {/* Account details */}
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

          {/* Fleet Control Actions */}
          <div className="rounded-xl border border-apex-border/50 bg-apex-bg p-4 space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-apex-textMuted font-medium">Fleet Control</p>
            <div className="flex flex-col gap-2">
              {isActive ? (
                <button
                  onClick={onDeactivate}
                  className="flex items-center gap-2 rounded-lg border border-apex-warning/30 bg-apex-warning/5 px-4 py-2.5 text-sm font-medium text-apex-warning hover:bg-apex-warning/10 transition-colors"
                >
                  <PowerOff size={14} /> Deactivate / Suspend Tenant
                </button>
              ) : (
                <button
                  onClick={onActivate}
                  className="flex items-center gap-2 rounded-lg border border-apex-success/30 bg-apex-success/5 px-4 py-2.5 text-sm font-medium text-apex-success hover:bg-apex-success/10 transition-colors"
                >
                  <Power size={14} /> Activate Tenant
                </button>
              )}

              {/* Fleet toggle if fleet exists */}
              {fleet && (
                fleet.status === 'online' ? (
                  <button
                    onClick={onDeactivate}
                    className="flex items-center gap-2 rounded-lg border border-apex-border bg-apex-surface px-4 py-2.5 text-sm font-medium text-apex-textMuted hover:text-apex-text hover:border-apex-warning/30 transition-colors"
                  >
                    <WifiOff size={14} /> Take Fleet Offline
                  </button>
                ) : (
                  <button
                    onClick={onActivate}
                    className="flex items-center gap-2 rounded-lg border border-apex-border bg-apex-surface px-4 py-2.5 text-sm font-medium text-apex-textMuted hover:text-apex-text hover:border-apex-success/30 transition-colors"
                  >
                    <Wifi size={14} /> Bring Fleet Online
                  </button>
                )
              )}

              <button
                onClick={onDelete}
                className="flex items-center gap-2 rounded-lg border border-apex-danger/30 bg-apex-danger/5 px-4 py-2.5 text-sm font-medium text-apex-danger hover:bg-apex-danger/10 transition-colors"
              >
                <Trash2 size={14} /> Delete Fleet & Tenant
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TenantsPage() {
  const { tenants, fleets, isLoading, addAlert, updateTenant, removeTenant, updateFleet, removeFleet } = useApexStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);

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
  const deleteFleet = deleteTarget ? getFleet(deleteTarget.id) : undefined;

  const activeCount = tenants.filter((t) => t.status === 'active').length;
  const suspendedCount = tenants.filter((t) => t.status === 'suspended').length;
  const onlineFleets = fleets.filter((f) => f.status === 'online').length;
  const hasData = tenants.length > 0;

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleActivate = useCallback((tenant: Tenant) => {
    const fleet = getFleet(tenant.id);
    updateTenant(tenant.id, { status: 'active', updatedAt: Date.now() });
    if (fleet) updateFleet(fleet.id, { status: 'online', activeVehicles: Math.floor(fleet.vehicleCount * 0.8), activeDrivers: Math.floor(fleet.driverCount * 0.75), updatedAt: Date.now() });
    addAlert({ type: 'success', title: 'Tenant Activated', message: `${tenant.name} is now active.` });
    if (selectedTenant?.id === tenant.id) setSelectedTenant({ ...tenant, status: 'active' });
  }, [fleets, updateTenant, updateFleet, addAlert, selectedTenant]);

  const handleDeactivate = useCallback((tenant: Tenant) => {
    const fleet = getFleet(tenant.id);
    updateTenant(tenant.id, { status: 'suspended', updatedAt: Date.now() });
    if (fleet) updateFleet(fleet.id, { status: 'offline', activeVehicles: 0, activeDrivers: 0, uptimePercent: 0, updatedAt: Date.now() });
    addAlert({ type: 'warning', title: 'Tenant Suspended', message: `${tenant.name} has been deactivated.` });
    if (selectedTenant?.id === tenant.id) setSelectedTenant({ ...tenant, status: 'suspended' });
  }, [fleets, updateTenant, updateFleet, addAlert, selectedTenant]);

  const handleDelete = useCallback((tenant: Tenant) => {
    const fleet = getFleet(tenant.id);
    removeTenant(tenant.id);
    if (fleet) removeFleet(fleet.id);
    addAlert({ type: 'info', title: 'Fleet Removed', message: `${tenant.name} has been deleted from the registry.` });
    if (selectedTenant?.id === tenant.id) setSelectedTenant(null);
    setDeleteTarget(null);
  }, [fleets, removeTenant, removeFleet, addAlert, selectedTenant]);

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
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-xl bg-apex-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-apex-accentDim transition-all shadow-lg shadow-apex-accent/20"
        >
          <Plus size={15} /> Add Fleet
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
              Click <strong className="text-apex-text">Add Fleet</strong> to register your first fleet entity.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-apex-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-apex-accentDim transition-all"
          >
            <Plus size={15} /> Add First Fleet
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {filtered.map((tenant) => (
                <TenantCard
                  key={tenant.id}
                  tenant={tenant}
                  fleet={getFleet(tenant.id)}
                  onSelect={() => setSelectedTenant(tenant)}
                  onActivate={() => handleActivate(tenant)}
                  onDeactivate={() => handleDeactivate(tenant)}
                  onDelete={() => setDeleteTarget(tenant)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Add Modal */}
      {showAddModal && <AddFleetModal onClose={() => setShowAddModal(false)} />}

      {/* Confirm Delete Modal */}
      {deleteTarget && (
        <ConfirmDeleteModal
          tenant={deleteTarget}
          fleet={deleteFleet}
          onConfirm={() => handleDelete(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {/* Tenant detail panel */}
      {selectedTenant && (
        <TenantDetailPanel
          tenant={selectedTenant}
          fleet={selectedFleet}
          onClose={() => setSelectedTenant(null)}
          onActivate={() => handleActivate(selectedTenant)}
          onDeactivate={() => handleDeactivate(selectedTenant)}
          onDelete={() => { setDeleteTarget(selectedTenant); setSelectedTenant(null); }}
        />
      )}
    </div>
  );
}
