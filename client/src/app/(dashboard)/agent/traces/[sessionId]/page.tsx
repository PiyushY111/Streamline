'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  Clock,
  Coins,
  Cpu,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Download,
  RefreshCw,
  Layers,
  ChevronDown,
  ChevronUp,
  Brain,
  Wrench,
  Sparkles,
  User,
  AlertTriangle,
  Play,
  Pause,
  ExternalLink,
} from 'lucide-react';
import {
  fetchAgentTrace,
  approvePendingAction,
  rejectPendingAction,
  AgentTraceResponseData,
  TraceStepData,
  OTelSpanData,
} from '@/lib/api';

export default function DecisionTracePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = (Array.isArray(params?.sessionId) ? params.sessionId[0] : params?.sessionId) as string;

  const [trace, setTrace] = useState<AgentTraceResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'timeline' | 'waterfall' | 'tokens' | 'raw'>('timeline');
  const [copiedJson, setCopiedJson] = useState(false);
  const [isLiveStreaming, setIsLiveStreaming] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [bannerToast, setBannerToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadTrace = useCallback(async () => {
    if (!sessionId) return;
    try {
      setLoading(true);
      const data = await fetchAgentTrace(sessionId);
      setTrace(data);
    } catch (err) {
      console.error('Failed to load trace data', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadTrace();
  }, [loadTrace]);

  // Live SSE stream handler
  useEffect(() => {
    if (!isLiveStreaming || !sessionId) return;

    const eventSource = new EventSource(`/api/agent/traces/${sessionId}/stream`);

    eventSource.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        console.log('Live trace event received:', payload);
        // Automatically re-fetch trace to absorb completed spans
        loadTrace();
      } catch (err) {
        // ignore heartbeats
      }
    };

    eventSource.addEventListener('trace_event', () => {
      loadTrace();
    });

    return () => {
      eventSource.close();
    };
  }, [isLiveStreaming, sessionId, loadTrace]);

  const toggleDetail = (id: string) => {
    setExpandedDetails((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyJson = () => {
    if (!trace) return;
    navigator.clipboard.writeText(JSON.stringify(trace, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  // Inline Approve Action
  const handleApprove = async (actionId: string, stepId: string) => {
    try {
      setActionLoading((prev) => ({ ...prev, [stepId]: true }));
      await approvePendingAction(actionId);

      // Optimistically update status in trace state
      setTrace((prev) => {
        if (!prev) return prev;
        const updatedSteps = prev.timelineSteps.map((step) => {
          if (step.metadata?.actionId === actionId) {
            return {
              ...step,
              label: step.label.replace('PENDING', 'EXECUTED'),
              metadata: { ...step.metadata, status: 'executed' },
              detail: typeof step.detail === 'object' && step.detail !== null
                ? { ...(step.detail as Record<string, unknown>), status: 'executed' }
                : step.detail,
            };
          }
          return step;
        });
        return { ...prev, timelineSteps: updatedSteps };
      });

      setBannerToast({
        type: 'success',
        message: 'Action approved and executed successfully via dual-boundary policy engine!',
      });
      setTimeout(() => setBannerToast(null), 4000);
    } catch (err: any) {
      setBannerToast({
        type: 'error',
        message: `Failed to approve action: ${err.message || 'Error occurred'}`,
      });
    } finally {
      setActionLoading((prev) => ({ ...prev, [stepId]: false }));
    }
  };

  // Inline Reject Action
  const handleReject = async (actionId: string, stepId: string) => {
    try {
      setActionLoading((prev) => ({ ...prev, [stepId]: true }));
      await rejectPendingAction(actionId);

      setTrace((prev) => {
        if (!prev) return prev;
        const updatedSteps = prev.timelineSteps.map((step) => {
          if (step.metadata?.actionId === actionId) {
            return {
              ...step,
              label: step.label.replace('PENDING', 'REJECTED'),
              metadata: { ...step.metadata, status: 'rejected' },
              detail: typeof step.detail === 'object' && step.detail !== null
                ? { ...(step.detail as Record<string, unknown>), status: 'rejected' }
                : step.detail,
            };
          }
          return step;
        });
        return { ...prev, timelineSteps: updatedSteps };
      });

      setBannerToast({
        type: 'success',
        message: 'Action proposal rejected by human operator.',
      });
      setTimeout(() => setBannerToast(null), 4000);
    } catch (err: any) {
      setBannerToast({
        type: 'error',
        message: `Failed to reject action: ${err.message || 'Error occurred'}`,
      });
    } finally {
      setActionLoading((prev) => ({ ...prev, [stepId]: false }));
    }
  };

  if (loading && !trace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-3">
        <RefreshCw className="h-7 w-7 text-purple-600 animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Assembling OpenTelemetry Decision Trace...</p>
      </div>
    );
  }

  if (!trace) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Trace Not Found</h2>
        <p className="text-xs text-slate-500">
          The requested agent decision session could not be found or access is denied.
        </p>
        <Link
          href="/agent"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-semibold"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Agent Studio</span>
        </Link>
      </div>
    );
  }

  const { summary, timelineSteps, waterfallSpans } = trace;
  const maxWaterfallDuration = Math.max(
    ...waterfallSpans.map((s) => s.startTimeMs + s.durationMs),
    summary.totalLatencyMs || 100
  );

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      {/* Toast Alert Banner */}
      {bannerToast && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-200 shadow-md ${
            bannerToast.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {bannerToast.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{bannerToast.message}</span>
          </div>
          <button
            onClick={() => setBannerToast(null)}
            className="text-xs font-semibold hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 mb-1">
            <Link href="/agent" className="hover:text-purple-600 transition-colors flex items-center space-x-1">
              <ArrowLeft className="h-3.5 w-3.5 mr-0.5" />
              <span>Agent Studio</span>
            </Link>
            <span>/</span>
            <span>Traces</span>
            <span>/</span>
            <span className="font-mono text-slate-700 dark:text-slate-300">{sessionId.slice(0, 8)}...</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center space-x-2">
            <span>{summary.sessionTitle}</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Trace ID: {sessionId} · Session Created: {new Date(summary.createdAt).toLocaleString()}
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          {/* Live Streaming Toggle */}
          <button
            onClick={() => setIsLiveStreaming(!isLiveStreaming)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              isLiveStreaming
                ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isLiveStreaming ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
            <span>{isLiveStreaming ? 'Live Monitoring' : 'Stream Trace'}</span>
          </button>

          <button
            onClick={loadTrace}
            title="Reload Trace"
            className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          <button
            onClick={handleCopyJson}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
          >
            {copiedJson ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedJson ? 'Copied' : 'Copy JSON'}</span>
          </button>
        </div>
      </div>

      {/* Hero KPI Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* End-to-End Latency */}
        <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-medium">Total Latency</span>
            <Clock className="h-3.5 w-3.5 text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white font-mono">
            {summary.totalLatencyMs}ms
          </div>
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
          <div className="text-[10px] text-slate-400 mt-1">
            ${summary.totalCostUsd.toFixed(6)} USD
          </div>
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
          <div className="text-[10px] text-slate-400 mt-1">
            {summary.toolCallsCount} tool calls executed
          </div>
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

      {/* View Switcher Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('timeline')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
            activeTab === 'timeline'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Decision Timeline
        </button>

        <button
          onClick={() => setActiveTab('waterfall')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
            activeTab === 'waterfall'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Waterfall Gantt Chart
        </button>

        <button
          onClick={() => setActiveTab('tokens')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
            activeTab === 'tokens'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Token & Cost Decomposition
        </button>

        <button
          onClick={() => setActiveTab('raw')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
            activeTab === 'raw'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Raw JSON Audit Log
        </button>
      </div>

      {/* TAB 1: DECISION TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="relative border-l-2 border-indigo-200 dark:border-indigo-900/60 ml-4 pl-6 space-y-6">
          {timelineSteps.map((step, idx) => {
            const isExpanded = !!expandedDetails[step.id];
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
              nodeBorderClass = 'border-rose-300 dark:border-rose-900/80 bg-rose-50/60 dark:bg-rose-950/30 ring-1 ring-rose-500/20';
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
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {step.label}
                      </span>
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
                              <span className="text-[9px] text-slate-400 font-mono">
                                id: {mem.id.slice(0, 6)}...
                              </span>
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
                        {typeof step.detail === 'string'
                          ? step.detail
                          : JSON.stringify(step.detail, null, 2)}
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
                            <strong>Untrusted Content Warning:</strong> This proposal was prompted by external email content. Review carefully.
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
                            onClick={() => handleApprove(step.metadata!.actionId!, step.id)}
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
                            onClick={() => handleReject(step.metadata!.actionId!, step.id)}
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
                      {typeof step.detail === 'string'
                        ? step.detail
                        : JSON.stringify(step.detail, null, 2)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: WATERFALL GANTT CHART */}
      {activeTab === 'waterfall' && (
        <div className="p-4 rounded-2xl bg-white/80 dark:bg-[#0B101D]/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-xs space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-200 dark:border-slate-800">
            <span className="font-semibold">Execution Span Hierarchy</span>
            <span className="font-mono">Time Window: 0ms → {maxWaterfallDuration}ms</span>
          </div>

          <div className="space-y-3">
            {waterfallSpans.map((span) => {
              const startPercent = (span.startTimeMs / maxWaterfallDuration) * 100;
              const widthPercent = Math.max((span.durationMs / maxWaterfallDuration) * 100, 2);

              let barColor = 'bg-indigo-500';
              if (span.statusCode === 'INTERCEPTED') barColor = 'bg-rose-500';
              else if (span.name.includes('memory')) barColor = 'bg-purple-500';
              else if (span.name.includes('tool')) barColor = 'bg-amber-500';
              else if (span.name.includes('generate')) barColor = 'bg-emerald-500';

              return (
                <div key={span.spanId} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-800 dark:text-slate-200 font-semibold truncate max-w-md">
                      {span.name}
                    </span>
                    <span className="text-slate-400">
                      {span.startTimeMs}ms (+{span.durationMs}ms)
                    </span>
                  </div>

                  {/* Horizontal Waterfall Bar */}
                  <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800/80 overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{
                        marginLeft: `${Math.min(startPercent, 95)}%`,
                        width: `${Math.min(widthPercent, 100 - startPercent)}%`,
                      }}
                      title={`${span.name}: ${span.durationMs}ms`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: TOKEN & COST DECOMPOSITION */}
      {activeTab === 'tokens' && (
        <div className="p-6 rounded-2xl bg-white/80 dark:bg-[#0B101D]/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-xs space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Token Consumption Heatmap
            </h3>
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
                <span className="font-mono text-slate-500">
                  {summary.costDecomposition.systemPromptTokens} tokens
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{
                    width: `${Math.min((summary.costDecomposition.systemPromptTokens / (summary.totalTokens || 1)) * 100, 100)}%`,
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
                <span className="font-mono text-slate-500">
                  {summary.costDecomposition.memoryContextTokens} tokens
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{
                    width: `${Math.min((summary.costDecomposition.memoryContextTokens / (summary.totalTokens || 1)) * 100, 100)}%`,
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
                <span className="font-mono text-slate-500">
                  {summary.costDecomposition.historyTokens} tokens
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{
                    width: `${Math.min((summary.costDecomposition.historyTokens / (summary.totalTokens || 1)) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Completion Output */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Model Output / Completion Tokens
                </span>
                <span className="font-mono text-slate-500">
                  {summary.costDecomposition.completionTokens} tokens
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{
                    width: `${Math.min((summary.costDecomposition.completionTokens / (summary.totalTokens || 1)) * 100, 100)}%`,
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
              {summary.costDecomposition.totalCostFormatted}
            </span>
          </div>
        </div>
      )}

      {/* TAB 4: RAW JSON AUDIT LOG */}
      {activeTab === 'raw' && (
        <div className="p-4 rounded-2xl bg-white/80 dark:bg-[#0B101D]/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Compliance Audit Payload</span>
            <button
              onClick={handleCopyJson}
              className="flex items-center space-x-1 text-purple-600 dark:text-purple-400 hover:underline"
            >
              {copiedJson ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedJson ? 'Copied' : 'Copy Payload'}</span>
            </button>
          </div>
          <pre className="text-[11px] font-mono p-4 rounded-xl bg-black/5 dark:bg-black/50 text-slate-800 dark:text-slate-200 overflow-x-auto max-h-[600px] whitespace-pre-wrap">
            {JSON.stringify(trace, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
