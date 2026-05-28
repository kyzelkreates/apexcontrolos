'use client';
import React, { useState, useMemo } from 'react';
import { useAP3XStore } from '@/store/ap3x-store';
import { createTask, updateTask } from '@/services/ap3xDataService';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { NoDataBanner } from '@/components/shared/NoDataBanner';
import { formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { TaskPriority, TaskStatus } from '@/types/db';
import {
  ClipboardList, Plus, Search, RefreshCw,
  X, AlertTriangle, ChevronDown,
} from 'lucide-react';

const PRIORITY_ORDER: TaskPriority[] = ['critical', 'high', 'medium', 'low'];
const STATUS_TABS: { value: TaskStatus | 'all'; label: string }[] = [
  { value: 'all',         label: 'All' },
  { value: 'pending',     label: 'Pending' },
  { value: 'assigned',    label: 'Assigned' },
  { value: 'accepted',    label: 'Accepted' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed' },
  { value: 'cancelled',   label: 'Cancelled' },
];

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-apex-danger  bg-apex-danger/10  border-apex-danger/30',
  high:     'text-apex-warning bg-apex-warning/10 border-apex-warning/30',
  medium:   'text-apex-accent  bg-apex-accent/10  border-apex-accent/30',
  low:      'text-apex-textMuted bg-apex-border border-apex-border',
};

// ─── Create Task Modal ───────────────────────────────────────────
function CreateTaskModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium' as TaskPriority, location: '', notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setSaving(true); setError('');
    const result = await createTask({
      title:       form.title.trim(),
      description: form.description.trim() || undefined,
      priority:    form.priority,
      location:    form.location.trim() || undefined,
      notes:       form.notes.trim() || undefined,
    });
    setSaving(false);
    if (!result) { setError('Failed to create task. Check Supabase connection.'); return; }
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-apex-border bg-apex-card shadow-apex-card">
        <div className="flex items-center justify-between border-b border-apex-border px-5 py-4">
          <h2 className="text-sm font-semibold text-apex-text">Create Task</h2>
          <button onClick={onClose}><X size={16} className="text-apex-textMuted hover:text-apex-text" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-apex-textMuted mb-1.5">Title *</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm text-apex-text focus:border-apex-accent focus:outline-none"
              placeholder="Deliver parcel to…"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-apex-textMuted mb-1.5">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
              className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm text-apex-text focus:border-apex-accent focus:outline-none"
            >
              {PRIORITY_ORDER.map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-apex-textMuted mb-1.5">Location</label>
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm text-apex-text focus:border-apex-accent focus:outline-none"
              placeholder="123 Main Street…"
            />
          </div>
          <div>
            <label className="block text-xs text-apex-textMuted mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm text-apex-text focus:border-apex-accent focus:outline-none resize-none"
              rows={2}
              placeholder="Optional task details…"
            />
          </div>
          <div>
            <label className="block text-xs text-apex-textMuted mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm text-apex-text focus:border-apex-accent focus:outline-none resize-none"
              rows={2}
              placeholder="Internal admin notes…"
            />
          </div>

          {/* Contract reminder */}
          <p className="text-[10px] text-apex-textMuted border border-apex-border/50 rounded-lg px-3 py-2 bg-apex-surface">
            ℹ Task will be created as <span className="text-apex-warning font-semibold">pending</span>. Assignment is handled by the dispatcher — not this dashboard.
          </p>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-apex-danger/10 border border-apex-danger/30 px-3 py-2 text-xs text-apex-danger">
              <AlertTriangle size={12} /> {error}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-apex-border px-4 py-2 text-sm text-apex-textMuted hover:bg-apex-border/30 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-apex-accent px-4 py-2 text-sm font-medium text-white hover:bg-apex-accentDim transition-colors disabled:opacity-50">
              {saving ? <><RefreshCw size={12} className="animate-spin" /> Creating…</> : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tasks Page ───────────────────────────────────────────────────
export default function TasksPage() {
  const { tasksWithAssignments, isLoading, isConfigured } = useAP3XStore();
  const [showCreate, setShowCreate]     = useState(false);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriority]   = useState<TaskPriority | 'all'>('all');
  const [cancelling, setCancelling]     = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [expandedId, setExpandedId]     = useState<string | null>(null);

  const filtered = useMemo(() => {
    return tasksWithAssignments.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          (t.description ?? '').toLowerCase().includes(q) ||
          (t.location ?? '').toLowerCase().includes(q) ||
          (t.driver?.name ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tasksWithAssignments, statusFilter, priorityFilter, search]);

  const handleCancel = async (taskId: string) => {
    if (confirmCancel !== taskId) { setConfirmCancel(taskId); return; }
    setCancelling(taskId);
    await updateTask(taskId, { status: 'cancelled' });
    setCancelling(null);
    setConfirmCancel(null);
  };

  if (!isConfigured && !isLoading) return <NoDataBanner reason="not_configured" />;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-apex-text">
            Task <span className="apex-gradient-text">Management</span>
          </h1>
          <p className="text-sm text-apex-textMuted mt-1">
            {formatNumber(tasksWithAssignments.length)} tasks · create pending · read full lifecycle
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-apex-accent px-4 py-2 text-sm font-medium text-white hover:bg-apex-accentDim transition-colors"
        >
          <Plus size={14} /> New Task
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Status tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_TABS.map((tab) => {
            const count = tab.value === 'all'
              ? tasksWithAssignments.length
              : tasksWithAssignments.filter((t) => t.status === tab.value).length;
            return (
              <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
                className={cn('rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  statusFilter === tab.value
                    ? 'bg-apex-accent text-white'
                    : 'bg-apex-card border border-apex-border text-apex-textMuted hover:text-apex-text'
                )}>
                {tab.label} <span className="opacity-60 ml-1">{count}</span>
              </button>
            );
          })}
        </div>
        {/* Search + Priority */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-apex-textMuted" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks, locations, drivers…"
              className="w-full rounded-lg border border-apex-border bg-apex-card pl-8 pr-3 py-2 text-sm text-apex-text placeholder-apex-textMuted focus:border-apex-accent focus:outline-none"
            />
          </div>
          <select value={priorityFilter} onChange={(e) => setPriority(e.target.value as TaskPriority | 'all')}
            className="rounded-lg border border-apex-border bg-apex-card px-3 py-2 text-sm text-apex-text focus:border-apex-accent focus:outline-none">
            <option value="all">All Priorities</option>
            {PRIORITY_ORDER.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        </div>
      </div>

      {/* Task list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-apex-textMuted">
          <RefreshCw size={16} className="animate-spin mr-2" /> Loading from Supabase…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-apex-textMuted">
          <ClipboardList size={36} className="opacity-20" />
          <p className="text-sm">{search || statusFilter !== 'all' || priorityFilter !== 'all' ? 'No tasks match your filters.' : 'No tasks yet.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const isExpanded   = expandedId === t.id;
            const isCancelling = cancelling === t.id;
            const canCancel    = !['cancelled', 'completed'].includes(t.status);

            return (
              <div key={t.id} className={cn('rounded-xl border bg-apex-card transition-all', {
                'border-apex-danger/30':  t.priority === 'critical',
                'border-apex-warning/30': t.priority === 'high',
                'border-apex-border':     !['critical','high'].includes(t.priority),
              })}>
                {/* Row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                >
                  {/* Priority dot */}
                  <div className={cn('h-2 w-2 rounded-full flex-shrink-0', {
                    'bg-apex-danger  animate-pulse': t.priority === 'critical',
                    'bg-apex-warning':               t.priority === 'high',
                    'bg-apex-accent':                t.priority === 'medium',
                    'bg-apex-textMuted':             t.priority === 'low',
                  })} />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-apex-text truncate">{t.title}</p>
                    <p className="text-[11px] text-apex-textMuted mt-0.5 truncate">
                      {t.location ? `📍 ${t.location}` : 'No location'}
                      {t.driver ? ` · ${t.driver.name}` : ''}
                    </p>
                  </div>

                  {/* Priority badge */}
                  <span className={cn('hidden sm:inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold flex-shrink-0', PRIORITY_COLORS[t.priority])}>
                    {t.priority}
                  </span>

                  <StatusBadge status={t.status} />
                  <ChevronDown size={14} className={cn('text-apex-textMuted transition-transform flex-shrink-0', isExpanded && 'rotate-180')} />
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-apex-border px-4 py-4 space-y-3">
                    {/* Assignment info (read-only) */}
                    {t.assignment && (
                      <div className="rounded-lg bg-apex-surface border border-apex-border/50 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase text-apex-textMuted mb-2">Assignment (read-only)</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><span className="text-apex-textMuted">Driver:</span> <span className="text-apex-text">{t.driver?.name ?? '—'}</span></div>
                          <div><span className="text-apex-textMuted">Vehicle:</span> <span className="text-apex-text">{t.vehicle?.name ?? '—'}</span></div>
                          <div><span className="text-apex-textMuted">Assignment status:</span> <span className="text-apex-text">{t.assignment.status}</span></div>
                          <div><span className="text-apex-textMuted">Assigned at:</span> <span className="text-apex-text font-mono">{new Date(t.assignment.assigned_at).toLocaleString()}</span></div>
                        </div>
                      </div>
                    )}

                    {/* Task metadata */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-apex-textMuted">
                      {t.description && <div className="col-span-2"><span className="text-apex-textDim">Description:</span> {t.description}</div>}
                      {t.notes && <div className="col-span-2"><span className="text-apex-textDim">Notes:</span> {t.notes}</div>}
                      <div><span className="text-apex-textDim">Created:</span> <span className="font-mono">{new Date(t.created_at).toLocaleString()}</span></div>
                      <div><span className="text-apex-textDim">Updated:</span> <span className="font-mono">{new Date(t.updated_at).toLocaleString()}</span></div>
                      <div><span className="text-apex-textDim">ID:</span> <span className="font-mono text-[10px] truncate">{t.id}</span></div>
                    </div>

                    {/* Cancel action — only allowed operation */}
                    {canCancel && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCancel(t.id); }}
                          disabled={isCancelling}
                          className={cn('flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
                            confirmCancel === t.id
                              ? 'border-apex-danger bg-apex-danger text-white'
                              : 'border-apex-danger/40 text-apex-danger hover:bg-apex-danger/10'
                          )}>
                          {isCancelling ? <RefreshCw size={10} className="animate-spin" /> : <AlertTriangle size={10} />}
                          {isCancelling ? 'Cancelling…' : confirmCancel === t.id ? '⚠ Confirm Cancel' : 'Cancel Task'}
                        </button>
                        {confirmCancel === t.id && (
                          <button onClick={(e) => { e.stopPropagation(); setConfirmCancel(null); }}
                            className="text-[10px] text-apex-textMuted hover:text-apex-text">
                            Nevermind
                          </button>
                        )}
                        <span className="text-[10px] text-apex-textMuted ml-2">Task status is otherwise managed by the dispatcher.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateTaskModal onClose={() => setShowCreate(false)} onCreated={() => {}} />
      )}
    </div>
  );
}
