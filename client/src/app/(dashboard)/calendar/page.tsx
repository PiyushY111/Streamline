'use client';

import React, { useEffect, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  AlertTriangle,
  Sparkles,
  Video,
  RefreshCw,
  CheckCircle2,
  X,
  Users,
  Search,
  Filter,
} from 'lucide-react';
import { fetchEvents, fetchConnectedAccounts, EventData, AccountData } from '@/lib/api';

export default function CalendarPage() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day' | 'agenda'>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date('2026-08-25'));
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Calendar filter toggles
  const [visibleAccounts, setVisibleAccounts] = useState<string[]>([]);

  // Create event state
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventStart, setNewEventStart] = useState('14:00');
  const [newEventEnd, setNewEventEnd] = useState('15:00');
  const [newEventLocation, setNewEventLocation] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [evtData, accData] = await Promise.all([fetchEvents(), fetchConnectedAccounts()]);
      setEvents(evtData);
      setAccounts(accData);
      setVisibleAccounts(accData.map((a) => a.id));
    } catch (err) {
      console.warn('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleAccountVisibility = (id: string) => {
    setVisibleAccounts((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const filteredEvents = events.filter((e) => {
    if (visibleAccounts.length > 0 && !visibleAccounts.includes(e.accountId)) {
      return false;
    }
    if (searchQuery.trim()) {
      return e.title.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const conflictCount = filteredEvents.filter((e) => e.hasConflict).length;

  // Mini Calendar Date Grid generator (August 2026)
  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);

  const handlePrevDate = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() - 7);
    setSelectedDate(next);
  };

  const handleNextDate = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 7);
    setSelectedDate(next);
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] -m-6 overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      {/* 1. Left Mini-Calendar Sidebar */}
      <aside className="w-64 bg-slate-100/70 dark:bg-slate-900/60 border-r border-slate-200/80 dark:border-slate-800 p-4 flex flex-col justify-between shrink-0 overflow-y-auto space-y-6">
        <div className="space-y-6">
          {/* Create Event Trigger */}
          <button
            onClick={() => setShowEventModal(true)}
            className="w-full flex items-center justify-center space-x-2.5 px-4 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-md shadow-purple-600/20 transition-all hover:scale-[1.01] active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create Event</span>
          </button>

          {/* Mini Month Grid Picker */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-white">
              <span>August 2026</span>
              <div className="flex items-center space-x-1">
                <button onClick={handlePrevDate} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button onClick={handleNextDate} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-400">
              <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
            </div>

            {/* Date Grid */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium">
              {daysInMonth.map((day) => {
                const isSelected = selectedDate.getDate() === day;
                return (
                  <button
                    key={day}
                    onClick={() => {
                      const d = new Date(selectedDate);
                      d.setDate(day);
                      setSelectedDate(d);
                    }}
                    className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors text-[11px] ${
                      isSelected
                        ? 'bg-purple-600 text-white font-bold shadow-xs'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-800'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Calendars Layer Toggle */}
          <div className="space-y-2.5 pt-4 border-t border-slate-200/80 dark:border-slate-800">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              My Calendars
            </div>
            {accounts.map((acc) => {
              const isChecked = visibleAccounts.includes(acc.id);
              return (
                <button
                  key={acc.id}
                  onClick={() => toggleAccountVisibility(acc.id)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800/60 text-xs transition-colors"
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <span
                      className="w-3 h-3 rounded-md shrink-0 border border-slate-300 dark:border-slate-700"
                      style={{ backgroundColor: isChecked ? acc.color : 'transparent' }}
                    />
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate text-[11px]">{acc.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sync Status Footer */}
        <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Google Calendar Sync</span>
          </span>
          <button onClick={loadData} title="Refresh Calendar">
            <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </aside>

      {/* 2. Google Calendar Main Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 overflow-hidden">
        {/* Top Control Bar */}
        <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Left Controls */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setSelectedDate(new Date())}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-200 transition-colors shadow-xs"
            >
              Today
            </button>

            <div className="flex items-center space-x-1">
              <button onClick={handlePrevDate} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={handleNextDate} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <h2 className="text-base font-bold text-slate-900 dark:text-white font-mono">
              {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
          </div>

          {/* Right View Switcher & Search */}
          <div className="flex items-center space-x-3">
            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events..."
                className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 shadow-xs"
              />
            </div>

            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              {(['month', 'week', 'day', 'agenda'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                    viewMode === mode
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Double-Booking Conflict Engine Alert Banner */}
        {conflictCount > 0 && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/40 flex items-center justify-between shadow-xs">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-xl bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0">
                <AlertTriangle className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wide">
                  ⚠️ Double-Booking Conflict Engine ({conflictCount} Overlapping Event{conflictCount === 1 ? '' : 's'})
                </h4>
                <p className="text-[11px] text-amber-800 dark:text-slate-300 mt-0.5">
                  Sweep-line detector identified overlapping schedule blocks across your connected calendars.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 3. Main Grid Viewport */}
        <div className="flex-1 p-6 overflow-y-auto">
          {viewMode === 'month' && (
            <div className="grid grid-cols-7 gap-3 h-full min-h-[500px]">
              {/* Day Headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-900">
                  {d}
                </div>
              ))}

              {/* Month Grid Cells */}
              {daysInMonth.map((day) => {
                const dayEvts = filteredEvents.filter((e) => new Date(e.startTime).getDate() === day);
                const isToday = day === 25;

                return (
                  <div
                    key={day}
                    className={`min-h-[100px] p-2 rounded-2xl border transition-all flex flex-col justify-between ${
                      isToday
                        ? 'border-purple-500/50 bg-purple-50/30 dark:bg-purple-900/10 shadow-xs'
                        : 'border-slate-100 dark:border-slate-900 bg-slate-50/40 dark:bg-slate-950/40 hover:bg-slate-100/60 dark:hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${isToday ? 'h-6 w-6 rounded-full bg-purple-600 text-white flex items-center justify-center' : 'text-slate-700 dark:text-slate-300'}`}>
                        {day}
                      </span>
                    </div>

                    <div className="space-y-1 mt-1 flex-1 overflow-y-auto">
                      {dayEvts.map((evt) => (
                        <div
                          key={evt.id}
                          onClick={() => setSelectedEvent(evt)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-semibold truncate cursor-pointer transition-all ${
                            evt.hasConflict
                              ? 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-300'
                              : 'bg-purple-100 dark:bg-purple-600/20 text-purple-900 dark:text-purple-200 hover:scale-105'
                          }`}
                        >
                          <div className="flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: evt.accountColor }} />
                            <span className="truncate">{evt.title}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {viewMode === 'agenda' && (
            <div className="space-y-4 max-w-4xl mx-auto">
              {filteredEvents.length === 0 ? (
                <div className="p-12 text-center clean-card rounded-3xl space-y-2">
                  <CalendarIcon className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
                  <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400">No Calendar Events Found</h3>
                  <p className="text-[11px] text-slate-400">Click &quot;Create Event&quot; or connect your Google Calendar account.</p>
                </div>
              ) : (
                filteredEvents.map((evt) => (
                  <div
                    key={evt.id}
                    onClick={() => setSelectedEvent(evt)}
                    className={`p-5 rounded-2xl clean-card clean-card-hover cursor-pointer ${
                      evt.hasConflict
                        ? 'border-amber-300 dark:border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/10'
                        : ''
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-3">
                          <span
                            className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                            style={{
                              backgroundColor: `${evt.accountColor}15`,
                              color: evt.accountColor,
                              border: `1px solid ${evt.accountColor}30`,
                            }}
                          >
                            {evt.accountName}
                          </span>

                          {evt.hasConflict && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 text-[10px] font-semibold">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Double-Booking Conflict</span>
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">{evt.title}</h3>
                        {evt.description && <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{evt.description}</p>}
                      </div>

                      <div className="flex flex-col md:items-end space-y-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-200 dark:border-slate-800">
                        <div className="flex items-center space-x-2 text-xs font-mono text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-500/10 px-3 py-1.5 rounded-xl border border-purple-200 dark:border-purple-500/20">
                          <Clock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          <span>{new Date(evt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(evt.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        <button className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-semibold shadow-xs">
                          <Video className="w-3.5 h-3.5" />
                          <span>Join Google Meet</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Event Details Drawer */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <span
                className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ backgroundColor: `${selectedEvent.accountColor}15`, color: selectedEvent.accountColor }}
              >
                {selectedEvent.accountName}
              </span>
              <button onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white leading-snug">{selectedEvent.title}</h3>
              {selectedEvent.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{selectedEvent.description}</p>
              )}

              <div className="space-y-2 pt-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-purple-600" />
                  <span className="font-mono">{new Date(selectedEvent.startTime).toLocaleString()} – {new Date(selectedEvent.endTime).toLocaleTimeString()}</span>
                </div>
                {selectedEvent.location && (
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span>{selectedEvent.location}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 flex justify-end space-x-2">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300"
              >
                Close
              </button>
              <button className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-semibold">
                <Video className="w-3.5 h-3.5" />
                <span>Join Google Meet</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Create New Event</h3>
              <button onClick={() => setShowEventModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                alert(`Event "${newEventTitle}" scheduled!`);
                setShowEventModal(false);
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Title</label>
                <input
                  type="text"
                  required
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="Meeting title..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Start Time</label>
                  <input
                    type="time"
                    value={newEventStart}
                    onChange={(e) => setNewEventStart(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">End Time</label>
                  <input
                    type="time"
                    value={newEventEnd}
                    onChange={(e) => setNewEventEnd(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Location / Google Meet Link</label>
                <input
                  type="text"
                  value={newEventLocation}
                  onChange={(e) => setNewEventLocation(e.target.value)}
                  placeholder="Google Meet or Location"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
