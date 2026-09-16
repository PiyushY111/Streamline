'use client';

import React, { useState } from 'react';
import { Sparkles, Send, X, RefreshCw, Copy, Check, Briefcase, Smile, Zap, Ban, Calendar } from 'lucide-react';
import { safeFetch } from '@/lib/api/client';

interface AiReplyDrafterModalProps {
  isOpen: boolean;
  onClose: () => void;
  threadId: string;
  emailId?: string;
  threadSubject?: string;
  emailContext?: string;
  onInsertDraft: (draftText: string) => void;
}

type ToneType = 'professional' | 'concise' | 'friendly' | 'decline' | 'counter_propose';

const toneOptions: Array<{ id: ToneType; label: string; icon: React.ElementType; desc: string }> = [
  { id: 'professional', label: 'Professional', icon: Briefcase, desc: 'Polished executive tone' },
  { id: 'concise', label: 'Concise', icon: Zap, desc: 'Direct & to the point' },
  { id: 'friendly', label: 'Friendly', icon: Smile, desc: 'Warm & collaborative' },
  { id: 'decline', label: 'Decline Politely', icon: Ban, desc: 'Polite refusal' },
  { id: 'counter_propose', label: 'Counter-Propose', icon: Calendar, desc: 'Suggest alternate time/plan' },
];

export function AiReplyDrafterModal({
  isOpen,
  onClose,
  threadId,
  emailId,
  threadSubject,
  emailContext,
  onInsertDraft,
}: AiReplyDrafterModalProps) {
  const [selectedTone, setSelectedTone] = useState<ToneType>('professional');
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatedDraft, setGeneratedDraft] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Auto-reset modal state when opening, closing, or switching to another thread/email
  React.useEffect(() => {
    if (!isOpen) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setGeneratedDraft('');
      setError(null);
      setCustomPrompt('');
      setIsGenerating(false);
      setCopied(false);
      setSelectedTone('professional');
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [isOpen, threadId, emailId]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;

    setIsGenerating(true);
    setGeneratedDraft('');
    setError(null);

    try {
      const response = await safeFetch('/ai/threads/draft-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ac.signal,
        body: JSON.stringify({
          threadId,
          emailId,
          tone: selectedTone,
          customPrompt: customPrompt.trim() || undefined,
          emailContext: emailContext || undefined,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with status ${response.status}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported by browser');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        if (ac.signal.aborted) break;
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (dataStr === '[DONE]') {
              break;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text && !ac.signal.aborted) {
                accumulated += parsed.text;
                setGeneratedDraft(accumulated);
              }
              if (parsed.error) {
                setError(parsed.error);
              }
            } catch {
              // Ignore partial JSON chunks
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || ac.signal.aborted) {
        return;
      }
      setError(err.message || 'Error drafting reply');
    } finally {
      if (abortControllerRef.current === ac) {
        setIsGenerating(false);
        abortControllerRef.current = null;
      }
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    onInsertDraft(generatedDraft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Draft Reply with Gemini</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-md">
                {threadSubject || 'Context-aware email reply assistant'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Tone Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">Choose Tone</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {toneOptions.map((tone) => {
                const Icon = tone.icon;
                const isSelected = selectedTone === tone.id;
                return (
                  <button
                    key={tone.id}
                    type="button"
                    onClick={() => setSelectedTone(tone.id)}
                    className={`flex items-start space-x-2 p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-purple-600 bg-purple-50/60 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 mt-0.5 shrink-0 ${isSelected ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold leading-none">{tone.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 truncate">{tone.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Instruction Prompt */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
              Custom Angle or Key Points (Optional)
            </label>
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Mention that I will send the slides tomorrow at 2 PM..."
              className="w-full px-3.5 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Generate Button */}
          <div className="flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-md shadow-purple-600/30 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50"
            >
              <Sparkles className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>{isGenerating ? 'Drafting with Gemini...' : 'Generate Draft'}</span>
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* Generated Draft Output Area */}
          {(generatedDraft || isGenerating) && (
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Generated Draft</span>
                {generatedDraft && (
                  <button
                    onClick={handleCopy}
                    className="flex items-center space-x-1 text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs leading-relaxed text-slate-800 dark:text-slate-200 font-sans whitespace-pre-wrap min-h-[120px]">
                {generatedDraft || (
                  <span className="text-slate-400 flex items-center space-x-2">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Gemini is generating your response...</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            Cancel
          </button>

          {generatedDraft && (
            <button
              onClick={handleInsert}
              className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/30 transition-all hover:scale-[1.01] active:scale-95"
            >
              <span>Insert into Reply</span>
              <Send className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
