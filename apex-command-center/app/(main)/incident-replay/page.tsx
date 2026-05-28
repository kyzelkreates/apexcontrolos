'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useAP3XStore } from '@/store/ap3x-store';
import { fetchIncidentReplays } from '@/services/governanceService';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { NoDataBanner } from '@/components/shared/NoDataBanner';
import type { IncidentReplay, ReplayTimelineFrame, ReplayAnomaly } from '@/types/governance';
import {
  PlayCircle, AlertTriangle, ChevronDown, Search,
  RefreshCw, Clock, Users, Cpu, Activity,
  CheckCircle2, XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000)   return `${ms}ms`;
  if (ms < 60000)  return `${(ms/1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms/60000).toFixed(1)}min`;
  return `${(ms/3600000).toFixed(1)}h`;
}

function AnomalyBadge({ anomaly }: { anomaly: ReplayAnomaly }) {
  return (
    <div className={cn('flex items-start gap-2 rounded-lg border px-3 py-2', {
      'bg-apex-danger/5  border-apex-danger/20':  anomaly.severity === 'critical',
      'bg-apex-warning/5 border-apex-warning/20': anomaly.severity === 'warning',
      'bg-apex-surface   border-apex-border/50':  anomaly.severity === 'info',
    })}>
      <AlertTriangle size={11} className={cn('mt-0.5 flex-shrink-0', {
        'text-apex-danger':  anomaly.severity === 'critical',
        'text-apex-warning': anomaly.severity === 'warning',
        'text-apex-textMuted': anomaly.severity === 'info',
      })} />
      <div>
        <p className="text-xs font-semibold text-apex-text">{anomaly.type.replace(/_/g,' ')}</p>
        {anomaly.delta_ms !== undefined && (
          <p className="text-[10px] text-apex-textMuted mt-0.5">
            Duration: {formatDuration(anomaly.delta_ms)} · Threshold: {formatDuration(anomaly.threshold_ms ?? null)}
          </p>
        )}
        {anomaly.detail && <p className="text-[10px] text-apex-textMuted">{anomaly.detail}</p>}
      </div>
    </div>
  );
}

function TimelineFrame({ frame, isLast }: { frame: ReplayTimelineFrame; isLast: boolean }) {
  const isDriver = frame.actor_role === 'driver' || frame.source === 'driver_locations';
  const isSystem = frame.actor === 'system' || frame.actor === 'dispatcher_engine' || frame.source === 'job_assignments';

  return (
    <div className="flex gap-3">
      {/* Connector */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={cn('h-7 w-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-[10px] font-bold', {
          'border-apex-purple  bg-apex-purple/10  text-apex-purple':  isDriver,
          'border-apex-accent  bg-apex-accent/10  text-apex-accent':  isSystem,
          'border-apex-success bg-apex-success/10 text-apex-success': frame.event_type.includes('complete'),
          'border-apex-danger  bg-apex-danger/10  text-apex-danger':  frame.event_type.includes('cancel'),
        })}>
          {isDriver ? <Users size={12} /> : isSystem ? <Cpu size={12} /> : <Activity size={12} />}
        </div>
        {!isLast && <div className="flex-1 w-px bg-apex-border/50 my-1" />}
      </div>

      {/* Content */}
      <div className={cn('flex-1 pb-4', isLast && 'pb-0')}>
        <div className="rounded-lg border border-apex-border/50 bg-apex-surface px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-apex-text">{frame.label}</p>
              <p className={cn('text-[10px] font-mono mt-0.5', {
                'text-apex-purple':  isDriver,
                'text-apex-accent':  isSystem,
                'text-apex-textMuted': !isDriver && !isSystem,
              })}>
                {frame.event_type}
                {frame.actor_role ? ` · ${frame.actor_role}` : ''}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-mono text-[10px] text-apex-textMuted">
                {new Date(frame.timestamp).toLocaleTimeString()}
              </p>
              {frame.delta_ms > 0 && (
                <p className="font-mono text-[10px] text-apex-textDim">+{formatDuration(frame.delta_ms)}</p>
              )}
            </div>
          </div>
          {Object.keys(frame.state).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(frame.state).slice(0, 4).map(([k, v]) => (
                <span key={k} className="rounded-full bg-apex-border/50 px-2 py-0.5 text-[10px] font-mono text-apex-textMuted">
                  {k}: {String(v).slice(0,20)}
                </span>
              ))}
            </div>
          )}
        </div>
        <p className="mt-1 text-[10px] text-apex-textMuted ml-1">
          seq #{frame.seq} · source: {frame.source}
        </p>
      </div>
    </div>
  );
}

function ReplayModal({ replay, onClose }: { replay: IncidentReplay; onClose: () => void }) {
  const [tab, setTab] = useState<'timeline' | 'driver' | 'system' | 'anomalies'>('timeline');

  const frames = tab === 'driver' ? replay.driver_decisions
    : tab === 'system' ? replay.system_decisions
    : replay.timeline;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-apex-border bg-apex-card shadow-apex-card">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-apex-border px-5 py-4 flex-shrink-0">
          <PlayCircle size={16} className="text-apex-accent" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-apex-text truncate">{replay.replay_label}</p>
            <p className="text-[10px] text-apex-textMuted">
              Duration: {formatDuration(replay.total_duration_ms)} ·
              {replay.timeline.length} frames ·
              {replay.has_anomalies ? ` ${replay.anomalies.length} anomalies` : ' no anomalies'}
            </p>
          </div>
          <StatusBadge status={replay.risk_level} />
          <button onClick={onClose} className="text-apex-textMuted hover:text-apex-text text-lg leading-none">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-apex-border px-5 flex-shrink-0">
          {([
            { key: 'timeline', label: `Timeline (${replay.timeline.length})` },
            { key: 'driver',   label: `Driver (${replay.driver_decisions.length})` },
            { key: 'system',   label: `System (${replay.system_decisions.length})` },
            { key: 'anomalies',label: `Anomalies (${replay.anomalies.length})` },
          ] as const).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('py-3 px-4 text-xs font-medium border-b-2 transition-colors', {
                'border-apex-accent text-apex-accent': tab === t.key,
                'border-transparent text-apex-textMuted hover:text-apex-text': tab !== t.key,
              })}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'anomalies' ? (
            replay.anomalies.length === 0
              ? <p className="text-xs text-apex-textMuted text-center py-8">No anomalies detected in this replay.</p>
              : <div className="space-y-2">{replay.anomalies.map((a, i) => <AnomalyBadge key={i} anomaly={a} />)}</div>
          ) : frames.length === 0 ? (
            <p className="text-xs text-apex-textMuted text-center py-8">No {tab} events recorded.</p>
          ) : (
            <div>
              {frames.map((frame, i) => (
                <TimelineFrame key={frame.seq} frame={frame} isLast={i === frames.length - 1} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function IncidentReplayPage() {
  const { isConfigured } = useAP3XStore();
  const [replays, setReplays]     = useState<IncidentReplay[]>([]);
  const [loading, setLoading]     = useState(true);
  const [view, setView]           = useState<'all' | 'incidents' | 'anomalies'>('all');
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState<IncidentReplay | null>(null);

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return; }
    setLoading(true);
    const opts = {
      isIncident:    view === 'incidents' ? true : undefined,
      hasAnomalies:  view === 'anomalies' ? true : undefined,
      limit: 100,
    };
    fetchIncidentReplays(opts).then((d) => { setReplays(d ?? []); setLoading(false); });
  }, [isConfigured, view]);

  const filtered = useMemo(() => replays.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.replay_label.toLowerCase().includes(q) ||
      (r.task_title ?? '').toLowerCase().includes(q) ||
      r.task_id.toLowerCase().includes(q)
    );
  }), [replays, search]);

  if (!isConfigured) return <NoDataBanner reason="not_configured" />;

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-apex-text">
          Incident <span className="apex-gradient-text">Replay System</span>
        </h1>
        <p className="text-sm text-apex-textMuted mt-1">
          Full task lifecycle reconstruction · stop-by-stop execution · driver + system decisions side-by-side
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-apex-textMuted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search replays, task titles…"
            className="w-full rounded-lg border border-apex-border bg-apex-card pl-8 pr-3 py-2 text-sm text-apex-text placeholder-apex-textMuted focus:border-apex-accent focus:outline-none"
          />
        </div>
        {(['all','incidents','anomalies'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={cn('rounded-full px-3 py-1.5 text-xs font-medium transition-colors capitalize',
              view === v ? 'bg-apex-accent text-white' : 'bg-apex-card border border-apex-border text-apex-textMuted hover:text-apex-text'
            )}>
            {v}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-apex-textMuted">
          <RefreshCw size={16} className="animate-spin mr-2" /> Loading replays…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-apex-textMuted">
          <PlayCircle size={36} className="opacity-20" />
          <p className="text-sm">{replays.length === 0
            ? 'No replays yet. They are constructed automatically as tasks complete.'
            : 'No replays match your filters.'
          }</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <div key={r.id} className={cn('rounded-xl border bg-apex-card hover:border-apex-accent/30 transition-all', {
              'border-apex-danger/30':  r.is_incident || r.risk_level === 'critical',
              'border-apex-warning/30': r.has_anomalies && !r.is_incident,
              'border-apex-border':     !r.is_incident && !r.has_anomalies,
            })}>
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Status indicators */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {r.is_incident
                    ? <AlertTriangle size={14} className="text-apex-danger" />
                    : r.has_anomalies
                      ? <AlertTriangle size={14} className="text-apex-warning" />
                      : <CheckCircle2 size={14} className="text-apex-success" />
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-apex-text truncate">{r.replay_label}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-apex-textMuted">
                    <span className="flex items-center gap-1"><Clock size={8}/> {formatDuration(r.total_duration_ms)}</span>
                    <span>{r.timeline.length} frames</span>
                    {r.has_anomalies && <span className="text-apex-warning">{r.anomalies.length} anomaly{r.anomalies.length !== 1 ? 'ies' : ''}</span>}
                    {r.task_priority && <StatusBadge status={r.task_priority} />}
                  </div>
                </div>

                {/* Risk + version */}
                <StatusBadge status={r.risk_level} />
                <span className="hidden sm:block font-mono text-[10px] text-apex-textMuted flex-shrink-0">
                  v{r.version} · {new Date(r.constructed_at).toLocaleDateString()}
                </span>

                {/* Play button */}
                <button
                  onClick={() => setSelected(r)}
                  className="flex items-center gap-1.5 rounded-lg bg-apex-accent/10 border border-apex-accent/30 px-3 py-1.5 text-xs font-medium text-apex-accent hover:bg-apex-accent/20 transition-colors flex-shrink-0"
                >
                  <PlayCircle size={12} /> Replay
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && <ReplayModal replay={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
