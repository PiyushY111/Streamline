'use client';

import { Search, X, SlidersHorizontal, List, Columns, Sparkles, RefreshCw, Settings as SettingsIcon } from 'lucide-react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

interface InboxHeaderProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onOpenSearchModal: () => void;
  viewMode: 'list' | 'split' | 'bottom';
  onSelectListView: () => void;
  onSelectSplitView: () => void;
  openCopilot: () => void;
  pendingCount: number;
  loading: boolean;
  onSync: () => void;
  onOpenSettings: () => void;
}

export function InboxHeader({
  searchQuery,
  onSearchQueryChange,
  onOpenSearchModal,
  viewMode,
  onSelectListView,
  onSelectSplitView,
  openCopilot,
  pendingCount,
  loading,
  onSync,
  onOpenSettings,
}: InboxHeaderProps) {
  return (
    <header className="h-16 px-4 bg-[#f6f8fc] dark:bg-[#1f1f1f] border-b border-slate-200/60 dark:border-slate-800 flex items-center justify-between shrink-0 gap-4">
      {/* Left: Gmail Header Search Bar */}
      <div className="flex-1 max-w-3xl flex items-center space-x-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search in mail (press '/' to focus)"
            className="w-full pl-12 pr-10 py-2.5 rounded-full bg-[#eaf1fb] dark:bg-[#2e2f33] text-slate-900 dark:text-white placeholder-slate-500 text-sm focus:outline-none focus:bg-white focus:dark:bg-[#28292c] focus:ring-2 focus:ring-[#0b57d0] transition-all shadow-xs"
          />
          {searchQuery ? (
            <button
              onClick={() => onSearchQueryChange('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onOpenSearchModal}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-[#0b57d0]"
              title="Advanced search filters"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Right: View Mode Toggle, Sync Button, Theme Toggle, User Avatar */}
      <div className="flex items-center space-x-3">
        {/* Layout Split Mode Switcher (List vs Split) */}
        <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={onSelectListView}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all ${
              viewMode === 'list'
                ? 'bg-white dark:bg-slate-700 text-[#0b57d0] dark:text-purple-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
            title="Full List View"
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline text-[11px]">List</span>
          </button>
          <button
            onClick={onSelectSplitView}
            className={`p-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all ${
              viewMode === 'split'
                ? 'bg-white dark:bg-slate-700 text-[#0b57d0] dark:text-purple-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
            title="Split View"
          >
            <Columns className="w-4 h-4" />
            <span className="hidden sm:inline text-[11px]">Split</span>
          </button>
        </div>

        {/* AI Copilot Trigger Button */}
        <button
          onClick={openCopilot}
          className="relative flex items-center space-x-1.5 px-3 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-800/80 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50 hover:from-indigo-100 hover:to-purple-100 dark:hover:from-indigo-900/60 dark:hover:to-purple-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold transition-all shadow-2xs group"
          title="Open Streamline AI Copilot (⌘K)"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 group-hover:rotate-12 transition-transform" />
          <span className="hidden sm:inline font-bold">Copilot</span>
          <kbd className="hidden md:inline-block px-1.5 py-0.2 text-[9px] font-mono bg-white/70 dark:bg-slate-800/70 border border-indigo-200/80 dark:border-indigo-700/60 rounded text-indigo-600 dark:text-indigo-300">
            ⌘K
          </kbd>
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse shadow-sm">
              {pendingCount}
            </span>
          )}
        </button>

        {/* Sync Button */}
        <button
          onClick={onSync}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 text-xs font-semibold transition-all shadow-2xs"
          title="Sync Gmail Accounts"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#0b57d0]' : ''}`} />
          <span className="hidden md:inline">Sync Now</span>
        </button>

        {/* Theme Switcher Button */}
        <ThemeToggle />

        {/* Gmail Settings Gear Button */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          title="Gmail Settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>

        {/* User Profile Avatar */}
        <div
          className="w-8 h-8 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-xs shadow-xs"
          title="Connected Account: Piyush"
        >
          P
        </div>
      </div>
    </header>
  );
}
