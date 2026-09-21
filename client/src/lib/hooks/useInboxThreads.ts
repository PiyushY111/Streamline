'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchEmails, fetchConnectedAccounts, triggerSyncApi, EmailData, AccountData } from '@/lib/api';
import { useLiveEvents } from '@/lib/hooks/useLiveEvents';
import { mergeIncomingEmails } from '@/lib/inbox/mergeEmails';

export const INBOX_EMAILS_QUERY_KEY = ['inbox', 'emails'] as const;
export const INBOX_ACCOUNTS_QUERY_KEY = ['inbox', 'accounts'] as const;

const POLL_INTERVAL_MS = 25000;

type Updater<T> = T | ((prev: T) => T);

function resolveUpdater<T>(updater: Updater<T>, prev: T): T {
  return typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater;
}

export interface UseInboxThreadsOptions {
  /** Whether a thread is already selected — mirrors the original "auto-select first email" guard. */
  hasSelectedEmail: boolean;
  onFirstEmailLoaded: (id: string) => void;
}

export interface UseInboxThreadsResult {
  emails: EmailData[];
  accounts: AccountData[];
  loading: boolean;
  loadData: (forceSync?: boolean) => Promise<void>;
  setEmails: (updater: Updater<EmailData[]>) => void;
  setAccounts: (updater: Updater<AccountData[]>) => void;
}

/**
 * Owns the inbox's emails/accounts data: initial load, 25s poll, focus-triggered
 * resync, and zero-latency SSE push updates. Backed by TanStack Query's cache
 * (this project's existing data-fetching convention, see useTasks.ts) so the
 * data survives remounts, but every trigger below is fired imperatively at the
 * exact same moments as the original inline implementation — this hook does
 * not rely on RQ's automatic refetch-on-focus/polling, to keep behavior identical.
 */
export function useInboxThreads({ hasSelectedEmail, onFirstEmailLoaded }: UseInboxThreadsOptions): UseInboxThreadsResult {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);

  // These queries never fetch on their own — see loadData/refreshEmails below.
  // They exist purely so the emails/accounts arrays live in the shared query
  // cache instead of component-local state.
  const emailsQuery = useQuery<EmailData[]>({
    queryKey: INBOX_EMAILS_QUERY_KEY,
    queryFn: () => Promise.resolve([]),
    initialData: [],
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const accountsQuery = useQuery<AccountData[]>({
    queryKey: INBOX_ACCOUNTS_QUERY_KEY,
    queryFn: () => Promise.resolve([]),
    initialData: [],
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const setEmails = useCallback(
    (updater: Updater<EmailData[]>) => {
      queryClient.setQueryData<EmailData[]>(INBOX_EMAILS_QUERY_KEY, (prev = []) => resolveUpdater(updater, prev));
    },
    [queryClient],
  );

  const setAccounts = useCallback(
    (updater: Updater<AccountData[]>) => {
      queryClient.setQueryData<AccountData[]>(INBOX_ACCOUNTS_QUERY_KEY, (prev = []) => resolveUpdater(updater, prev));
    },
    [queryClient],
  );

  const updateEmailsState = useCallback(
    (incoming: EmailData[]) => {
      setEmails((prev) => mergeIncomingEmails(prev, incoming));
    },
    [setEmails],
  );

  // Keep latest selection guard in a ref so the callback below doesn't need to
  // change identity on every render (it feeds an effect dependency array).
  const hasSelectedEmailRef = useRef(hasSelectedEmail);
  hasSelectedEmailRef.current = hasSelectedEmail;

  const loadData = useCallback(
    async (forceSync: boolean = false) => {
      try {
        setLoading(true);
        const [emailData, accData] = await Promise.all([
          fetchEmails().catch(() => []),
          fetchConnectedAccounts().catch(() => []),
        ]);
        if (emailData && emailData.length > 0) {
          updateEmailsState(emailData);
          if (!hasSelectedEmailRef.current && emailData[0]) {
            onFirstEmailLoaded(emailData[0].id);
          }
        }
        if (accData && accData.length > 0) {
          setAccounts(accData);
        }

        if (forceSync) {
          triggerSyncApi(false)
            .then(() => fetchEmails())
            .then((freshEmails) => {
              if (freshEmails && freshEmails.length > 0) {
                updateEmailsState(freshEmails);
              }
            })
            .catch((syncErr) => console.warn('Background sync notification:', syncErr));
        }
      } catch (err) {
        console.warn('Failed to load inbox data:', err);
      } finally {
        setLoading(false);
      }
    },
    [onFirstEmailLoaded, setAccounts, updateEmailsState],
  );

  const refreshEmails = useCallback(() => {
    fetchEmails()
      .then((emailData) => {
        if (emailData && emailData.length > 0) updateEmailsState(emailData);
      })
      .catch(() => {});
  }, [updateEmailsState]);

  // Initial load with fast-sync, 25s poll, and focus-triggered resync.
  // (The original also cleared an unrelated undo-send timer here on unmount;
  // that cleanup now lives with the undo-toast state in useReplyDrafter/useCompose.)
  useEffect(() => {
    loadData(true);

    const pollInterval = setInterval(() => {
      triggerSyncApi(true).then(() => refreshEmails()).catch(() => {});
    }, POLL_INTERVAL_MS);

    const handleFocus = () => {
      triggerSyncApi(true).then(() => refreshEmails()).catch(() => {});
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only, mirrors original behavior
  }, []);

  // Zero-latency push ingestion via Server-Sent Events (Google Cloud Pub/Sub < 500ms updates).
  const onEmailReceived = useCallback(() => refreshEmails(), [refreshEmails]);
  const onSyncCompleted = useCallback(() => refreshEmails(), [refreshEmails]);
  const onTriageCompleted = useCallback(() => refreshEmails(), [refreshEmails]);
  useLiveEvents({ onEmailReceived, onSyncCompleted, onTriageCompleted });

  return {
    emails: emailsQuery.data ?? [],
    accounts: accountsQuery.data ?? [],
    loading,
    loadData,
    setEmails,
    setAccounts,
  };
}
