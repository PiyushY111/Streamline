'use client';

import { useEffect, useRef } from 'react';

export interface LiveEventPayload {
  accountId?: string;
  emailAddress?: string;
  historyId?: string;
  timestamp: string;
  [key: string]: unknown;
}

interface UseLiveEventsOptions {
  onEmailReceived?: (data: LiveEventPayload) => void;
  onSyncCompleted?: (data: LiveEventPayload) => void;
  onTriageCompleted?: (data: LiveEventPayload) => void;
  enabled?: boolean;
}

export function useLiveEvents({
  onEmailReceived,
  onSyncCompleted,
  onTriageCompleted,
  enabled = true,
}: UseLiveEventsOptions = {}) {
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const token = localStorage.getItem('streamline_token');
    const url = token ? `/api/live/stream?token=${encodeURIComponent(token)}` : '/api/live/stream';

    let es: EventSource | null = null;
    let retryTimer: NodeJS.Timeout | null = null;

    function connect() {
      try {
        es = new EventSource(url, { withCredentials: true });
        eventSourceRef.current = es;

        es.addEventListener('email.received', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            onEmailReceived?.(data);
          } catch (err) {
            console.warn('Failed to parse SSE email.received payload', err);
          }
        });

        es.addEventListener('sync.completed', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            onSyncCompleted?.(data);
          } catch (err) {
            console.warn('Failed to parse SSE sync.completed payload', err);
          }
        });

        es.addEventListener('triage.completed', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            onTriageCompleted?.(data);
          } catch (err) {
            console.warn('Failed to parse SSE triage.completed payload', err);
          }
        });

        es.onerror = () => {
          if (es) {
            es.close();
            eventSourceRef.current = null;
          }
          retryTimer = setTimeout(connect, 5000);
        };
      } catch (err) {
        retryTimer = setTimeout(connect, 5000);
      }
    }

    connect();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [enabled, onEmailReceived, onSyncCompleted, onTriageCompleted]);
}
