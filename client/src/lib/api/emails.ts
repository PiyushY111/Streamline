import { safeFetch } from './client';
import { EmailData } from './types';

export async function fetchEmails(): Promise<EmailData[]> {
  try {
    const res = await safeFetch('/emails', { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.emails || [];
  } catch (err: unknown) {
    return [];
  }
}
