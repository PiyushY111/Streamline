'use client';

import React, { useState } from 'react';
import { Search, X, SlidersHorizontal, Paperclip, Calendar } from 'lucide-react';

export interface SearchFilterState {
  from: string;
  to: string;
  subject: string;
  hasAttachment: boolean;
  dateWithin: string;
}

interface AdvancedSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: SearchFilterState) => void;
  onResetFilters: () => void;
}

export function AdvancedSearchModal({
  isOpen,
  onClose,
  onApplyFilters,
  onResetFilters,
}: AdvancedSearchModalProps) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [hasAttachment, setHasAttachment] = useState(false);
  const [dateWithin, setDateWithin] = useState('any');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onApplyFilters({ from, to, subject, hasAttachment, dateWithin });
    onClose();
  };

  const handleReset = () => {
    setFrom('');
    setTo('');
    setSubject('');
    setHasAttachment(false);
    setDateWithin('any');
    onResetFilters();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-[#f6f8fc] dark:bg-[#28292c] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-800 dark:text-white font-bold text-sm">
            <SlidersHorizontal className="w-4 h-4 text-[#0b57d0] dark:text-purple-400" />
            <span>Advanced Search Filters</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">From</label>
              <input
                type="text"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="Sender email or name"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#141517] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#0b57d0]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">To</label>
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="Recipient email"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#141517] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#0b57d0]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">Subject Contains</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Keywords in subject line"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#141517] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#0b57d0]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-1">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Date Range</label>
              <select
                value={dateWithin}
                onChange={(e) => setDateWithin(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#141517] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#0b57d0]"
              >
                <option value="any">Anytime</option>
                <option value="1d">Past 24 hours</option>
                <option value="7d">Past 7 days</option>
                <option value="30d">Past 30 days</option>
              </select>
            </div>

            <div className="flex items-center space-x-2 pt-6">
              <input
                type="checkbox"
                id="hasAttachmentCheck"
                checked={hasAttachment}
                onChange={(e) => setHasAttachment(e.target.checked)}
                className="w-4 h-4 rounded text-[#0b57d0] focus:ring-[#0b57d0]"
              />
              <label htmlFor="hasAttachmentCheck" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1 cursor-pointer">
                <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                <span>Has Attachment</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium"
            >
              Reset Filters
            </button>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#0b57d0] hover:bg-[#0a4ab8] text-white font-semibold shadow-md"
              >
                Search Mail
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
