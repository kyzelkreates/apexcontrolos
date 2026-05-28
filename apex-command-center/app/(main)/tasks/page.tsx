'use client';
import React, { useState, useMemo } from 'react';
import { useAP3XStore } from '@/store/ap3x-store';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { createTask, updateTask } from '@/services/ap3xDataService';
import { formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { TaskPriority, TaskStatus } from '@/types/db';
import {
  ClipboardList, Plus, Search, Filter, X,
  CheckCircle2, Clock, AlertTriangle, RefreshCw,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────
// CREATE TASK MODAL
// ─────────────────────────────────────────────────────────────────
function CreateTaskModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { addAlert, upsertTask } = useAP3XStore();
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium' as TaskPriority,
    location: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError('');
    try {
      const task = await createTask({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        priority: form.priority,
        location: form.location.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      if (!task) { setError('Failed to create task — check Supabase connection.'); return; }
      upsertTask(task);
      addAlert({ type: 'success', title: 'Task Created', message: `"${task.title}" added as pending.` });
      onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-apex-border bg-apex-card shadow-apex-card mx-4">
        <div className="flex items-center justify-between border-b border-apex-border px-5 py-4">
          <h2 className="text-sm font-semibold text-apex-text">Create New Task</h2>
          <button onClick={onClose} className="text-apex-textMuted hover:text-apex-text"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-apex-textMuted mb-1.5">Title *</label>
            <input
              value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm text-apex-text placeholder-apex-textMuted focus:border-apex-accent focus:outline-none"
              placeholder="Task title…"
            />
          </div>
          <div>
            <label className="block text-xs text-apex-textMuted mb-1.5">Description</label>
            <textarea
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm text-apex-text placeholder-apex-textMuted focus:border-apex-accent focus:outline-none resize-none"
              placeholder="Optional details…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-apex-textMuted mb-1.5">Priority</label>
              <select
                value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
                className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm text-apex-text focus:border-apex-accent focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-apex-textMuted mb-1.5">Location</label>
              <input
                value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm text-apex-text placeholder-apex-textMuted focus:border-apex-accent focus:outline-none"
                placeholder="Address or area…"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-apex-textMuted mb-1.5">Notes</label>
            <textarea
              value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-apex-border bg-apex-surface px-3 py-2 text-sm text-apex-text placeholder-apex-textMuted focus:border-apex-accent focus:outline-none resize-none"
              placeholder="Internal notes…"
            />
          </div>
          {error && <p className="text-xs text-apex-danger">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-apex-border px-4 py-2 text-sm text-apex-textMuted hover:bg-apex-border/30 transition-colors">
              Cancel
            </button>
            <button
              type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-apex-accent px-4 py-2 text-sm font-medium text-white hover:bg-apex-accentDim transition-colors disabled:opacity-50"
            >
              {saving ? <><RefreshCw size={12} className="animate-spin" /> Creating…</> : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// TASKS PAGE
// ─────────────────────────────────────────────────────────────────
const STATUS_FILTERS: (TaskStatus | 'all')[] = ['all', 'pending', 'assigned', 'in_progress', 'complete', 'cancelled'];
const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export default function TasksPage() {
  const { tasksWithAssignments, isLoading } = useAP3XStore();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { upsertTask, addAlert } = useAP3XStore();

  const filtered = useMemo(() => {
    return tasksWithAssignments
      .filter((t) => {
        if (statusFilter !== 'all' && t.status !== statusFilter) return false;
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
      })
      .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));
  }, [tasksWithAssignments, statusFilter, search]);

  const handleCancel = async (taskId: string, title: string) => {
    setCancellingId(taskId);
    const ok = await updateTask(taskId, { status: 'cancelled' });
    if (ok) {
      const updated = tasksWithAssignments.find((t) => t.id === taskId);
      if (updated) upsertTask({ ...updated, status: 'cancelled' });
      addAlert({ type: 'info', title: 'Task Cancelled', message: `"${title}" has been cancelled.` });
    } else {
      addAlert({ type: 'danger', title: 'Error', message: 'Failed to cancel task.' });
    }
    setCancellingId(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-apex-text">
            Task <span className="apex-gradient-text">Management</span>
          </h1>
          <p className="text-sm text-apex-textMuted mt-1">
            Create and monitor tasks · {formatNumber(tasksWithAssignments.length)} total
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-apex-accent px-4 py-2 text-sm font-medium text-white hover:bg-apex-accentDim transition-colors flex-shrink-0"
        >
          <Plus size={14} /> New Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-apex-textMuted" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks, locations, drivers…"
            className="w-full rounded-lg border border-apex-border bg-apex-card pl-8 pr-3 py-2 text-sm text-apex-text placeholder-apex-textMuted focus:border-apex-accent focus:outline-none"
          />
        </div>
        {/* Status filter */}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors capitalize',
                statusFilter === s
                  ? 'bg-apex-accent text-white'
                  : 'bg-apex-card border border-apex-border text-apex-textMuted hover:text-apex-text'
              )}
            >
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-apex-border bg-apex-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-apex-textMuted text-sm">
            <RefreshCw size={16} className="animate-spin mr-2" /> Loading tasks…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-apex-textMuted gap-3">
            <ClipboardList size={32} className="opacity-30" />
            <p className="text-sm">{search || statusFilter !== 'all' ? 'No tasks match your filters.' : 'No tasks yet. Create your first one.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-apex-border bg-apex-surface/50 text-apex-textMuted">
                  <th className="px-4 py-3 text-left font-medium">Title</th>
                  <th className="px-4 py-3 text-left font-medium">Priority</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Driver</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Vehicle</th>
                  <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Location</th>
                  <th className="px-4 py-3 text-left font-medium">Created</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-apex-border/50">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-apex-surface/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-apex-text truncate max-w-[180px]">{t.title}</p>
                      {t.description && <p className="text-apex-textMuted mt-0.5 truncate max-w-[180px]">{t.description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', {
                        'bg-apex-danger/20 text-apex-danger':   t.priority === 'critical',
                        'bg-apex-warning/20 text-apex-warning': t.priority === 'high',
                        'bg-apex-accent/20 text-apex-accent':   t.priority === 'medium',
                        'bg-apex-border text-apex-textMuted':   t.priority === 'low',
                      })}>
                        {t.priority.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-apex-textDim hidden md:table-cell">{t.driver?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-apex-textDim hidden md:table-cell">{t.vehicle?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-apex-textMuted hidden lg:table-cell truncate max-w-[120px]">{t.location ?? '—'}</td>
                    <td className="px-4 py-3 text-apex-textMuted font-mono">
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {t.status !== 'cancelled' && t.status !== 'complete' && (
                        <button
                          onClick={() => handleCancel(t.id, t.title)}
                          disabled={cancellingId === t.id}
                          className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-apex-danger hover:bg-apex-danger/10 transition-colors border border-apex-danger/30 disabled:opacity-50"
                        >
                          {cancellingId === t.id ? <RefreshCw size={9} className="animate-spin" /> : <X size={9} />}
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} onCreated={() => {}} />}
    </div>
  );
}
