'use client';

import React, { useState } from 'react';
import {
  Brain,
  Mail,
  Calendar,
  Layers,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowDown,
  GitBranch,
} from 'lucide-react';

export interface SwarmSubTaskData {
  id: string;
  role: 'supervisor' | 'inbox_sentry' | 'calendar_negotiator' | 'dossier_researcher' | 'dag_scheduler' | 'critic' | string;
  title: string;
  instruction?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: Record<string, unknown> | string;
  durationMs?: number;
}

interface ReasoningDAGVisualizerProps {
  subTasks: SwarmSubTaskData[];
  criticPassed?: boolean;
  criticFeedback?: string;
  activeRole?: string;
  isRunning?: boolean;
}

export function ReasoningDAGVisualizer({
  subTasks,
  criticPassed,
  criticFeedback,
  activeRole,
  isRunning = false,
}: ReasoningDAGVisualizerProps) {
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'inbox_sentry':
        return Mail;
      case 'calendar_negotiator':
        return Calendar;
      case 'dossier_researcher':
        return Search;
      case 'dag_scheduler':
        return Layers;
      case 'critic':
        return ShieldCheck;
      default:
        return Brain;
    }
  };

  const getRoleColors = (role: string) => {
    switch (role) {
      case 'inbox_sentry':
        return {
          badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
          border: 'border-amber-500/40',
          glow: 'shadow-amber-500/20',
        };
      case 'calendar_negotiator':
        return {
          badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
          border: 'border-blue-500/40',
          glow: 'shadow-blue-500/20',
        };
      case 'dossier_researcher':
        return {
          badge: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
          border: 'border-indigo-500/40',
          glow: 'shadow-indigo-500/20',
        };
      case 'dag_scheduler':
        return {
          badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          border: 'border-emerald-500/40',
          glow: 'shadow-emerald-500/20',
        };
      case 'critic':
        return {
          badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
          border: 'border-rose-500/40',
          glow: 'shadow-rose-500/20',
        };
      default:
        return {
          badge: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
          border: 'border-purple-500/40',
          glow: 'shadow-purple-500/20',
        };
    }
  };

  if (subTasks.length === 0 && !isRunning) return null;

  return (
    <div className="bg-[#10131A] border border-slate-800/80 rounded-2xl p-5 shadow-2xl space-y-4 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <GitBranch className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white flex items-center space-x-2">
              <span>Multi-Agent Swarm Reasoning DAG</span>
              {isRunning && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </h3>
            <p className="text-[11px] text-slate-400">
              Deterministic supervisor delegation, specialist execution, and Tree-of-Thought critique.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {criticPassed !== undefined && (
            <span
              className={`text-[10px] font-mono px-2.5 py-1 rounded-full border flex items-center space-x-1.5 ${
                criticPassed
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              }`}
            >
              <ShieldCheck className="w-3 h-3" />
              <span>{criticPassed ? 'Critic: Verified' : 'Critic: Under Review'}</span>
            </span>
          )}
        </div>
      </div>

      {/* Visual DAG Nodes Waterfall */}
      <div className="space-y-3 relative">
        {subTasks.map((task, idx) => {
          const Icon = getRoleIcon(task.role);
          const colors = getRoleColors(task.role);
          const isExpanded = expandedNodeId === task.id;
          const isCurrent = task.status === 'running';

          return (
            <div key={task.id} className="relative">
              {idx > 0 && (
                <div className="flex justify-center -my-1.5">
                  <ArrowDown className="w-3 h-3 text-slate-600" />
                </div>
              )}

              <div
                className={`p-3.5 rounded-xl border transition-all ${
                  isCurrent
                    ? `bg-slate-900/90 ${colors.border} ring-1 ring-indigo-500/50 shadow-lg ${colors.glow}`
                    : task.status === 'completed'
                    ? 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    : 'bg-slate-950/30 border-slate-900 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg border ${colors.badge}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-xs font-semibold text-slate-200">{task.title}</h4>
                        <span className={`text-[9px] uppercase font-mono px-1.5 py-0.2 rounded border ${colors.badge}`}>
                          {task.role.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {task.instruction && (
                        <p className="text-[11px] text-slate-400 truncate max-w-md mt-0.5">
                          {task.instruction}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {task.durationMs && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        {task.durationMs}ms
                      </span>
                    )}

                    {task.status === 'completed' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                    {task.status === 'running' && (
                      <Clock className="w-4 h-4 text-indigo-400 animate-spin" />
                    )}
                    {task.status === 'failed' && (
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                    )}

                    {task.output && (
                      <button
                        onClick={() => setExpandedNodeId(isExpanded ? null : task.id)}
                        className="p-1 hover:bg-slate-800 rounded-md text-slate-400"
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Output Data */}
                {isExpanded && task.output && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] font-mono text-slate-300 bg-black/40 p-2.5 rounded-lg overflow-x-auto">
                    <pre className="whitespace-pre-wrap">
                      {typeof task.output === 'string' ? task.output : JSON.stringify(task.output, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Critic Verification Card */}
        {criticFeedback && (
          <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs flex items-start space-x-2.5 mt-2">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-emerald-300">Tree-of-Thought Critique: </span>
              <span className="text-slate-300">{criticFeedback}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
