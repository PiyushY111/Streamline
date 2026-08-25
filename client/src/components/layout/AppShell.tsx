'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isFullBleed = pathname === '/inbox' || pathname === '/calendar';

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-[#090D16] flex text-slate-900 dark:text-slate-100 selection:bg-purple-500/20 selection:text-purple-900 dark:selection:text-purple-200 transition-colors duration-200">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header - Hidden on Inbox for pure full-bleed Gmail layout */}
        {!isFullBleed && <Header />}

        {/* Viewport Content */}
        <main
          className={
            isFullBleed
              ? 'flex-1 flex flex-col h-full overflow-hidden min-h-0'
              : 'flex-1 p-6 overflow-y-auto max-w-7xl w-full mx-auto'
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}

