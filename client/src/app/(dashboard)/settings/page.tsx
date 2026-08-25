'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Check,
  ShieldCheck,
  Mail,
  Calendar,
  Zap,
  ExternalLink,
  Sparkles,
  Lock,
} from 'lucide-react';
import {
  fetchConnectedAccounts,
  updateAccountDetails,
  disconnectAccountApi,
  AccountData,
} from '@/lib/api';

const COLOR_OPTIONS = [
  '#3b82f6', // Electric Blue
  '#a855f7', // Vivid Purple
  '#ec4899', // Pink
  '#10b981', // Emerald Green
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#ef4444', // Red
  '#6366f1', // Indigo
];

function SettingsContent() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('');
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isConnected = searchParams.get('connected');
  const accountConnected = searchParams.get('accountConnected');
  const connectedEmail = searchParams.get('email');
  const errorParam = searchParams.get('error');

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await fetchConnectedAccounts();
      setAccounts(data);
    } catch (err: any) {
      console.warn('Backend accounts fetch failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();

    if (isConnected === 'true' || accountConnected === 'true') {
      setBannerMessage({
        type: 'success',
        text: `Google Account successfully connected! Messages and calendar events are syncing in the background.`,
      });
    } else if (errorParam) {
      setBannerMessage({
        type: 'error',
        text: `OAuth connection error: ${decodeURIComponent(errorParam)}`,
      });
    }
  }, [isConnected, accountConnected, connectedEmail, errorParam]);

  const handleConnectGoogle = () => {
    window.location.href = '/api/auth/google/connect';
  };

  const handleManualSync = async (accountId?: string) => {
    setSyncingAccountId(accountId || 'all');
    try {
      await fetch('/api/sync/trigger', { method: 'POST' });
      setBannerMessage({
        type: 'success',
        text: 'Live background sync triggered across connected accounts.',
      });
      await loadAccounts();
    } catch (err) {
      setBannerMessage({ type: 'error', text: 'Failed to trigger live synchronization.' });
    } finally {
      setTimeout(() => setSyncingAccountId(null), 1200);
    }
  };

  const handleConfirmDisconnect = async () => {
    if (!disconnectingId) return;
    try {
      await disconnectAccountApi(disconnectingId);
      setAccounts((prev) => prev.filter((a) => a.id !== disconnectingId));
      setBannerMessage({ type: 'success', text: 'Google Account disconnected successfully.' });
    } catch (err: any) {
      alert(`Error disconnecting account: ${err.message}`);
    } finally {
      setDisconnectingId(null);
    }
  };

  const handleStartEditing = (acc: AccountData) => {
    setEditingId(acc.id);
    setEditLabel(acc.label || acc.email.split('@')[0]);
    setEditColor(acc.color || '#3b82f6');
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const updated = await updateAccountDetails(id, { label: editLabel, color: editColor });
      setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)));
      setEditingId(null);
    } catch (err: any) {
      alert(`Error updating account: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 font-sans">
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

      {/* Main Glassmorphic Hero Banner */}
      <div className="relative overflow-hidden p-8 rounded-3xl clean-card dark:dark-glass dark:dark-glow flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-200 dark:border-slate-800/80">
        <div className="space-y-2 max-w-xl z-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-[11px] font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Multi-Account Integration Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Connected Accounts
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Link and manage multiple Google accounts to unify your Gmail messages, Google Calendar events, and daily action items into Streamline.
          </p>
        </div>

        <div className="flex items-center space-x-3 z-10 shrink-0">
          <button
            onClick={() => handleManualSync()}
            disabled={Boolean(syncingAccountId)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all disabled:opacity-50"
            title="Trigger manual background sync across all accounts"
          >
            <RefreshCw className={`w-4 h-4 ${syncingAccountId ? 'animate-spin text-purple-500' : ''}`} />
            <span>{syncingAccountId ? 'Syncing...' : 'Sync All'}</span>
          </button>

          <button
            onClick={handleConnectGoogle}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.02] active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Connect Google Account</span>
          </button>
        </div>

        {/* Ambient background glow */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-purple-600/10 dark:bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Active Accounts Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center space-x-2">
            <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Connected Accounts ({accounts.length})
            </h2>
          </div>

          <button
            onClick={loadAccounts}
            className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-semibold flex items-center space-x-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh List</span>
          </button>
        </div>

        {accounts.length === 0 ? (
          <div className="p-12 rounded-3xl clean-card dark:dark-glass text-center space-y-4 border border-dashed border-slate-300 dark:border-slate-800">
            <div className="h-14 w-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto text-purple-500">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">No Accounts Linked Yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Connect your primary Gmail or Work Google account to populate your unified inbox and calendar.
              </p>
            </div>
            <button
              onClick={handleConnectGoogle}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-lg shadow-purple-600/25 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Connect First Account</span>
            </button>
          </div>
        ) : (
          accounts.map((acc) => {
            const isEditing = editingId === acc.id;
            const isSyncingThis = syncingAccountId === acc.id;

            return (
              <div
                key={acc.id}
                className="p-6 rounded-3xl clean-card dark:dark-glass clean-card-hover flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-200 dark:border-slate-800/80 transition-all duration-200"
              >
                {/* Left Info Column */}
                <div className="flex items-start space-x-4 flex-1 min-w-0">
                  {/* Account Avatar Badge */}
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-extrabold text-base shadow-md shrink-0 mt-0.5"
                    style={{ backgroundColor: acc.color || '#3b82f6' }}
                  >
                    {acc.label ? acc.label.charAt(0).toUpperCase() : acc.email.charAt(0).toUpperCase()}
                  </div>

                  <div className="space-y-2 flex-1 min-w-0">
                    {/* Inline Editing Mode */}
                    {isEditing ? (
                      <div className="space-y-3 p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            placeholder="Account tag name (e.g. Work, Personal)..."
                            className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 flex-1"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEdit(acc.id)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center space-x-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>
                        </div>

                        {/* Color Picker Swatches */}
                        <div className="flex items-center space-x-2 pt-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Badge Color:</span>
                          <div className="flex items-center space-x-1.5">
                            {COLOR_OPTIONS.map((c) => (
                              <button
                                key={c}
                                onClick={() => setEditColor(c)}
                                className={`w-5 h-5 rounded-full transition-transform ${
                                  editColor === c ? 'ring-2 ring-purple-500 scale-125' : 'hover:scale-110'
                                }`}
                                style={{ backgroundColor: c }}
                                title={c}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Display Header Mode */
                      <div className="flex items-center space-x-3 flex-wrap gap-y-1">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                          {acc.label || acc.email.split('@')[0]}
                        </h3>

                        <span
                          className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold tracking-tight shadow-2xs"
                          style={{
                            backgroundColor: `${acc.color || '#3b82f6'}20`,
                            color: acc.color || '#3b82f6',
                            border: `1px solid ${acc.color || '#3b82f6'}40`,
                          }}
                        >
                          {acc.email}
                        </span>

                        <button
                          onClick={() => handleStartEditing(acc)}
                          className="p-1.5 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Edit Account Tag & Color"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Integrated Services Badges */}
                    <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap gap-y-1.5">
                      <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 capitalize">
                          {acc.status || 'Active'}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 text-[11px]">
                        <span className="flex items-center space-x-1 text-slate-600 dark:text-slate-300 font-medium">
                          <Mail className="w-3.5 h-3.5 text-blue-500" />
                          <span>Gmail Sync</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center space-x-1 text-slate-600 dark:text-slate-300 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-purple-500" />
                          <span>Google Calendar Sync</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Actions Column */}
                <div className="flex items-center space-x-2 shrink-0 self-end md:self-auto border-t md:border-t-0 pt-3 md:pt-0 border-slate-200 dark:border-slate-800/80 w-full md:w-auto justify-end">
                  <button
                    onClick={() => handleManualSync(acc.id)}
                    disabled={isSyncingThis}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all flex items-center space-x-1.5 disabled:opacity-50"
                    title="Sync this account now"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingThis ? 'animate-spin text-purple-500' : ''}`} />
                    <span>{isSyncingThis ? 'Syncing' : 'Sync'}</span>
                  </button>

                  <button
                    onClick={() => setDisconnectingId(acc.id)}
                    className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-semibold text-rose-600 dark:text-rose-400 transition-colors flex items-center space-x-1.5"
                    title="Disconnect this Google account"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Security & Privacy Guarantee Footer Card */}
      <div className="p-6 rounded-3xl clean-card dark:dark-glass border border-slate-200 dark:border-slate-800/80 space-y-3">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-900 dark:text-white">
          <Lock className="w-4 h-4 text-purple-500" />
          <span>Security & Data Encryption Standard</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Streamline uses industry-standard OAuth 2.0 authentication. Access tokens and refresh tokens are encrypted at rest using AES-256-GCM. We never store or sell your emails or private calendar details.
        </p>
      </div>

      {/* Disconnect Confirmation Modal */}
      {disconnectingId && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Confirm Disconnect Account</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Are you sure you want to disconnect this account? Synced emails, calendar events, and tokens for this Google account will be purged from Streamline.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setDisconnectingId(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDisconnect}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/25"
              >
                Disconnect Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}

