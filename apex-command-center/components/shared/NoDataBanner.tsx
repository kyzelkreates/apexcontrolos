/**
 * APEX COMMAND CENTER OS
 * components/shared/NoDataBanner.tsx
 *
 * Shown at the top of data pages when no real fleet data has been
 * pushed from a connected Fleet Control dashboard or Driver app yet.
 * Disappears automatically once real data arrives.
 */

import React from 'react';
import { Wifi, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface NoDataBannerProps {
  /** Page-specific label, e.g. "financial events", "fleet entities" */
  dataLabel?: string;
  /** Hide the banner — pass true once data exists */
  hasData: boolean;
}

export function NoDataBanner({ hasData, dataLabel = 'live data' }: NoDataBannerProps) {
  if (hasData) return null;

  return (
    <div className="flex items-center gap-4 rounded-xl border border-apex-accent/30 bg-apex-accent/5 px-5 py-4">
      <div className="flex-shrink-0 rounded-lg bg-apex-accent/10 p-2.5">
        <Wifi size={18} className="text-apex-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-apex-text">
          Awaiting {dataLabel} from connected fleet systems
        </p>
        <p className="text-xs text-apex-textMuted mt-0.5">
          This page populates automatically once a Fleet Control dashboard or Driver app
          begins pushing telemetry. Data is stored locally in IndexedDB — no cloud required.
        </p>
      </div>
      <Link
        href="/tenants"
        className="flex-shrink-0 flex items-center gap-1.5 rounded-lg border border-apex-accent/40 bg-apex-accent/10 px-3 py-1.5 text-xs font-medium text-apex-accent hover:bg-apex-accent/20 transition-colors"
      >
        Register Fleet <ArrowRight size={12} />
      </Link>
    </div>
  );
}
