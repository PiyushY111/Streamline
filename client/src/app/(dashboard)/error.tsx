'use client';

import React, { useEffect } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

export default function DashboardErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard Error caught by Streamline Error Boundary:', error);
  }, [error]);

  return (
    <div className="flex-1 h-full min-h-[500px] flex items-center justify-center p-8">
      <div className="max-w-lg w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-5 shadow-lg">
        <div className="w-12 h-12 mx-auto rounded-xl bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
          <AlertCircle className="w-6 h-6" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Dashboard View Error
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            This dashboard view encountered a render issue. Your other workspaces and sidebars remain safe and interactive.
          </p>
          {error?.message && (
            <div className="p-2.5 mt-2 bg-slate-50 dark:bg-slate-800/80 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-300 text-left overflow-x-auto max-h-20">
              {error.message}
            </div>
          )}
        </div>

        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all active:scale-95 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reload This View
        </button>
      </div>
    </div>
  );
}
