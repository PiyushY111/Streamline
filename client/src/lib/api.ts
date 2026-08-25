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
    if (!res.ok) return [];
    const data = await res.json();
    return data.accounts || [];
  } catch (err) {
    console.error('Error fetching accounts:', err);
    return [];
  }
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
    if (!res.ok) return [];
    const data = await res.json();
    return data.events || [];
  } catch (err) {
    return [];
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
