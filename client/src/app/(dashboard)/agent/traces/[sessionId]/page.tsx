'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import {
  fetchAgentTrace,
  approvePendingAction,
  rejectPendingAction,
  AgentTraceResponseData,
} from '@/lib/api';
import {
  TraceHeaderKPIs,
  TraceTimeline,
  TraceWaterfallGantt,
  TokenDecompositionHeatmap,
  RawAuditLogViewer,
} from '@/components/agent/traces';

export default function DecisionTracePage() {
  const params = useParams();
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
        JSON.parse(e.data);
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
      <TraceHeaderKPIs summary={summary} />

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
        <TraceTimeline
          timelineSteps={timelineSteps}
          expandedDetails={expandedDetails}
          toggleDetail={toggleDetail}
          actionLoading={actionLoading}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      {/* TAB 2: WATERFALL GANTT CHART */}
      {activeTab === 'waterfall' && (
        <TraceWaterfallGantt
          waterfallSpans={waterfallSpans}
          maxWaterfallDuration={maxWaterfallDuration}
        />
      )}

      {/* TAB 3: TOKEN & COST DECOMPOSITION */}
      {activeTab === 'tokens' && (
        <TokenDecompositionHeatmap
          costDecomposition={summary.costDecomposition}
          totalTokens={summary.totalTokens}
        />
      )}

      {/* TAB 4: RAW JSON AUDIT LOG */}
      {activeTab === 'raw' && (
        <RawAuditLogViewer
          trace={trace}
          onCopy={handleCopyJson}
          copied={copiedJson}
        />
      )}
    </div>
  );
}
