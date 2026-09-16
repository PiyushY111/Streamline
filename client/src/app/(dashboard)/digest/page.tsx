'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  Newspaper,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  Sliders,
  Flame,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Link from 'next/link';
import { safeFetch } from '@/lib/api/client';

interface NewsletterTopic {
  topic: string;
  headline: string;
  bulletPoints: string[];
  sourceEmailIds: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
}

interface ActionSummaryItem {
  task: string;
  from: string;
  emailId: string;
  urgency: string;
}

interface DailyDigestData {
  id: string;
  digestDate: string;
  executiveGreeting: string;
  scheduleSummary?: string;
  newsletterTopics: NewsletterTopic[];
  actionSummary: ActionSummaryItem[];
  isRead: boolean;
}

export default function DailyDigestPage() {
  const queryClient = useQueryClient();
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});

  const { data, isLoading, isRefetching, refetch } = useQuery<{
    success: boolean;
    data: DailyDigestData;
  }>({
    queryKey: ['daily-digest-today'],
    queryFn: async () => {
      const res = await safeFetch('/ai/daily-digest/today');
      if (!res.ok) throw new Error('Failed to fetch daily digest');
      return res.json();
    },
  });

  const generateNowMutation = useMutation({
    mutationFn: async () => {
      const res = await safeFetch('/ai/daily-digest/generate-now', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to generate daily digest');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-digest-today'] });
    },
  });

  const toggleTopicExpand = (topic: string) => {
    setExpandedTopics((prev) => ({
      ...prev,
      [topic]: !prev[topic],
    }));
  };

  const digest = data?.data;
  const topics = digest?.newsletterTopics || [];
  const actionItems = digest?.actionSummary || [];

  const filteredTopics = selectedTopic === 'all' ? topics : topics.filter((t) => t.topic === selectedTopic);

  const formattedDate = digest?.digestDate
    ? new Date(digest.digestDate).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Executive Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-purple-800/40">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-200 text-xs font-semibold backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-purple-300 animate-pulse" />
              <span>Gemini Pro Executive Briefing</span>
              <span>•</span>
              <span>{formattedDate}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {digest?.executiveGreeting || 'Synthesizing your daily briefing...'}
            </h1>

            {digest?.scheduleSummary && (
              <p className="text-xs sm:text-sm text-purple-200/80 max-w-2xl font-medium">{digest.scheduleSummary}</p>
            )}
          </div>

          <div className="flex items-center space-x-2.5 self-start sm:self-center">
            <button
              onClick={() => generateNowMutation.mutate()}
              disabled={generateNowMutation.isPending || isRefetching}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-semibold backdrop-blur-md transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${generateNowMutation.isPending || isRefetching ? 'animate-spin' : ''}`}
              />
              <span>Generate Fresh Digest</span>
            </button>

            <Link
              href="/settings"
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-colors"
              title="Configure Digest Delivery Time"
            >
              <Sliders className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-400">
          <Sparkles className="h-8 w-8 text-purple-500 animate-spin" />
          <p className="text-sm font-medium">Reading subscriptions and synthesizing briefing...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Newsletter Hub (Left 2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Newspaper className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Curated Subscriptions Digest</h2>
              </div>
              <span className="text-xs text-slate-500 font-medium">{topics.length} Topics Clustered</span>
            </div>

            {/* Topic Filter Pills */}
            {topics.length > 0 && (
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  onClick={() => setSelectedTopic('all')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    selectedTopic === 'all'
                      ? 'bg-purple-600 text-white shadow-xs font-semibold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  All Topics
                </button>
                {topics.map((t) => (
                  <button
                    key={t.topic}
                    onClick={() => setSelectedTopic(t.topic)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                      selectedTopic === t.topic
                        ? 'bg-purple-600 text-white shadow-xs font-semibold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {t.topic}
                  </button>
                ))}
              </div>
            )}

            {/* Topics Cards */}
            {filteredTopics.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <Newspaper className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No newsletters received yet today
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  When new Substack, Axios, or curated emails arrive, Gemini will summarize them here automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTopics.map((item, idx) => {
                  const isExpanded = expandedTopics[item.topic] !== false; // default expanded

                  return (
                    <div
                      key={item.topic + idx}
                      className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all hover:border-purple-500/30"
                    >
                      {/* Topic Card Header */}
                      <div
                        onClick={() => toggleTopicExpand(item.topic)}
                        className="p-4 sm:p-5 flex items-start justify-between gap-4 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300">
                              {item.topic}
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{item.headline}</h3>
                        </div>

                        <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>

                      {/* Bullets Content */}
                      {isExpanded && (
                        <div className="px-4 sm:px-5 pb-5 pt-1 border-t border-slate-100 dark:border-slate-800/60 space-y-2.5">
                          <ul className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                            {item.bulletPoints.map((bullet, bIdx) => (
                              <li key={bIdx} className="flex items-start space-x-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-2 shrink-0" />
                                <span className="leading-relaxed">{bullet}</span>
                              </li>
                            ))}
                          </ul>

                          {/* Source Citations */}
                          <div className="pt-3 flex items-center justify-between text-xs text-slate-400">
                            <span>Synthesized from {item.sourceEmailIds?.length || 1} newsletter sources</span>
                            <Link
                              href="/inbox"
                              className="inline-flex items-center space-x-1 text-purple-600 dark:text-purple-400 hover:underline font-medium"
                            >
                              <span>View in Inbox</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Synthesis Sidebar (Right 1 col) */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Flame className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Urgent Action Items</h2>
            </div>

            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-3.5">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Top tasks detected from your unread high-priority emails today:
              </p>

              {actionItems.length === 0 ? (
                <div className="py-6 text-center text-slate-400">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1.5" />
                  <p className="text-xs font-medium">No urgent bottlenecks pending!</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {actionItems.map((act, aIdx) => (
                    <div
                      key={aIdx}
                      className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">{act.task}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 shrink-0">
                          {act.urgency}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">From: {act.from}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <Link
                  href="/tasks"
                  className="block text-center py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                >
                  Open Full Task Radar &rarr;
                </Link>
              </div>
            </div>

            {/* Digest Settings Info Card */}
            <div className="rounded-2xl border border-purple-200/60 dark:border-purple-900/40 bg-purple-50/40 dark:bg-purple-950/20 p-4 space-y-2">
              <div className="flex items-center space-x-2 text-purple-700 dark:text-purple-300">
                <Clock className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Scheduled Delivery</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Streamline automatically synthesizes your subscriptions and agenda at your preferred morning hour.
              </p>
              <Link
                href="/settings"
                className="inline-block text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline"
              >
                Change Delivery Time in Settings &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
