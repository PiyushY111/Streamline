'use client';

import React, { useState } from 'react';
import { Lock, X, ShieldAlert, KeyRound, Clock } from 'lucide-react';

export interface ConfidentialModeConfig {
  expiration: string;
  requirePasscode: boolean;
}

interface ConfidentialModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: ConfidentialModeConfig) => void;
  currentConfig?: ConfidentialModeConfig | null;
}

export function ConfidentialModeModal({ isOpen, onClose, onSave, currentConfig }: ConfidentialModeModalProps) {
  const [expiration, setExpiration] = useState(currentConfig?.expiration || '1w');
  const [requirePasscode, setRequirePasscode] = useState(currentConfig?.requirePasscode || false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ expiration, requirePasscode });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#f6f8fc] dark:bg-[#28292c] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-800 dark:text-white font-bold text-xs">
            <Lock className="w-4 h-4 text-amber-500" />
            <span>Confidential Mode Settings</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 flex items-start space-x-2.5 text-amber-800 dark:text-amber-300">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Recipients won&apos;t have the option to forward, copy, print, or download this email.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Set Expiration</span>
            </label>
            <select
              value={expiration}
              onChange={(e) => setExpiration(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#141517] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#0b57d0]"
            >
              <option value="1d">Expires in 1 day</option>
              <option value="1w">Expires in 1 week</option>
              <option value="1m">Expires in 1 month</option>
              <option value="3m">Expires in 3 months</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5 cursor-pointer">
              <KeyRound className="w-3.5 h-3.5 text-slate-400" />
              <span>SMS Passcode Protection</span>
            </label>
            <input
              type="checkbox"
              checked={requirePasscode}
              onChange={(e) => setRequirePasscode(e.target.checked)}
              className="w-4 h-4 rounded text-[#0b57d0] focus:ring-[#0b57d0]"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
            <button type="submit" className="px-4 py-1.5 rounded-xl bg-[#0b57d0] text-white font-semibold shadow-xs">
              Save Mode
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
