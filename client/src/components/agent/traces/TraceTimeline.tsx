import React from 'react';
import {
  Activity,
  Brain,
  User,
  ShieldAlert,
  Wrench,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { TraceStepData } from '@/lib/api';

interface TraceTimelineProps {
  timelineSteps: TraceStepData[];
  expandedDetails: Record<string, boolean>;
  toggleDetail: (id: string) => void;
  actionLoading: Record<string, boolean>;
  onApprove: (actionId: string, stepId: string) => void;
  onReject: (actionId: string, stepId: string) => void;
}

export const TraceTimeline: React.FC<TraceTimelineProps> = ({
  timelineSteps,
  expandedDetails,
  toggleDetail,
  actionLoading,
  onApprove,
  onReject,
}) => {
  return (
    <div className="relative border-l-2 border-indigo-200 dark:border-indigo-900/60 ml-4 pl-6 space-y-6">
      {timelineSteps.map((step) => {
        const isUser = step.kind === 'user_message';
        const isContext = step.kind === 'context_retrieved';
        const isPending = step.kind === 'pending_action';
        const isTool = step.kind === 'tool_call';
        const isModel = step.kind === 'model_response';

        let nodeBorderClass = 'border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60';
        let dotBg = 'bg-slate-400';
        let StepIcon = Activity;

        if (isUser) {
          nodeBorderClass = 'border-blue-300 dark:border-blue-900/80 bg-blue-50/50 dark:bg-blue-950/20';
          dotBg = 'bg-blue-500';
          StepIcon = User;
        } else if (isContext) {
          nodeBorderClass = 'border-purple-300 dark:border-purple-900/80 bg-purple-50/50 dark:bg-purple-950/20';
          dotBg = 'bg-purple-500';
          StepIcon = Brain;
        } else if (isPending) {
          nodeBorderClass =
            'border-rose-300 dark:border-rose-900/80 bg-rose-50/60 dark:bg-rose-950/30 ring-1 ring-rose-500/20';
          dotBg = 'bg-rose-500 animate-pulse';
          StepIcon = ShieldAlert;
        } else if (isTool) {
          nodeBorderClass = 'border-amber-300 dark:border-amber-900/80 bg-amber-50/50 dark:bg-amber-950/20';
          dotBg = 'bg-amber-500';
          StepIcon = Wrench;
        } else if (isModel) {
          nodeBorderClass = 'border-emerald-300 dark:border-emerald-900/80 bg-emerald-50/50 dark:bg-emerald-950/20';
          dotBg = 'bg-emerald-500';
          StepIcon = Sparkles;
        }

        return (
          <div key={step.id} className="relative group">
            {/* Timeline Dot on Rail */}
            <div
              className={`absolute -left-[31px] top-3.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#0B101D] ${dotBg}`}
            />

            {/* Step Card */}
            <div className={`p-4 rounded-2xl border backdrop-blur-md shadow-xs transition-all ${nodeBorderClass}`}>
              {/* Step Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                <div className="flex items-center space-x-2">
                  <StepIcon className="h-4 w-4 shrink-0 text-slate-700 dark:text-slate-300" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{step.label}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-black/5 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                    {step.spanId}
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-[10px] text-slate-400 font-mono">
                  {step.latencyMs !== undefined && <span>{step.latencyMs}ms latency</span>}
                  <span>{new Date(step.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>

              {/* Body: User Message */}
              {isUser && (
                <div className="text-xs text-slate-800 dark:text-slate-200 font-medium">
                  {typeof step.detail === 'string' ? step.detail : JSON.stringify(step.detail)}
                </div>
              )}

              {/* Body: Semantic Memory Retrieval */}
              {isContext && (
                <div className="space-y-2 mt-2">
                  <div className="flex flex-wrap gap-1.5">
                    {step.metadata?.memorySnippets?.map((mem) => (
                      <div
                        key={mem.id}
                        className="p-2 rounded-xl bg-purple-100/70 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-[11px] text-purple-900 dark:text-purple-200 flex flex-col space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[9px] uppercase tracking-wider text-purple-600 dark:text-purple-400">
                            [{mem.type}]
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">id: {mem.id.slice(0, 6)}...</span>
                        </div>
                        <p className="text-xs">{mem.snippet}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Body: Tool Call Result */}
              {isTool && (
                <div className="mt-1">
                  <pre className="text-[11px] font-mono p-2.5 rounded-xl bg-black/5 dark:bg-black/40 text-slate-800 dark:text-slate-200 overflow-x-auto max-h-48 whitespace-pre-wrap">
                    {typeof step.detail === 'string' ? step.detail : JSON.stringify(step.detail, null, 2)}
                  </pre>
                </div>
              )}

              {/* Body: Pending Action with HITL Gate & Inline Approval */}
              {isPending && (
                <div className="mt-2 space-y-3">
                  {/* Security notice if prompted by untrusted external email */}
                  {step.metadata?.untrustedContentWarning && (
                    <div className="p-2.5 rounded-xl bg-rose-100/80 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                      <span>
                        <strong>Untrusted Content Warning:</strong> This proposal was prompted by external email
                        content. Review carefully.
                      </span>
                    </div>
                  )}

                  {/* Reasoning */}
                  {step.metadata?.reasoning && (
                    <div className="text-xs text-slate-700 dark:text-slate-300">
                      <strong>Agent Rationale:</strong> {step.metadata.reasoning}
                    </div>
                  )}

                  {/* Impact Preview / Arguments */}
                  <pre className="text-[11px] font-mono p-2.5 rounded-xl bg-black/5 dark:bg-black/40 text-slate-800 dark:text-slate-200 overflow-x-auto max-h-48 whitespace-pre-wrap">
                    {JSON.stringify(step.detail, null, 2)}
                  </pre>

                  {/* Live Inline Approval / Rejection Gate */}
                  {step.metadata?.actionId && step.metadata.status === 'pending' && (
                    <div className="flex items-center space-x-3 pt-2">
                      <button
                        onClick={() => onApprove(step.metadata!.actionId!, step.id)}
                        disabled={actionLoading[step.id]}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all flex items-center space-x-1.5 disabled:opacity-50"
                      >
                        {actionLoading[step.id] ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        <span>Approve & Execute Action</span>
                      </button>

                      <button
                        onClick={() => onReject(step.metadata!.actionId!, step.id)}
                        disabled={actionLoading[step.id]}
                        className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all disabled:opacity-50"
                      >
                        Reject Proposal
                      </button>
                    </div>
                  )}

                  {/* Status indicator if resolved */}
                  {step.metadata?.status && step.metadata.status !== 'pending' && (
                    <div className="flex items-center space-x-1.5 text-xs font-bold pt-1">
                      {step.metadata.status === 'executed' || step.metadata.status === 'approved' ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Status: EXECUTED (Human Approved)</span>
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400 flex items-center space-x-1">
                          <XCircle className="h-4 w-4" />
                          <span>Status: REJECTED</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Body: Model Response */}
              {isModel && (
                <div className="mt-1 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {typeof step.detail === 'string' ? step.detail : JSON.stringify(step.detail, null, 2)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TraceTimeline;
