import { safeFetch } from './client';
import { EmailData } from './types';

export async function fetchEmails(folder?: string): Promise<EmailData[]> {
  try {
    const query = folder ? `?folder=${encodeURIComponent(folder)}&limit=1000` : '?limit=1000';
    const res = await safeFetch(`/emails${query}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.emails || [];
  } catch (err: unknown) {
    return [];
  }
}

export async function sendEmailApi(payload: { to: string; subject: string; body: string; accountId?: string }): Promise<EmailData> {
  const res = await safeFetch('/emails/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to send email');
  }
  const data = await res.json();
  return data.email;
}

export async function markEmailAsReadApi(id: string, isRead: boolean = true): Promise<EmailData> {
  const res = await safeFetch(`/emails/${id}/read`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isRead }),
  });
  if (!res.ok) throw new Error('Failed to update read status');
  const data = await res.json();
  return data.email;
}

export async function toggleStarEmailApi(id: string, isStarred: boolean = true): Promise<EmailData> {
  const res = await safeFetch(`/emails/${id}/star`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isStarred }),
  });
  if (!res.ok) throw new Error('Failed to update star status');
  const data = await res.json();
  return data.email;
}

export async function deleteEmailApi(id: string): Promise<void> {
  const res = await safeFetch(`/emails/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete email');
}

export async function fetchEmailByIdApi(id: string): Promise<EmailData | null> {
  try {
    const res = await safeFetch(`/emails/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.email || null;
  } catch (err: unknown) {
    return null;
  }
}

export async function updateEmailCategoryApi(id: string, category: string): Promise<EmailData> {
  const res = await safeFetch(`/emails/${id}/category`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category }),
  });
  if (!res.ok) throw new Error('Failed to update email category');
  const data = await res.json();
  return data.email;
}

export async function triggerSyncApi(): Promise<void> {
  try {
    await safeFetch('/sync/trigger', { method: 'POST' });
  } catch (err: unknown) {
    console.warn('Manual sync trigger error:', err);
  }
}
