import React from 'react';
import { Clock, Coins, Layers, ShieldCheck } from 'lucide-react';
import { TraceSummaryData } from '@/lib/api';

interface TraceHeaderKPIsProps {
  summary: TraceSummaryData;
}

export const TraceHeaderKPIs: React.FC<TraceHeaderKPIsProps> = ({ summary }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* End-to-End Latency */}
      <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-2xs">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
          <span className="font-medium">Total Latency</span>
          <Clock className="h-3.5 w-3.5 text-indigo-500" />
        </div>
        <div className="text-xl font-bold text-slate-900 dark:text-white font-mono">{summary.totalLatencyMs}ms</div>
        <div className="text-[10px] text-slate-400 mt-1 flex items-center space-x-2">
          <span>LLM: {summary.modelLatencyMs}ms</span>
          <span>·</span>
          <span>Tools: {summary.toolLatencyMs}ms</span>
        </div>
      </div>

      {/* Tokens & Cost Attribution */}
      <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-2xs">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
          <span className="font-medium">Tokens & Cost</span>
          <Coins className="h-3.5 w-3.5 text-purple-500" />
        </div>
        <div className="text-xl font-bold text-purple-600 dark:text-purple-400 font-mono">
          {summary.totalTokens.toLocaleString()} <span className="text-xs font-normal text-slate-400">tokens</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-1">${summary.totalCostUsd.toFixed(6)} USD</div>
      </div>

      {/* Total Decision Steps */}
      <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-2xs">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
          <span className="font-medium">Decision Steps</span>
          <Layers className="h-3.5 w-3.5 text-indigo-500" />
        </div>
        <div className="text-xl font-bold text-slate-900 dark:text-white font-mono">
          {summary.stepCount} <span className="text-xs font-normal text-slate-400">spans</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-1">{summary.toolCallsCount} tool calls executed</div>
      </div>

      {/* Policy Gate & HITL Interceptions */}
      <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-2xs">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
          <span className="font-medium">Safety Interceptions</span>
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
        </div>
        <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
          {summary.pendingActionsCount} <span className="text-xs font-normal text-slate-400">held</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-1">
          {summary.hasUntrustedContentWarning ? '⚠️ Untrusted data flagged' : 'Zero autonomous writes'}
        </div>
      </div>
    </div>
  );
};

export default TraceHeaderKPIs;
