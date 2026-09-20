'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, ChevronRight, CheckCircle2, Clock, Sparkles, ShieldCheck } from 'lucide-react';
import { fetchPendingActions, PendingActionData } from '@/lib/api';
import { PendingActionCard } from './PendingActionCard';

interface PendingActionsBannerProps {
  onActionResolved?: () => void;
}

export function PendingActionsBanner({ onActionResolved }: PendingActionsBannerProps) {
  const [actions, setActions] = useState<PendingActionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const list = await fetchPendingActions();
      setActions(list);
    } catch (err) {
      console.warn('Failed to load pending actions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (actions.length === 0) return null;

  const untrustedCount = actions.filter(
    (a) =>
      (a.impactPreview as Record<string, any>)?._securityNotice || (a.toolArgs as Record<string, any>)?._securityNotice,
  ).length;

  return (
    <div className="rounded-3xl border border-amber-300/80 dark:border-amber-700/60 bg-gradient-to-r from-amber-500/10 via-amber-50/40 to-white/90 dark:from-amber-950/40 dark:via-slate-900/90 dark:to-amber-950/20 p-4 sm:p-5 shadow-sm space-y-3.5 transition-all">
      {/* Banner Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3.5 min-w-0">
          <div className="relative p-2.5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/20 shrink-0">
            <ShieldAlert className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {actions.length} Action{actions.length > 1 ? 's' : ''} Awaiting Your Review
              </h3>
              {untrustedCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 uppercase tracking-wider">
                  {untrustedCount} Shield Alert{untrustedCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              The AI copilot proposed actions that require human confirmation and parameter inspection before execution.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-bold transition-all flex items-center space-x-1.5 shadow-2xs hover:scale-[1.02] active:scale-98 cursor-pointer"
          >
            <span>
              {expanded ? 'Hide Proposals' : `Review ${actions.length} Action${actions.length > 1 ? 's' : ''}`}
            </span>
            <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
          </button>
        </div>
      </div>

      {/* Scrollable Action Cards Container */}
      {expanded && (
        <div className="space-y-2 pt-1">
          {actions.length > 2 && (
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1 font-medium">
              <span>Showing {actions.length} pending action proposals (scroll to review all)</span>
              <span className="text-slate-400 font-mono">↓ Scroll down for more</span>
            </div>
          )}

          <div className="max-h-[520px] overflow-y-auto pr-2 space-y-3.5 overscroll-contain animate-in fade-in duration-200">
            {actions.map((act) => (
              <PendingActionCard
                key={act.id}
                action={act}
                onResolved={() => {
                  load();
                  onActionResolved?.();
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
