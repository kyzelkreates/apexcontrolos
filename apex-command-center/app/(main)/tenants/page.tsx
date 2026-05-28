'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  fetchTenantsWithFleets, registerFleetByCode,
  updateTenantStatus, deleteTenant,
} from '@/services/federationService';
import type { TenantWithFleets, TenantPlan } from '@/types/federation';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { MetricCard } from '@/components/shared/MetricCard';
import { formatNumber } from '@/lib/utils';
import {
  Building2, Plus, RefreshCw, Copy, CheckCircle2,
  Trash2, ChevronDown, ChevronUp, Wifi, WifiOff,
  Shield, X, AlertTriangle, Leaf,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────
// REGISTER FLEET MODAL
// ─────────────────────────────────────────────────────────────────
function RegisterFleetModal({ onClose, onRegistered }: { onClose: () => void; onRegistered: () => void }) {
  const [step, setStep] = useState<'code' | 'details' | 'done'>('code');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ pairingToken: string; tenantId: string; fleetId: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [form, setForm] = useState({
    code: '',
    tenantName: '',
    contactEmail: '',
    plan: 'starter' as TenantPlan,
    region: '',
    fleetName: '',
    commandCenterUrl: typeof window !== 'undefined' ? window.location.origin : '',
  });

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tenantName.trim() || !form.fleetName.trim()) { setError('Tenant name and fleet name are required.'); return; }
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
          <h2 className="text-sm font-semibold text-apex-text">Register Fleet</h2>
          <button onClick={onClose}><X size={16} className="text-apex-textMuted hover:text-apex-text" /></button>
        </div>

        {step === 'code' && (
          <div className="p-5 space-y-4">
            <p className="text-xs text-apex-textDim">Enter the <span className="font-mono text-apex-accent">APEX-XXXXXXXX-XXXX-FC</span> code displayed in Fleet Control OS → Federation.</p>
            <div>
              <label className="block text-xs text-apex-textMuted mb-1.5">Registration Code</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 font-mono text-sm text-apex-accent placeholder-apex-textMuted focus:border-apex-accent focus:outline-none tracking-widest"
                placeholder="APEX-3A7F2C1B-9D4E-FC"
                autoFocus
              />
            </div>
            {error && <p className="text-xs text-apex-danger">{error}</p>}
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-lg border border-apex-border px-4 py-2 text-sm text-apex-textMuted hover:bg-apex-border/30 transition-colors">Cancel</button>
              <button
                onClick={() => {
                  if (!form.code.trim()) { setError('Enter a code first.'); return; }
                  if (!/^APEX-[A-F0-9]{8}-[A-F0-9]{4}-[A-Z]{2,4}$/.test(form.code.trim())) {
                    setError('Invalid code format. Expected: APEX-XXXXXXXX-XXXX-FC'); return;
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
            {error && <p className="text-xs text-apex-danger">{error}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep('code')} className="flex-1 rounded-lg border border-apex-border px-4 py-2 text-sm text-apex-textMuted hover:bg-apex-border/30 transition-colors">← Back</button>
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
            <p className="text-xs text-apex-textDim">Copy these values back into Fleet Control OS → Federation → Manual Pairing, or they will auto-detect via the pairing-status poll.</p>
            {[
              { label: 'Tenant ID',     value: result.tenantId,     key: 'tid' },
              { label: 'Fleet ID',      value: result.fleetId,      key: 'fid' },
              { label: 'Pairing Token', value: result.pairingToken, key: 'pt' },
            ].map((row) => (
              <div key={row.key} className="rounded-lg border border-apex-border bg-apex-surface px-3 py-2.5">
                <p className="text-[10px] text-apex-textMuted mb-1">{row.label}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-apex-accent truncate">{row.value}</span>
                  <button onClick={() => copy(row.value, row.key)} className="flex-shrink-0 text-apex-textMuted hover:text-apex-accent transition-colors">
                    {copied === row.key ? <CheckCircle2 size={12} className="text-apex-success" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            ))}
            <button onClick={onClose} className="w-full rounded-lg bg-apex-accent px-4 py-2 text-sm font-medium text-white hover:bg-apex-accentDim transition-colors">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// TENANT CARD
// ─────────────────────────────────────────────────────────────────
function TenantCard({ tenant, onRefresh }: { tenant: TenantWithFleets; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [suspending, setSuspending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const lastSeen = tenant.latest_heartbeat?.received_at;
  const isOnline = lastSeen && (Date.now() - new Date(lastSeen).getTime()) < 2 * 60 * 1000;

  const handleToggleStatus = async () => {
    setSuspending(true);
    const newStatus = tenant.status === 'active' ? 'suspended' : 'active';
    await updateTenantStatus(tenant.id, newStatus);
    setSuspending(false);
    onRefresh();
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    await deleteTenant(tenant.id);
    setDeleting(false);
    onRefresh();
  };

  return (
    <div className={cn('rounded-xl border bg-apex-card transition-all', tenant.status === 'suspended' ? 'border-apex-warning/30 opacity-70' : 'border-apex-border')}>
      {/* Header row */}
      <div className="flex items-center gap-4 px-5 py-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-apex-surface border border-apex-border">
          <Building2 size={15} className="text-apex-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm text-apex-text">{tenant.name}</p>
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', {
              'bg-apex-success/20 text-apex-success': tenant.plan === 'enterprise',
              'bg-apex-accent/20 text-apex-accent':   tenant.plan === 'growth',
              'bg-apex-border text-apex-textMuted':   tenant.plan === 'starter',
            })}>
              {tenant.plan.toUpperCase()}
            </span>
            <StatusBadge status={tenant.status} />
          </div>
          <p className="text-[11px] text-apex-textMuted mt-0.5">
            {tenant.contact_email ?? '—'} {tenant.region ? `· ${tenant.region}` : ''}
          </p>
        </div>

        {/* Metrics */}
        <div className="hidden sm:flex items-center gap-5 text-[11px] flex-shrink-0">
          <div className="text-center">
            <p className="font-mono font-bold text-apex-text">{tenant.fleets.length}</p>
            <p className="text-apex-textMuted">fleets</p>
          </div>
          <div className="text-center">
            <p className="font-mono font-bold text-apex-text">{tenant.total_vehicles}</p>
            <p className="text-apex-textMuted">vehicles</p>
          </div>
          <div className="text-center">
            <p className="font-mono font-bold text-apex-text">{tenant.total_routes}</p>
            <p className="text-apex-textMuted">routes</p>
          </div>
          <div className="text-center">
            <p className={cn('font-mono font-bold', isOnline ? 'text-apex-success' : 'text-apex-textMuted')}>
              {isOnline ? <span className="flex items-center gap-1"><Wifi size={10} /> online</span> : <span className="flex items-center gap-1"><WifiOff size={10} /> offline</span>}
            </p>
            <p className="text-apex-textMuted">{lastSeen ? new Date(lastSeen).toLocaleTimeString() : 'never'}</p>
          </div>
        </div>

        <button className="flex-shrink-0 text-apex-textMuted">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Expanded: fleet list + actions */}
      {expanded && (
        <div className="border-t border-apex-border px-5 py-4 space-y-4">
          {/* Fleets */}
          {tenant.fleets.length > 0 && (
            <div>
              <p className="text-[10px] text-apex-textMuted font-semibold uppercase mb-2">Fleet Entities</p>
              <div className="space-y-2">
                {tenant.fleets.map((f) => (
                  <div key={f.id} className="rounded-lg bg-apex-surface border border-apex-border/50 px-4 py-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="text-xs font-semibold text-apex-text">{f.name}</p>
                        <p className="text-[10px] font-mono text-apex-textMuted mt-0.5">{f.id}</p>
                      </div>
                      <StatusBadge status={f.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-[10px] text-apex-textMuted font-mono">
                      <span>{f.vehicle_count} vehicles ({f.active_vehicles} active)</span>
                      <span>{f.driver_count} drivers ({f.active_drivers} active)</span>
                      <span>↑ {f.uptime_percent}% uptime</span>
                      {f.version && <span>v{f.version}</span>}
                      {f.last_heartbeat && <span>last ping {new Date(f.last_heartbeat).toLocaleTimeString()}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sustainability */}
          {tenant.total_co2_saved_kg > 0 && (
            <div className="rounded-lg bg-apex-success/5 border border-apex-success/20 px-4 py-3 flex items-center gap-3">
              <Leaf size={14} className="text-apex-success" />
              <div>
                <p className="text-xs font-medium text-apex-success">{tenant.total_co2_saved_kg.toFixed(1)} kg CO₂ saved</p>
                <p className="text-[10px] text-apex-textMuted">across {tenant.total_routes} routes</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <button
              onClick={handleToggleStatus}
              disabled={suspending}
              className={cn('flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
                tenant.status === 'active'
                  ? 'border-apex-warning/40 text-apex-warning hover:bg-apex-warning/10'
                  : 'border-apex-success/40 text-apex-success hover:bg-apex-success/10'
              )}>
              {suspending ? <RefreshCw size={10} className="animate-spin" /> : <Shield size={10} />}
              {tenant.status === 'active' ? 'Suspend' : 'Activate'}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className={cn('flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
                confirmDelete
                  ? 'border-apex-danger bg-apex-danger text-white'
                  : 'border-apex-danger/40 text-apex-danger hover:bg-apex-danger/10'
              )}>
              {deleting ? <RefreshCw size={10} className="animate-spin" /> : <Trash2 size={10} />}
              {deleting ? 'Deleting…' : confirmDelete ? '⚠ Confirm Delete' : 'Delete Tenant'}
            </button>
            {confirmDelete && (
              <button onClick={() => setConfirmDelete(false)} className="text-[10px] text-apex-textMuted hover:text-apex-text">
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// TENANTS PAGE
// ─────────────────────────────────────────────────────────────────
export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantWithFleets[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchTenantsWithFleets();
    if (data) setTenants(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = tenants.filter((t) =>
    !search ||
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.contact_email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (t.region ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const totalFleets    = tenants.reduce((s, t) => s + t.fleets.length, 0);
  const totalVehicles  = tenants.reduce((s, t) => s + t.total_vehicles, 0);
  const totalRoutes    = tenants.reduce((s, t) => s + t.total_routes, 0);
  const totalCo2Saved  = tenants.reduce((s, t) => s + t.total_co2_saved_kg, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-apex-text">
            Federation <span className="apex-gradient-text">Tenants</span>
          </h1>
          <p className="text-sm text-apex-textMuted mt-1">Register and monitor connected Fleet Control OS instances</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 rounded-lg border border-apex-border px-3 py-2 text-xs text-apex-textMuted hover:text-apex-text hover:bg-apex-border/30 transition-colors disabled:opacity-50">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            onClick={() => setShowRegister(true)}
            className="flex items-center gap-2 rounded-lg bg-apex-accent px-4 py-2 text-sm font-medium text-white hover:bg-apex-accentDim transition-colors"
          >
            <Plus size={14} /> Register Fleet
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard title="Active Tenants"  value={formatNumber(tenants.filter(t => t.status === 'active').length)} subtitle={`${tenants.length} total`}  icon={Building2} variant="accent"  loading={loading} />
        <MetricCard title="Fleet Entities"  value={formatNumber(totalFleets)}   subtitle="Registered fleets"     icon={Building2} variant="purple"  loading={loading} />
        <MetricCard title="Total Vehicles"  value={formatNumber(totalVehicles)} subtitle="Across all fleets"     icon={Building2} variant="success" loading={loading} />
        <MetricCard title="CO₂ Saved"       value={`${totalCo2Saved.toFixed(0)} kg`} subtitle={`${totalRoutes} routes`} icon={Leaf} variant="success" loading={loading} />
      </div>

      {/* Search */}
      <input
        value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search tenants by name, email, region…"
        className="w-full max-w-md rounded-lg border border-apex-border bg-apex-card px-3 py-2 text-sm text-apex-text placeholder-apex-textMuted focus:border-apex-accent focus:outline-none"
      />

      {/* Tenant list */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-apex-textMuted">
          <RefreshCw size={16} className="animate-spin mr-2" /> Loading tenants…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-apex-textMuted">
          <Building2 size={36} className="opacity-20" />
          <div className="text-center">
            <p className="text-sm font-medium">No tenants registered yet</p>
            <p className="text-xs mt-1">
              {search ? 'No tenants match your search.' : 'Click "Register Fleet" and paste the APEX-XXXXXXXX-XXXX-FC code from Fleet Control OS.'}
            </p>
          </div>
          {!search && (
            <button
              onClick={() => setShowRegister(true)}
              className="flex items-center gap-2 rounded-lg bg-apex-accent/20 border border-apex-accent/30 px-4 py-2 text-sm text-apex-accent hover:bg-apex-accent/30 transition-colors"
            >
              <Plus size={14} /> Register First Fleet
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <TenantCard key={t.id} tenant={t} onRefresh={load} />
          ))}
        </div>
      )}

      {showRegister && <RegisterFleetModal onClose={() => setShowRegister(false)} onRegistered={load} />}
    </div>
  );
}
