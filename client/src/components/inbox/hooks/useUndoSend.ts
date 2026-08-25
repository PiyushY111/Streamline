import { useState, useRef } from 'react';

export function useUndoSend() {
  const [undoToast, setUndoToast] = useState<{
    active: boolean;
    message: string;
    countdown: number;
    onUndo: () => void;
  } | null>(null);

  const undoTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerUndoToast = (seconds: number, message: string, onUndo: () => void) => {
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);

    setUndoToast({
      active: true,
      message,
      countdown: seconds,
      onUndo,
    });

    let current = seconds;
    undoTimerRef.current = setInterval(() => {
      current -= 1;
      if (current <= 0) {
        if (undoTimerRef.current) clearInterval(undoTimerRef.current);
        setUndoToast(null);
      } else {
        setUndoToast(prev => prev ? { ...prev, countdown: current } : null);
      }
    }, 1000);
  };

  const cancelUndo = () => {
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    if (undoToast?.onUndo) undoToast.onUndo();
    setUndoToast(null);
  };

  return {
    undoToast,
    triggerUndoToast,
    cancelUndo,
  };
}
