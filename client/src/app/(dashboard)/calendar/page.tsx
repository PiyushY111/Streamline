'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { fetchEvents, fetchConnectedAccounts, createEventApi, EventData, AccountData } from '@/lib/api';
import { GoogleCalendarHeader } from '@/components/calendar/GoogleCalendarHeader';
import { GoogleCalendarSidebar } from '@/components/calendar/GoogleCalendarSidebar';
import { MonthView } from '@/components/calendar/MonthView';
import { WeekView } from '@/components/calendar/WeekView';
import { DayView } from '@/components/calendar/DayView';
import { YearView } from '@/components/calendar/YearView';
import { ScheduleView } from '@/components/calendar/ScheduleView';
import { QuickCreateModal } from '@/components/calendar/QuickCreateModal';
import { EventDetailsModal } from '@/components/calendar/EventDetailsModal';
import { ConflictBanner } from '@/components/calendar/ConflictBanner';

export default function CalendarPage() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month' | 'year' | 'schedule'>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [visibleAccounts, setVisibleAccounts] = useState<string[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [evtData, accData] = await Promise.all([fetchEvents(), fetchConnectedAccounts()]);
    setEvents(evtData);
    setAccounts(accData);
    setVisibleAccounts(accData.map(a => a.id));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleAccountVisibility = (id: string) => {
    setVisibleAccounts(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const handleSaveQuickCreate = async (payload: Partial<EventData>) => {
    const created = await createEventApi(payload);
    setEvents(prev => [...prev, created]);
    setIsQuickCreateOpen(false);
  };

  const formattedDateTitle = selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const filteredEvents = events.filter(e => visibleAccounts.includes(e.accountId));
  const conflictingEvents = filteredEvents.filter(e => e.hasConflict);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <GoogleCalendarHeader
        currentDateTitle={formattedDateTitle}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onToday={() => setSelectedDate(new Date())}
        onPrev={() => {
          const next = new Date(selectedDate);
          next.setMonth(next.getMonth() - 1);
          setSelectedDate(next);
        }}
        onNext={() => {
          const next = new Date(selectedDate);
          next.setMonth(next.getMonth() + 1);
          setSelectedDate(next);
        }}
        onQuickCreate={() => setIsQuickCreateOpen(true)}
      />

      <ConflictBanner conflictEvents={conflictingEvents} onSelectEvent={setSelectedEvent} />

      <div className="flex-1 flex overflow-hidden">
        <GoogleCalendarSidebar
          accounts={accounts}
          selectedAccounts={visibleAccounts}
          onToggleAccount={toggleAccountVisibility}
        />

        <div className="flex-1 flex flex-col overflow-y-auto">
          {viewMode === 'month' && (
            <MonthView
              selectedDate={selectedDate}
              events={filteredEvents}
              onSelectEvent={setSelectedEvent}
              onQuickCreate={() => setIsQuickCreateOpen(true)}
            />
          )}
          {viewMode === 'week' && (
            <WeekView
              selectedDate={selectedDate}
              events={filteredEvents}
              onSelectEvent={setSelectedEvent}
              onQuickCreateSlot={() => setIsQuickCreateOpen(true)}
            />
          )}
          {viewMode === 'day' && (
            <DayView
              selectedDate={selectedDate}
              events={filteredEvents}
              onSelectEvent={setSelectedEvent}
              onQuickCreateSlot={() => setIsQuickCreateOpen(true)}
            />
          )}
          {viewMode === 'year' && (
            <YearView
              selectedDate={selectedDate}
              events={filteredEvents}
              onSelectDate={(d) => { setSelectedDate(d); setViewMode('day'); }}
              onSwitchToMonthView={() => setViewMode('month')}
            />
          )}
          {viewMode === 'schedule' && (
            <ScheduleView
              events={filteredEvents}
              onSelectEvent={setSelectedEvent}
              onOpenCreateModal={() => setIsQuickCreateOpen(true)}
            />
          )}
        </div>
      </div>

      <QuickCreateModal
        isOpen={isQuickCreateOpen}
        onClose={() => setIsQuickCreateOpen(false)}
        accounts={accounts}
        onSave={handleSaveQuickCreate}
      />

      <EventDetailsModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onDelete={(id) => {
          setEvents(prev => prev.filter(e => e.id !== id));
          setSelectedEvent(null);
        }}
      />
    </div>
  );
}
