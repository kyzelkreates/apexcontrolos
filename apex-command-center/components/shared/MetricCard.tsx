import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: { value: number; label: string };
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'purple';
  className?: string;
  loading?: boolean;
}

const variantStyles = {
  default: 'border-apex-border',
  accent: 'border-apex-accent/30',
  success: 'border-apex-success/30',
  warning: 'border-apex-warning/30',
  danger: 'border-apex-danger/30',
  purple: 'border-apex-purple/30',
};

const iconStyles = {
  default: 'text-apex-textDim bg-apex-border/50',
  accent: 'text-apex-accent bg-apex-accent/10',
  success: 'text-apex-success bg-apex-success/10',
  warning: 'text-apex-warning bg-apex-warning/10',
  danger: 'text-apex-danger bg-apex-danger/10',
  purple: 'text-apex-purple bg-apex-purple/10',
};

const valueStyles = {
  default: 'text-apex-text',
  accent: 'text-apex-accent',
  success: 'text-apex-success',
  warning: 'text-apex-warning',
  danger: 'text-apex-danger',
  purple: 'text-apex-purple',
};

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  className,
  loading = false,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border bg-apex-card p-5 shadow-apex-card transition-all duration-200 hover:border-opacity-60',
        variantStyles[variant],
        className
      )}
    >
      {/* Background glow */}
      {variant === 'accent' && (
        <div className="absolute inset-0 bg-apex-accent/3 pointer-events-none" />
      )}

      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-apex-textMuted truncate">
            {title}
          </p>

          {loading ? (
            <div className="mt-2 h-8 w-24 rounded bg-apex-border animate-pulse" />
          ) : (
            <p className={cn('mt-1 text-2xl font-bold font-mono tracking-tight', valueStyles[variant])}>
              {value}
            </p>
          )}

          {subtitle && (
            <p className="mt-1 text-xs text-apex-textMuted truncate">{subtitle}</p>
          )}

          {trend && (
            <div className="mt-2 flex items-center gap-1">
              <span
                className={cn(
                  'text-xs font-medium',
                  trend.value >= 0 ? 'text-apex-success' : 'text-apex-danger'
                )}
              >
                {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-apex-textMuted">{trend.label}</span>
            </div>
          )}
        </div>

        {Icon && (
          <div className={cn('flex-shrink-0 p-2.5 rounded-lg', iconStyles[variant])}>
            <Icon size={18} />
          </div>
        )}
      </div>
    </div>
  );
}

export default MetricCard;
