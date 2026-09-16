'use client';

import React, { useState } from 'react';
import { Clock, X, Calendar, Sun, Sunrise, CalendarDays } from 'lucide-react';

interface SnoozeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSnooze: (snoozeDate: Date, label: string) => void;
}

export function SnoozeModal({ isOpen, onClose, onSnooze }: SnoozeModalProps) {
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('18:00');
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  if (!isOpen) return null;

  const now = new Date();

  // Presets
  const laterToday = new Date(now);
  laterToday.setHours(18, 0, 0, 0);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);

  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + ((1 + 7 - nextWeek.getDay()) % 7 || 7));
  nextWeek.setHours(8, 0, 0, 0);

  const handlePresetSelect = (date: Date, label: string) => {
    onSnooze(date, label);
    onClose();
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDate) return;
    const combined = new Date(`${customDate}T${customTime || '09:00'}`);
    onSnooze(
      combined,
      combined.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#f6f8fc] dark:bg-[#28292c] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-800 dark:text-white font-bold text-xs">
            <Clock className="w-4 h-4 text-[#0b57d0] dark:text-purple-400" />
            <span>Snooze until...</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options */}
        {!showCustomPicker ? (
          <div className="p-3 space-y-1 text-xs">
            <button
              onClick={() => handlePresetSelect(laterToday, 'Later today (6:00 PM)')}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200"
            >
              <div className="flex items-center space-x-3">
                <Sun className="w-4 h-4 text-amber-500" />
                <span className="font-semibold">Later today</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">6:00 PM</span>
            </button>

            <button
              onClick={() => handlePresetSelect(tomorrow, 'Tomorrow morning (8:00 AM)')}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200"
            >
              <div className="flex items-center space-x-3">
                <Sunrise className="w-4 h-4 text-orange-500" />
                <span className="font-semibold">Tomorrow morning</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">8:00 AM</span>
            </button>

            <button
              onClick={() => handlePresetSelect(nextWeek, 'Next week (Mon 8:00 AM)')}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200"
            >
              <div className="flex items-center space-x-3">
                <CalendarDays className="w-4 h-4 text-blue-500" />
                <span className="font-semibold">Next week</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Mon, 8:00 AM</span>
            </button>

            <button
              onClick={() => setShowCustomPicker(true)}
              className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200 font-semibold"
            >
              <Calendar className="w-4 h-4 text-purple-500" />
              <span>Select date & time</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleCustomSubmit} className="p-4 space-y-3 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Date</label>
              <input
                type="date"
                required
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#141517] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Time</label>
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#141517] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCustomPicker(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
              >
                Back
              </button>
              <button type="submit" className="px-4 py-1.5 rounded-xl bg-[#0b57d0] text-white font-semibold shadow-sm">
                Save
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
