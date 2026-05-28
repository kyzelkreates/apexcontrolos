'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useAP3XStore } from '@/store/ap3x-store';
import { fetchDecisionTraces } from '@/services/governanceService';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { NoDataBanner } from '@/components/shared/NoDataBanner';
import type { DecisionTraceLog, DecisionRuleStep } from '@/types/governance';
import type { Driver, Vehicle, Task } from '@/types/db';
import {
  Brain, ChevronDown, ChevronRight, Search,
  RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  Zap, Users, Truck, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const OUTCOME_COLORS: Record<string, string> = {
  assigned:   'text-apex-success  bg-apex-success/10  border-apex-success/30',
  rejected:   'text-apex-danger   bg-apex-danger/10   border-apex-danger/30',
  escalated:  'text-apex-warning  bg-apex-warning/10  border-apex-warning/30',
  overridden: 'text-apex-purple   bg-apex-purple/10   border-apex-purple/30',
};

const TRIGGER_ICONS: Record<string, React.ReactNode> = {
  system_auto:       <Zap size={11} />,
  dispatcher_manual: <Users size={11} />,
  safety_officer:    <AlertTriangle size={11} />,
  ai_engine:         <Brain size={11} />,
};

function RuleStepRow({ step }: { step: DecisionRuleStep }) {
  return (
    <div className={cn('flex items-start gap-3 rounded-lg px-3 py-2 border text-xs', {
      'bg-apex-success/5 border-apex-success/20': step.result === 'pass',
      'bg-apex-danger/5  border-apex-danger/20':  step.result === 'fail',
      'bg-apex-surface   border-apex-border/50':  step.result === 'skip',
    })}>
      <span className="font-mono text-apex-textMuted w-4 flex-shrink-0">{step.step}.</span>
      {step.result === 'pass'
        ? <CheckCircle2 size={12} className="text-apex-success flex-shrink-0 mt-0.5" />
        : step.result === 'fail'
          ? <XCircle size={12} className="text-apex-danger flex-shrink-0 mt-0.5" />
          : <div className="h-3 w-3 rounded-full bg-apex-textMuted/30 flex-shrink-0 mt-0.5" />
      }
      <div className="flex-1 min-w-0">
        <span className="font-mono font-semibold text-apex-text">{step.rule}</span>
        <p className="text-apex-textMuted mt-0.5">{step.detail}</p>
      </div>
      <span className="flex-shrink-0 font-mono text-[10px] text-apex-textMuted">
        w={step.weight.toFixed(2)}
      </span>
    </div>
  );
}

function TraceCard({ trace, drivers, vehicles, tasks }: {
  trace: DecisionTraceLog;
  drivers: Driver[];
  vehicles: Vehicle[];
  tasks: Task[];
}) {
  const [expanded, setExpanded] = useState(false);
  const driver  = drivers.find((d) => d.id === trace.driver_id);
  const vehicle = vehicles.find((v) => v.id === trace.vehicle_id);
  const task    = tasks.find((t) => t.id === trace.task_id);
  const passCount = trace.rule_chain.filter((r) => r.result === 'pass').length;
  const failCount = trace.rule_chain.filter((r) => r.result === 'fail').length;

  return (
    <div className={cn('rounded-xl border bg-apex-card transition-all', {
      'border-apex-success/30': trace.outcome === 'assigned',
      'border-apex-danger/30':  trace.outcome === 'rejected',
      'border-apex-warning/30': trace.outcome === 'escalated',
      'border-apex-purple/30':  trace.outcome === 'overridden',
    })}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Outcome badge */}
        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold flex-shrink-0 capitalize',
          OUTCOME_COLORS[trace.outcome] ?? 'text-apex-textMuted border-apex-border')}>
          {trace.outcome}
        </span>

        {/* Task + driver */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-apex-text truncate">
            {task?.title ?? `Task ${trace.task_id.slice(0, 8)}…`}
          </p>
          <div className="flex items-center gap-3 mt-0.5 text-[10px] text-apex-textMuted">
            {driver  && <span className="flex items-center gap-1"><Users size={8}/> {driver.name}</span>}
            {vehicle && <span className="flex items-center gap-1"><Truck size={8}/> {vehicle.name}</span>}
            <span className="flex items-center gap-1">
              {TRIGGER_ICONS[trace.triggered_by] ?? <Zap size={8} />}
              {trace.triggered_by.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Rule summary */}
        <div className="hidden sm:flex items-center gap-2 text-[10px] flex-shrink-0">
          <span className="text-apex-success">{passCount} pass</span>
          {failCount > 0 && <span className="text-apex-danger">{failCount} fail</span>}
          {trace.confidence_score !== null && (
            <span className="font-mono text-apex-textMuted">
              {(trace.confidence_score * 100).toFixed(0)}% conf
            </span>
          )}
        </div>

        {/* Timestamp */}
        <span className="hidden md:block text-[10px] font-mono text-apex-textMuted flex-shrink-0">
          {new Date(trace.created_at).toLocaleString()}
        </span>

        <ChevronDown size={14} className={cn('text-apex-textMuted flex-shrink-0 transition-transform', expanded && 'rotate-180')} />
      </div>

      {expanded && (
        <div className="border-t border-apex-border px-4 py-4 space-y-4">
          {/* Context snapshot */}
          {Object.keys(trace.context_snapshot).length > 0 && (
            <div className="rounded-lg bg-apex-surface border border-apex-border/50 px-4 py-3">
              <p className="text-[10px] font-bold uppercase text-apex-textMuted tracking-wider mb-2">Context at Decision Time</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(trace.context_snapshot).map(([k, v]) => (
                  <div key={k} className="text-xs">
                    <p className="text-apex-textMuted">{k.replace(/_/g, ' ')}</p>
                    <p className="font-mono font-semibold text-apex-text">{String(v)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rule chain */}
          <div>
            <p className="text-[10px] font-bold uppercase text-apex-textMuted tracking-wider mb-2">
              Reasoning Chain — {trace.rule_chain.length} rules evaluated
            </p>
            <div className="space-y-1.5">
              {trace.rule_chain.map((step) => (
                <RuleStepRow key={step.step} step={step} />
              ))}
            </div>
          </div>

          {/* Override reason */}
          {trace.override_reason && (
            <div className="flex items-start gap-2 rounded-lg bg-apex-purple/10 border border-apex-purple/30 px-3 py-2.5">
              <AlertTriangle size={12} className="text-apex-purple flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-apex-purple">Override Reason</p>
                <p className="text-xs text-apex-textDim mt-0.5">{trace.override_reason}</p>
              </div>
            </div>
          )}

          {/* IDs */}
          <div className="grid grid-cols-2 gap-1.5 text-[10px] text-apex-textMuted font-mono">
            <div>trace_id: {trace.id.slice(0, 16)}…</div>
            <div>task_id: {trace.task_id.slice(0, 16)}…</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DecisionEnginePage() {
  const { tasks, drivers, vehicles, isConfigured } = useAP3XStore();
  const [traces, setTraces]     = useState<DecisionTraceLog[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState<'all' | 'assigned' | 'rejected' | 'escalated' | 'overridden'>('all');

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return; }
    fetchDecisionTraces({ limit: 200 }).then((d) => {
      setTraces(d ?? []);
      setLoading(false);
    });
  }, [isConfigured]);

  const filtered = useMemo(() => traces.filter((t) => {
    if (filter !== 'all' && t.outcome !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const task = tasks.find((tk) => tk.id === t.task_id);
      return (
        (task?.title ?? '').toLowerCase().includes(q) ||
        t.decision_type.toLowerCase().includes(q) ||
        t.triggered_by.toLowerCase().includes(q) ||
        t.outcome.toLowerCase().includes(q)
      );
    }
    return true;
  }), [traces, filter, search, tasks]);

  if (!isConfigured) return <NoDataBanner reason="not_configured" />;

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-apex-text">
          Decision <span className="apex-gradient-text">Explanation Engine</span>
        </h1>
        <p className="text-sm text-apex-textMuted mt-1">
          Full reasoning chain for every dispatch decision · read-only
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-apex-textMuted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search decisions, tasks, triggers…"
            className="w-full rounded-lg border border-apex-border bg-apex-card pl-8 pr-3 py-2 text-sm text-apex-text placeholder-apex-textMuted focus:border-apex-accent focus:outline-none"
          />
        </div>
        {(['all','assigned','rejected','escalated','overridden'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-colors capitalize',
              filter === f ? 'bg-apex-accent text-white' : 'bg-apex-card border border-apex-border text-apex-textMuted hover:text-apex-text'
            )}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-apex-textMuted">
          <RefreshCw size={16} className="animate-spin mr-2" /> Loading decision traces…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-apex-textMuted">
          <Brain size={36} className="opacity-20" />
          <p className="text-sm">{traces.length === 0
            ? 'No decision traces yet. They appear here once the dispatch engine runs.'
            : 'No decisions match your filters.'
          }</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((trace) => (
            <TraceCard key={trace.id} trace={trace} drivers={drivers} vehicles={vehicles} tasks={tasks} />
          ))}
        </div>
      )}
    </div>
  );
}
