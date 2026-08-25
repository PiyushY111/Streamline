'use client';

import React from 'react';
import { EventData } from '@/lib/api';

interface YearViewProps {
  selectedDate: Date;
  events: EventData[];
  onSelectDate: (d: Date) => void;
  onSwitchToMonthView: () => void;
}

export const YearView: React.FC<YearViewProps> = ({
  selectedDate,
  events,
  onSelectDate,
  onSwitchToMonthView,
}) => {
  const currentYear = selectedDate.getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => i);
  const today = new Date();

  return (
    <div className="flex-1 p-6 bg-white dark:bg-slate-950 overflow-y-auto select-none">
      <div className="max-w-6xl mx-auto space-y-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white text-center">
          {currentYear} Calendar Overview
        </h2>

        {/* 4x3 Responsive Month Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {months.map((monthIdx) => {
            const monthDate = new Date(currentYear, monthIdx, 1);
            const monthName = monthDate.toLocaleDateString('en-US', { month: 'long' });

            const firstDayIndex = new Date(currentYear, monthIdx, 1).getDay();
            const totalDays = new Date(currentYear, monthIdx + 1, 0).getDate();

            const prevDaysCount = firstDayIndex;
            const currentDays = Array.from({ length: totalDays }, (_, i) => i + 1);

            return (
              <div
                key={monthIdx}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-100/60 dark:hover:bg-slate-900/80 transition-colors shadow-2xs cursor-pointer"
                onClick={() => {
                  onSelectDate(monthDate);
                  onSwitchToMonthView();
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{monthName}</h3>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-semibold text-slate-400 mb-1">
                  <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
                </div>

                {/* Days matrix */}
                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                  {Array.from({ length: prevDaysCount }).map((_, i) => (
                    <div key={`blank-${i}`} className="h-5 w-5" />
                  ))}

                  {currentDays.map((d) => {
                    const isTodayCell =
                      today.getFullYear() === currentYear &&
                      today.getMonth() === monthIdx &&
                      today.getDate() === d;

                    // Check if there are events on this day
                    const hasEvts = events.some((e) => {
                      const st = new Date(e.startTime);
                      return (
                        st.getFullYear() === currentYear &&
                        st.getMonth() === monthIdx &&
                        st.getDate() === d
                      );
                    });

                    return (
                      <button
                        key={d}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDate(new Date(currentYear, monthIdx, d));
                          onSwitchToMonthView();
                        }}
                        className={`h-5 w-5 mx-auto rounded-full flex items-center justify-center text-[10px] transition-all relative ${
                          isTodayCell
                            ? 'bg-blue-600 text-white font-bold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span>{d}</span>
                        {hasEvts && !isTodayCell && (
                          <span className="w-1 h-1 rounded-full bg-blue-500 absolute bottom-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
