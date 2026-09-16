'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { fetchEvents, fetchConnectedAccounts, createEventApi, deleteEventApi, EventData, AccountData } from '@/lib/api';

import { GoogleCalendarHeader, CalendarViewMode } from '@/components/calendar/GoogleCalendarHeader';
import { GoogleCalendarSidebar } from '@/components/calendar/GoogleCalendarSidebar';
import { MonthView } from '@/components/calendar/MonthView';
import { WeekView } from '@/components/calendar/WeekView';
import { DayView } from '@/components/calendar/DayView';
import { YearView } from '@/components/calendar/YearView';
import { ScheduleView } from '@/components/calendar/ScheduleView';
import { QuickCreateModal } from '@/components/calendar/QuickCreateModal';
import { EventDetailsModal } from '@/components/calendar/EventDetailsModal';
import { ConflictBanner } from '@/components/calendar/ConflictBanner';
import { GoogleCalendarRightToolbar } from '@/components/calendar/GoogleCalendarRightToolbar';

export default function CalendarPage() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [guestFilter, setGuestFilter] = useState('');
  const [visibleAccounts, setVisibleAccounts] = useState<string[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);

  // Quick create modal state
  const [quickCreateModal, setQuickCreateModal] = useState<{
    isOpen: boolean;
    date?: Date;
    hour?: number;
    type?: 'event' | 'task' | 'reminder';
  }>({ isOpen: false });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [evtData, accData] = await Promise.all([fetchEvents(), fetchConnectedAccounts()]);
      setEvents(evtData);
      setAccounts(accData);
      setVisibleAccounts(accData.map((a) => a.id));
    } catch (err) {
      console.warn('Failed to load Google Calendar data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keyboard Shortcuts (T: Today, M: Month, W: Week, D: Day, Y: Year, A: Schedule, C: Create)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        quickCreateModal.isOpen ||
        selectedEvent
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 't') {
        setSelectedDate(new Date());
      } else if (key === 'm') {
        setViewMode('month');
      } else if (key === 'w') {
        setViewMode('week');
      } else if (key === 'd') {
        setViewMode('day');
      } else if (key === 'y') {
        setViewMode('year');
      } else if (key === 'a') {
        setViewMode('agenda');
      } else if (key === 'c') {
        setQuickCreateModal({ isOpen: true, date: selectedDate });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quickCreateModal.isOpen, selectedEvent, selectedDate]);

  const toggleAccountVisibility = (id: string) => {
    setVisibleAccounts((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  // Filter events by account, search query, and guest filter
  const filteredEvents = events.filter((e) => {
    if (visibleAccounts.length > 0 && e.accountId && !visibleAccounts.includes(e.accountId)) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = e.title.toLowerCase().includes(q);
      const matchDesc = e.description?.toLowerCase().includes(q);
      const matchLoc = e.location?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchLoc) return false;
    }
    if (guestFilter.trim()) {
      const g = guestFilter.toLowerCase();
      const hasGuest = e.guests?.some((guest) => guest.toLowerCase().includes(g));
      if (!hasGuest) return false;
    }
    return true;
  });

  const conflictEvents = filteredEvents.filter((e) => e.hasConflict);

  // Navigation handlers
  const handleNavigatePrev = () => {
    const d = new Date(selectedDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() - 1);
    else if (viewMode === 'week') d.setDate(d.getDate() - 7);
    else if (viewMode === 'day') d.setDate(d.getDate() - 1);
    else if (viewMode === 'year') d.setFullYear(d.getFullYear() - 1);
    else d.setDate(d.getDate() - 7);
    setSelectedDate(d);
  };

  const handleNavigateNext = () => {
    const d = new Date(selectedDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() + 1);
    else if (viewMode === 'week') d.setDate(d.getDate() + 7);
    else if (viewMode === 'day') d.setDate(d.getDate() + 1);
    else if (viewMode === 'year') d.setFullYear(d.getFullYear() + 1);
    else d.setDate(d.getDate() + 7);
    setSelectedDate(d);
  };

  const handleCreateSave = async (evtPayload: Partial<EventData>) => {
    const newEvt = await createEventApi(evtPayload);
    setEvents((prev) => [...prev, newEvt]);
  };

  const handleDeleteEvent = async (id: string) => {
    await deleteEventApi(id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-white dark:bg-slate-950 font-sans transition-colors duration-200">
      {/* Top Google Workspace Header */}
      <GoogleCalendarHeader
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        selectedDate={selectedDate}
        onSelectToday={() => setSelectedDate(new Date())}
        onNavigatePrev={handleNavigatePrev}
        onNavigateNext={handleNavigateNext}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        conflictCount={conflictEvents.length}
        onRefresh={loadData}
        isRefreshing={loading}
      />

      {/* Main Container with Sidebar + Viewport */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        {sidebarOpen && (
          <GoogleCalendarSidebar
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            accounts={accounts}
            visibleAccounts={visibleAccounts}
            onToggleAccount={toggleAccountVisibility}
            onOpenCreateModal={(type) => setQuickCreateModal({ isOpen: true, date: selectedDate, type })}
            guestFilter={guestFilter}
            onGuestFilterChange={setGuestFilter}
            onTriggerSync={loadData}
            isSyncing={loading}
          />
        )}

        {/* Viewport Content */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Double-Booking Conflict Engine Banner */}
          <ConflictBanner conflictEvents={conflictEvents} onSelectEvent={setSelectedEvent} />

          {/* Active View Switcher Component */}
          {viewMode === 'month' && (
            <MonthView
              selectedDate={selectedDate}
              events={filteredEvents}
              onSelectEvent={setSelectedEvent}
              onQuickCreate={(d) => setQuickCreateModal({ isOpen: true, date: d })}
            />
          )}

          {viewMode === 'week' && (
            <WeekView
              selectedDate={selectedDate}
              events={filteredEvents}
              onSelectEvent={setSelectedEvent}
              onQuickCreateSlot={(d, h) => setQuickCreateModal({ isOpen: true, date: d, hour: h })}
            />
          )}

          {viewMode === 'day' && (
            <DayView
              selectedDate={selectedDate}
              events={filteredEvents}
              onSelectEvent={setSelectedEvent}
              onQuickCreateSlot={(d, h) => setQuickCreateModal({ isOpen: true, date: d, hour: h })}
            />
          )}

          {viewMode === 'year' && (
            <YearView
              selectedDate={selectedDate}
              events={filteredEvents}
              onSelectDate={setSelectedDate}
              onSwitchToMonthView={() => setViewMode('month')}
            />
          )}

          {viewMode === 'agenda' && (
            <ScheduleView
              events={filteredEvents}
              onSelectEvent={setSelectedEvent}
              onOpenCreateModal={() => setQuickCreateModal({ isOpen: true, date: selectedDate })}
            />
          )}
        </div>

        {/* Right Side Google Toolbar Strip */}
        <GoogleCalendarRightToolbar />
      </div>

      {/* Quick Create Event Modal */}
      <QuickCreateModal
        isOpen={quickCreateModal.isOpen}
        onClose={() => setQuickCreateModal({ isOpen: false })}
        onSave={handleCreateSave}
        accounts={accounts}
        initialDate={quickCreateModal.date || selectedDate}
        initialHour={quickCreateModal.hour ?? 10}
        initialType={quickCreateModal.type || 'event'}
      />

      {/* Event Details Drawer Modal */}
      <EventDetailsModal event={selectedEvent} onClose={() => setSelectedEvent(null)} onDelete={handleDeleteEvent} />
    </div>
  );
}
