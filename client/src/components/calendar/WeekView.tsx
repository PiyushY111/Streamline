'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Video } from 'lucide-react';
import { EventData } from '@/lib/api';

interface WeekViewProps {
  selectedDate: Date;
  events: EventData[];
  onSelectEvent: (evt: EventData) => void;
  onQuickCreateSlot: (date: Date, hour: number) => void;
}

export const WeekView: React.FC<WeekViewProps> = ({
  selectedDate,
  events,
  onSelectEvent,
  onQuickCreateSlot,
}) => {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Compute week start (Sunday)
  const weekStart = new Date(selectedDate);
  weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());

  const daysOfWeek = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const hourRowHeight = 60; // 60px per hour => 1px per minute

  // Current red line position
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const redLineTop = currentMinutes * (hourRowHeight / 60);

  const isTodayWeek = daysOfWeek.some(
    (d) =>
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-950 overflow-hidden select-none">
      {/* Week Header Row */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 shrink-0">
        <div className="w-16 border-r border-slate-200 dark:border-slate-800 p-2 text-center text-[10px] font-bold text-slate-400">
          GMT
        </div>
        <div className="flex-1 grid grid-cols-7 border-l border-slate-200 dark:border-slate-800">
          {daysOfWeek.map((dayDate, i) => {
            const isTodayCell =
              dayDate.getFullYear() === now.getFullYear() &&
              dayDate.getMonth() === now.getMonth() &&
              dayDate.getDate() === now.getDate();

            return (
              <div
                key={i}
                className="text-center py-2 border-r border-slate-200 dark:border-slate-800 last:border-r-0 flex flex-col items-center justify-center space-y-0.5"
              >
                <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                  {dayDate.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <span
                  className={`text-sm font-bold h-7 w-7 rounded-full flex items-center justify-center ${
                    isTodayCell
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {dayDate.getDate()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hourly Scrollable Grid Container */}
      <div className="flex-1 flex overflow-y-auto relative">
        {/* Left Time Gutter */}
        <div className="w-16 border-r border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/20 shrink-0">
          {hours.map((hour) => {
            const displayTime =
              hour === 0
                ? '12 AM'
                : hour < 12
                ? `${hour} AM`
                : hour === 12
                ? '12 PM'
                : `${hour - 12} PM`;
            return (
              <div
                key={hour}
                style={{ height: `${hourRowHeight}px` }}
                className="text-[10px] font-mono text-slate-400 text-right pr-2 pt-1 border-b border-slate-100 dark:border-slate-900"
              >
                {displayTime}
              </div>
            );
          })}
        </div>

        {/* 7 Columns Container */}
        <div className="flex-1 grid grid-cols-7 relative divide-x divide-slate-200 dark:divide-slate-800 min-h-[1440px]">
          {daysOfWeek.map((dayDate, dayIdx) => {
            const isTodayColumn =
              dayDate.getFullYear() === now.getFullYear() &&
              dayDate.getMonth() === now.getMonth() &&
              dayDate.getDate() === now.getDate();

            // Filter events for this specific date
            const dayEvents = events.filter((e) => {
              const start = new Date(e.startTime);
              return (
                start.getFullYear() === dayDate.getFullYear() &&
                start.getMonth() === dayDate.getMonth() &&
                start.getDate() === dayDate.getDate()
              );
            });

            return (
              <div key={dayIdx} className="relative h-full">
                {/* Hourly background horizontal gridlines */}
                {hours.map((h) => (
                  <div
                    key={h}
                    onClick={() => onQuickCreateSlot(dayDate, h)}
                    style={{ height: `${hourRowHeight}px` }}
                    className="border-b border-slate-100 dark:border-slate-900/60 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 cursor-pointer transition-colors"
                  />
                ))}

                {/* Red line current-time indicator for Today */}
                {isTodayColumn && (
                  <div
                    style={{ top: `${redLineTop}px` }}
                    className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1 shadow-xs" />
                    <div className="flex-1 h-[2px] bg-red-500" />
                  </div>
                )}

                {/* Event Cards positioned absolutely */}
                {dayEvents.map((evt) => {
                  const start = new Date(evt.startTime);
                  const end = new Date(evt.endTime);

                  const startMin = start.getHours() * 60 + start.getMinutes();
                  const endMin = end.getHours() * 60 + end.getMinutes();
                  const durationMin = Math.max(30, endMin - startMin);

                  const topPx = startMin * (hourRowHeight / 60);
                  const heightPx = durationMin * (hourRowHeight / 60);

                  return (
                    <div
                      key={evt.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(evt);
                      }}
                      style={{
                        top: `${topPx}px`,
                        height: `${heightPx}px`,
                        backgroundColor: evt.hasConflict
                          ? undefined
                          : `${evt.accountColor || '#4285F4'}25`,
                        borderColor: evt.hasConflict
                          ? undefined
                          : evt.accountColor || '#4285F4',
                      }}
                      className={`absolute left-1 right-1 rounded-xl p-2 z-10 cursor-pointer overflow-hidden border shadow-2xs transition-all hover:scale-[1.02] hover:z-30 ${
                        evt.hasConflict
                          ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-400 text-amber-900 dark:text-amber-200'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold truncate tracking-tight">{evt.title}</span>
                        {evt.hasConflict && <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />}
                      </div>
                      <div className="text-[9px] font-mono opacity-80 mt-0.5">
                        {start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} –{' '}
                        {end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
