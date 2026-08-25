'use client';

import React, { useEffect, useState } from 'react';
import {
  RefreshCw,
  ChevronDown,
  CheckCircle2,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';
import { fetchConnectedAccounts, AccountData } from '@/lib/api';
import { useAuth } from '@/providers/AuthContext';

export function Header() {
  const { user, logout } = useAuth();
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    fetchConnectedAccounts()
      .then((data) => setAccounts(data))
      .catch(() => console.warn('No backend connected accounts yet'));
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await fetch('/api/sync/trigger', { method: 'POST' });
    } catch (e) {
      console.warn('Sync trigger failed');
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
      }, 1200);
    }
  };

  const selectedAcc = accounts.find((a) => a.id === selectedAccountId);
  const selectedAccount =
    selectedAccountId === 'all' || !selectedAcc
      ? { label: 'All Accounts', email: 'Unified View', color: '#8b5cf6' }
      : { label: selectedAcc.label, email: selectedAcc.email, color: selectedAcc.color };

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : user?.email ? user.email.charAt(0).toUpperCase() : 'U';

  return (
    <header className="h-16 shrink-0 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/60 backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-20 transition-colors duration-200">
      {/* Account Selector Filter */}
      <div className="relative">
        <button
          onClick={() => setIsAccountOpen(!isAccountOpen)}
          className="flex items-center space-x-2.5 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-sm font-medium transition-all group shadow-xs"
        >
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
            style={{ backgroundColor: selectedAccount.color }}
          />
          <div className="flex flex-col text-left">
            <span className="text-xs text-slate-800 dark:text-slate-200 font-semibold leading-tight">
              {selectedAccount.label}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              {selectedAccount.email}
            </span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform" />
        </button>

        {isAccountOpen && (
          <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Filter Workspace Scope
            </div>

            <button
              onClick={() => {
                setSelectedAccountId('all');
                setIsAccountOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${
                selectedAccountId === 'all'
                  ? 'bg-purple-50 text-purple-900 dark:bg-purple-600/20 dark:text-purple-200 font-semibold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">All Accounts</span>
                  <span className="text-[10px] text-slate-400">Unified View</span>
                </div>
              </div>
              {selectedAccountId === 'all' && (
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              )}
            </button>

            {accounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => {
                  setSelectedAccountId(acc.id);
                  setIsAccountOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${
                  selectedAccountId === acc.id
                    ? 'bg-purple-50 text-purple-900 dark:bg-purple-600/20 dark:text-purple-200 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: acc.color }}
                  />
                  <div className="flex flex-col text-left">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{acc.label}</span>
                    <span className="text-[10px] text-slate-400">{acc.email}</span>
                  </div>
                </div>
                {selectedAccountId === acc.id && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actions & User Menu */}
      <div className="flex items-center space-x-3">
        {/* Manual Sync Trigger */}
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-600/10 hover:bg-purple-100 dark:hover:bg-purple-600/20 border border-purple-200 dark:border-purple-500/20 text-xs text-purple-700 dark:text-purple-300 transition-all active:scale-95 disabled:opacity-50 font-medium shadow-xs"
          title="Trigger Incremental Sync"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-purple-600 dark:text-purple-400' : ''}`} />
          <span className="hidden sm:inline">
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </span>
        </button>

        <ThemeToggle />

        {/* User Profile Menu */}
        <div className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center space-x-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-xs"
          >
            <div className="h-7 w-7 rounded-lg bg-purple-600 flex items-center justify-center text-white font-semibold text-xs shadow-sm">
              {userInitial}
            </div>
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 space-y-1">
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {user?.name || 'Account User'}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                  {user?.email || 'user@example.com'}
                </p>
              </div>

              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
