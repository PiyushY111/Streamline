'use client';

import { useCallback, useRef, useState } from 'react';
import type { UndoToastState } from '@/lib/inbox/types';

const UNDO_COUNTDOWN_SECONDS = 5;

export interface ShowUndoOptions {
  message: string;
  onUndo: () => void;
  onCommit: () => void | Promise<void>;
}

export interface UseUndoToastResult {
  undoToast: UndoToastState | null;
  /** Shows the toast and starts the 5s countdown; calls onCommit when it elapses, unless undone. */
  showUndo: (opts: ShowUndoOptions) => void;
  /** Cancels any in-flight countdown without running onCommit or onUndo (used on unmount). */
  cancelPending: () => void;
}

/**
 * Shared "5-second undo" toast used by both the compose dock and the inline
 * reply/forward box -- both used to duplicate this exact countdown/timer logic.
 */
export function useUndoToast(): UseUndoToastResult {
  const [undoToast, setUndoToast] = useState<UndoToastState | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const cancelPending = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const showUndo = useCallback(
    ({ message, onUndo, onCommit }: ShowUndoOptions) => {
      let seconds = UNDO_COUNTDOWN_SECONDS;

      const toastObj: UndoToastState = {
        active: true,
        message,
        countdown: seconds,
        onUndo: () => {
          cancelPending();
          setUndoToast(null);
          onUndo();
        },
      };
      setUndoToast(toastObj);

      timerRef.current = setInterval(async () => {
        seconds -= 1;
        if (seconds <= 0) {
          cancelPending();
          setUndoToast(null);
          await onCommit();
        } else {
          setUndoToast((prev) => (prev ? { ...prev, countdown: seconds } : null));
        }
      }, 1000);
    },
    [cancelPending],
  );

  return { undoToast, showUndo, cancelPending };
}
