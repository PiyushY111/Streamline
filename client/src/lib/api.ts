const PRIMARY_API = '/api';
const FALLBACK_API = 'http://localhost:5001/api';

async function safeFetch(endpoint: string, options?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(`${PRIMARY_API}${endpoint}`, options);
    if (res.ok || res.status === 400 || res.status === 401) {
      return res;
    }
  } catch (err) {
    // Relative fetch failed, fall through to absolute fallback
  }
  return fetch(`${FALLBACK_API}${endpoint}`, options);
}

export interface AccountData {
  id: string;
  providerAccountId: string;
  email: string;
  label: string;
  color: string;
  avatar?: string;
  status: 'active' | 'syncing' | 'error';
  scopes: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailData {
  id: string;
  threadId: string;
  accountId: string;
  accountName: string;
  accountColor: string;
  sender: string;
  recipients: string;
  subject: string;
  snippet: string;
  bodyText?: string;
  bodyHtml?: string;
  receivedAt: string;
  isRead: boolean;
  isStarred: boolean;
  isImportant: boolean;
}

export interface EventData {
  id: string;
  calendarId: string;
  accountId: string;
  accountName: string;
  accountColor: string;
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  hasConflict: boolean;
  conflictingWith: string[];
  guests?: string[];
  type?: 'event' | 'task' | 'reminder';
  colorSwatch?: string;
  meetLink?: string;
  isAllDay?: boolean;
}

export interface TaskData {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  dueAt?: string;
  sourceEmailId?: string;
  sourceEventId?: string;
}

export async function fetchConnectedAccounts(): Promise<AccountData[]> {
  try {
    const res = await safeFetch('/accounts', { cache: 'no-store' });
    if (!res.ok) throw new Error('Fetch failed');
    const data = await res.json();
    if (data.accounts && data.accounts.length > 0) return data.accounts;
  } catch (err) {
    // Fallback accounts
  }
  return [
    {
      id: 'acc-1',
      providerAccountId: 'user@google.com',
      email: 'alex.smith@gmail.com',
      label: 'Personal Calendar',
      color: '#4285F4', // Google Blue
      status: 'active',
      scopes: 'https://www.googleapis.com/auth/calendar',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'acc-2',
      providerAccountId: 'work@google.com',
      email: 'alex.smith@company.io',
      label: 'Work (Streamline Tech)',
      color: '#0F9D58', // Google Green
      status: 'active',
      scopes: 'https://www.googleapis.com/auth/calendar',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'acc-3',
      providerAccountId: 'design@google.com',
      email: 'design@company.io',
      label: 'Product & Design',
      color: '#AB47BC', // Purple/Grape
      status: 'active',
      scopes: 'https://www.googleapis.com/auth/calendar',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}

export async function updateAccountDetails(
  id: string,
  payload: { label?: string; color?: string }
): Promise<AccountData> {
  const res = await safeFetch(`/accounts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update account');
  const data = await res.json();
  return data.account;
}

export async function disconnectAccountApi(id: string): Promise<void> {
  const res = await safeFetch(`/accounts/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to disconnect account');
}

export async function fetchEmails(): Promise<EmailData[]> {
  try {
    const res = await safeFetch('/emails', { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.emails || [];
  } catch (err) {
    return [];
  }
}

export async function fetchEvents(): Promise<EventData[]> {
  try {
    const res = await safeFetch('/events', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.events && data.events.length > 0) return data.events;
    }
  } catch (err) {
    // Fall through to sample events
  }

  // Compute dates relative to the actual real current date of the user's system
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
  } catch (err) {
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
  } catch (err) {
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
  } catch (err) {
    // Ignore error offline
  }
}


export async function fetchTasks(): Promise<TaskData[]> {
  try {
    const res = await safeFetch('/tasks', { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.tasks || [];
  } catch (err) {
    return [];
  }
}

export async function createTaskApi(payload: Partial<TaskData>): Promise<TaskData> {
  const res = await safeFetch('/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create task');
  const data = await res.json();
  return data.task;
}

export async function updateTaskApi(id: string, payload: Partial<TaskData>): Promise<TaskData> {
  const res = await safeFetch(`/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update task');
  const data = await res.json();
  return data.task;
}

export async function deleteTaskApi(id: string): Promise<void> {
  const res = await safeFetch(`/tasks/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete task');
}
