'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useAP3XStore } from '@/store/ap3x-store';
import { fetchAuditLog, fetchHighRiskAudit } from '@/services/governanceService';
import { NoDataBanner } from '@/components/shared/NoDataBanner';
import type { AuditLogEntry, RiskLevel } from '@/types/governance';
import {
  FileText, Search, RefreshCw, ChevronDown,
  AlertTriangle, Shield, Lock, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const RISK_BADGE: Record<RiskLevel, string> = {
  low:      'bg-apex-success/10 text-apex-success  border-apex-success/30',
  medium:   'bg-apex-warning/10 text-apex-warning  border-apex-warning/30',
  high:     'bg-apex-danger/10  text-apex-danger   border-apex-danger/30',
  critical: 'bg-apex-danger/20  text-apex-danger   border-apex-danger/60',
};

const ACTION_COLORS: Record<string, string> = {
  task_created:      'text-apex-accent',
  task_cancelled:    'text-apex-danger',
  task_assigned:     'text-apex-cyan',
  task_completed:    'text-apex-success',
  override_applied:  'text-apex-purple',
  escalation_triggered: 'text-apex-warning',
  safety_threshold_breach: 'text-apex-danger',
  setting_changed:   'text-apex-warning',
};

function DiffViewer({ before, after }: { before: Record<string, unknown>; after: Record<string, unknown> }) {
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const changes = keys.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  if (!changes.length) return <p className="text-xs text-apex-textMuted">No field-level changes detected.</p>;

  return (
    <div className="space-y-1.5">
      {changes.map((k) => (
        <div key={k} className="grid grid-cols-3 gap-2 text-[11px] rounded-lg bg-apex-surface border border-apex-border/50 px-3 py-2">
          <span className="font-mono text-apex-textMuted">{k}</span>
          <span className="text-apex-danger line-through truncate">{String(before[k] ?? '—')}</span>
          <span className="text-apex-success truncate">{String(after[k] ?? '—')}</span>
        </div>
      ))}
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasDiff = Object.keys(entry.before_state).length > 0 || Object.keys(entry.after_state).length > 0;

  return (
    <div className={cn('rounded-xl border bg-apex-card', {
      'border-apex-danger/30':  ['high','critical'].includes(entry.risk_level),
      'border-apex-warning/30': entry.risk_level === 'medium',
      'border-apex-border':     entry.risk_level === 'low',
    })}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Override indicator */}
        {entry.is_override && (
          <AlertTriangle size={12} className="text-apex-purple flex-shrink-0" />
        )}

        {/* Action */}
        <span className={cn('text-xs font-mono font-semibold flex-shrink-0',
          ACTION_COLORS[entry.action] ?? 'text-apex-textDim')}>
          {entry.action}
        </span>

        {/* Entity */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-apex-text truncate">
            {entry.entity_type}
            {entry.entity_id ? ` · ${entry.entity_id.slice(0,8)}…` : ''}
          </p>
          <p className="text-[10px] text-apex-textMuted mt-0.5 truncate">
            {entry.actor_email ?? entry.actor_role ?? 'system'}
            {entry.acting_as !== 'self' ? ` [${entry.acting_as}]` : ''}
          </p>
        </div>

        {/* Risk badge */}
        <span className={cn('hidden sm:inline rounded-full border px-2 py-0.5 text-[10px] font-bold flex-shrink-0 capitalize',
          RISK_BADGE[entry.risk_level])}>
          {entry.risk_level}
        </span>

        {/* Timestamp */}
        <span className="hidden md:block font-mono text-[10px] text-apex-textMuted flex-shrink-0">
          {new Date(entry.created_at).toLocaleString()}
        </span>

        <ChevronDown size={14} className={cn('text-apex-textMuted flex-shrink-0 transition-transform', expanded && 'rotate-180')} />
      </div>

      {expanded && (
        <div className="border-t border-apex-border px-4 py-4 space-y-3">
          {/* Entity snapshot */}
          {Object.keys(entry.entity_snapshot).length > 0 && (
            <div className="rounded-lg bg-apex-surface border border-apex-border/50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase text-apex-textMuted mb-2">Entity State at Action Time</p>
              <pre className="text-[10px] font-mono text-apex-textDim overflow-x-auto max-h-32">
                {JSON.stringify(entry.entity_snapshot, null, 2)}
              </pre>
            </div>
          )}

          {/* Diff */}
          {hasDiff && (
            <div>
              <div className="flex items-center gap-4 text-[10px] font-bold uppercase text-apex-textMuted mb-2">
                <span className="flex-none w-1/3">Field</span>
                <span className="flex-none text-apex-danger">Before</span>
                <span className="flex-none ml-2 text-apex-success">After</span>
              </div>
              <DiffViewer before={entry.before_state} after={entry.after_state} />
            </div>
          )}

          {/* Override justification */}
          {entry.override_justification && (
            <div className="flex items-start gap-2 rounded-lg bg-apex-purple/10 border border-apex-purple/30 px-3 py-2.5">
              <Shield size={12} className="text-apex-purple flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-apex-purple">Override Justification</p>
                <p className="text-xs text-apex-textDim mt-0.5">{entry.override_justification}</p>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px] text-apex-textMuted">
            <div><span className="text-apex-textDim">Source:</span> {entry.source_system}</div>
            <div><span className="text-apex-textDim">Actor role:</span> {entry.actor_role ?? '—'}</div>
            <div><span className="text-apex-textDim">Acting as:</span> {entry.acting_as}</div>
            {entry.request_id && <div className="col-span-2 font-mono">req: {entry.request_id.slice(0,16)}…</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuditPage() {
  const { isConfigured, profiles } = useAP3XStore();
  const [entries, setEntries]   = useState<AuditLogEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [view, setView]         = useState<'all' | 'high_risk' | 'overrides'>('all');
  const [search, setSearch]     = useState('');
  const [entityFilter, setEntityFilter] = useState('all');

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return; }
    setLoading(true);

    const loader = view === 'high_risk'
      ? fetchHighRiskAudit()
      : view === 'overrides'
        ? fetchAuditLog({ isOverride: true, limit: 200 })
        : fetchAuditLog({ limit: 200 });

    loader.then((d) => { setEntries(d ?? []); setLoading(false); });
  }, [isConfigured, view]);

  const entityTypes = useMemo(() =>
    Array.from(new Set(entries.map((e) => e.entity_type))).sort()
  , [entries]);

  const filtered = useMemo(() => entries.filter((e) => {
    if (entityFilter !== 'all' && e.entity_type !== entityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        e.action.toLowerCase().includes(q) ||
        (e.actor_email ?? '').toLowerCase().includes(q) ||
        (e.actor_role ?? '').toLowerCase().includes(q) ||
        e.entity_type.toLowerCase().includes(q) ||
        (e.entity_id ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  }), [entries, entityFilter, search]);

  if (!isConfigured) return <NoDataBanner reason="not_configured" />;

  const overrideCount  = entries.filter((e) => e.is_override).length;
  const highRiskCount  = entries.filter((e) => ['high','critical'].includes(e.risk_level)).length;
  const criticalCount  = entries.filter((e) => e.risk_level === 'critical').length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-apex-text">
          Audit <span className="apex-gradient-text">& Governance</span>
        </h1>
        <p className="text-sm text-apex-textMuted mt-1">
          Immutable audit trail · role-based action tracking · override history
        </p>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Total Events',  value: entries.length, color: 'text-apex-textDim' },
          { label: 'High Risk',     value: highRiskCount,  color: 'text-apex-warning' },
          { label: 'Critical',      value: criticalCount,  color: 'text-apex-danger'  },
          { label: 'Overrides',     value: overrideCount,  color: 'text-apex-purple'  },
        ].map((p) => (
          <div key={p.label} className="rounded-lg border border-apex-border bg-apex-card px-4 py-2.5 text-center">
            <p className={cn('text-lg font-bold font-mono', p.color)}>{p.value}</p>
            <p className="text-[10px] text-apex-textMuted">{p.label}</p>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1.5 rounded-lg border border-apex-success/30 bg-apex-success/5 px-3 py-2 text-xs text-apex-success">
          <Lock size={11} /> Immutable log — no updates or deletes
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-apex-textMuted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actions, actors, entity IDs…"
            className="w-full rounded-lg border border-apex-border bg-apex-card pl-8 pr-3 py-2 text-sm text-apex-text placeholder-apex-textMuted focus:border-apex-accent focus:outline-none"
          />
        </div>
        {(['all','high_risk','overrides'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-colors capitalize',
              view === v ? 'bg-apex-accent text-white' : 'bg-apex-card border border-apex-border text-apex-textMuted hover:text-apex-text'
            )}>
            {v.replace('_',' ')}
          </button>
        ))}
        {entityTypes.length > 0 && (
          <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}
            className="rounded-lg border border-apex-border bg-apex-card px-3 py-1.5 text-xs text-apex-text focus:border-apex-accent focus:outline-none">
            <option value="all">All entities</option>
            {entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      {/* Entries */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-apex-textMuted">
          <RefreshCw size={16} className="animate-spin mr-2" /> Loading audit log…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-apex-textMuted">
          <FileText size={36} className="opacity-20" />
          <p className="text-sm">{entries.length === 0
            ? 'No audit log entries yet. They are written automatically as actions occur.'
            : 'No entries match your filters.'
          }</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => (
            <AuditRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
