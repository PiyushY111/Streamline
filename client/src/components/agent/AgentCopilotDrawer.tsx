'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  X,
  Sparkles,
  RefreshCw,
  Clock,
  Calendar,
  CheckSquare,
  Mail,
  ShieldCheck,
  ChevronDown,
  Layers,
} from 'lucide-react';
import {
  sendAgentMessage,
  fetchPendingActions,
  PendingActionData,
  fetchSessionMessages,
  AgentMessageData,
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
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<
    Array<{
      id?: string;
      role: 'user' | 'model';
      content: string;
      toolCalls?: Array<{ name: string; args: any }>;
      pendingActions?: PendingActionData[];
    }>
  >([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || loading) return;

    const userText = query.trim();
    setInput('');

    // Add user message optimistically
    setMessages((prev) => [...prev, { role: 'user', content: userText }]);
    setLoading(true);

    try {
      const response = await sendAgentMessage(userText, sessionId);
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
    'Find me two open hours tomorrow for my project',
    'Draft an email to Sarah saying I will be 15 mins late',
    'Create a high-priority task to run database migration',
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md">
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
                Any-AI model powered • Zero unauthorized side effects
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

        {/* Conversation Message List */}
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
                  I can check your schedule, manage priorities, draft emails, and propose calendar events with your approval.
                </p>
              </div>

              {/* Suggestions */}
              <div className="space-y-2 pt-2 text-left">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block px-1">
                  Suggested Actions
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
              <span>Analyzing context &amp; coordinating tools...</span>
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
              placeholder="Ask copilot to check tasks, find slots, or schedule..."
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
      </div>
    </div>
  );
}
