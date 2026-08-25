'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Check,
  Shield,
} from 'lucide-react';
import {
  fetchConnectedAccounts,
  updateAccountDetails,
  disconnectAccountApi,
  AccountData,
} from '@/lib/api';

const COLOR_OPTIONS = ['#ec4899', '#3b82f6', '#10b981', '#a855f7', '#f59e0b', '#06b6d4'];

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('');
  const [bannerMessage, setBannerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isConnected = searchParams.get('connected');
  const connectedEmail = searchParams.get('email');
  const errorParam = searchParams.get('error');

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await fetchConnectedAccounts();
      setAccounts(data);
    } catch (err: any) {
      console.warn('Backend API query pending');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();

    if (isConnected === 'success') {
      setBannerMessage({
        type: 'success',
        text: `Successfully connected Google Account (${connectedEmail || 'Account'})! Sync engine is active.`,
      });
    } else if (errorParam) {
      setBannerMessage({
        type: 'error',
        text: `OAuth authorization failed: ${decodeURIComponent(errorParam)}`,
      });
    }
  }, [isConnected, connectedEmail, errorParam]);

  const handleDisconnect = async (id: string) => {
    if (!confirm('Are you sure you want to disconnect this account? Synced data will be purged.')) return;
    try {
      await disconnectAccountApi(id);
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      setBannerMessage({ type: 'success', text: 'Account disconnected successfully.' });
    } catch (err: any) {
      alert(`Error disconnecting account: ${err.message}`);
    }
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
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Banner Notification */}
      {bannerMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm animate-in fade-in duration-200 ${
            bannerMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-500/40 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center space-x-3">
            {bannerMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span className="text-xs font-medium">{bannerMessage.text}</span>
          </div>
          <button
            onClick={() => setBannerMessage(null)}
            className="text-xs opacity-70 hover:opacity-100 font-mono"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Clean Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl clean-card">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Connected Accounts
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Connect and manage your Google accounts for unified inbox and calendar synchronization.
          </p>
        </div>

        <a
          href="http://localhost:5001/api/auth/google/connect"
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-md shadow-purple-600/20 transition-all hover:scale-[1.01] active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Connect Google Account</span>
        </a>
      </div>

      {/* Accounts List Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Active Accounts ({accounts.length})
          </h2>
          <button
            onClick={loadAccounts}
            className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium flex items-center space-x-1"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {accounts.length === 0 ? (
          <div className="p-12 rounded-3xl clean-card text-center space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800/40 flex items-center justify-center mx-auto text-purple-600 dark:text-purple-400">
              <Shield className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">No Accounts Connected</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Authorize your Gmail & Google Calendar accounts to enable multi-account unified sync.
              </p>
            </div>
            <a
              href="http://localhost:5001/api/auth/google/connect"
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-md shadow-purple-600/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Connect First Account</span>
            </a>
          </div>
        ) : (
          accounts.map((acc) => (
            <div
              key={acc.id}
              className="p-5 rounded-2xl clean-card clean-card-hover flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start space-x-4 flex-1">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0 mt-0.5"
                  style={{ backgroundColor: acc.color }}
                >
                  {acc.label ? acc.label.charAt(0) : 'G'}
                </div>

                <div className="space-y-1.5 flex-1">
                  {editingId === acc.id ? (
                    <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                      <input
                        type="text"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                      />
                      <div className="flex items-center space-x-1.5">
                        {COLOR_OPTIONS.map((c) => (
                          <button
                            key={c}
                            onClick={() => setEditColor(c)}
                            className={`w-5 h-5 rounded-full border ${
                              editColor === c ? 'border-purple-600 scale-110' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => handleSaveEdit(acc.id)}
                        className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2.5">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">{acc.label}</h3>
                      <span
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{
                          backgroundColor: `${acc.color}15`,
                          color: acc.color,
                          border: `1px solid ${acc.color}30`,
                        }}
                      >
                        {acc.email}
                      </span>
                      <button
                        onClick={() => {
                          setEditingId(acc.id);
                          setEditLabel(acc.label);
                          setEditColor(acc.color);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        title="Edit Tag & Label"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap gap-y-1">
                    <span className="inline-flex items-center space-x-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="capitalize font-medium text-slate-700 dark:text-slate-300">{acc.status}</span>
                    </span>
                    <span>•</span>
                    <span className="font-mono text-[10px] text-slate-400">
                      Gmail & Calendar Connected
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2 self-end md:self-auto border-t md:border-t-0 pt-3 md:pt-0 border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => handleDisconnect(acc.id)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center space-x-1.5 font-medium"
                  title="Disconnect Account"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
