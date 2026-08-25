'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, CheckCircle2, AlertCircle, Trash2, Edit2, Check } from 'lucide-react';
import { fetchConnectedAccounts, updateAccountDetails, disconnectAccountApi, AccountData } from '@/lib/api';

const COLOR_OPTIONS = ['#ec4899', '#3b82f6', '#10b981', '#a855f7', '#f59e0b', '#06b6d4'];

function SettingsContent() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('');
  const [bannerMessage, setBannerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchConnectedAccounts().then(setAccounts).finally(() => setLoading(false));
  }, []);

  const handleDisconnect = async (id: string) => {
    if (!confirm('Are you sure you want to disconnect this account?')) return;
    await disconnectAccountApi(id);
    setAccounts(prev => prev.filter(a => a.id !== id));
    setBannerMessage({ type: 'success', text: 'Account disconnected successfully.' });
  };

  const handleSaveEdit = async (id: string) => {
    const updated = await updateAccountDetails(id, { label: editLabel, color: editColor });
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...updated } : a));
    setEditingId(null);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      {bannerMessage && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm ${
          bannerMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {bannerMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{bannerMessage.text}</span>
        </div>
      )}

      <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Connected Accounts</h2>
            <p className="text-xs text-gray-500">Manage Google accounts synced with Streamline</p>
          </div>
          <a
            href="/api/auth/google/connect"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Google Account
          </a>
        </div>

        <div className="space-y-4">
          {accounts.map(acc => (
            <div key={acc.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900/50">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: acc.color }} />
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{acc.label}</h4>
                  <p className="text-xs text-gray-500">{acc.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleDisconnect(acc.id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
