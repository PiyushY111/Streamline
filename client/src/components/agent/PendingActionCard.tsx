'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Mail, CheckSquare, AlertTriangle, Clock, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';
import { PendingActionData } from '@/lib/api';
import { useApproveAction, useRejectAction } from '@/lib/hooks/useAgentActions';

interface PendingActionCardProps {
  action: PendingActionData;
  onResolved?: () => void;
}

export function PendingActionCard({ action, onResolved }: PendingActionCardProps) {
  const [resolvedStatus, setResolvedStatus] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const rejectBtnRef = useRef<HTMLButtonElement>(null);
  const approveBtnRef = useRef<HTMLButtonElement>(null);

  const approveMutation = useApproveAction();
  const rejectMutation = useRejectAction();

  const loading = approveMutation.isPending || rejectMutation.isPending;

  // Accessibility: Focus Reject button by default and handle Escape / Tab keyboard trapping
  useEffect(() => {
    if (!resolvedStatus) {
      rejectBtnRef.current?.focus();
    }
  }, [resolvedStatus]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (resolvedStatus) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        handleReject();
      }

      if (e.key === 'Tab') {
        const rejectBtn = rejectBtnRef.current;
        const approveBtn = approveBtnRef.current;
        if (!rejectBtn || !approveBtn) return;

        if (e.shiftKey && document.activeElement === rejectBtn) {
          e.preventDefault();
          approveBtn.focus();
        } else if (!e.shiftKey && document.activeElement === approveBtn) {
          e.preventDefault();
          rejectBtn.focus();
        }
      }
    };

    const element = cardRef.current;
    element?.addEventListener('keydown', handleKeyDown);
    return () => {
      element?.removeEventListener('keydown', handleKeyDown);
    };
  }, [resolvedStatus]);

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync({ actionId: action.id });
      setResolvedStatus('executed');
      onResolved?.();
    } catch {
      // Error handled by mutation toast
    }
  };

  const handleReject = async () => {
    try {
      await rejectMutation.mutateAsync(action.id);
      setResolvedStatus('rejected');
      onResolved?.();
    } catch {
      // Error handled by mutation toast
    }
  };

  const getToolMeta = () => {
    switch (action.toolName) {
      case 'create_calendar_event':
        return {
          label: 'Calendar Event',
          icon: Calendar,
          color: 'text-blue-600 dark:text-blue-400',
          bg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800/80',
          badge: 'Write Action',
        };
      case 'send_email':
        return {
          label: 'External Email',
          icon: Mail,
          color: 'text-rose-600 dark:text-rose-400',
          bg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800/80',
          badge: 'Send Action • High Consequence',
        };
      case 'create_task':
        return {
          label: 'Create Task',
          icon: CheckSquare,
          color: 'text-amber-600 dark:text-amber-400',
          bg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/80',
          badge: 'Write Action',
        };
      default:
        return {
          label: action.toolName,
          icon: AlertTriangle,
          color: 'text-indigo-600 dark:text-indigo-400',
          bg: 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800/80',
          badge: 'Action Proposal',
        };
    }
  };

  const meta = getToolMeta();
  const Icon = meta.icon;
  const preview = action.impactPreview || (action.toolArgs as Record<string, any>);

  const expiresTime = new Date(action.expiresAt);
  const hoursRemaining = Math.max(0, Math.round((expiresTime.getTime() - Date.now()) / 3600000));

  if (resolvedStatus === 'executed') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center space-x-3 text-xs text-emerald-800 dark:text-emerald-300 shadow-sm animate-in fade-in duration-200"
      >
        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
        <span>Action approved &amp; executed successfully.</span>
      </div>
    );
  }

  if (resolvedStatus === 'rejected') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center space-x-3 text-xs text-slate-500 shadow-sm animate-in fade-in duration-200"
      >
        <XCircle className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
        <span>Action rejected. No changes were made.</span>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      role="region"
      aria-label={`${meta.label} Human-in-the-Loop Review Card`}
      aria-busy={loading}
      data-testid="shield-action-card"
      tabIndex={0}
      className={`p-4 rounded-2xl border ${meta.bg} space-y-3 transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-primary/40`}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <Icon className={`w-4 h-4 ${meta.color}`} aria-hidden="true" />
          </div>
          <div>
            <h4 id={`action-title-${action.id}`} className="text-xs font-bold text-slate-900 dark:text-white">
              {meta.label} Proposal
            </h4>
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{meta.badge}</span>
          </div>
        </div>

        <div className="flex items-center space-x-1 text-[10px] text-slate-500 font-medium">
          <Clock className="w-3 h-3" aria-hidden="true" />
          <span>Expires in {hoursRemaining}h</span>
        </div>
      </div>

      {/* Untrusted Content Origin Shield Alert */}
      {preview?._securityNotice && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start space-x-2.5 text-xs animate-in fade-in duration-150">
          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5 flex-1 min-w-0">
            <div className="flex items-center space-x-1.5 font-bold text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400">
              <span>Shield Alert: Untrusted Inbound Trigger</span>
            </div>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
              This action proposal was prompted after ingesting external content from{' '}
              <strong className="text-amber-700 dark:text-amber-300 font-semibold">
                {preview._securityNotice.sourceSender}
              </strong>
              . Verify all parameters before confirming.
            </p>
          </div>
        </div>
      )}

      {/* AI Reasoning */}
      {action.reasoning && (
        <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-300">
          <span className="font-semibold text-slate-900 dark:text-white block mb-0.5">Agent Stated Reasoning:</span>
          <p className="leading-relaxed text-[11px]">{action.reasoning}</p>
        </div>
      )}

      {/* Impact Preview details */}
      <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 text-xs space-y-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
          What will change upon approval:
        </span>

        {action.toolName === 'create_calendar_event' && (
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Event Title:</span>{' '}
              <strong className="text-slate-900 dark:text-white">{preview.title || preview.name}</strong>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Duration:</span>{' '}
              <span className="font-semibold text-slate-900 dark:text-white">{preview.durationMinutes} mins</span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-500 dark:text-slate-400">Time:</span>{' '}
              <span className="font-mono text-[10px] text-slate-800 dark:text-slate-200">
                {new Date(preview.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} -{' '}
                {new Date(preview.endTime).toLocaleTimeString([], { timeStyle: 'short' })}
              </span>
            </div>
          </div>
        )}

        {action.toolName === 'send_email' && (
          <div className="space-y-1 text-[11px]">
            <div>
              <span className="text-slate-500 dark:text-slate-400">To:</span>{' '}
              <strong className="text-slate-900 dark:text-white font-mono">{preview.to}</strong>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Subject:</span>{' '}
              <strong className="text-slate-900 dark:text-white">{preview.subject}</strong>
            </div>
            {preview.bodySnippet && (
              <div className="text-[11px] text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800/60 mt-1">
                &quot;{preview.bodySnippet}&quot;
              </div>
            )}
          </div>
        )}

        {action.toolName === 'create_task' && (
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Task Title:</span>{' '}
              <strong className="text-slate-900 dark:text-white">{preview.title}</strong>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Priority:</span>{' '}
              <span className="font-semibold uppercase text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                {preview.priority}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Decision Buttons with Focus Trap */}
      <div className="flex items-center justify-end space-x-2 pt-1">
        <button
          ref={rejectBtnRef}
          type="button"
          disabled={loading}
          onClick={handleReject}
          data-testid="reject-action-btn"
          aria-label="Reject proposed action"
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-slate-400 cursor-pointer disabled:opacity-50"
        >
          Reject (Esc)
        </button>
        <button
          ref={approveBtnRef}
          type="button"
          disabled={loading}
          onClick={handleApprove}
          data-testid="approve-action-btn"
          aria-label="Approve and execute proposed action"
          className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all hover:scale-[1.02] active:scale-98 flex items-center space-x-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
        >
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{loading ? 'Executing...' : 'Approve & Execute'}</span>
        </button>
      </div>
    </div>
  );
}
