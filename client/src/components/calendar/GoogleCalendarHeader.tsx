'use client';

import React, { useState } from 'react';
import {
  Menu,
  ChevronLeft,
  ChevronRight,
  Search,
  RotateCw,
  Settings,
  HelpCircle,
  ChevronDown,
  Calendar as CalendarIcon,
  AlertTriangle,
  Grid,
  Check,
  X,
  Keyboard,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { ThemeToggle } from '../layout/ThemeToggle';
import { useAuth } from '@/providers/AuthContext';

export type CalendarViewMode = 'day' | 'week' | 'month' | 'year' | 'agenda';

interface GoogleCalendarHeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  selectedDate: Date;
  onSelectToday: () => void;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  conflictCount: number;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const GoogleCalendarHeader: React.FC<GoogleCalendarHeaderProps> = ({
  sidebarOpen,
  onToggleSidebar,
  selectedDate,
  onSelectToday,
  onNavigatePrev,
  onNavigateNext,
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchChange,
  conflictCount,
  onRefresh,
  isRefreshing,
}) => {
  const { user, logout } = useAuth();
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const getHeaderTitle = () => {
    if (viewMode === 'month' || viewMode === 'year') {
      return selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    if (viewMode === 'day') {
      return selectedDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    if (viewMode === 'week') {
      const start = new Date(selectedDate);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const viewModeLabels: Record<CalendarViewMode, string> = {
    day: 'Day',
    week: 'Week',
    month: 'Month',
    year: 'Year',
    agenda: 'Schedule',
  };

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : user?.email ? user.email.charAt(0).toUpperCase() : 'P';

  return (
    <header className="h-16 px-4 bg-white dark:bg-slate-950 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 shrink-0 select-none font-sans">
      {/* Left section: Hamburger, Google Logo, Today button, Prev/Next, Date Label */}
      <div className="flex items-center space-x-3 shrink-0">
        <button
          onClick={onToggleSidebar}
          title={sidebarOpen ? 'Collapse main menu' : 'Expand main menu'}
          className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Authentic Google Calendar Logo & Title */}
        <div className="flex items-center space-x-2 mr-3 cursor-pointer" onClick={onSelectToday}>
          <div className="w-10 h-10 rounded-xl bg-[#1a73e8] flex items-center justify-center text-white shadow-sm">
            <span className="font-sans text-lg font-bold tracking-tight">{selectedDate.getDate()}</span>
          </div>
          <span className="text-xl font-normal text-[#3c4043] dark:text-slate-100 hidden sm:inline font-sans tracking-tight">
            Calendar
          </span>
        </div>

        {/* Today Pill Button */}
        <button
          onClick={onSelectToday}
          className="px-5 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-[#3c4043] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors"
        >
          Today
        </button>

        {/* Prev / Next arrows */}
        <div className="flex items-center space-x-0.5">
          <button
            onClick={onNavigatePrev}
            title="Previous"
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={onNavigateNext}
            title="Next"
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Date Title Header */}
        <h1 className="text-xl font-normal text-[#3c4043] dark:text-white tracking-tight ml-2 truncate">
          {getHeaderTitle()}
        </h1>
      </div>

      {/* Right section: Search, Help, Settings, View Selector Dropdown, Profile */}
      <div className="flex items-center space-x-2 relative">
        {/* Search Input Toggle */}
        <div className="relative">
          {showSearchInput ? (
            <div className="relative w-64 animate-in fade-in duration-150">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search"
                className="w-full bg-[#f1f3f4] dark:bg-slate-900 border-0 rounded-full pl-9 pr-8 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
              />
              <button
                onClick={() => setShowSearchInput(false)}
                className="absolute right-2 top-2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSearchInput(true)}
              title="Search"
              className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Help / Keyboard Shortcuts button */}
        <button
          onClick={() => setShowHelpModal(true)}
          title="Keyboard Shortcuts & Support"
          className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors hidden md:block"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        {/* Sync & Settings button */}
        <button
          onClick={onRefresh}
          title="Sync & Refresh"
          className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
        >
          <RotateCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
        </button>

        {/* Google View Selector Dropdown Pill (Month ▾) */}
        <div className="relative">
          <button
            onClick={() => setShowViewDropdown(!showViewDropdown)}
            className="flex items-center space-x-2 px-4 py-1.5 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-[#3c4043] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <span>{viewModeLabels[viewMode]}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          </button>

          {showViewDropdown && (
            <div className="absolute right-0 top-10 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 py-2 space-y-1 animate-in fade-in duration-150">
              {(['day', 'week', 'month', 'year', 'agenda'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    onViewModeChange(mode);
                    setShowViewDropdown(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-2 text-xs font-medium capitalize transition-colors ${
                    viewMode === mode
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 font-bold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{viewModeLabels[mode]}</span>
                  {viewMode === mode && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User Profile Avatar */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="w-8 h-8 rounded-full bg-[#e8710a] text-white font-bold flex items-center justify-center text-xs shadow-sm cursor-pointer ml-1 hover:ring-2 hover:ring-orange-400 transition-all"
          >
            {userInitial}
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 top-10 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xl z-50 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center space-x-3 pb-2 border-b border-slate-200 dark:border-slate-800">
                <div className="w-9 h-9 rounded-full bg-[#e8710a] text-white font-bold flex items-center justify-center text-sm shrink-0">
                  {userInitial}
                </div>
                <div className="truncate">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {user?.name || 'User Account'}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {user?.email || 'user@company.com'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => logout()}
                className="w-full flex items-center space-x-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 px-3 py-2 rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts & Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Keyboard className="w-5 h-5 text-blue-600" />
                <span>Keyboard Shortcuts</span>
              </h3>
              <button onClick={() => setShowHelpModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span>Jump to Today</span>
                <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono font-bold">T</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span>Month View</span>
                <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono font-bold">M</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span>Week View</span>
                <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono font-bold">W</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span>Day View</span>
                <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono font-bold">D</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span>Year View</span>
                <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono font-bold">Y</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span>Schedule / Agenda View</span>
                <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono font-bold">A</kbd>
              </div>
              <div className="flex justify-between py-1">
                <span>Create New Event</span>
                <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono font-bold">C</kbd>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
