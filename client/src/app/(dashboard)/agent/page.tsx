'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Bot,
  Sparkles,
  Activity,
  Send,
  Plus,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Coins,
  History,
  ShieldCheck,
  ChevronRight,
  Layers,
  ArrowUpRight,
  Sliders,
  ExternalLink,
  GitBranch,
} from 'lucide-react';
import { ReasoningDAGVisualizer, SwarmSubTaskData } from '@/components/agent/ReasoningDAGVisualizer';
import { safeFetch } from '@/lib/api/client';
import {
  fetchAgentSessions,
  fetchSessionMessages,
  sendAgentMessage,
  fetchAgentStats,
  fetchActiveAiProvider,
  AgentSessionData,
  AgentMessageData,
  AgentStatsResponseData,
  AiProviderInfoData,
} from '@/lib/api';

export default function AgentStudioPage() {
  const [sessions, setSessions] = useState<AgentSessionData[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessageData[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Telemetry & Stats
  const [stats, setStats] = useState<AgentStatsResponseData | null>(null);
  const [providerInfo, setProviderInfo] = useState<AiProviderInfoData | null>(null);

  // Multi-Agent Swarm state
  const [isSwarmMode, setIsSwarmMode] = useState(true);
  const [swarmTasks, setSwarmTasks] = useState<SwarmSubTaskData[]>([]);
  const [criticPassed, setCriticPassed] = useState<boolean | undefined>(undefined);
  const [criticFeedback, setCriticFeedback] = useState<string | undefined>(undefined);
  const [isSwarmRunning, setIsSwarmRunning] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load Sessions & Governance Stats
  const loadInitialData = useCallback(async () => {
    try {
      setLoadingSessions(true);
      const [fetchedSessions, fetchedStats, fetchedProvider] = await Promise.all([
        fetchAgentSessions(),
        fetchAgentStats(),
        fetchActiveAiProvider(),
      ]);

      setSessions(fetchedSessions);
      setStats(fetchedStats);
      setProviderInfo(fetchedProvider);

      if (fetchedSessions.length > 0 && !selectedSessionId) {
        setSelectedSessionId(fetchedSessions[0].id);
      }
    } catch (err) {
      console.error('Failed to load agent studio initial data', err);
    } finally {
      setLoadingSessions(false);
    }
  }, [selectedSessionId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load Messages when active session changes
  useEffect(() => {
    if (!selectedSessionId) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    setLoadingMessages(true);

    fetchSessionMessages(selectedSessionId)
      .then((msgs) => {
        if (isMounted) setMessages(msgs);
      })
      .catch((err) => {
        console.error('Failed to load session messages', err);
      })
      .finally(() => {
        if (isMounted) {
          setLoadingMessages(false);
          setTimeout(scrollToBottom, 100);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSessionId]);

  // Start a fresh agent conversation
  const handleNewSession = () => {
    setSelectedSessionId(null);
    setMessages([]);
  };

  // Submit a turn
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputMessage.trim();
    if (!clean || sending) return;

    setInputMessage('');
    setSending(true);

    // Optimistically add user turn
    const tempUserMsg: AgentMessageData = {
      id: `temp-${Date.now()}`,
      sessionId: selectedSessionId || '',
      role: 'user',
      content: clean,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setTimeout(scrollToBottom, 50);

    if (isSwarmMode) {
      setIsSwarmRunning(true);
      setSwarmTasks([
        { id: 'step-plan', role: 'supervisor', title: 'Goal Decomposition', status: 'running' },
      ]);
      try {
        const res = await safeFetch('/agent/swarm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: clean, sessionId: selectedSessionId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (!selectedSessionId && data.sessionId) {
            setSelectedSessionId(data.sessionId);
            fetchAgentSessions().then(setSessions);
          }
          setSwarmTasks(data.subTasks || []);
          setCriticPassed(data.criticPassed);
          setCriticFeedback(data.criticFeedback);

          const modelMsg: AgentMessageData = {
            id: `swarm-res-${Date.now()}`,
            sessionId: data.sessionId || selectedSessionId || '',
            role: 'model',
            content: data.answer || 'Swarm execution completed successfully.',
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, modelMsg]);
        }
      } catch (err: any) {
        console.error('Swarm execution error', err);
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            sessionId: selectedSessionId || '',
            role: 'model',
            content: `⚠️ Swarm error: ${err.message || 'Please retry.'}`,
            createdAt: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsSwarmRunning(false);
        setSending(false);
        setTimeout(scrollToBottom, 100);
      }
      return;
    }

    try {
      const response = await sendAgentMessage(clean, selectedSessionId || undefined);

      if (!selectedSessionId && response.sessionId) {
        setSelectedSessionId(response.sessionId);
        // Refresh session list so new thread appears in sidebar
        fetchAgentSessions().then(setSessions);
      }

      // Re-fetch messages to capture exact server turn with latency and tool results
      if (response.sessionId) {
        const fresh = await fetchSessionMessages(response.sessionId);
        setMessages(fresh);
      }

      // Refresh telemetry stats
      fetchAgentStats().then(setStats);
    } catch (err: any) {
      console.error('Agent message failed', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sessionId: selectedSessionId || '',
          role: 'model',
          content: `⚠️ Error communicating with agent: ${err.message || 'Please retry.'}`,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      {/* Top Header & Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20">
              <Activity className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              ReAct Agent Orchestrator
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Tool Runtime &amp; HITL Shield
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Multi-turn tool execution runtime with thought signature inspection, OpenTelemetry waterfall profiler, and dual-boundary policy safeguards.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsSwarmMode(!isSwarmMode)}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              isSwarmMode
                ? 'bg-purple-950/40 text-purple-300 border-purple-500/50 shadow-sm shadow-purple-500/20 ring-1 ring-purple-500/30'
                : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            title="Toggle between Multi-Agent Swarm Mode and Single ReAct Loop"
          >
            <GitBranch className="h-3.5 w-3.5 text-purple-400" />
            <span>{isSwarmMode ? 'Swarm Mode Active' : 'Standard ReAct'}</span>
          </button>

          <button
            onClick={loadInitialData}
            title="Refresh Studio Data"
            className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          <button
            onClick={handleNewSession}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-purple-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            <span>New Session</span>
          </button>
        </div>
      </div>

      {/* Governance & Telemetry KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Active AI Provider */}
        <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-medium">AI Provider</span>
            <Cpu className="h-3.5 w-3.5 text-indigo-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {providerInfo?.provider || 'Google Gemini 2.5'}
            </div>
            <span className="flex items-center text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
              Live
            </span>
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            768-dim Vector Embeddings
          </div>
        </div>

        {/* 7-Day Agent Turns Cost */}
        <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-medium">7-Day Copilot Spend</span>
            <Coins className="h-3.5 w-3.5 text-purple-500" />
          </div>
          <div className="text-sm font-bold text-purple-600 dark:text-purple-400">
            ${stats?.last7Days.agentTurnCostUsd.toFixed(6) || '0.000000'}
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            Attributed to conversational reasoning
          </div>
        </div>

        {/* Total Sessions Recorded */}
        <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-medium">Total Sessions</span>
            <History className="h-3.5 w-3.5 text-indigo-500" />
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">
            {stats?.totalSessions ?? sessions.length} Threads
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            Auditable decision histories
          </div>
        </div>

        {/* Dual-Boundary Policy Gate Status */}
        <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md flex flex-col justify-between shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-medium">Policy Engine</span>
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              100% Interception
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono">
              HITL Active
            </span>
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            Zero direct write actions allowed
          </div>
        </div>
      </div>

      {/* Main Workspace (Split Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        {/* Left / Main Workspace: Active Chat Stream (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col rounded-2xl bg-white/80 dark:bg-[#0B101D]/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-xl shadow-sm overflow-hidden">
          {/* Active Session Header Banner */}
          <div className="p-3.5 border-b border-slate-200/80 dark:border-slate-800/60 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
            <div className="flex items-center space-x-3">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-sm">
                  {selectedSession?.title || 'New Agent Interaction'}
                </h3>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  {selectedSessionId ? `Session ID: ${selectedSessionId.slice(0, 12)}...` : 'Fresh thread'}
                </span>
              </div>
            </div>

            {selectedSessionId && (
              <Link
                href={`/agent/traces/${selectedSessionId}`}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-semibold transition-all group"
              >
                <span>Inspect Full Trace</span>
                <ArrowUpRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            )}
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Real-time Multi-Agent Swarm Reasoning DAG Visualizer */}
            {isSwarmMode && (swarmTasks.length > 0 || isSwarmRunning) && (
              <ReasoningDAGVisualizer
                subTasks={swarmTasks}
                criticPassed={criticPassed}
                criticFeedback={criticFeedback}
                isRunning={isSwarmRunning}
              />
            )}

            {loadingMessages ? (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                Loading conversation telemetry...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 text-slate-400">
                <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 mb-3">
                  <Bot className="h-8 w-8" />
                </div>
                <h4 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Start an Autonomous Agent Interaction
                </h4>
                <p className="text-xs text-slate-500 max-w-md">
                  Send a prompt to observe semantic memory recall, OpenTelemetry span timing, and dual-boundary policy enforcement in real time.
                </p>
                <div className="flex flex-wrap gap-2 mt-4 max-w-lg justify-center">
                  {[
                    'What tasks are currently due this week?',
                    'Find free slots tomorrow morning for a 30m sync',
                    'Draft a reply to my latest email',
                    'Reschedule my afternoon meetings',
                  ].map((example) => (
                    <button
                      key={example}
                      onClick={() => setInputMessage(example)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs transition-colors"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === 'user';
                const isTool = msg.role === 'tool';

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed shadow-xs ${
                        isUser
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-none'
                          : isTool
                          ? 'bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-slate-800 dark:text-slate-200 rounded-bl-none'
                          : 'bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 rounded-bl-none'
                      }`}
                    >
                      {/* Message Meta Pill */}
                      <div className="flex items-center justify-between text-[10px] opacity-70 mb-1.5 space-x-4">
                        <span className="font-semibold uppercase tracking-wider">
                          {isUser ? 'You' : isTool ? `Tool: ${msg.toolName || 'execute'}` : 'Streamline Copilot'}
                        </span>
                        <div className="flex items-center space-x-2">
                          {msg.latencyMs !== undefined && (
                            <span className="font-mono">{msg.latencyMs}ms</span>
                          )}
                          <span>
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Message Content */}
                      {msg.content && (
                        <div className="whitespace-pre-wrap font-sans break-words">
                          {msg.content}
                        </div>
                      )}

                      {/* Tool Calls Planned */}
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                            Planned Actions:
                          </div>
                          {msg.toolCalls.map((tc, idx) => (
                            <div
                              key={idx}
                              className="px-2.5 py-1 rounded bg-black/5 dark:bg-black/40 font-mono text-[11px] text-purple-700 dark:text-purple-300"
                            >
                              ⚡ {tc.name}({JSON.stringify(tc.args).slice(0, 60)}...)
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Tool Result Data */}
                      {isTool && msg.toolResult && (
                        <pre className="mt-2 p-2 rounded bg-black/5 dark:bg-black/40 text-[10px] font-mono whitespace-pre-wrap overflow-x-auto max-h-36">
                          {typeof msg.toolResult === 'string'
                            ? msg.toolResult
                            : JSON.stringify(msg.toolResult, null, 2)}
                        </pre>
                      )}

                      {/* Recalled Memory Chips */}
                      {msg.retrievedMemoryIds && msg.retrievedMemoryIds.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-white/20 dark:border-slate-700/60 flex items-center space-x-1.5 text-[10px]">
                          <span className="font-bold text-purple-300">Memory Provenance:</span>
                          <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-200 font-mono">
                            {msg.retrievedMemoryIds.length} facts recalled
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input Box */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 border-t border-slate-200/80 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30 flex items-center space-x-2"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask Streamline Copilot (e.g., 'Schedule meeting with design team tomorrow at 2 PM')..."
              disabled={sending}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || sending}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-semibold hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5 shadow-md shadow-purple-500/20"
            >
              {sending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>Send</span>
                  <Send className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Workspace: Sessions History & Trace Launcher (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col rounded-2xl bg-white/80 dark:bg-[#0B101D]/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-xl shadow-sm overflow-hidden">
          <div className="p-3.5 border-b border-slate-200/80 dark:border-slate-800/60 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 dark:text-slate-200">
              <History className="h-4 w-4 text-indigo-500" />
              <span>Session History</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {sessions.length} recorded
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loadingSessions ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading sessions...</div>
            ) : sessions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No agent sessions yet.</div>
            ) : (
              sessions.map((sess) => {
                const isSelected = sess.id === selectedSessionId;
                return (
                  <div
                    key={sess.id}
                    onClick={() => setSelectedSessionId(sess.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 group ${
                      isSelected
                        ? 'bg-purple-50/90 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 shadow-sm'
                        : 'bg-white dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800/70 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <h4
                        className={`text-xs font-semibold truncate max-w-[180px] ${
                          isSelected ? 'text-purple-700 dark:text-purple-300' : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {sess.title || 'Untitled Interaction'}
                      </h4>
                      <span className="text-[10px] text-slate-400">
                        {new Date(sess.updatedAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/50">
                      <span className="text-[10px] text-slate-400 font-mono">
                        {sess.id.slice(0, 8)}...
                      </span>

                      <Link
                        href={`/agent/traces/${sess.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-indigo-100/70 hover:bg-indigo-200 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold transition-colors"
                      >
                        <span>Trace</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
