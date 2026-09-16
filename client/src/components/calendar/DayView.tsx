'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, MapPin, Video, Users, Plus } from 'lucide-react';
import { EventData } from '@/lib/api';

interface DayViewProps {
  selectedDate: Date;
  events: EventData[];
  onSelectEvent: (evt: EventData) => void;
  onQuickCreateSlot: (date: Date, hour: number) => void;
}

export const DayView: React.FC<DayViewProps> = ({ selectedDate, events, onSelectEvent, onQuickCreateSlot }) => {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const hourRowHeight = 70; // 70px per hour

  const isToday =
    selectedDate.getFullYear() === now.getFullYear() &&
    selectedDate.getMonth() === now.getMonth() &&
    selectedDate.getDate() === now.getDate();

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const redLineTop = currentMinutes * (hourRowHeight / 60);

  // Filter events for selectedDate
  const dayEvents = events.filter((e) => {
    const start = new Date(e.startTime);
    return (
      start.getFullYear() === selectedDate.getFullYear() &&
      start.getMonth() === selectedDate.getMonth() &&
      start.getDate() === selectedDate.getDate()
    );
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-950 overflow-hidden select-none">
      {/* Day Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-lg shadow-sm">
            {selectedDate.getDate()}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {selectedDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </h2>
            <p className="text-xs text-slate-500">
              {dayEvents.length} Event{dayEvents.length === 1 ? '' : 's'} scheduled
            </p>
          </div>
        </div>

        <button
          onClick={() => onQuickCreateSlot(selectedDate, 9)}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Event Today</span>
        </button>
      </div>

      {/* Hourly Grid Container */}
      <div className="flex-1 flex overflow-y-auto relative">
        {/* Left Time Gutter */}
        <div className="w-20 border-r border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/20 shrink-0">
          {hours.map((hour) => {
            const displayTime =
              hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
            return (
              <div
                key={hour}
                style={{ height: `${hourRowHeight}px` }}
                className="text-xs font-mono text-slate-400 text-right pr-3 pt-2 border-b border-slate-100 dark:border-slate-900"
              >
                {displayTime}
              </div>
            );
          })}
        </div>

        {/* Day Column Area */}
        <div className="flex-1 relative min-h-[1680px]">
          {/* Hour row slot triggers */}
          {hours.map((h) => (
            <div
              key={h}
              onClick={() => onQuickCreateSlot(selectedDate, h)}
              style={{ height: `${hourRowHeight}px` }}
              className="border-b border-slate-100 dark:border-slate-900 hover:bg-blue-50/20 dark:hover:bg-blue-900/10 cursor-pointer transition-colors"
            />
          ))}

          {/* Red current time indicator line */}
          {isToday && (
            <div
              style={{ top: `${redLineTop}px` }}
              className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
            >
              <div className="w-3 h-3 rounded-full bg-red-500 -ml-1.5 shadow-sm" />
              <div className="flex-1 h-[2px] bg-red-500" />
            </div>
          )}

          {/* Event Cards */}
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
                  backgroundColor: evt.hasConflict ? undefined : `${evt.accountColor || '#4285F4'}15`,
                  borderColor: evt.hasConflict ? undefined : evt.accountColor || '#4285F4',
                }}
                className={`absolute left-3 right-3 rounded-2xl p-3 z-10 cursor-pointer overflow-hidden border shadow-xs transition-all hover:shadow-md hover:z-30 ${
                  evt.hasConflict
                    ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-400 text-amber-900 dark:text-amber-200'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: evt.accountColor }}
                      />
                      <h4 className="text-sm font-bold tracking-tight">{evt.title}</h4>
                      {evt.hasConflict && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 text-[10px] font-bold">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Double-Booked</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono opacity-80 flex items-center space-x-1">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} –{' '}
                      {end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>

                  {evt.meetLink && (
                    <a
                      href={evt.meetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-xs"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Join Meet</span>
                    </a>
                  )}
                </div>

                {evt.description && <p className="text-xs opacity-75 mt-2 line-clamp-2">{evt.description}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
