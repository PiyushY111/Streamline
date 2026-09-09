import { safeFetch } from './client';
import {
  PendingActionData,
  AgentSessionData,
  AgentMessageData,
  UserMemoryData,
} from './types';

export async function sendAgentMessage(
  message: string,
  sessionId?: string
): Promise<{ sessionId: string; text: string; pendingActions: string[] }> {
  const res = await safeFetch('/agent/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to communicate with agent');
  }
  return res.json();
}

export async function fetchPendingActions(): Promise<PendingActionData[]> {
  try {
    const res = await safeFetch('/agent/actions/pending', { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.actions || [];
  } catch (err) {
    return [];
  }
}

export async function approvePendingAction(
  id: string,
  idempotencyKey?: string
): Promise<{ success: boolean; result: any }> {
  const res = await safeFetch(`/agent/actions/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idempotencyKey }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to approve action');
  }
  return res.json();
}

export async function rejectPendingAction(id: string): Promise<{ success: boolean }> {
  const res = await safeFetch(`/agent/actions/${id}/reject`, {
    method: 'POST',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to reject action');
  }
  return res.json();
}

export async function fetchAgentSessions(): Promise<AgentSessionData[]> {
  try {
    const res = await safeFetch('/agent/sessions', { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.sessions || [];
  } catch (err) {
    return [];
  }
}

export async function fetchSessionMessages(sessionId: string): Promise<AgentMessageData[]> {
  try {
    const res = await safeFetch(`/agent/sessions/${sessionId}/messages`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.messages || [];
  } catch (err) {
    return [];
  }
}

export async function fetchUserMemories(type?: string): Promise<UserMemoryData[]> {
  try {
    const url = type ? `/agent/memories?type=${encodeURIComponent(type)}` : '/agent/memories';
    const res = await safeFetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.memories || [];
  } catch (err) {
    return [];
  }
}

export async function deleteUserMemory(id: string): Promise<boolean> {
  const res = await safeFetch(`/agent/memories/${id}`, {
    method: 'DELETE',
  });
  return res.ok;
}
