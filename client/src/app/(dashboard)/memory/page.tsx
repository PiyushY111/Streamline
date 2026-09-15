'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Brain,
  Sparkles,
  Layers,
  Search,
  Trash2,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Database,
  Zap,
  Activity,
  UserCheck,
  ShieldCheck,
  X,
  Clock,
} from 'lucide-react';
import {
  fetchUserMemories,
  createUserMemory,
  deleteUserMemory,
  searchUserMemories,
  fetchActiveAiProvider,
  UserMemoryData,
  MemorySearchResultData,
  AiProviderInfoData,
} from '@/lib/api';

const MEMORY_TYPES: Array<{
  id: 'preference' | 'decision' | 'project_fact';
  label: string;
  description: string;
  badgeClass: string;
  accentClass: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'preference',
    label: 'Preference',
    description: 'Work styles, schedules, communication habits',
    badgeClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
    accentClass: 'from-purple-500/20 to-indigo-500/20 border-purple-500/30',
    icon: UserCheck,
  },
  {
    id: 'decision',
    label: 'Decision',
    description: 'Confirmed directives, policy rules, explicit commitments',
    badgeClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
    accentClass: 'from-indigo-500/20 to-blue-500/20 border-indigo-500/30',
    icon: Sparkles,
  },
  {
    id: 'project_fact',
    label: 'Project Fact',
    description: 'Architectural rules, conventions, infrastructure details',
    badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    accentClass: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30',
    icon: Layers,
  },
];

export default function MemoryVaultPage() {
  const [memories, setMemories] = useState<UserMemoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<'all' | 'preference' | 'decision' | 'project_fact'>('all');
  const [searchFilter, setSearchFilter] = useState('');
  
  // AI Provider state
  const [providerInfo, setProviderInfo] = useState<AiProviderInfoData | null>(null);
  const [providerLoading, setProviderLoading] = useState(true);

  // New Memory form state
  const [newType, setNewType] = useState<'preference' | 'decision' | 'project_fact'>('preference');
  const [newContent, setNewContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Hybrid RAG Retrieval Inspector state
  const [ragQuery, setRagQuery] = useState('');
  const [ragCategory, setRagCategory] = useState<'all' | 'preference' | 'decision' | 'project_fact'>('all');
  const [ragResults, setRagResults] = useState<MemorySearchResultData[]>([]);
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [hasRetrieved, setHasRetrieved] = useState(false);
  const [retrievalLatencyMs, setRetrievalLatencyMs] = useState<number | null>(null);
  const [activeViewMode, setActiveViewMode] = useState<'ranked' | 'prompt'>('ranked');

  // Notifications & Modals
  const [bannerMessage, setBannerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Load Memories and AI Provider status
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [fetchedMemories, fetchedProvider] = await Promise.all([
        fetchUserMemories(),
        fetchActiveAiProvider(),
      ]);
      setMemories(fetchedMemories);
      setProviderInfo(fetchedProvider);
    } catch (err: any) {
      console.warn('Failed to load memory vault data:', err);
    } finally {
      setLoading(false);
      setProviderLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Metric counts
  const metrics = useMemo(() => {
    const total = memories.length;
    const preferences = memories.filter((m) => m.type === 'preference').length;
    const decisions = memories.filter((m) => m.type === 'decision').length;
    const facts = memories.filter((m) => m.type === 'project_fact').length;
    return { total, preferences, decisions, facts };
  }, [memories]);

  // Filtered memories for display grid
  const filteredMemories = useMemo(() => {
    return memories.filter((m) => {
      const matchesCategory = activeCategory === 'all' || m.type === activeCategory;
      const matchesSearch =
        !searchFilter.trim() ||
        m.content.toLowerCase().includes(searchFilter.toLowerCase()) ||
        m.type.toLowerCase().includes(searchFilter.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [memories, activeCategory, searchFilter]);

  // Handle Quick Memory Creation
  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    try {
      setIsAdding(true);
      const response = await createUserMemory(newType, newContent.trim());
      if (response.memory) {
        setMemories((prev) => [response.memory, ...prev]);
        setNewContent('');
        setIsFormOpen(false);
        setBannerMessage({
          type: 'success',
          text: `Saved to memory vault and generated ${providerInfo?.dimensions || 768}-dim dense vector embedding.`,
        });
      }
    } catch (err: any) {
      setBannerMessage({
        type: 'error',
        text: `Failed to create memory: ${err.message || 'Server error'}`,
      });
    } finally {
      setIsAdding(false);
    }
  };

  // Handle Deleting Memory
  const handleDeleteMemory = async (id: string) => {
    try {
      const ok = await deleteUserMemory(id);
      if (ok) {
        setMemories((prev) => prev.filter((m) => m.id !== id));
        setBannerMessage({
          type: 'success',
          text: 'Memory removed from vector index and relational store.',
        });
      } else {
        throw new Error('Failed to delete memory');
      }
    } catch (err: any) {
      setBannerMessage({
        type: 'error',
        text: `Error deleting memory: ${err.message}`,
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Handle Live pgvector + tsvector Hybrid RAG Retrieval Execution
  const handleExecuteRetrieval = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!ragQuery.trim()) return;

    const startTime = performance.now();
    try {
      setIsRetrieving(true);
      setHasRetrieved(true);
      const results = await searchUserMemories(ragQuery.trim(), ragCategory, 5);
      setRagResults(results);
      setRetrievalLatencyMs(Math.round(performance.now() - startTime));
    } catch (err: any) {
      setBannerMessage({
        type: 'error',
        text: `Hybrid RAG retrieval error: ${err.message}`,
      });
    } finally {
      setIsRetrieving(false);
    }
  };

  const getProviderDisplayName = () => {
    if (providerLoading) return 'Connecting AI Engine...';
    if (!providerInfo) return 'AI Engine Offline';
    const providerMap: Record<string, string> = {
      gemini: 'Google Gemini',
      'openai-compatible': 'OpenAI Compatible',
      mock: 'Offline Mock Provider',
    };
    return providerMap[providerInfo.provider] || providerInfo.provider;
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16 font-sans">
      {/* Toast Notification Banner */}
      {bannerMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between shadow-lg backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 ${
            bannerMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center space-x-3">
            {bannerMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            )}
            <span className="text-xs font-semibold">{bannerMessage.text}</span>
          </div>
          <button
            onClick={() => setBannerMessage(null)}
            className="text-xs font-bold opacity-70 hover:opacity-100 uppercase tracking-wider px-2 py-1 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Hero Glassmorphic Header */}
      <div className="relative overflow-hidden p-8 rounded-3xl clean-card dark:dark-glass dark:dark-glow border border-slate-200 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl z-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-[11px] font-bold uppercase tracking-wider">
            <Brain className="w-3.5 h-3.5" />
            <span>Agent Long-Term Memory & Episodic Graph</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Memory Vault
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Persistent episodic memory powering contextual, cross-session agent reasoning. Combines dense HNSW vector embeddings with sparse keyword search using Reciprocal Rank Fusion (RRF).
          </p>
        </div>

        {/* Live AI Provider Indicator & Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 z-10 shrink-0">
          {/* AI Engine Status Badge */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  providerInfo?.isAvailable ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  providerInfo?.isAvailable ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </span>
            <div className="flex flex-col text-left">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Active AI Engine
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1">
                <span>{getProviderDisplayName()}</span>
                {providerInfo && (
                  <span className="text-[10px] text-purple-500 font-mono">
                    ({providerInfo.dimensions}-dim)
                  </span>
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 transition-all disabled:opacity-50"
              title="Refresh Memory Index"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-500' : ''}`} />
            </button>

            <button
              onClick={() => setIsFormOpen(!isFormOpen)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.02] active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>{isFormOpen ? 'Close Editor' : 'Record Memory'}</span>
            </button>
          </div>
        </div>

        {/* Ambient background glow */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-purple-600/10 dark:bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Memories */}
        <div
          onClick={() => setActiveCategory('all')}
          className={`p-5 rounded-3xl clean-card dark:dark-glass clean-card-hover border cursor-pointer transition-all ${
            activeCategory === 'all'
              ? 'border-purple-500 ring-2 ring-purple-500/20'
              : 'border-slate-200 dark:border-slate-800/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Brain className="w-5 h-5" />
            </div>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {metrics.total}
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">Total Memories</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              HNSW vector indexed entries
            </p>
          </div>
        </div>

        {/* Preferences */}
        <div
          onClick={() => setActiveCategory('preference')}
          className={`p-5 rounded-3xl clean-card dark:dark-glass clean-card-hover border cursor-pointer transition-all ${
            activeCategory === 'preference'
              ? 'border-purple-500 ring-2 ring-purple-500/20'
              : 'border-slate-200 dark:border-slate-800/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {metrics.preferences}
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">Preferences</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              Habits, scheduling, styling
            </p>
          </div>
        </div>

        {/* Decisions */}
        <div
          onClick={() => setActiveCategory('decision')}
          className={`p-5 rounded-3xl clean-card dark:dark-glass clean-card-hover border cursor-pointer transition-all ${
            activeCategory === 'decision'
              ? 'border-indigo-500 ring-2 ring-indigo-500/20'
              : 'border-slate-200 dark:border-slate-800/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {metrics.decisions}
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">Decisions</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              Confirmed directives & policies
            </p>
          </div>
        </div>

        {/* Project Facts */}
        <div
          onClick={() => setActiveCategory('project_fact')}
          className={`p-5 rounded-3xl clean-card dark:dark-glass clean-card-hover border cursor-pointer transition-all ${
            activeCategory === 'project_fact'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20'
              : 'border-slate-200 dark:border-slate-800/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Layers className="w-5 h-5" />
            </div>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {metrics.facts}
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">Project Facts</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              Codebase architecture & rules
            </p>
          </div>
        </div>
      </div>

      {/* Quick Memory Creation Form (Expandable) */}
      {isFormOpen && (
        <div className="p-6 rounded-3xl clean-card dark:dark-glass border border-purple-500/30 shadow-xl space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Record New Long-Term Memory
              </h2>
            </div>
            <button
              onClick={() => setIsFormOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleCreateMemory} className="space-y-4">
            {/* Type selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {MEMORY_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = newType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setNewType(type.id)}
                    className={`p-3 rounded-2xl border text-left flex items-start space-x-3 transition-all ${
                      isSelected
                        ? 'border-purple-500 bg-purple-500/10 text-purple-900 dark:text-purple-200 ring-2 ring-purple-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? 'text-purple-500' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-bold">{type.label}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                        {type.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Content text area */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Memory Content
              </label>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="e.g., Never schedule external product demos on Friday afternoons before 3 PM EST."
                rows={3}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-purple-500 transition-colors"
                required
              />
            </div>

            <div className="flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isAdding || !newContent.trim()}
                className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-md shadow-purple-600/25 disabled:opacity-50"
              >
                {isAdding ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Indexing Vector...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Store in Vault</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Hybrid RAG Retrieval Inspector & Semantic Context Profiler */}
      <div className="p-6 sm:p-8 rounded-3xl clean-card dark:dark-glass border border-slate-200 dark:border-slate-800/80 space-y-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Neon pgvector + tsvector Engine</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Hybrid RAG Retrieval Inspector & Context Profiler
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Inspect real-time dense vector retrieval via Neon pgvector HNSW cosine distance (<code className="font-mono text-indigo-500">&lt;=&gt;</code>) fused with sparse PostgreSQL <code className="font-mono text-purple-500">tsvector</code> search via Reciprocal Rank Fusion ($k=60$).
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-[11px] text-slate-400 font-mono px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              pgvector HNSW • Top-K: 5 • Cosine Cutoff: 0.78
            </span>
          </div>
        </div>

        {/* Quick Query Presets */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-[11px]">
          <span className="text-slate-400 shrink-0 font-medium">Quick Queries:</span>
          {[
            'What are my communication preferences?',
            'How is OAuth token refresh implemented?',
            'What are the calendar meeting rules?',
          ].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setRagQuery(preset);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-800 transition-colors shrink-0"
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Retrieval Search Bar */}
        <form onSubmit={handleExecuteRetrieval} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={ragQuery}
              onChange={(e) => setRagQuery(e.target.value)}
              placeholder="Query semantic memory (e.g., 'What time can I take calls?' or 'How is auth implemented?')..."
              className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={ragCategory}
              onChange={(e: any) => setRagCategory(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-3 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Memory Types</option>
              <option value="preference">Preferences Only</option>
              <option value="decision">Decisions Only</option>
              <option value="project_fact">Project Facts Only</option>
            </select>

            <button
              type="submit"
              disabled={isRetrieving || !ragQuery.trim()}
              className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center space-x-2 transition-all shadow-md shadow-indigo-600/25 disabled:opacity-50 shrink-0"
            >
              {isRetrieving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Querying pgvector...</span>
                </>
              ) : (
                <>
                  <Database className="w-3.5 h-3.5" />
                  <span>Execute Retrieval</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Live Retrieval Telemetry & Context Inspector */}
        {hasRetrieved && (
          <div className="space-y-4 pt-2">
            {/* Telemetry KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Query Latency</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white font-mono mt-0.5">
                  {retrievalLatencyMs !== null ? `${retrievalLatencyMs} ms` : '—'}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Retrieved Candidates</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white font-mono mt-0.5">
                  {ragResults.length} records
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Max Cosine Match</span>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                  {ragResults.length > 0
                    ? `${Math.max(0, Math.round((1 - Math.min(...ragResults.map((r) => r.distance))) * 100))}%`
                    : '0%'}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Injected Context Load</span>
                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                  ~{ragResults.reduce((acc, r) => acc + Math.round(r.content.length / 4), 0)} tokens
                </p>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveViewMode('ranked')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                    activeViewMode === 'ranked'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Ranked Candidates ({ragResults.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveViewMode('prompt')}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                    activeViewMode === 'prompt'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Agent Injected Prompt Preview
                </button>
              </div>

              <span className="text-[11px] font-mono text-purple-500 hidden sm:inline">
                Fused via RRF: RRF(d) = Σ [1 / (60 + rank)]
              </span>
            </div>

            {ragResults.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
                <AlertCircle className="w-6 h-6 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  No Relevant Context Exceeds Similarity Threshold (Distance &lt; 0.78)
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Try broadening your query terms or recording new long-term facts in the Memory Vault.
                </p>
              </div>
            ) : activeViewMode === 'ranked' ? (
              <div className="space-y-2.5">
                {ragResults.map((result, idx) => {
                  const similarityPct = Math.max(0, Math.round((1 - result.distance) * 100));
                  return (
                    <div
                      key={result.id}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-indigo-500/40 transition-colors"
                    >
                      <div className="flex items-start space-x-3 flex-1 min-w-0">
                        <div className="flex flex-col items-center justify-center w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs shrink-0 mt-0.5">
                          #{idx + 1}
                        </div>
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                result.type === 'preference'
                                  ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                                  : result.type === 'decision'
                                  ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              }`}
                            >
                              {result.type.replace('_', ' ')}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              RRF Rank Score: {result.score.toFixed(4)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                            {result.content}
                          </p>
                        </div>
                      </div>

                      {/* Distance & Metric Gauge */}
                      <div className="flex items-center space-x-3 shrink-0 self-end md:self-auto border-t md:border-t-0 pt-2 md:pt-0 border-slate-200 dark:border-slate-800">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                            Cosine Similarity
                          </span>
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                            {similarityPct}% match
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            distance: {result.distance.toFixed(4)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Agent Context Injection XML Preview */
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Exact serialized context injected into ReAct Agent system prompt:</span>
                  <span className="font-mono text-indigo-400">XML Encapsulation</span>
                </div>
                <pre className="p-4 rounded-2xl bg-slate-950 text-slate-300 font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed">
                  {`<user_context>\n` +
                    ragResults
                      .map(
                        (r, i) =>
                          `  <${r.type} id="${r.id}" rank="${i + 1}" similarity="${Math.max(
                            0,
                            Math.round((1 - r.distance) * 100)
                          )}%">\n    ${r.content}\n  </${r.type}>`
                      )
                      .join('\n') +
                    `\n</user_context>`}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Memory Vault Explorer Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
          {/* Category Filter Tabs */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeCategory === 'all'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              All ({metrics.total})
            </button>
            <button
              onClick={() => setActiveCategory('preference')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeCategory === 'preference'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              Preferences ({metrics.preferences})
            </button>
            <button
              onClick={() => setActiveCategory('decision')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeCategory === 'decision'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              Decisions ({metrics.decisions})
            </button>
            <button
              onClick={() => setActiveCategory('project_fact')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeCategory === 'project_fact'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              Project Facts ({metrics.facts})
            </button>
          </div>

          {/* Search Filter Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search memories..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Memories Grid */}
        {filteredMemories.length === 0 ? (
          <div className="p-12 rounded-3xl clean-card dark:dark-glass text-center space-y-4 border border-dashed border-slate-300 dark:border-slate-800">
            <div className="h-12 w-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto text-purple-500">
              <Brain className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {memories.length === 0 ? 'No Memories Stored Yet' : 'No Matching Memories'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {memories.length === 0
                  ? 'The agent automatically extracts preferences, decisions, and facts from conversations, or you can record them manually.'
                  : 'Try changing your search filter or category selection.'}
              </p>
            </div>
            {memories.length === 0 && (
              <button
                onClick={() => setIsFormOpen(true)}
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/25 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Record First Memory</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMemories.map((mem) => {
              const meta = MEMORY_TYPES.find((t) => t.id === mem.type) || MEMORY_TYPES[0];
              const Icon = meta.icon;
              const dateStr = new Date(mem.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <div
                  key={mem.id}
                  className="p-5 rounded-3xl clean-card dark:dark-glass clean-card-hover border border-slate-200 dark:border-slate-800/80 flex flex-col justify-between space-y-4 transition-all duration-200"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${meta.badgeClass}`}
                      >
                        <Icon className="w-3 h-3" />
                        <span>{meta.label}</span>
                      </span>

                      <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                        <Clock className="w-3 h-3" />
                        <span>{dateStr}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                      {mem.content}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[10px] text-slate-400">
                    <div className="flex items-center space-x-1">
                      <Database className="w-3 h-3 text-purple-500" />
                      <span>{mem.sourceRef ? `Source: ${mem.sourceRef}` : 'Agent Extracted'}</span>
                    </div>

                    <button
                      onClick={() => setDeletingId(mem.id)}
                      className="p-1 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors rounded-lg hover:bg-rose-500/10"
                      title="Delete memory"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Architectural Guarantee Card */}
      <div className="p-6 rounded-3xl clean-card dark:dark-glass border border-slate-200 dark:border-slate-800/80 space-y-3">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-900 dark:text-white">
          <ShieldCheck className="w-4 h-4 text-purple-500" />
          <span>Production Architecture & Safety Standard</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          The Memory Vault is built on Neon PostgreSQL with the <code className="font-mono text-purple-500">pgvector</code> HNSW index and GIN full-text index. When the agent uses <code className="font-mono text-purple-500">save_memory</code>, it operates under zero real-world blast radius (classified as a read operation in ADR-0010 & ADR-0011) to avoid human confirmation friction while maintaining user safety. The memory layer is 100% provider-agnostic, supporting Google Gemini, OpenAI-compatible endpoints, and offline mock environments.
        </p>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Memory</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Are you sure you want to remove this memory from your long-term vault? The agent will no longer retrieve this information during future planning and synthesis.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteMemory(deletingId)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/25"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
