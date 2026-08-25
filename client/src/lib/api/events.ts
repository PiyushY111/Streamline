import { safeFetch } from './client';
import { EventData } from './types';

export async function fetchEvents(): Promise<EventData[]> {
  try {
    const res = await safeFetch('/events', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.events && data.events.length > 0) return data.events;
    }
  } catch (err: unknown) {
    // Fall through to sample events
  }

  const todayObj = new Date();
  const baseDate = todayObj.toISOString().split('T')[0];

  const tomorrowObj = new Date(todayObj);
  tomorrowObj.setDate(todayObj.getDate() + 1);
  const tomorrowDate = tomorrowObj.toISOString().split('T')[0];

  const nextDayObj = new Date(todayObj);
  nextDayObj.setDate(todayObj.getDate() + 2);
  const nextDate = nextDayObj.toISOString().split('T')[0];

  const fridayObj = new Date(todayObj);
  fridayObj.setDate(todayObj.getDate() + 3);
  const fridayDate = fridayObj.toISOString().split('T')[0];

  return [
    {
      id: 'evt-101',
      calendarId: 'cal-main',
      accountId: 'acc-2',
      accountName: 'Work (Streamline Tech)',
      accountColor: '#0F9D58',
      title: '🚀 Q3 Product Roadmap Sync & Architecture Review',
      description: 'Reviewing engineering milestones, microservices migration, and AI agent integration goals for Q3.',
      location: 'Google Meet / San Francisco HQ (Room 402)',
      startTime: `${baseDate}T09:30:00.000Z`,
      endTime: `${baseDate}T10:30:00.000Z`,
      hasConflict: false,
      conflictingWith: [],
      guests: ['alex.smith@company.io', 'sarah.dev@company.io', 'michael.pm@company.io'],
      type: 'event',
      meetLink: 'https://meet.google.com/xyz-stream-q3',
      colorSwatch: '#0F9D58',
    },
    {
      id: 'evt-102',
      calendarId: 'cal-design',
      accountId: 'acc-3',
      accountName: 'Product & Design',
      accountColor: '#AB47BC',
      title: '🎨 Google Calendar Redesign Sprint Review',
      description: 'Walkthrough of new Material 3 time-grid components, color themes, and quick-create popovers.',
      location: 'Google Meet',
      startTime: `${baseDate}T10:00:00.000Z`,
      endTime: `${baseDate}T11:30:00.000Z`,
      hasConflict: true,
      conflictingWith: ['evt-101'],
      guests: ['alex.smith@company.io', 'ux.lead@company.io'],
      type: 'event',
      meetLink: 'https://meet.google.com/abc-gcal-redesign',
      colorSwatch: '#AB47BC',
    },
    {
      id: 'evt-103',
      calendarId: 'cal-main',
      accountId: 'acc-2',
      accountName: 'Work (Streamline Tech)',
      accountColor: '#0F9D58',
      title: '💻 Weekly Engineering All-Hands',
      description: 'Team update on backend performance metrics, database query latencies, and deployments.',
      location: 'Main Conference Auditorium',
      startTime: `${baseDate}T14:00:00.000Z`,
      endTime: `${baseDate}T15:00:00.000Z`,
      hasConflict: false,
      conflictingWith: [],
      guests: ['eng-team@company.io'],
      type: 'event',
      meetLink: 'https://meet.google.com/eng-all-hands',
      colorSwatch: '#4285F4',
    },
    {
      id: 'evt-104',
      calendarId: 'cal-personal',
      accountId: 'acc-1',
      accountName: 'Personal Calendar',
      accountColor: '#4285F4',
      title: '🏋️ Workout & Physical Training Session',
      description: 'Cardio & strength training routine.',
      location: 'Equinox Fitness Club',
      startTime: `${baseDate}T17:30:00.000Z`,
      endTime: `${baseDate}T18:30:00.000Z`,
      hasConflict: false,
      conflictingWith: [],
      guests: ['alex.smith@gmail.com'],
      type: 'event',
      colorSwatch: '#DB4437',
    },
    {
      id: 'evt-105',
      calendarId: 'cal-main',
      accountId: 'acc-2',
      accountName: 'Work (Streamline Tech)',
      accountColor: '#0F9D58',
      title: '☕ 1-on-1 Mentorship Coffee with Lead Architect',
      description: 'Discussing career progression and system scalability strategies.',
      location: 'Philz Coffee, 4th St',
      startTime: `${tomorrowDate}T11:00:00.000Z`,
      endTime: `${tomorrowDate}T12:00:00.000Z`,
      hasConflict: false,
      conflictingWith: [],
      guests: ['alex.smith@company.io', 'lead.arch@company.io'],
      type: 'event',
      meetLink: 'https://meet.google.com/coffee-mentorship',
      colorSwatch: '#F4B400',
    },
    {
      id: 'evt-106',
      calendarId: 'cal-design',
      accountId: 'acc-3',
      accountName: 'Product & Design',
      accountColor: '#AB47BC',
      title: '📌 Submit Final UI Specs for Mobile App',
      description: 'Figma link export & handoff to iOS/Android teams.',
      startTime: `${nextDate}T16:00:00.000Z`,
      endTime: `${nextDate}T17:00:00.000Z`,
      hasConflict: false,
      conflictingWith: [],
      type: 'task',
      colorSwatch: '#AB47BC',
    },
    {
      id: 'evt-107',
      calendarId: 'cal-main',
      accountId: 'acc-2',
      accountName: 'Work (Streamline Tech)',
      accountColor: '#0F9D58',
      title: '🎉 Team Celebration & Q3 Sprint Demo',
      description: 'Celebrating team deliverables with live demos and social snacks!',
      location: 'Rooftop Lounge',
      startTime: `${fridayDate}T16:30:00.000Z`,
      endTime: `${fridayDate}T18:00:00.000Z`,
      hasConflict: false,
      conflictingWith: [],
      guests: ['all-team@company.io'],
      type: 'event',
      meetLink: 'https://meet.google.com/team-celebration-demo',
      colorSwatch: '#0F9D58',
    },
  ];
}

export async function createEventApi(payload: Partial<EventData>): Promise<EventData> {
  try {
    const res = await safeFetch('/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      return data.event;
    }
  } catch (err: unknown) {
    // Return created object directly if offline
  }
  return {
    id: `evt-${Date.now()}`,
    calendarId: payload.calendarId || 'cal-main',
    accountId: payload.accountId || 'acc-1',
    accountName: payload.accountName || 'Personal Calendar',
    accountColor: payload.accountColor || '#4285F4',
    title: payload.title || 'Untitled Event',
    description: payload.description || '',
    location: payload.location || '',
    startTime: payload.startTime || new Date().toISOString(),
    endTime: payload.endTime || new Date(Date.now() + 3600000).toISOString(),
    hasConflict: false,
    conflictingWith: [],
    guests: payload.guests || [],
    type: payload.type || 'event',
    meetLink: payload.meetLink,
    colorSwatch: payload.colorSwatch || payload.accountColor || '#4285F4',
  };
}

export async function updateEventApi(id: string, payload: Partial<EventData>): Promise<EventData> {
  try {
    const res = await safeFetch(`/events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      return data.event;
    }
  } catch (err: unknown) {
    // Return updated mock object
  }
  return {
    id,
    calendarId: payload.calendarId || 'cal-main',
    accountId: payload.accountId || 'acc-1',
    accountName: payload.accountName || 'Calendar',
    accountColor: payload.accountColor || '#4285F4',
    title: payload.title || 'Updated Event',
    description: payload.description,
    location: payload.location,
    startTime: payload.startTime || new Date().toISOString(),
    endTime: payload.endTime || new Date(Date.now() + 3600000).toISOString(),
    hasConflict: false,
    conflictingWith: [],
    guests: payload.guests,
    type: payload.type || 'event',
    meetLink: payload.meetLink,
    colorSwatch: payload.colorSwatch,
  };
}

export async function deleteEventApi(id: string): Promise<void> {
  try {
    await safeFetch(`/events/${id}`, { method: 'DELETE' });
  } catch (err: unknown) {
    // Ignore error offline
  }
}
