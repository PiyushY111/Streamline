'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  X,
  Sliders,
  Mail,
  Tag,
  Keyboard,
  Check,
  Plus,
  Trash2,
  Bell,
  Clock,
  Shield,
  Palette,
  Layout,
  RefreshCw,
} from 'lucide-react';
import { AccountData, fetchConnectedAccounts, updateAccountDetails } from '@/lib/api';
import { CustomLabel } from './LabelManagerModal';

export interface GmailAppSettings {
  undoSendSeconds: number;
  defaultReplyMode: 'reply' | 'replyAll';
  vacationResponderActive: boolean;
  vacationSubject: string;
  vacationMessage: string;
  notificationsEnabled: boolean;
  defaultPageSize: number;
  keyboardShortcutsEnabled: boolean;
  readingPaneLayout: 'list' | 'split' | 'bottom';
  enabledCategories: {
    primary: boolean;
    promotions: boolean;
    social: boolean;
    updates: boolean;
  };
}

interface GmailSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GmailAppSettings;
  onUpdateSettings: (newSettings: Partial<GmailAppSettings>) => void;
  accounts: AccountData[];
  onRefreshAccounts: () => void;
  customLabels: CustomLabel[];
  onCreateLabel: (name: string, color: string) => void;
  onDeleteLabel: (id: string) => void;
}

export function GmailSettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  accounts,
  onRefreshAccounts,
  customLabels,
  onCreateLabel,
  onDeleteLabel,
}: GmailSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'accounts' | 'inbox' | 'labels' | 'shortcuts'>('general');
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#3b82f6');
  const [signaturesMap, setSignaturesMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const savedSigs = localStorage.getItem('gmail_account_signatures');
    if (savedSigs) {
      try {
        setSignaturesMap(JSON.parse(savedSigs));
      } catch (e) {}
    }
  }, []);

  const handleSaveSignature = (accId: string, sig: string) => {
    const nextMap = { ...signaturesMap, [accId]: sig };
    setSignaturesMap(nextMap);
    localStorage.setItem('gmail_account_signatures', JSON.stringify(nextMap));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl h-[620px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header Bar */}
        <div className="px-6 py-4 bg-[#f6f8fc] dark:bg-[#28292c] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5 text-slate-900 dark:text-white font-bold text-sm">
            <SettingsIcon className="w-5 h-5 text-[#0b57d0] dark:text-purple-400" />
            <span>Gmail Client Settings</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Header */}
        <div className="px-6 bg-[#f6f8fc]/60 dark:bg-[#1a1b1e] border-b border-slate-200 dark:border-slate-800 flex items-center space-x-1 shrink-0 text-xs font-semibold overflow-x-auto">
          {[
            { id: 'general', label: 'General', icon: Sliders },
            { id: 'accounts', label: 'Accounts & Signatures', icon: Mail },
            { id: 'inbox', label: 'Inbox & Layout', icon: Layout },
            { id: 'labels', label: 'Labels', icon: Tag },
            { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-4 flex items-center space-x-2 border-b-[3px] transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-[#0b57d0] text-[#0b57d0] dark:border-purple-400 dark:text-purple-400 font-bold bg-white dark:bg-[#1e1e1e]'
                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body Canvas */}
        <div className="flex-1 overflow-y-auto p-6 text-xs space-y-6 min-h-0">
          {/* 1. GENERAL TAB */}
          {activeTab === 'general' && (
            <div className="space-y-6 max-w-xl">
              {/* Undo Send */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-[#0b57d0]" />
                  <span>Undo Send Cancellation Window</span>
                </label>
                <p className="text-slate-400 text-[11px]">Set the delay time before email is dispatched to allow instant Undo.</p>
                <select
                  value={settings.undoSendSeconds}
                  onChange={(e) => onUpdateSettings({ undoSendSeconds: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-medium"
                >
                  <option value={5}>5 seconds</option>
                  <option value={10}>10 seconds</option>
                  <option value={20}>20 seconds</option>
                  <option value={30}>30 seconds</option>
                </select>
              </div>

              {/* Default Reply Action */}
              <div className="space-y-1.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <label className="font-bold text-slate-900 dark:text-white">Default Reply Behavior</label>
                <div className="flex items-center space-x-4 pt-1">
                  <label className="flex items-center space-x-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="replyMode"
                      checked={settings.defaultReplyMode === 'reply'}
                      onChange={() => onUpdateSettings({ defaultReplyMode: 'reply' })}
                      className="text-[#0b57d0]"
                    />
                    <span>Reply</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="replyMode"
                      checked={settings.defaultReplyMode === 'replyAll'}
                      onChange={() => onUpdateSettings({ defaultReplyMode: 'replyAll' })}
                      className="text-[#0b57d0]"
                    />
                    <span>Reply All</span>
                  </label>
                </div>
              </div>

              {/* Out of Office / Vacation Responder */}
              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h4 className="font-bold text-slate-900 dark:text-white">Vacation Responder (Out of Office)</h4>
                    <p className="text-slate-400 text-[11px]">Send automatic replies when away on vacation.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.vacationResponderActive}
                    onChange={(e) => onUpdateSettings({ vacationResponderActive: e.target.checked })}
                    className="w-4 h-4 rounded text-[#0b57d0]"
                  />
                </div>

                {settings.vacationResponderActive && (
                  <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900 space-y-3">
                    <input
                      type="text"
                      value={settings.vacationSubject}
                      onChange={(e) => onUpdateSettings({ vacationSubject: e.target.value })}
                      placeholder="Out of Office Subject"
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#141517] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                    <textarea
                      rows={3}
                      value={settings.vacationMessage}
                      onChange={(e) => onUpdateSettings({ vacationMessage: e.target.value })}
                      placeholder="Automatic reply message..."
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#141517] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white resize-none"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. ACCOUNTS & SIGNATURES TAB */}
          {activeTab === 'accounts' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Connected Mailboxes ({accounts.length})</h4>
                  <p className="text-slate-400 text-[11px]">Manage signatures and connected Google OAuth accounts.</p>
                </div>
                <a
                  href="http://localhost:5001/api/auth/google/connect"
                  className="px-3.5 py-1.5 rounded-xl bg-[#0b57d0] text-white font-semibold text-xs shadow-xs hover:bg-[#0a4ab8]"
                >
                  + Add Account
                </a>
              </div>

              <div className="space-y-4">
                {accounts.map((acc) => (
                  <div key={acc.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 bg-slate-50 dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: acc.color }} />
                        <span className="font-bold text-slate-900 dark:text-white text-xs">{acc.label}</span>
                        <span className="text-[11px] font-mono text-slate-400">&lt;{acc.email}&gt;</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200">
                        Connected
                      </span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Account Signature</label>
                      <textarea
                        rows={2}
                        value={signaturesMap[acc.id] || `--\nSent from ${acc.label}`}
                        onChange={(e) => handleSaveSignature(acc.id, e.target.value)}
                        placeholder="Configure HTML/text signature for this account..."
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-[#141517] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-mono resize-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. INBOX & LAYOUT TAB */}
          {activeTab === 'inbox' && (
            <div className="space-y-6 max-w-xl">
              {/* Reading Pane Split Layout */}
              <div className="space-y-2">
                <label className="font-bold text-slate-900 dark:text-white">Reading Pane Split Position</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'list', label: 'No Split', desc: 'Full email table' },
                    { id: 'split', label: 'Right Split', desc: 'Vertical 2-pane' },
                    { id: 'bottom', label: 'Bottom Split', desc: 'Horizontal split' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => onUpdateSettings({ readingPaneLayout: mode.id as any })}
                      className={`p-3 rounded-2xl border text-left space-y-1 transition-all ${
                        settings.readingPaneLayout === mode.id
                          ? 'border-[#0b57d0] bg-blue-50/50 dark:bg-slate-800 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <h5 className="font-bold text-slate-900 dark:text-white text-xs">{mode.label}</h5>
                      <p className="text-[10px] text-slate-400">{mode.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Items Per Page */}
              <div className="space-y-1.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <label className="font-bold text-slate-900 dark:text-white">Default Page Size</label>
                <select
                  value={settings.defaultPageSize}
                  onChange={(e) => onUpdateSettings({ defaultPageSize: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                >
                  <option value={25}>25 emails per page</option>
                  <option value={50}>50 emails per page</option>
                  <option value={100}>100 emails per page</option>
                </select>
              </div>
            </div>
          )}

          {/* 4. LABELS TAB */}
          {activeTab === 'labels' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Custom Color Labels ({customLabels.length})</h4>
                  <p className="text-slate-400 text-[11px]">Create and manage label badges for organizing email threads.</p>
                </div>
              </div>

              {/* Create Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newLabelName.trim()) return;
                  onCreateLabel(newLabelName.trim(), newLabelColor);
                  setNewLabelName('');
                }}
                className="flex items-center space-x-2"
              >
                <input
                  type="text"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  placeholder="New label name (e.g. Travel, Projects)"
                  className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs"
                />
                <input
                  type="color"
                  value={newLabelColor}
                  onChange={(e) => setNewLabelColor(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer border-0"
                />
                <button type="submit" className="px-4 py-2 rounded-xl bg-[#0b57d0] text-white font-semibold text-xs shadow-xs">
                  Create
                </button>
              </form>

              {/* Labels List */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {customLabels.map((lbl) => (
                  <div key={lbl.id} className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <div className="flex items-center space-x-2.5">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: lbl.color }} />
                      <span className="font-bold text-slate-900 dark:text-white">{lbl.name}</span>
                    </div>
                    <button
                      onClick={() => onDeleteLabel(lbl.id)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. KEYBOARD SHORTCUTS TAB */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-4 max-w-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Gmail Keyboard Shortcuts</h4>
                  <p className="text-slate-400 text-[11px]">Control email actions using single-key shortcuts.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.keyboardShortcutsEnabled}
                  onChange={(e) => onUpdateSettings({ keyboardShortcutsEnabled: e.target.checked })}
                  className="w-4 h-4 rounded text-[#0b57d0]"
                />
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-900">
                {[
                  { key: 'c', action: 'Compose new email' },
                  { key: '/', action: 'Focus Search bar' },
                  { key: 'e', action: 'Delete / Archive email' },
                  { key: 'r', action: 'Reply to email' },
                  { key: 'f', action: 'Forward email' },
                  { key: 'j / k', action: 'Move selection down / up' },
                ].map((s) => (
                  <div key={s.key} className="px-4 py-2.5 flex items-center justify-between text-xs">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{s.action}</span>
                    <kbd className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-white">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#f6f8fc] dark:bg-[#28292c] border-t border-slate-200 dark:border-slate-800 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#0b57d0] text-white font-bold text-xs shadow-md"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
