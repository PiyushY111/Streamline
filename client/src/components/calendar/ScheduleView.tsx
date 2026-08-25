'use client';

import React from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, Video, AlertTriangle, Users } from 'lucide-react';
import { EventData } from '@/lib/api';

interface ScheduleViewProps {
  events: EventData[];
  onSelectEvent: (evt: EventData) => void;
  onOpenCreateModal: () => void;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  events,
  onSelectEvent,
  onOpenCreateModal,
}) => {
  // Sort events chronologically
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  // Group events by formatted date string (e.g. "Tuesday, August 25, 2026")
  const grouped: Record<string, EventData[]> = {};
  sortedEvents.forEach((evt) => {
    const dStr = new Date(evt.startTime).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    if (!grouped[dStr]) grouped[dStr] = [];
    grouped[dStr].push(evt);
  });

  return (
    <div className="flex-1 p-6 bg-white dark:bg-slate-950 overflow-y-auto select-none">
      <div className="max-w-4xl mx-auto space-y-6">
        {Object.keys(grouped).length === 0 ? (
          <div className="p-12 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl space-y-3">
            <CalendarIcon className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">No Scheduled Events</h3>
            <p className="text-xs text-slate-400">Click &quot;Create&quot; to add events to your Google Calendar.</p>
            <button
              onClick={onOpenCreateModal}
              className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all"
            >
              Create Event
            </button>
          </div>
        ) : (
          Object.entries(grouped).map(([dateHeader, dayEvts]) => (
            <div key={dateHeader} className="space-y-3">
              {/* Date Group Sticky Header */}
              <div className="sticky top-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xs py-2 border-b border-slate-200 dark:border-slate-800 z-10 flex items-center space-x-3">
                <span className="w-3 h-3 rounded-full bg-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-sans">
                  {dateHeader}
                </h3>
              </div>

              {/* Event Cards */}
              <div className="space-y-3">
                {dayEvts.map((evt) => {
                  const start = new Date(evt.startTime);
                  const end = new Date(evt.endTime);

                  return (
                    <div
                      key={evt.id}
                      onClick={() => onSelectEvent(evt)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer hover:shadow-md ${
                        evt.hasConflict
                          ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700/50'
                          : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Event details left */}
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center space-x-2.5">
                            <span
                              className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                              style={{
                                backgroundColor: `${evt.accountColor || '#4285F4'}20`,
                                color: evt.accountColor || '#1a73e8',
                              }}
                            >
                              {evt.accountName || 'Calendar'}
                            </span>

                            {evt.hasConflict && (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 text-[10px] font-bold">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Double-Booked Conflict</span>
                              </span>
                            )}
                          </div>

                          <h4 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                            {evt.title}
                          </h4>

                          {evt.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                              {evt.description}
                            </p>
                          )}

                          {evt.location && (
                            <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              <span>{evt.location}</span>
                            </div>
                          )}
                        </div>

                        {/* Right action area */}
                        <div className="flex flex-col md:items-end space-y-2.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200 dark:border-slate-800">
                          <div className="flex items-center space-x-1.5 text-xs font-mono text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-900">
                            <Clock className="w-3.5 h-3.5 text-blue-600" />
                            <span>
                              {start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} –{' '}
                              {end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            </span>
                          </div>

                          {evt.meetLink && (
                            <a
                              href={evt.meetLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span>Join Google Meet</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

