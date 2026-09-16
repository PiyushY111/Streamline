import React from 'react';
import { TraceSummaryData } from '@/lib/api';

interface TokenDecompositionHeatmapProps {
  costDecomposition: TraceSummaryData['costDecomposition'];
  totalTokens: number;
}

export const TokenDecompositionHeatmap: React.FC<TokenDecompositionHeatmapProps> = ({
  costDecomposition,
  totalTokens,
}) => {
  return (
    <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#0B101D]/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-xs space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Token Consumption Heatmap</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Breakdown of token attribution across copilot prompt components.
        </p>
      </div>

      <div className="space-y-4">
        {/* System Prompt */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Base System Prompt & Copilot Instructions
            </span>
            <span className="font-mono text-slate-500">{costDecomposition.systemPromptTokens} tokens</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full"
              style={{
                width: `${Math.min((costDecomposition.systemPromptTokens / (totalTokens || 1)) * 100, 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Semantic Memory Facts */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Semantic Memory Context (RAG Facts Injected)
            </span>
            <span className="font-mono text-slate-500">{costDecomposition.memoryContextTokens} tokens</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full"
              style={{
                width: `${Math.min((costDecomposition.memoryContextTokens / (totalTokens || 1)) * 100, 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Conversation History */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Conversation History & Tool Result Buffer
            </span>
            <span className="font-mono text-slate-500">{costDecomposition.historyTokens} tokens</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{
                width: `${Math.min((costDecomposition.historyTokens / (totalTokens || 1)) * 100, 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Completion Output */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Model Output / Completion Tokens</span>
            <span className="font-mono text-slate-500">{costDecomposition.completionTokens} tokens</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{
                width: `${Math.min((costDecomposition.completionTokens / (totalTokens || 1)) * 100, 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/80 flex items-center justify-between text-xs">
        <div>
          <span className="font-bold text-purple-900 dark:text-purple-200">Total Billed Cost for Session:</span>
          <p className="text-[11px] text-purple-700 dark:text-purple-400">
            Aggregated per-turn pricing based on Google Gemini Flash rates.
          </p>
        </div>
        <span className="text-base font-bold font-mono text-purple-700 dark:text-purple-300">
          {costDecomposition.totalCostFormatted}
        </span>
      </div>
    </div>
  );
};

export default TokenDecompositionHeatmap;
