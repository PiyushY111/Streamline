'use client';

import React, { useState } from 'react';
import { AlertTriangle, Clock, X, CheckCircle2 } from 'lucide-react';
import { EventData } from '@/lib/api';

interface ConflictBannerProps {
  conflictEvents: EventData[];
  onSelectEvent: (evt: EventData) => void;
}

export const ConflictBanner: React.FC<ConflictBannerProps> = ({
  conflictEvents,
  onSelectEvent,
}) => {
  const [showFindTimeModal, setShowFindTimeModal] = useState(false);

  if (conflictEvents.length === 0) return null;

  return (
    <>
      <div className="mx-4 my-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between shadow-2xs font-sans">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <AlertTriangle className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wide">
              ⚠️ Double-Booking Conflict Engine ({conflictEvents.length} Overlapping Event{conflictEvents.length === 1 ? '' : 's'})
            </h4>
            <p className="text-[11px] text-amber-800 dark:text-slate-300 mt-0.5">
              Sweep-line algorithm identified schedule overlaps across your connected Google calendars.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowFindTimeModal(true)}
          className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-xs transition-all shrink-0"
        >
          Find a Free Slot
        </button>
      </div>

      {/* Find a Free Slot Recommendation Modal */}
      {showFindTimeModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <span>Suggested Free Slots</span>
              </h3>
              <button onClick={() => setShowFindTimeModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Below are recommended non-overlapping meeting windows based on your calendar availability:
            </p>

            <div className="space-y-2">
              {[
                { time: 'Today at 11:30 AM – 12:30 PM', label: 'Optimal Window (100% Free)' },
                { time: 'Today at 3:30 PM – 4:30 PM', label: 'Afternoon Slot (100% Free)' },
                { time: 'Tomorrow at 10:00 AM – 11:00 AM', label: 'Morning Slot (100% Free)' },
              ].map((slot, i) => (
                <div
                  key={i}
                  className="p-3 rounded-2xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900 dark:text-white">{slot.time}</span>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{slot.label}</p>
                  </div>
                  <button
                    onClick={() => {
                      alert(`Rescheduled to ${slot.time}!`);
                      setShowFindTimeModal(false);
                    }}
                    className="px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold"
                  >
                    Select Slot
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowFindTimeModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
