'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useDriverStore } from '@/lib/driver-store';
import { pushRouteComplete, pushDriverHeartbeat, queueRouteComplete, flushOfflineQueue } from '@/lib/apex-push';
import { cn, formatNumber, formatCurrency, timeAgo } from '@/lib/utils';
import {
  MapPin, CheckCircle, Clock, Fuel, Leaf, DollarSign, TreePine,
  Car, Truck, User, Wifi, WifiOff, ChevronRight, X, Play,
  StopCircle, Package, AlertCircle, Star, Settings, BarChart2,
  Shield, Zap, RefreshCw,
} from 'lucide-react';
import type { ActiveRoute, Stop, DriverProfile } from '@/lib/driver-store';
import { v4 as uuid } from 'uuid';

// ─── Stat pill ────────────────────────────────────────────────────────────────
function Stat({ label, value, unit = '', color = 'text-drv-accent' }: {
  label: string; value: string | number; unit?: string; color?: string;
}) {
  return (
    <div className="text-center">
      <p className={cn('text-2xl font-bold', color)}>{value}<span className="text-sm font-normal text-drv-textMuted ml-1">{unit}</span></p>
      <p className="text-[10px] text-drv-textMuted uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

// ─── Onboarding / Profile Setup ───────────────────────────────────────────────
function OnboardingScreen({ onDone }: { onDone: (p: DriverProfile) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    name: '', fleetName: '', tenantId: '', fleetId: '', apexUrl: '', apiKey: '',
  });
  const [error, setError] = useState('');

  return (
    <div className="min-h-screen bg-drv-bg flex flex-col justify-center px-6 py-10 space-y-6 animate-slide-up">
      {/* Logo */}
      <div className="text-center">
        <div className="inline-flex h-16 w-16 rounded-2xl drv-gradient items-center justify-center mb-4">
          <Truck size={28} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-drv-text">Apex Driver</h1>
        <p className="text-sm text-drv-textMuted mt-1">Your fleet, your routes, your impact.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2].map((s) => (
          <React.Fragment key={s}>
            <div className={cn('flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
              step >= s ? 'bg-drv-accent text-white' : 'bg-drv-border text-drv-textMuted')}>{s}</div>
            {s < 2 && <div className={cn('flex-1 h-0.5', step > s ? 'bg-drv-accent' : 'bg-drv-border')} />}
          </React.Fragment>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-xs text-drv-textMuted font-semibold uppercase tracking-wider">Your Details</p>
          {[
            { key: 'name', label: 'Your Full Name', placeholder: 'James Okafor' },
            { key: 'fleetName', label: 'Fleet / Company Name', placeholder: 'LogiTech Solutions' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs text-drv-textMuted mb-1">{label}</label>
              <input className="w-full rounded-xl border border-drv-border bg-drv-surface px-4 py-3 text-drv-text placeholder-drv-textMuted focus:border-drv-accent/60 focus:outline-none"
                placeholder={placeholder} value={(form as Record<string, string>)[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </div>
          ))}
          <button onClick={() => { if (!form.name) { setError('Name is required.'); return; } setError(''); setStep(2); }}
            className="w-full rounded-xl drv-gradient py-3 text-sm font-bold text-white">
            Continue →
          </button>
          {error && <p className="text-xs text-drv-danger text-center">{error}</p>}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-xs text-drv-textMuted font-semibold uppercase tracking-wider">Connect to Apex</p>
          {[
            { key: 'apexUrl', label: 'Apex Control Center URL', placeholder: 'https://apexcontrolos.vercel.app' },
            { key: 'tenantId', label: 'Tenant ID', placeholder: 'tenant_xxxxxxxx' },
            { key: 'fleetId', label: 'Fleet ID', placeholder: 'fleet_xxxxxxxx' },
            { key: 'apiKey', label: 'API Key (optional)', placeholder: 'Your key from Fleet Manager' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs text-drv-textMuted mb-1">{label}</label>
              <input className="w-full rounded-xl border border-drv-border bg-drv-surface px-4 py-3 text-drv-text placeholder-drv-textMuted focus:border-drv-accent/60 focus:outline-none"
                placeholder={placeholder} value={(form as Record<string, string>)[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </div>
          ))}
          <p className="text-[10px] text-drv-textMuted">Tip: set Apex URL to <code className="text-drv-accent">local</code> to use fully offline.</p>
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="flex-1 rounded-xl border border-drv-border py-3 text-sm font-semibold text-drv-textDim">← Back</button>
            <button onClick={() => {
              if (!form.name) { setError('Go back and enter your name.'); return; }
              onDone({
                id: `drv_${uuid()}`, name: form.name, fleetName: form.fleetName,
                tenantId: form.tenantId, fleetId: form.fleetId,
                apexUrl: form.apexUrl || 'local', apiKey: form.apiKey,
                joinedAt: Date.now(),
              });
            }} className="flex-2 flex-1 rounded-xl drv-gradient py-3 text-sm font-bold text-white">
              Start Driving
            </button>
          </div>
          {error && <p className="text-xs text-drv-danger text-center">{error}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Route Card ───────────────────────────────────────────────────────────────
function RouteCard({ route, onStart, onComplete, isActive }: {
  route: ActiveRoute;
  onStart?: () => void;
  onComplete?: () => void;
  isActive: boolean;
}) {
  const allStopsComplete = route.stops.length > 0 && route.stops.every((s) => s.completed);
  const completedStops = route.stops.filter((s) => s.completed).length;
  const progressPct = route.stops.length > 0 ? (completedStops / route.stops.length) * 100 : 0;

  return (
    <div className={cn('rounded-2xl border p-4 space-y-3', isActive ? 'border-drv-accent/50 bg-drv-accent/5' : 'border-drv-border bg-drv-card')}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {route.aiOptimised && <span className="text-[9px] bg-drv-purple/20 text-drv-purple border border-drv-purple/30 px-1.5 py-0.5 rounded font-bold">AI OPT</span>}
            <span className={cn('text-[9px] px-1.5 py-0.5 rounded border font-bold capitalize',
              route.status === 'in_progress' ? 'bg-drv-accent/10 text-drv-accent border-drv-accent/30' :
              route.status === 'completed' ? 'bg-drv-success/10 text-drv-success border-drv-success/30' :
              'bg-drv-textMuted/10 text-drv-textMuted border-drv-textMuted/30')}>
              {route.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-sm font-semibold text-drv-text truncate">{route.origin}</p>
          <div className="flex items-center gap-1 text-[10px] text-drv-textMuted mt-0.5">
            <ChevronRight size={10} />
            <span className="truncate">{route.destination}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-mono text-drv-textDim">{route.distanceKm} km</p>
          <p className="text-[10px] text-drv-textMuted">{route.estimatedDurationMin} min</p>
        </div>
      </div>

      {/* Stops progress */}
      {route.stops.length > 0 && (
        <div>
          <div className="flex items-center justify-between text-[10px] text-drv-textMuted mb-1">
            <span>Stops: {completedStops}/{route.stops.length}</span>
            <span>{progressPct.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-drv-border overflow-hidden">
            <div className="h-full rounded-full bg-drv-success transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {/* Impact preview (completed routes) */}
      {route.status === 'completed' && route.fuelSavedL && (
        <div className="rounded-xl bg-drv-success/10 border border-drv-success/20 px-3 py-2 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-sm font-bold text-drv-success">{route.fuelSavedL.toFixed(1)}L</p>
            <p className="text-[9px] text-drv-textMuted">Fuel Saved</p>
          </div>
          <div>
            <p className="text-sm font-bold text-drv-success">{(route.co2SavedKg ?? 0).toFixed(1)}kg</p>
            <p className="text-[9px] text-drv-textMuted">CO₂ Saved</p>
          </div>
          <div>
            <p className="text-sm font-bold text-drv-accent">{formatCurrency(route.fuelCostSavedUSD ?? 0)}</p>
            <p className="text-[9px] text-drv-textMuted">Cost Saved</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {route.status === 'pending' && onStart && (
          <button onClick={onStart} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-drv-accent py-2.5 text-xs font-bold text-white">
            <Play size={12} /> Start Route
          </button>
        )}
        {route.status === 'in_progress' && onComplete && (
          <button onClick={onComplete}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-drv-success py-2.5 text-xs font-bold text-white">
            <StopCircle size={12} /> Complete Route
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Complete Route Sheet ─────────────────────────────────────────────────────
function CompleteSheet({ route, onClose, onConfirm }: {
  route: ActiveRoute;
  onClose: () => void;
  onConfirm: (data: { fuelSavedL: number; optimisationSavingPercent: number; onTimeDelivery: boolean; actualDurationMin: number }) => void;
}) {
  const [form, setForm] = useState({
    fuelSavedL: 0, optimisationSavingPercent: route.aiOptimised ? 15 : 0,
    onTimeDelivery: true, actualDurationMin: route.estimatedDurationMin,
  });
  const co2 = (form.fuelSavedL * 2.68).toFixed(1);
  const cost = (form.fuelSavedL * 1.35).toFixed(2);
  const trees = (parseFloat(co2) / 21).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60">
      <div className="w-full max-w-md mx-auto rounded-t-3xl border-t border-fleet-border bg-drv-card p-6 space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-drv-text">Complete Route</h3>
          <button onClick={onClose} className="text-drv-textMuted hover:text-drv-text"><X size={18} /></button>
        </div>
        <p className="text-xs text-drv-textMuted">{route.origin} → {route.destination}</p>

        {[
          { key: 'actualDurationMin', label: 'Actual Duration (min)', step: 1 },
          { key: 'fuelSavedL', label: 'Fuel Saved (litres)', step: 0.1 },
          { key: 'optimisationSavingPercent', label: 'Route Saving (%)', step: 0.5 },
        ].map(({ key, label, step }) => (
          <div key={key}>
            <label className="block text-xs text-drv-textMuted mb-1">{label}</label>
            <input type="number" step={step}
              className="w-full rounded-xl border border-drv-border bg-drv-surface px-4 py-3 text-drv-text focus:border-drv-accent/60 focus:outline-none"
              value={(form as Record<string, number | boolean>)[key] as number}
              onChange={(e) => setForm({ ...form, [key]: parseFloat(e.target.value) || 0 })} />
          </div>
        ))}

        {form.fuelSavedL > 0 && (
          <div className="rounded-2xl bg-drv-success/10 border border-drv-success/20 p-4 space-y-2">
            <p className="text-xs font-bold text-drv-success flex items-center gap-1.5"><Leaf size={12} /> Your Impact This Route</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-drv-success">{co2}</p>
                <p className="text-[9px] text-drv-textMuted">kg CO₂</p>
              </div>
              <div>
                <p className="text-lg font-bold text-drv-accent">${cost}</p>
                <p className="text-[9px] text-drv-textMuted">Cost Saved</p>
              </div>
              <div>
                <p className="text-lg font-bold text-drv-success">{trees}</p>
                <p className="text-[9px] text-drv-textMuted">Trees/yr</p>
              </div>
            </div>
          </div>
        )}

        <label className="flex items-center gap-2">
          <input type="checkbox" className="w-4 h-4 rounded" checked={form.onTimeDelivery}
            onChange={(e) => setForm({ ...form, onTimeDelivery: e.target.checked })} />
          <span className="text-sm text-drv-textDim">Delivered on time</span>
        </label>

        <button onClick={() => onConfirm(form)}
          className="w-full rounded-2xl drv-gradient py-4 text-sm font-bold text-white">
          Confirm & Send to Fleet →
        </button>
      </div>
    </div>
  );
}

// ─── Add Route Sheet ──────────────────────────────────────────────────────────
function AddRouteSheet({ onClose, onAdd, vehicleId }: {
  onClose: () => void;
  onAdd: (r: ActiveRoute) => void;
  vehicleId: string;
}) {
  const [form, setForm] = useState({
    origin: '', destination: '', distanceKm: 0,
    estimatedDurationMin: 0, aiOptimised: true,
    stopAddresses: [''],
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60">
      <div className="w-full max-w-md mx-auto rounded-t-3xl border-t border-drv-border bg-drv-card p-6 space-y-4 animate-slide-up max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-drv-text">New Route</h3>
          <button onClick={onClose} className="text-drv-textMuted hover:text-drv-text"><X size={18} /></button>
        </div>
        {[
          { key: 'origin', label: 'Origin / Depot', placeholder: 'Depot A, London' },
          { key: 'destination', label: 'Final Destination', placeholder: 'Customer, Manchester' },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-xs text-drv-textMuted mb-1">{label}</label>
            <input className="w-full rounded-xl border border-drv-border bg-drv-surface px-4 py-3 text-drv-text placeholder-drv-textMuted focus:outline-none focus:border-drv-accent/60"
              placeholder={placeholder} value={(form as Record<string, string | number | boolean | string[]>)[key] as string}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2">
          {[{ key: 'distanceKm', label: 'Distance (km)' }, { key: 'estimatedDurationMin', label: 'Est. Time (min)' }].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs text-drv-textMuted mb-1">{label}</label>
              <input type="number" className="w-full rounded-xl border border-drv-border bg-drv-surface px-4 py-3 text-drv-text focus:outline-none focus:border-drv-accent/60"
                value={(form as Record<string, number>)[key]}
                onChange={(e) => setForm({ ...form, [key]: parseFloat(e.target.value) || 0 })} />
            </div>
          ))}
        </div>

        {/* Stops */}
        <div>
          <p className="text-xs text-drv-textMuted mb-2">Stops (optional)</p>
          {form.stopAddresses.map((addr, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input className="flex-1 rounded-xl border border-drv-border bg-drv-surface px-3 py-2 text-sm text-drv-text placeholder-drv-textMuted focus:outline-none focus:border-drv-accent/60"
                placeholder={`Stop ${i + 1}`} value={addr}
                onChange={(e) => {
                  const a = [...form.stopAddresses]; a[i] = e.target.value;
                  setForm({ ...form, stopAddresses: a });
                }} />
              {form.stopAddresses.length > 1 && (
                <button onClick={() => setForm({ ...form, stopAddresses: form.stopAddresses.filter((_, j) => j !== i) })}
                  className="text-drv-danger"><X size={14} /></button>
              )}
            </div>
          ))}
          <button onClick={() => setForm({ ...form, stopAddresses: [...form.stopAddresses, ''] })}
            className="text-xs text-drv-accent">+ Add stop</button>
        </div>

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.aiOptimised}
            onChange={(e) => setForm({ ...form, aiOptimised: e.target.checked })} />
          <span className="text-sm text-drv-textDim">AI route optimisation</span>
        </label>

        <button onClick={() => {
          if (!form.origin || !form.destination) return;
          onAdd({
            id: `route_${uuid()}`, origin: form.origin, destination: form.destination,
            distanceKm: form.distanceKm, estimatedDurationMin: form.estimatedDurationMin,
            aiOptimised: form.aiOptimised, status: 'pending', vehicleId,
            dispatchedAt: Date.now(),
            stops: form.stopAddresses.filter(Boolean).map((addr) => ({
              id: `stop_${uuid()}`, address: addr, completed: false,
            })),
          });
          onClose();
        }} className="w-full rounded-2xl drv-gradient py-4 text-sm font-bold text-white">
          Start Route →
        </button>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function DriverApp() {
  const {
    profile, setProfile, routes, currentRouteId,
    addRoute, setCurrentRoute, startRoute, completeStop,
    completeRoute, getLifetimeStats, getTodayStats, getCurrentRoute,
  } = useDriverStore();

  const [tab, setTab] = useState<'home' | 'route' | 'impact' | 'profile'>('home');
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<ActiveRoute | null>(null);
  const [apexOnline, setApexOnline] = useState<boolean | null>(null);
  const [syncStatus, setSyncStatus] = useState('');

  const currentRoute = getCurrentRoute();
  const todayStats = getTodayStats();
  const lifetimeStats = getLifetimeStats();

  // Flush offline queue on load
  useEffect(() => {
    flushOfflineQueue().then((n) => { if (n > 0) setSyncStatus(`Synced ${n} offline route${n > 1 ? 's' : ''}`); });
  }, []);

  // Heartbeat
  useEffect(() => {
    if (!profile || profile.apexUrl === 'local') return;
    const hb = async () => {
      const ok = await pushDriverHeartbeat(profile, currentRoute?.status === 'in_progress' ? 'on_route' : 'available');
      setApexOnline(ok);
    };
    hb();
    const t = setInterval(hb, 60000);
    return () => clearInterval(t);
  }, [profile, currentRoute]);

  const handleCompleteRoute = useCallback(async (data: {
    fuelSavedL: number; optimisationSavingPercent: number;
    onTimeDelivery: boolean; actualDurationMin: number;
  }) => {
    if (!completeTarget || !profile) return;
    completeRoute(completeTarget.id, data);

    const updated: ActiveRoute = {
      ...completeTarget,
      status: 'completed',
      completedAt: Date.now(),
      fuelSavedL: data.fuelSavedL,
      co2SavedKg: data.fuelSavedL * 2.68,
      fuelCostSavedUSD: data.fuelSavedL * 1.35,
      optimisationSavingPercent: data.optimisationSavingPercent,
      onTimeDelivery: data.onTimeDelivery,
      actualDurationMin: data.actualDurationMin,
    };

    if (profile.apexUrl !== 'local') {
      const ok = await pushRouteComplete(profile, updated);
      if (!ok) queueRouteComplete(profile, updated);
      setSyncStatus(ok ? '✓ Sent to Fleet Control' : '⚠ Saved offline — will sync');
    } else {
      setSyncStatus('✓ Saved locally');
    }
    setTimeout(() => setSyncStatus(''), 4000);
    setCompleteTarget(null);
    setTab('impact');
  }, [completeTarget, profile, completeRoute]);

  // Onboarding
  if (!profile) {
    return <OnboardingScreen onDone={(p) => { setProfile(p); }} />;
  }

  const pendingRoutes = routes.filter((r) => r.status === 'pending');
  const activeRoutes = routes.filter((r) => r.status === 'in_progress');
  const completedRoutes = routes.filter((r) => r.status === 'completed');

  return (
    <div className="min-h-screen bg-drv-bg pb-24">
      {/* Status bar */}
      <div className="px-4 py-2 flex items-center justify-between bg-drv-surface border-b border-drv-border">
        <p className="text-[10px] text-drv-textMuted">👋 {profile.name}</p>
        <div className="flex items-center gap-2">
          {syncStatus && <span className="text-[10px] text-drv-success animate-fade-in">{syncStatus}</span>}
          {profile.apexUrl !== 'local' && (
            <div className={cn('flex items-center gap-1 text-[10px]', apexOnline === true ? 'text-drv-success' : apexOnline === false ? 'text-drv-danger' : 'text-drv-textMuted')}>
              {apexOnline === true ? <Wifi size={10} /> : <WifiOff size={10} />}
              {apexOnline === true ? 'Synced' : apexOnline === false ? 'Offline' : '—'}
            </div>
          )}
        </div>
      </div>

      {/* ── HOME TAB ── */}
      {tab === 'home' && (
        <div className="px-4 py-5 space-y-5 animate-fade-in">
          {/* Today's summary */}
          <div className="rounded-2xl drv-gradient p-5 text-white">
            <p className="text-xs font-semibold opacity-80 mb-3 uppercase tracking-wider">Today's Impact</p>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Routes" value={todayStats.totalRoutes} color="text-white" />
              <Stat label="CO₂ Saved" value={todayStats.totalCO2SavedKg.toFixed(1)} unit="kg" color="text-white" />
              <Stat label="Fuel Saved" value={todayStats.totalFuelSavedL.toFixed(1)} unit="L" color="text-white" />
            </div>
          </div>

          {/* Active route */}
          {activeRoutes.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-drv-textMuted mb-2 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-drv-accent animate-pulse-slow inline-block" />
                Active Route
              </p>
              {activeRoutes.map((r) => (
                <RouteCard key={r.id} route={r} isActive={true}
                  onComplete={() => setCompleteTarget(r)} />
              ))}
              {/* Stop checklist */}
              {currentRoute?.stops && currentRoute.stops.length > 0 && (
                <div className="mt-3 rounded-2xl border border-drv-border bg-drv-card p-4 space-y-2">
                  <p className="text-xs font-semibold text-drv-textDim flex items-center gap-1.5"><Package size={12} /> Stops</p>
                  {currentRoute.stops.map((stop) => (
                    <button key={stop.id} onClick={() => completeStop(currentRoute.id, stop.id)}
                      className={cn('w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-xs transition-colors',
                        stop.completed ? 'border-drv-success/30 bg-drv-success/5 text-drv-textMuted line-through' : 'border-drv-border bg-drv-surface text-drv-text')}>
                      {stop.completed ? <CheckCircle size={14} className="text-drv-success shrink-0" /> : <div className="h-3.5 w-3.5 rounded-full border border-drv-textMuted shrink-0" />}
                      {stop.address}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pending routes */}
          {pendingRoutes.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-drv-textMuted mb-2">Pending</p>
              {pendingRoutes.map((r) => (
                <RouteCard key={r.id} route={r} isActive={false}
                  onStart={() => { startRoute(r.id); setCurrentRoute(r.id); }} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {routes.filter((r) => r.status !== 'completed').length === 0 && (
            <div className="text-center py-12 space-y-3">
              <div className="inline-flex h-14 w-14 rounded-2xl bg-drv-surface border border-drv-border items-center justify-center">
                <MapPin size={22} className="text-drv-textMuted" />
              </div>
              <p className="text-sm text-drv-textMuted">No active routes</p>
              <button onClick={() => setShowAddRoute(true)} className="rounded-xl drv-gradient px-5 py-2.5 text-xs font-bold text-white">
                + Start a Route
              </button>
            </div>
          )}

          {/* FAB */}
          <button onClick={() => setShowAddRoute(true)}
            className="fixed bottom-20 right-4 h-12 w-12 rounded-2xl drv-gradient flex items-center justify-center shadow-lg">
            <Play size={18} className="text-white" />
          </button>
        </div>
      )}

      {/* ── ROUTE HISTORY TAB ── */}
      {tab === 'route' && (
        <div className="px-4 py-5 space-y-4 animate-fade-in">
          <h2 className="text-lg font-bold text-drv-text">Route History</h2>
          {completedRoutes.length === 0 ? (
            <div className="text-center py-12 text-drv-textMuted text-sm">No completed routes yet.</div>
          ) : (
            completedRoutes.slice(0, 30).map((r) => (
              <RouteCard key={r.id} route={r} isActive={false} />
            ))
          )}
        </div>
      )}

      {/* ── IMPACT TAB ── */}
      {tab === 'impact' && (
        <div className="px-4 py-5 space-y-5 animate-fade-in">
          <h2 className="text-lg font-bold">🌿 My <span className="drv-gradient-text">Impact</span></h2>

          {/* Lifetime stats */}
          <div className="rounded-2xl border border-drv-success/30 bg-drv-success/5 p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-drv-success">Lifetime Total</p>
            <div className="grid grid-cols-2 gap-4">
              <Stat label="CO₂ Avoided" value={lifetimeStats.totalCO2SavedKg.toFixed(1)} unit="kg" color="text-drv-success" />
              <Stat label="Fuel Saved" value={lifetimeStats.totalFuelSavedL.toFixed(1)} unit="L" color="text-drv-success" />
              <Stat label="Cost Saved" value={formatCurrency(lifetimeStats.totalCostSavedUSD)} color="text-drv-accent" />
              <Stat label="Routes" value={lifetimeStats.totalRoutes} color="text-drv-purple" />
            </div>
          </div>

          {/* Equivalents */}
          <div className="rounded-2xl border border-drv-border bg-drv-card p-4 space-y-3">
            <p className="text-xs font-semibold text-drv-textDim">That's equivalent to…</p>
            {[
              {
                icon: TreePine, color: 'text-drv-success',
                value: (lifetimeStats.totalCO2SavedKg / 21).toFixed(1),
                label: 'trees absorbing CO₂ for a full year',
              },
              {
                icon: Car, color: 'text-drv-purple',
                value: formatNumber(Math.round(lifetimeStats.totalCO2SavedKg / 0.12)),
                label: 'km not driven by a petrol car',
              },
              {
                icon: Fuel, color: 'text-drv-warning',
                value: lifetimeStats.totalFuelSavedL.toFixed(0),
                label: 'litres of diesel not burned',
              },
            ].map(({ icon: Icon, color, value, label }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl bg-drv-surface p-3">
                <Icon size={18} className={color} />
                <div>
                  <p className={cn('text-base font-bold', color)}>{value}</p>
                  <p className="text-[10px] text-drv-textMuted">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Today vs all time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-drv-border bg-drv-card p-3 text-center">
              <p className="text-[10px] text-drv-textMuted mb-2 uppercase tracking-wider">Today</p>
              <p className="text-lg font-bold text-drv-success">{todayStats.totalCO2SavedKg.toFixed(1)} kg</p>
              <p className="text-[10px] text-drv-textMuted">CO₂ avoided</p>
            </div>
            <div className="rounded-xl border border-drv-border bg-drv-card p-3 text-center">
              <p className="text-[10px] text-drv-textMuted mb-2 uppercase tracking-wider">On-Time</p>
              <p className="text-lg font-bold text-drv-accent">
                {lifetimeStats.totalRoutes > 0
                  ? ((lifetimeStats.totalOnTime / lifetimeStats.totalRoutes) * 100).toFixed(0)
                  : 0}%
              </p>
              <p className="text-[10px] text-drv-textMuted">delivery rate</p>
            </div>
          </div>
        </div>
      )}

      {/* ── PROFILE TAB ── */}
      {tab === 'profile' && (
        <div className="px-4 py-5 space-y-5 animate-fade-in">
          <h2 className="text-lg font-bold text-drv-text">Profile</h2>

          <div className="rounded-2xl border border-drv-border bg-drv-card p-5 flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl drv-gradient flex items-center justify-center shrink-0">
              <User size={22} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-drv-text">{profile.name}</p>
              <p className="text-xs text-drv-textMuted">{profile.fleetName}</p>
              <p className="text-[10px] text-drv-textMuted mt-0.5">Driver since {new Date(profile.joinedAt).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-drv-border bg-drv-card p-4 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-drv-textMuted">Connection</p>
            {[
              { label: 'Apex URL', value: profile.apexUrl },
              { label: 'Tenant ID', value: profile.tenantId || 'Not set' },
              { label: 'Fleet ID', value: profile.fleetId || 'Not set' },
              { label: 'Driver ID', value: profile.id },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-drv-border/30 last:border-0">
                <span className="text-xs text-drv-textMuted">{label}</span>
                <span className="text-xs font-mono text-drv-textDim truncate max-w-[160px]">{value}</span>
              </div>
            ))}
          </div>

          <button onClick={() => setProfile(null)}
            className="w-full rounded-2xl border border-drv-danger/30 py-3 text-sm font-semibold text-drv-danger hover:bg-drv-danger/10 transition-colors">
            Reset & Re-connect
          </button>
        </div>
      )}

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto border-t border-drv-border bg-drv-surface/95 backdrop-blur-sm flex">
        {([
          { key: 'home', icon: MapPin, label: 'Routes' },
          { key: 'route', icon: Clock, label: 'History' },
          { key: 'impact', icon: Leaf, label: 'Impact' },
          { key: 'profile', icon: User, label: 'Profile' },
        ] as { key: typeof tab; icon: React.ElementType; label: string }[]).map(({ key, icon: Icon, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn('flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors',
              tab === key ? 'text-drv-accent' : 'text-drv-textMuted')}>
            <Icon size={18} />
            <span className="text-[9px] font-medium">{label}</span>
          </button>
        ))}
      </nav>

      {/* Modals */}
      {showAddRoute && (
        <AddRouteSheet
          onClose={() => setShowAddRoute(false)}
          onAdd={(r) => { addRoute(r); setShowAddRoute(false); setCurrentRoute(r.id); }}
          vehicleId="unknown"
        />
      )}
      {completeTarget && (
        <CompleteSheet route={completeTarget} onClose={() => setCompleteTarget(null)} onConfirm={handleCompleteRoute} />
      )}
    </div>
  );
}
