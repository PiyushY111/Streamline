'use client';

import React, { useState } from 'react';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Layers,
  Sparkles,
} from 'lucide-react';
import { AccountData } from '@/lib/api';

interface GoogleCalendarSidebarProps {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  accounts: AccountData[];
  visibleAccounts: string[];
  onToggleAccount: (id: string) => void;
  onOpenCreateModal: (type?: 'event' | 'task' | 'reminder') => void;
  guestFilter: string;
  onGuestFilterChange: (g: string) => void;
  onTriggerSync?: () => void;
  isSyncing?: boolean;
}

export const GoogleCalendarSidebar: React.FC<GoogleCalendarSidebarProps> = ({
  selectedDate,
  onSelectDate,
  accounts,
  visibleAccounts,
  onToggleAccount,
  onOpenCreateModal,
  guestFilter,
  onGuestFilterChange,
  onTriggerSync,
  isSyncing,
}) => {
  const [miniMonthDate, setMiniMonthDate] = useState<Date>(new Date(selectedDate));
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [myCalsExpanded, setMyCalsExpanded] = useState(true);
  const [otherCalsExpanded, setOtherCalsExpanded] = useState(true);

  // Calculate mini month days matrix
  const year = miniMonthDate.getFullYear();
  const month = miniMonthDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const totalDaysInPrevMonth = new Date(year, month, 0).getDate();

  const prevMonthDays = Array.from({ length: firstDayIndex }, (_, i) => totalDaysInPrevMonth - firstDayIndex + i + 1);
  const currentMonthDays = Array.from({ length: totalDaysInMonth }, (_, i) => i + 1);
  const totalCellsSoFar = prevMonthDays.length + currentMonthDays.length;
  const nextMonthDaysCount = totalCellsSoFar % 7 === 0 ? 0 : 7 - (totalCellsSoFar % 7);
  const nextMonthDays = Array.from({ length: nextMonthDaysCount }, (_, i) => i + 1);

  const handleMiniPrevMonth = () => {
    setMiniMonthDate(new Date(year, month - 1, 1));
  };

  const handleMiniNextMonth = () => {
    setMiniMonthDate(new Date(year, month + 1, 1));
  };

  const today = new Date();
  const isCurrentMonthActual = today.getFullYear() === year && today.getMonth() === month;

  return (
    <aside className="w-64 bg-[#f8f9fa] dark:bg-slate-950 border-r border-slate-200/80 dark:border-slate-800 p-3 flex flex-col justify-between shrink-0 overflow-y-auto space-y-5 select-none font-sans">
      <div className="space-y-5">
        {/* Google "+ Create ▾" Floating Action Pill */}
        <div className="relative">
          <button
            onClick={() => setShowCreateDropdown(!showCreateDropdown)}
            className="group flex items-center space-x-3 px-5 py-3 rounded-full bg-white dark:bg-slate-900 text-[#3c4043] dark:text-slate-100 font-medium text-sm border border-slate-200/80 dark:border-slate-800 shadow-md hover:shadow-lg transition-all"
          >
            {/* Multi-colored Google Plus SVG icon */}
            <svg className="w-5 h-5" viewBox="0 0 36 36">
              <path fill="#4285F4" d="M16 16v14h4V20z" />
              <path fill="#34A853" d="M30 16H20l-4 4h14z" />
              <path fill="#FBBC05" d="M6 16h10l4-4H6z" />
              <path fill="#EA4335" d="M20 16V6h-4v10z" />
            </svg>
            <span className="font-semibold text-slate-800 dark:text-white">Create</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-1" />
          </button>

          {/* Create Dropdown */}
          {showCreateDropdown && (
            <div className="absolute left-0 top-14 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-30 py-2 space-y-1 animate-in fade-in duration-150">
              <button
                onClick={() => {
                  setShowCreateDropdown(false);
                  onOpenCreateModal('event');
                }}
                className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-2.5"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#1a73e8]" />
                <span>Event</span>
              </button>
              <button
                onClick={() => {
                  setShowCreateDropdown(false);
                  onOpenCreateModal('task');
                }}
                className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-2.5"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Task</span>
              </button>
            </div>
          )}
        </div>

        {/* Mini Month Picker Calendar */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {miniMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <div className="flex items-center space-x-0.5">
              <button
                onClick={handleMiniPrevMonth}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleMiniNextMonth}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-slate-500">
            <span>S</span>
            <span>M</span>
            <span>T</span>
            <span>W</span>
            <span>T</span>
            <span>F</span>
            <span>S</span>
          </div>

          <div className="grid grid-cols-7 text-center text-xs font-medium gap-y-0.5">
            {prevMonthDays.map((d, i) => (
              <div key={`prev-${i}`} className="h-6 w-6 flex items-center justify-center text-[11px] text-slate-400">
                {d}
              </div>
            ))}
            {currentMonthDays.map((d) => {
              const dateObj = new Date(year, month, d);
              const isSelected =
                selectedDate.getFullYear() === year &&
                selectedDate.getMonth() === month &&
                selectedDate.getDate() === d;
              const isTodayCell = isCurrentMonthActual && today.getDate() === d;

              return (
                <button
                  key={`curr-${d}`}
                  onClick={() => onSelectDate(dateObj)}
                  className={`h-6 w-6 mx-auto rounded-full flex items-center justify-center transition-all text-[11px] font-medium ${
                    isSelected
                      ? 'bg-[#1a73e8] text-white font-bold shadow-xs'
                      : isTodayCell
                        ? 'bg-blue-100 text-blue-700 font-bold dark:bg-blue-900/40 dark:text-blue-300'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {d}
                </button>
              );
            })}
            {nextMonthDays.map((d, i) => (
              <div key={`next-${i}`} className="h-6 w-6 flex items-center justify-center text-[11px] text-slate-400">
                {d}
              </div>
            ))}
          </div>
        </div>

        {/* Search for People Input Box */}
        <div className="relative">
          <UserPlus className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={guestFilter}
            onChange={(e) => onGuestFilterChange(e.target.value)}
            placeholder="Search for people"
            className="w-full bg-[#f1f3f4] dark:bg-slate-900 border-0 rounded-full pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-500"
          />
        </div>

        {/* Booking Pages */}
        <div
          onClick={() => onOpenCreateModal('event')}
          className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer transition-colors"
          title="Create booking appointment page"
        >
          <span>Booking pages</span>
          <Plus className="w-4 h-4 text-slate-500" />
        </div>

        {/* My Calendars Accordion Section */}
        <div className="space-y-1 pt-1">
          <div
            onClick={() => setMyCalsExpanded(!myCalsExpanded)}
            className="flex items-center justify-between py-1 text-xs font-semibold text-[#3c4043] dark:text-slate-200 cursor-pointer group"
          >
            <span>My calendars</span>
            {myCalsExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </div>

          {myCalsExpanded && (
            <div className="space-y-1 pl-1">
              {accounts.map((acc) => {
                const isChecked = visibleAccounts.includes(acc.id);
                return (
                  <button
                    key={acc.id}
                    onClick={() => onToggleAccount(acc.id)}
                    className="w-full flex items-center space-x-2.5 px-2 py-1 rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-800/60 text-xs transition-colors text-left"
                  >
                    <span
                      className="w-4 h-4 rounded-sm flex items-center justify-center text-white shrink-0 border border-slate-300 dark:border-slate-700"
                      style={{
                        backgroundColor: isChecked ? acc.color || '#1a73e8' : 'transparent',
                        borderColor: isChecked ? acc.color || '#1a73e8' : undefined,
                      }}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </span>
                    <span className="font-medium text-[#3c4043] dark:text-slate-200 truncate text-xs">{acc.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Other Calendars Dynamic Section */}
        <div className="space-y-1 pt-1">
          <div
            onClick={() => setOtherCalsExpanded(!otherCalsExpanded)}
            className="flex items-center justify-between py-1 text-xs font-semibold text-[#3c4043] dark:text-slate-200 cursor-pointer"
          >
            <div className="flex items-center space-x-2">
              <span>Other calendars</span>
              <Plus className="w-3.5 h-3.5 text-slate-500" />
            </div>
            {otherCalsExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </div>

          {otherCalsExpanded && (
            <div className="space-y-1 pl-1 text-xs">
              <div className="flex items-center space-x-2.5 px-2 py-1 text-slate-700 dark:text-slate-300 cursor-pointer">
                <span className="w-4 h-4 rounded-sm bg-[#0b8043] flex items-center justify-center text-white shrink-0">
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
                <span className="truncate">Holidays in India</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
