'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { EventData } from '@/lib/api';

interface MonthViewProps {
  selectedDate: Date;
  events: EventData[];
  onSelectEvent: (evt: EventData) => void;
  onQuickCreate: (date: Date) => void;
}

export const MonthView: React.FC<MonthViewProps> = ({ selectedDate, events, onSelectEvent, onQuickCreate }) => {
  const [overflowDay, setOverflowDay] = useState<{ day: number; events: EventData[] } | null>(null);

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const totalDaysInPrevMonth = new Date(year, month, 0).getDate();

  const prevMonthDays = Array.from({ length: firstDayIndex }, (_, i) => totalDaysInPrevMonth - firstDayIndex + i + 1);
  const currentMonthDays = Array.from({ length: totalDaysInMonth }, (_, i) => i + 1);

  const totalCellsSoFar = prevMonthDays.length + currentMonthDays.length;
  const nextMonthDaysCount = totalCellsSoFar % 7 === 0 ? 0 : 7 - (totalCellsSoFar % 7);
  const nextMonthDays = Array.from({ length: nextMonthDaysCount }, (_, i) => i + 1);

  const today = new Date();
  const isCurrentMonthActual = today.getFullYear() === year && today.getMonth() === month;

  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f8f9fa] dark:bg-slate-950 p-2 sm:p-3 overflow-hidden select-none font-sans">
      {/* Floating Rounded White Card Container for Calendar Grid */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-[20px] border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
        {/* 7-Day Header Row */}
        <div className="grid grid-cols-7 border-b border-slate-200/70 dark:border-slate-800 text-center py-2 shrink-0 bg-white dark:bg-slate-900">
          {dayNames.map((d) => (
            <div key={d} className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tracking-tight">
              {d}
            </div>
          ))}
        </div>

        {/* Grid Matrix */}
        <div className="flex-1 grid grid-cols-7 grid-rows-5 overflow-y-auto bg-white dark:bg-slate-900">
          {/* Prev month fill cells */}
          {prevMonthDays.map((d, i) => (
            <div
              key={`prev-${i}`}
              className="border-r border-b border-slate-200/60 dark:border-slate-800/60 p-1.5 flex flex-col justify-between bg-slate-50/40 dark:bg-slate-950/20"
            >
              <div className="text-center">
                <span className="text-xs font-semibold text-slate-400">{d}</span>
              </div>
            </div>
          ))}

          {/* Current month cells */}
          {currentMonthDays.map((d) => {
            const dateObj = new Date(year, month, d);
            const isTodayCell = isCurrentMonthActual && today.getDate() === d;

            // Filter events for this day
            const dayEvents = events.filter((e) => {
              const evDate = new Date(e.startTime);
              return evDate.getFullYear() === year && evDate.getMonth() === month && evDate.getDate() === d;
            });

            const maxVisibleEvents = 2;
            const visibleEvts = dayEvents.slice(0, maxVisibleEvents);
            const extraCount = dayEvents.length - maxVisibleEvents;

            return (
              <div
                key={`curr-${d}`}
                onClick={(e) => {
                  if (e.target === e.currentTarget) {
                    onQuickCreate(dateObj);
                  }
                }}
                className="border-r border-b border-slate-200/60 dark:border-slate-800/60 p-1.5 flex flex-col justify-between group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/30 relative cursor-pointer min-h-[90px]"
              >
                {/* Top date badge */}
                <div className="flex items-center justify-center relative pointer-events-none mb-1">
                  <span
                    className={`text-xs font-medium h-6 min-w-6 px-1 rounded-full flex items-center justify-center ${
                      isTodayCell ? 'bg-[#1a73e8] text-white font-bold shadow-xs' : 'text-[#3c4043] dark:text-slate-200'
                    }`}
                  >
                    {d === 1 ? `1 ${selectedDate.toLocaleDateString('en-US', { month: 'short' })}` : d}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuickCreate(dateObj);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-opacity pointer-events-auto absolute right-0"
                    title="Add Event"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Event Chips (Solid Color Pills like Real Google Calendar) */}
                <div className="space-y-1 flex-1 overflow-hidden pointer-events-auto">
                  {visibleEvts.map((evt) => {
                    const bgSolidColor = evt.hasConflict ? '#d97706' : evt.accountColor || '#0b8043';

                    return (
                      <div
                        key={evt.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEvent(evt);
                        }}
                        style={{ backgroundColor: bgSolidColor }}
                        className="px-2 py-0.5 rounded-md text-white text-[11px] font-semibold truncate cursor-pointer transition-transform hover:scale-[1.01] shadow-2xs"
                      >
                        <span className="truncate">{evt.title}</span>
                      </div>
                    );
                  })}

                  {/* Overflow link "+ X more" */}
                  {extraCount > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOverflowDay({ day: d, events: dayEvents });
                      }}
                      className="text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 px-1 py-0.5 rounded text-left block w-full truncate"
                    >
                      {extraCount} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Next month fill cells */}
          {nextMonthDays.map((d, i) => (
            <div
              key={`next-${i}`}
              className="border-r border-b border-slate-200/60 dark:border-slate-800/60 p-1.5 flex flex-col justify-between bg-slate-50/40 dark:bg-slate-950/20"
            >
              <div className="text-center">
                <span className="text-xs font-semibold text-slate-400">
                  {d === 1 ? `1 ${new Date(year, month + 1, 1).toLocaleDateString('en-US', { month: 'short' })}` : d}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overflow Modal Dialog */}
      {overflowDay && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 w-full max-w-sm space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {new Date(year, month, overflowDay.day).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </h3>
              <button
                onClick={() => setOverflowDay(null)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {overflowDay.events.map((evt) => (
                <div
                  key={evt.id}
                  onClick={() => {
                    setOverflowDay(null);
                    onSelectEvent(evt);
                  }}
                  style={{ backgroundColor: evt.accountColor || '#0b8043' }}
                  className="p-2.5 rounded-lg text-white font-semibold cursor-pointer text-xs space-y-0.5 shadow-2xs"
                >
                  <div className="truncate">{evt.title}</div>
                  <div className="text-[10px] opacity-90 font-mono">
                    {new Date(evt.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} –{' '}
                    {new Date(evt.endTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
