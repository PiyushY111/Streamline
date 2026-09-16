'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Zap,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ChevronRight,
  RefreshCw,
  Calendar,
  Layers,
  BarChart3,
  SlidersHorizontal,
  Flame,
  Target,
  ArrowRight,
} from 'lucide-react';
import { fetchNextTask, NextTaskResponse, RankedTaskData, updateTaskApi } from '@/lib/api';

interface NextTaskCardProps {
  onTaskUpdated?: () => void;
  selectedProjectId?: string;
}

export function NextTaskCard({ onTaskUpdated, selectedProjectId }: NextTaskCardProps) {
  const [data, setData] = useState<NextTaskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<'balanced' | 'deadline' | 'deep_work' | 'quick_wins'>('balanced');
  const [windowMinutes, setWindowMinutes] = useState<number | undefined>(undefined);
  const [showBlocked, setShowBlocked] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);

  const loadRecommendation = async () => {
    try {
      setLoading(true);
      const res = await fetchNextTask({
        preset,
        availableMinutes: windowMinutes,
        projectId: selectedProjectId,
      });
      setData(res);
    } catch (err) {
      console.error('Failed to load next task recommendation', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecommendation();
  }, [preset, windowMinutes, selectedProjectId]);

  const handleStatusChange = async (task: RankedTaskData, newStatus: 'in_progress' | 'completed') => {
    try {
      setActionInProgress(true);
      await updateTaskApi(task.id, {
        status: newStatus,
        completedAt: newStatus === 'completed' ? new Date().toISOString() : undefined,
      });
      await loadRecommendation();
      onTaskUpdated?.();
    } catch (err) {
      console.error('Failed to update task status', err);
    } finally {
      setActionInProgress(false);
    }
  };

  const task = data?.recommendedTask;
  const slot = data?.availableSlot;
  const summary = data?.summary;

  const presetLabels: Record<
    'balanced' | 'deadline' | 'deep_work' | 'quick_wins',
    { label: string; icon: any; desc: string }
  > = {
    balanced: { label: 'Balanced', icon: SlidersHorizontal, desc: '5-factor equilibrium' },
    deadline: { label: 'Deadlines First', icon: Flame, desc: 'Exponential decay urgency' },
    deep_work: { label: 'Deep Work', icon: Target, desc: 'High importance & focus' },
    quick_wins: { label: 'Quick Wins', icon: Zap, desc: 'Highest impact per minute' },
  };

  const timeOptions = [
    { label: 'Auto (Calendar)', val: undefined },
    { label: '15m', val: 15 },
    { label: '30m', val: 30 },
    { label: '45m', val: 45 },
    { label: '60m', val: 60 },
    { label: '90m+', val: 90 },
  ];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-indigo-200/70 dark:border-indigo-900/40 bg-gradient-to-br from-indigo-50/60 via-white to-purple-50/40 dark:from-slate-900/90 dark:via-slate-900/80 dark:to-indigo-950/30 p-6 shadow-xl shadow-indigo-500/5 backdrop-blur-md transition-all">
      {/* Background ambient decorative glow */}
      <div className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-gradient-to-br from-indigo-400/10 to-purple-400/10 dark:from-indigo-600/10 dark:to-purple-600/10 blur-3xl pointer-events-none" />

      {/* Header bar */}
      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-indigo-100 dark:border-slate-800/80">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Next Best Action</h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                  DAG Ranked • Zero LLM
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Mathematical optimization based on calendar gaps, exponential decay, and dependency DAG.
              </p>
            </div>
          </div>
        </div>

        {/* Preset selector pills */}
        <div className="flex items-center gap-1.5 p-1 bg-white/80 dark:bg-slate-950/60 rounded-2xl border border-indigo-100 dark:border-slate-800 shadow-xs">
          {(['balanced', 'deadline', 'deep_work', 'quick_wins'] as const).map((key) => {
            const Icon = presetLabels[key].icon;
            const active = preset === key;
            return (
              <button
                key={key}
                onClick={() => setPreset(key)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  active
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{presetLabels[key].label}</span>
              </button>
            );
          })}

          <button
            onClick={loadRecommendation}
            title="Recalculate Next Best Action"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors ml-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Available Time Selection + Calendar Slot Notice */}
      <div className="py-4 flex flex-wrap items-center justify-between gap-3 text-xs border-b border-indigo-50 dark:border-slate-800/50">
        <div className="flex items-center space-x-2">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Time Window:</span>
          <div className="inline-flex rounded-xl p-0.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            {timeOptions.map((opt) => (
              <button
                key={opt.label}
                onClick={() => setWindowMinutes(opt.val)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  windowMinutes === opt.val
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {slot && (
          <div className="flex items-center space-x-2 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[11px]">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>
              Next Free Slot: <strong>{slot.durationMinutes}m</strong> (
              {new Date(slot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
              {new Date(slot.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) with 10m buffers
            </span>
          </div>
        )}
      </div>

      {/* Task Recommendation Content */}
      <div className="pt-5">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-xs text-slate-500 dark:text-slate-400">Computing deterministic priority rankings...</p>
          </div>
        ) : !task ? (
          <div className="py-12 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">No Actionable Tasks Right Now</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              All tasks are completed or blocked by prerequisites. Relax or create a new task!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-indigo-100/80 dark:border-slate-800 shadow-sm">
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                  {/* Score Pill */}
                  <div className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-xs font-bold text-xs tracking-tight">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Priority {task.score}/100</span>
                  </div>

                  {/* Priority Tag */}
                  <span
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider ${
                      task.priority === 'high'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30'
                        : task.priority === 'medium'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {task.priority}
                  </span>

                  {/* Status Tag */}
                  {task.status === 'in_progress' && (
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 flex items-center space-x-1">
                      <Clock className="w-3 h-3 animate-pulse" />
                      <span>In Progress</span>
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{task.title}</h3>

                {task.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl line-clamp-2">
                    {task.description}
                  </p>
                )}

                {/* Reasoning Pills */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {task.reasoning.map((r, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-row lg:flex-col items-center lg:items-end gap-2 shrink-0">
                {task.status !== 'in_progress' && (
                  <button
                    disabled={actionInProgress}
                    onClick={() => handleStatusChange(task, 'in_progress')}
                    className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-98"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Start Work</span>
                  </button>
                )}

                <button
                  disabled={actionInProgress}
                  onClick={() => handleStatusChange(task, 'completed')}
                  className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-98"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark Done</span>
                </button>

                <button
                  onClick={() => setShowBreakdown(!showBreakdown)}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center space-x-1 pt-1"
                >
                  <BarChart3 className="w-3 h-3" />
                  <span>{showBreakdown ? 'Hide Math Breakdown' : 'View Math Breakdown'}</span>
                </button>
              </div>
            </div>

            {/* 5-Factor Score Breakdown Bar Details */}
            {showBreakdown && task.breakdown && (
              <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-950/70 border border-indigo-100 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    5-Factor Deterministic Calculation:
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Total Score: <strong>{task.score}/100</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800 space-y-1">
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>Urgency ($e^{'{-\\Delta t}'}$)</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {Math.round(task.breakdown.urgency * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-rose-500 h-full rounded-full transition-all"
                        style={{ width: `${task.breakdown.urgency * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800 space-y-1">
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>Importance</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {Math.round(task.breakdown.importance * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full transition-all"
                        style={{ width: `${task.breakdown.importance * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800 space-y-1">
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>Proximity</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {Math.round(task.breakdown.deadlineProximity * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-purple-500 h-full rounded-full transition-all"
                        style={{ width: `${task.breakdown.deadlineProximity * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800 space-y-1">
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>DAG Leverage</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {Math.round(task.breakdown.dependencyImpact * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full rounded-full transition-all"
                        style={{ width: `${task.breakdown.dependencyImpact * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800 space-y-1">
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>Context Fit</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {Math.round(task.breakdown.contextFit * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all"
                        style={{ width: `${task.breakdown.contextFit * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Blocked tasks drawer indicator */}
        {data && data.blockedTasks && data.blockedTasks.length > 0 && (
          <div className="mt-4 pt-3 border-t border-indigo-100 dark:border-slate-800/60">
            <button
              onClick={() => setShowBlocked(!showBlocked)}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 text-xs transition-colors hover:bg-amber-100/60"
            >
              <div className="flex items-center space-x-2">
                <Lock className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  <strong>
                    {data.blockedTasks.length} task{data.blockedTasks.length > 1 ? 's' : ''}
                  </strong>{' '}
                  blocked by incomplete prerequisites (DAG cycle checked)
                </span>
              </div>
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showBlocked ? 'rotate-90' : ''}`} />
            </button>

            {showBlocked && (
              <div className="mt-2 space-y-2 p-3 rounded-2xl bg-amber-50/40 dark:bg-slate-950/60 border border-amber-100 dark:border-slate-800 animate-in fade-in duration-150">
                {data.blockedTasks.map((bt) => (
                  <div
                    key={bt.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    <div className="flex items-center space-x-2">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-medium text-slate-700 dark:text-slate-300">{bt.title}</span>
                      <span className="text-[10px] text-slate-400">
                        (Prerequisites: {bt.dependencies?.length || 0})
                      </span>
                    </div>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                      Waiting for unblock
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
