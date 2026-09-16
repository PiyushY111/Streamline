'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Clock, Globe, Bell, CheckCircle2, Plus, Trash2, Sliders, ShieldCheck, Save } from 'lucide-react';
import { safeFetch } from '@/lib/api/client';

interface AiPreferences {
  id: string;
  digestTime: string;
  digestTimezone: string;
  digestDeliveryMode: 'in_app' | 'email' | 'both';
  isAutoTriageEnabled: boolean;
  vipSenders: string[];
  customInstructions?: string;
}

export function AiSettingsSection() {
  const queryClient = useQueryClient();
  const [digestTime, setDigestTime] = useState('08:00:00');
  const [digestTimezone, setDigestTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [deliveryMode, setDeliveryMode] = useState<'in_app' | 'email' | 'both'>('in_app');
  const [isAutoTriageEnabled, setIsAutoTriageEnabled] = useState(true);
  const [vipSenders, setVipSenders] = useState<string[]>([]);
  const [newVipEmail, setNewVipEmail] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const { data, isLoading } = useQuery<{ success: boolean; data: AiPreferences }>({
    queryKey: ['ai-preferences'],
    queryFn: async () => {
      const res = await safeFetch('/ai/preferences');
      if (!res.ok) throw new Error('Failed to load AI preferences');
      return res.json();
    },
  });

  useEffect(() => {
    if (data?.data) {
      setDigestTime(data.data.digestTime || '08:00:00');
      setDigestTimezone(data.data.digestTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
      setDeliveryMode(data.data.digestDeliveryMode || 'in_app');
      setIsAutoTriageEnabled(data.data.isAutoTriageEnabled ?? true);
      setVipSenders(data.data.vipSenders || []);
      setCustomInstructions(data.data.customInstructions || '');
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<AiPreferences>) => {
      const res = await safeFetch('/ai/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save AI preferences');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-preferences'] });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    },
  });

  const handleAddVip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVipEmail.trim() || !newVipEmail.includes('@')) return;
    if (!vipSenders.includes(newVipEmail.trim().toLowerCase())) {
      setVipSenders([...vipSenders, newVipEmail.trim().toLowerCase()]);
    }
    setNewVipEmail('');
  };

  const handleRemoveVip = (emailToRemove: string) => {
    setVipSenders(vipSenders.filter((e) => e !== emailToRemove));
  };

  const handleSaveAll = () => {
    saveMutation.mutate({
      digestTime,
      digestTimezone,
      digestDeliveryMode: deliveryMode,
      isAutoTriageEnabled,
      vipSenders,
      customInstructions: customInstructions.trim() || undefined,
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center space-x-3.5">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Gemini AI Engine Settings
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configure your daily newsletter digest schedule, auto-triage, and VIP priorities.
            </p>
          </div>
        </div>

        <button
          onClick={handleSaveAll}
          disabled={saveMutation.isPending || isLoading}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/25 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 self-start sm:self-auto"
        >
          {savedSuccess ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              <span>Settings Saved!</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>{saveMutation.isPending ? 'Saving...' : 'Save AI Preferences'}</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Daily Digest Schedule */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-4">
          <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-semibold text-sm">
            <Clock className="h-4 w-4 text-purple-500" />
            <span>Daily Newsletter & Executive Digest Time</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                Preferred Delivery Hour
              </label>
              <input
                type="time"
                value={digestTime.substring(0, 5)}
                onChange={(e) => setDigestTime(`${e.target.value}:00`)}
                className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Gemini will summarize all unread newsletters & action items at this time.
              </span>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Your Timezone</label>
              <div className="flex items-center space-x-2">
                <Globe className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={digestTimezone}
                  onChange={(e) => setDigestTimezone(e.target.value)}
                  placeholder="e.g. Asia/Kolkata, America/New_York"
                  className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                Delivery Channel
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'in_app', label: 'In-App' },
                  { id: 'email', label: 'Email' },
                  { id: 'both', label: 'Both' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setDeliveryMode(mode.id as any)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      deliveryMode === mode.id
                        ? 'bg-purple-600 border-purple-600 text-white shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Auto-Triage & VIP Priority Senders */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-semibold text-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>Auto-Triage & VIP Senders</span>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isAutoTriageEnabled}
                onChange={(e) => setIsAutoTriageEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-purple-600"></div>
            </label>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                VIP Senders (Always Prioritized as P1 Urgent)
              </label>
              <form onSubmit={handleAddVip} className="flex space-x-2">
                <input
                  type="email"
                  value={newVipEmail}
                  onChange={(e) => setNewVipEmail(e.target.value)}
                  placeholder="boss@company.com or client@domain.com"
                  className="flex-1 px-3.5 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500"
                />
                <button
                  type="submit"
                  className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </form>

              {vipSenders.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5 max-h-28 overflow-y-auto">
                  {vipSenders.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-xs font-medium"
                    >
                      <span>{email}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveVip(email)}
                        className="text-purple-400 hover:text-purple-600 dark:hover:text-purple-200"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                Custom Gemini Persona / Instructions
              </label>
              <textarea
                rows={2}
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="e.g. Highlight technical architecture and budget decisions in summaries."
                className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
