'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
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

  return (
    <div className="rounded-3xl border border-amber-300 dark:border-amber-800/80 bg-gradient-to-r from-amber-50 via-white to-amber-50/50 dark:from-amber-950/40 dark:via-slate-900 dark:to-amber-950/20 p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-amber-500 text-white shadow-xs">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {actions.length} Action{actions.length > 1 ? 's' : ''} Awaiting Your Approval
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              The AI copilot proposed actions that require human confirmation before execution.
            </p>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-xs font-semibold transition-all flex items-center space-x-1"
        >
          <span>{expanded ? 'Collapse' : 'Review Actions'}</span>
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
      </div>

      {expanded && (
        <div className="pt-2 space-y-3 animate-in fade-in duration-150">
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
      )}
    </div>
  );
}
