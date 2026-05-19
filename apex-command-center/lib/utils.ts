import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number, decimals = 0): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(decimals);
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

export function formatPercent(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const min = Math.floor(diff / 60000);
  const hr = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (diff < 60000) return 'just now';
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  return `${day}d ago`;
}

export function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

export function statusColor(status: string): string {
  switch (status) {
    case 'online': case 'active': case 'deployed': case 'validated': return 'text-apex-success';
    case 'degraded': case 'rolling': case 'pending': return 'text-apex-warning';
    case 'offline': case 'suspended': case 'failed': case 'rejected': return 'text-apex-danger';
    case 'maintenance': case 'rolledback': return 'text-apex-textDim';
    default: return 'text-apex-textMuted';
  }
}

export function statusBg(status: string): string {
  switch (status) {
    case 'online': case 'active': case 'deployed': case 'validated': return 'bg-apex-success/10 text-apex-success border-apex-success/30';
    case 'degraded': case 'rolling': case 'pending': return 'bg-apex-warning/10 text-apex-warning border-apex-warning/30';
    case 'offline': case 'suspended': case 'failed': case 'rejected': return 'bg-apex-danger/10 text-apex-danger border-apex-danger/30';
    case 'maintenance': case 'rolledback': return 'bg-apex-border text-apex-textDim border-apex-border';
    default: return 'bg-apex-border/50 text-apex-textMuted border-apex-border';
  }
}

export function regionLabel(region: string): string {
  const map: Record<string, string> = {
    NA: 'North America',
    EU: 'Europe',
    APAC: 'Asia-Pacific',
    LATAM: 'Latin America',
    MEA: 'Middle East & Africa',
    GLOBAL: 'Global',
  };
  return map[region] || region;
}

export function generateChartColors(): string[] {
  return ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];
}

export function daysBetween(a: number, b: number): number {
  return Math.abs(Math.floor((b - a) / 86400000));
}

export function groupByDay(items: Array<{ timestamp: number; [key: string]: unknown }>): Record<string, typeof items> {
  return items.reduce((acc, item) => {
    const day = new Date(item.timestamp).toLocaleDateString('en-CA');
    if (!acc[day]) acc[day] = [];
    acc[day].push(item);
    return acc;
  }, {} as Record<string, typeof items>);
}
