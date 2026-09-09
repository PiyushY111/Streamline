'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchPendingActions } from '@/lib/api';

interface CopilotContextType {
  isOpen: boolean;
  openCopilot: () => void;
  closeCopilot: () => void;
  toggleCopilot: () => void;
  pendingCount: number;
  refreshPendingCount: () => void;
}

const CopilotContext = createContext<CopilotContextType | undefined>(undefined);

export function CopilotProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(() => {
    fetchPendingActions()
      .then((acts) => setPendingCount(acts.length))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshPendingCount();

    // Poll periodically for any new pending actions
    const interval = setInterval(refreshPendingCount, 15000);

    // Global keyboard shortcut: Cmd+K / Ctrl+K
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [refreshPendingCount]);

  return (
    <CopilotContext.Provider
      value={{
        isOpen,
        openCopilot: () => setIsOpen(true),
        closeCopilot: () => setIsOpen(false),
        toggleCopilot: () => setIsOpen((prev) => !prev),
        pendingCount,
        refreshPendingCount,
      }}
    >
      {children}
    </CopilotContext.Provider>
  );
}

export function useCopilot() {
  const ctx = useContext(CopilotContext);
  if (!ctx) {
    throw new Error('useCopilot must be used within CopilotProvider');
  }
  return ctx;
}
