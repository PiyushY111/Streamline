'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { EventData } from '@/lib/api';

interface ConflictBannerProps {
  conflictEvents: EventData[];
  onSelectEvent: (evt: EventData) => void;
}

export const ConflictBanner: React.FC<ConflictBannerProps> = ({ conflictEvents }) => {
  if (conflictEvents.length === 0) return null;

  return (
    <div className="mx-4 my-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between shadow-2xs font-sans">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
          <AlertTriangle className="w-4 h-4 animate-pulse" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wide">
            ⚠️ Double-Booking Conflict Engine ({conflictEvents.length} Overlapping Event
            {conflictEvents.length === 1 ? '' : 's'})
          </h4>
          <p className="text-[11px] text-amber-800 dark:text-slate-300 mt-0.5">
            Sweep-line algorithm identified schedule overlaps across your connected Google calendars.
          </p>
        </div>
      </div>
    </div>
  );
};
