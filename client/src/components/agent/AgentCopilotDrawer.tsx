'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  X,
  Sparkles,
  RefreshCw,
  Clock,
  Brain,
  Trash2,
  Tag,
  Layers,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  sendAgentMessage,
  fetchPendingActions,
  PendingActionData,
  fetchSessionMessages,
  AgentMessageData,
  fetchUserMemories,
  deleteUserMemory,
  UserMemoryData,
} from '@/lib/api';
import { PendingActionCard } from './PendingActionCard';

interface AgentCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onActionExecuted?: () => void;
}

export function AgentCopilotDrawer({
  isOpen,
  onClose,
  onActionExecuted,
}: AgentCopilotDrawerProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'memories'>('chat');
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<
    Array<{
      id?: string;
      role: 'user' | 'model';
      content: string;
      toolCalls?: Array<{ name: string; args: any }>;
      pendingActions?: PendingActionData[];
      recalledMemories?: Array<{ id: string; type: string; content: string }>;
    }>
  >([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Memories State
  const [memories, setMemories] = useState<UserMemoryData[]>([]);
  const [memoryFilter, setMemoryFilter] = useState<'all' | 'preference' | 'decision' | 'project_fact'>('all');
  const [loadingMemories, setLoadingMemories] = useState(false);
  const [expandedMemoryTurn, setExpandedMemoryTurn] = useState<number | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeTab === 'chat') {
      scrollToBottom();
    }
  }, [messages, loading, activeTab]);

  useEffect(() => {
    if (isOpen && activeTab === 'memories') {
      loadMemories();
    }
  }, [isOpen, activeTab, memoryFilter]);

  const loadMemories = async () => {
    setLoadingMemories(true);
    try {
      const filterArg = memoryFilter === 'all' ? undefined : memoryFilter;
      const data = await fetchUserMemories(filterArg);
      setMemories(data);
    } catch (err) {
      console.error('Failed to load memories', err);
    } finally {
      setLoadingMemories(false);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      const ok = await deleteUserMemory(id);
      if (ok) {
        setMemories((prev) => prev.filter((m) => m.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete memory', err);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || loading) return;

    const userText = query.trim();
    setInput('');

    // Add user message optimistically
    setMessages((prev) => [...prev, { role: 'user', content: userText }]);
    setLoading(true);

    try {
      const response: any = await sendAgentMessage(userText, sessionId);
      if (!sessionId) {
        setSessionId(response.sessionId);
      }

      // Fetch pending actions if any action was queued
      let pendingList: PendingActionData[] = [];
      if (response.pendingActions && response.pendingActions.length > 0) {
        const allPending = await fetchPendingActions();
        pendingList = allPending.filter((a) => response.pendingActions.includes(a.id));
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          content: response.text,
          pendingActions: pendingList,
          recalledMemories: response.recalledMemories || [],
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          content: `⚠️ Error: ${err.message || 'Unable to complete agent turn.'}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    'What tasks do I have pending right now?',
    'Remember that I prefer morning deep work before 12pm',
    'Find me two open hours tomorrow for my project',
    'Draft an email to Sarah saying I will be 15 mins late',
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/20">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Streamline Copilot
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Human-in-the-Loop Safe
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Any-AI model powered • Dual-boundary safety
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center space-x-1 bg-slate-200/60 dark:bg-slate-800/60 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-lg transition-all ${
                activeTab === 'chat'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Copilot Chat</span>
            </button>
            <button
              onClick={() => setActiveTab('memories')}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 rounded-lg transition-all ${
                activeTab === 'memories'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Memories ({memories.length})</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Conversation Chat View */}
        {activeTab === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.length === 0 ? (
                <div className="py-12 text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center shadow-xs">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      How can I help you today?
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                      I can check your schedule, manage priorities, remember your preferences, and propose calendar events with your approval.
                    </p>
                  </div>

                  {/* Suggestions */}
                  <div className="space-y-2 pt-2 text-left">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block px-1">
                      Suggested Prompts
                    </span>
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(s)}
                        className="w-full text-left px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/50 dark:bg-slate-950/50 hover:bg-white dark:hover:bg-slate-900 text-xs text-slate-700 dark:text-slate-300 transition-all text-ellipsis overflow-hidden"
                      >
                        &quot;{s}&quot;
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} space-y-2`}
                  >
                    {/* Proactive Memory Recall Pill */}
                    {m.role === 'model' && m.recalledMemories && m.recalledMemories.length > 0 && (
                      <div className="space-y-1">
                        <button
                          onClick={() => setExpandedMemoryTurn(expandedMemoryTurn === idx ? null : idx)}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/80 hover:bg-purple-100 transition-colors"
                        >
                          <Brain className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                          <span>
                            🧠 Recalled {m.recalledMemories.length} memory context {m.recalledMemories.length === 1 ? 'item' : 'items'}
                          </span>
                        </button>

                        {expandedMemoryTurn === idx && (
                          <div className="p-2.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 text-[11px] text-purple-900 dark:text-purple-200 space-y-1.5 max-w-sm animate-in fade-in duration-150">
                            {m.recalledMemories.map((rm) => (
                              <div key={rm.id} className="flex items-start space-x-1.5">
                                <span className="font-semibold uppercase text-[9px] px-1 py-0.5 rounded bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200 shrink-0">
                                  {rm.type}
                                </span>
                                <span className="text-[11px]">{rm.content}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-indigo-600 text-white shadow-xs font-medium'
                          : 'bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60 shadow-xs'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>

                    {/* Embedded Pending Actions needing approval */}
                    {m.pendingActions && m.pendingActions.length > 0 && (
                      <div className="w-full space-y-2 pt-1">
                        {m.pendingActions.map((act) => (
                          <PendingActionCard
                            key={act.id}
                            action={act}
                            onResolved={() => onActionExecuted?.()}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}

              {loading && (
                <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 p-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                  <span>Searching memory &amp; executing tools...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center space-x-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask copilot or tell it a preference to remember..."
                  className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white shadow-xs transition-all hover:scale-[1.03] active:scale-95 shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        )}

        {/* Tab 2: Long-Term Memory Inspector View */}
        {activeTab === 'memories' && (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Filter bar */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between">
              <div className="flex items-center space-x-1 overflow-x-auto">
                {(['all', 'preference', 'decision', 'project_fact'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setMemoryFilter(filter)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      memoryFilter === filter
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {filter === 'all'
                      ? 'All'
                      : filter === 'preference'
                      ? 'Preferences'
                      : filter === 'decision'
                      ? 'Decisions'
                      : 'Project Facts'}
                  </button>
                ))}
              </div>

              <button
                onClick={loadMemories}
                disabled={loadingMemories}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Refresh memories"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingMemories ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Memories List */}
            <div className="flex-1 p-5 space-y-3">
              {loadingMemories ? (
                <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto text-indigo-500" />
                  <p>Loading semantic memory vault...</p>
                </div>
              ) : memories.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 mx-auto flex items-center justify-center">
                    <Brain className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      No memories stored yet
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                      As you use the assistant or explicitly say &quot;Remember that I...&quot;, facts will be stored here and used for personalized recommendations.
                    </p>
                  </div>
                </div>
              ) : (
                memories.map((mem) => {
                  const badgeColor =
                    mem.type === 'preference'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                      : mem.type === 'decision'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';

                  return (
                    <div
                      key={mem.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-2 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${badgeColor}`}
                        >
                          {mem.type === 'preference'
                            ? 'Preference'
                            : mem.type === 'decision'
                            ? 'Past Decision'
                            : 'Project Fact'}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] text-slate-400">
                            {new Date(mem.createdAt).toLocaleDateString()}
                          </span>
                          <button
                            onClick={() => handleDeleteMemory(mem.id)}
                            className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                            title="Delete memory"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                        {mem.content}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
