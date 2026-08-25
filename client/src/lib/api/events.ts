import { safeFetch } from './client';
import { EventData } from './types';

export async function fetchEvents(): Promise<EventData[]> {
  try {
    const res = await safeFetch('/events', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      return data.events || [];
    }
    return [];
  } catch (err: unknown) {
    return [];
  }
}

export async function createEventApi(payload: Partial<EventData>): Promise<EventData> {
  const res = await safeFetch('/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create event');
  const data = await res.json();
  return data.event;
}

export async function updateEventApi(id: string, payload: Partial<EventData>): Promise<EventData> {
  const res = await safeFetch(`/events/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update event');
  const data = await res.json();
  return data.event;
}

export async function deleteEventApi(id: string): Promise<void> {
  const res = await safeFetch(`/events/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete event');
}
