'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  UserCheck,
  Send,
  Hourglass,
  Tag,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { safeFetch } from '@/lib/api/client';

interface RadarTask {
  taskId: string;
  title: string;
  type: 'assigned_to_me' | 'commitment_i_made' | 'followup_waiting_on';
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
  assignorOrAssignee?: string;
  confidence: number;
  isConverted: boolean;
  isDismissed: boolean;
  emailId: string;
  emailSubject: string | null;
  emailSender: string;
  emailReceivedAt: string;
  accountColor: string | null;
  accountLabel: string | null;
  accountEmail: string;
}

export function AiTaskRadar() {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState<string>('all');

  const { data, isLoading, isRefetching, refetch } = useQuery<{ success: boolean; data: RadarTask[] }>({
    queryKey: ['ai-task-radar'],
    queryFn: async () => {
      const res = await safeFetch('/ai/tasks/radar');
      if (!res.ok) throw new Error('Failed to fetch radar tasks');
      return res.json();
    },
  });

  const convertMutation = useMutation({
    mutationFn: async (task: RadarTask) => {
      const res = await safeFetch('/ai/tasks/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailId: task.emailId,
          taskId: task.taskId,
          title: task.title,
          priority: task.priority,
          dueDate: task.dueDate,
        }),
      });
      if (!res.ok) throw new Error('Failed to convert task');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-task-radar'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async ({ emailId, taskId }: { emailId: string; taskId: string }) => {
      const res = await safeFetch('/ai/tasks/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId, taskId }),
      });
      if (!res.ok) throw new Error('Failed to dismiss task');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-task-radar'] });
    },
  });

  const allTasks = data?.data || [];
  const activeTasks = allTasks.filter((t) => !t.isConverted && !t.isDismissed);

  const assignedToMe = activeTasks.filter((t) => t.type === 'assigned_to_me');
  const commitmentsMade = activeTasks.filter((t) => t.type === 'commitment_i_made');
  const followUps = activeTasks.filter((t) => t.type === 'followup_waiting_on');

  const filteredTasks =
    filterType === 'all'
      ? activeTasks
      : activeTasks.filter((t) => t.type === filterType);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                AI Task Radar
              </h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                {activeTasks.length} Discovered
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Directional action items and commitments extracted by Gemini from your synced emails.
            </p>
          </div>
        </div>

        {/* Action / Refresh */}
        <button
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          <span>Refresh Radar</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 py-3 overflow-x-auto text-xs">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
            filterType === 'all'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          All Items ({activeTasks.length})
        </button>
        <button
          onClick={() => setFilterType('assigned_to_me')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1.5 ${
            filterType === 'assigned_to_me'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <UserCheck className="h-3.5 w-3.5" />
          <span>Assigned to Me ({assignedToMe.length})</span>
        </button>
        <button
          onClick={() => setFilterType('commitment_i_made')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1.5 ${
            filterType === 'commitment_i_made'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Send className="h-3.5 w-3.5" />
          <span>Promises I Made ({commitmentsMade.length})</span>
        </button>
        <button
          onClick={() => setFilterType('followup_waiting_on')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1.5 ${
            filterType === 'followup_waiting_on'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Hourglass className="h-3.5 w-3.5" />
          <span>Waiting On ({followUps.length})</span>
        </button>
      </div>

      {/* Task Cards List */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-3 text-slate-400">
          <Sparkles className="h-6 w-6 animate-pulse text-purple-500" />
          <p className="text-sm">Scanning emails for promises & action items...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="py-10 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800">
          <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Radar is all clear!
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            No pending promises or unassigned requests detected in recent emails.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
          {filteredTasks.map((task) => {
            const isAssigned = task.type === 'assigned_to_me';
            const isCommitment = task.type === 'commitment_i_made';
            const isWaiting = task.type === 'followup_waiting_on';

            return (
              <div
                key={task.taskId}
                className="flex flex-col justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-purple-500/40 hover:shadow-md transition-all group"
              >
                <div>
                  {/* Top Type Badge & Priority */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                        isAssigned
                          ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                          : isCommitment
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                          : 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                      }`}
                    >
                      {isAssigned && <UserCheck className="h-3 w-3" />}
                      {isCommitment && <Send className="h-3 w-3" />}
                      {isWaiting && <Hourglass className="h-3 w-3" />}
                      <span>
                        {isAssigned
                          ? 'Assigned to You'
                          : isCommitment
                          ? 'You Promised'
                          : 'Waiting on Others'}
                      </span>
                    </span>

                    {task.priority === 'high' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
                        High Priority
                      </span>
                    )}
                  </div>

                  {/* Task Title */}
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                    {task.title}
                  </h4>

                  {/* Context snippet */}
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                    <div className="flex items-center space-x-1.5 truncate">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: task.accountColor || '#6366f1' }}
                      />
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                        {task.emailSubject || 'Email Thread'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      From: {task.emailSender}
                    </div>
                  </div>

                  {/* Due Date tag if available */}
                  {task.dueDate && (
                    <div className="mt-2.5 inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-200/60 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
                      <Clock className="h-3 w-3 text-purple-500" />
                      <span>Due: {task.dueDate}</span>
                    </div>
                  )}
                </div>

                {/* Actions bottom bar */}
                <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-200/60 dark:border-slate-800/80 gap-2">
                  <button
                    onClick={() =>
                      dismissMutation.mutate({
                        emailId: task.emailId,
                        taskId: task.taskId,
                      })
                    }
                    disabled={dismissMutation.isPending}
                    className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    Dismiss
                  </button>

                  <button
                    onClick={() => convertMutation.mutate(task)}
                    disabled={convertMutation.isPending}
                    className="flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-xs shadow-purple-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Accept to Tasks</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
