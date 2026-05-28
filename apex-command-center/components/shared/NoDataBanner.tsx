'use client';
import React from 'react';
import { AlertTriangle, Database } from 'lucide-react';

interface Props {
  reason: 'not_configured' | 'no_data' | 'error';
  message?: string;
}

export function NoDataBanner({ reason, message }: Props) {
  const config = {
    not_configured: {
      icon: Database,
      title: 'Supabase Not Configured',
      body: message ?? 'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your Vercel environment to connect the dashboard.',
      color: 'border-apex-warning/30 bg-apex-warning/5 text-apex-warning',
    },
    no_data: {
      icon: Database,
      title: 'No Data',
      body: message ?? 'No records found in Supabase for this view.',
      color: 'border-apex-border bg-apex-surface text-apex-textMuted',
    },
    error: {
      icon: AlertTriangle,
      title: 'Load Error',
      body: message ?? 'Failed to load data from Supabase.',
      color: 'border-apex-danger/30 bg-apex-danger/5 text-apex-danger',
    },
  }[reason];

  const Icon = config.icon;

  return (
    <div className={`flex flex-col items-center justify-center gap-4 rounded-xl border p-12 text-center ${config.color}`}>
      <Icon size={32} className="opacity-40" />
      <div>
        <p className="font-semibold text-sm">{config.title}</p>
        <p className="text-xs mt-1 opacity-70 max-w-sm">{config.body}</p>
      </div>
    </div>
  );
}
