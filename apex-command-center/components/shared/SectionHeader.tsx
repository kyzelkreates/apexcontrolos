import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ title, subtitle, icon: Icon, actions, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between mb-6', className)}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-apex-accent/10 text-apex-accent">
            <Icon size={18} />
          </div>
        )}
        <div>
          <h2 className="text-lg font-semibold text-apex-text leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-apex-textMuted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export default SectionHeader;
