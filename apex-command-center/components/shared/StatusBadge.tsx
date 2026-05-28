import React from 'react';
import { cn } from '@/lib/utils';

const BADGE_MAP: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  // Task statuses
  pending:     { bg: 'bg-apex-warning/15',  text: 'text-apex-warning', dot: 'bg-apex-warning',  label: 'Pending' },
  assigned:    { bg: 'bg-apex-accent/15',   text: 'text-apex-accent',  dot: 'bg-apex-accent',   label: 'Assigned' },
  in_progress: { bg: 'bg-apex-purple/15',   text: 'text-apex-purple',  dot: 'bg-apex-purple',   label: 'In Progress' },
  complete:    { bg: 'bg-apex-success/15',  text: 'text-apex-success', dot: 'bg-apex-success',  label: 'Complete' },
  cancelled:   { bg: 'bg-apex-danger/15',   text: 'text-apex-danger',  dot: 'bg-apex-danger',   label: 'Cancelled' },

  // Driver statuses
  available:   { bg: 'bg-apex-success/15',  text: 'text-apex-success', dot: 'bg-apex-success',  label: 'Available' },
  on_task:     { bg: 'bg-apex-purple/15',   text: 'text-apex-purple',  dot: 'bg-apex-purple',   label: 'On Task' },
  break:       { bg: 'bg-apex-warning/15',  text: 'text-apex-warning', dot: 'bg-apex-warning',  label: 'On Break' },
  offline:     { bg: 'bg-apex-border',      text: 'text-apex-textMuted', dot: 'bg-apex-textMuted', label: 'Offline' },

  // Vehicle statuses
  active:      { bg: 'bg-apex-success/15',  text: 'text-apex-success', dot: 'bg-apex-success',  label: 'Active' },
  idle:        { bg: 'bg-apex-accent/15',   text: 'text-apex-accent',  dot: 'bg-apex-accent',   label: 'Idle' },
  maintenance: { bg: 'bg-apex-warning/15',  text: 'text-apex-warning', dot: 'bg-apex-warning',  label: 'Maintenance' },
};

const FALLBACK = { bg: 'bg-apex-border', text: 'text-apex-textMuted', dot: 'bg-apex-textMuted', label: '' };

export function StatusBadge({ status }: { status: string }) {
  const cfg = BADGE_MAP[status] ?? { ...FALLBACK, label: status };
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold', cfg.bg, cfg.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.label || status}
    </span>
  );
}

export default StatusBadge;
