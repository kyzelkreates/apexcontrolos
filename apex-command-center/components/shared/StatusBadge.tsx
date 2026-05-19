import React from 'react';
import { cn, statusBg } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
  dot?: boolean;
}

export function StatusBadge({ status, className, dot = true }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
        statusBg(status),
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            ['online', 'active', 'deployed', 'validated'].includes(status) ? 'bg-apex-success animate-pulse' :
            ['degraded', 'rolling', 'pending'].includes(status) ? 'bg-apex-warning' :
            ['offline', 'suspended', 'failed'].includes(status) ? 'bg-apex-danger' :
            'bg-apex-textMuted'
          )}
        />
      )}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default StatusBadge;
