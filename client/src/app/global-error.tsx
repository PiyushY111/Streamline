'use client';

import React, { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global Layout Error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-slate-900 text-white min-h-screen flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-12 h-12 mx-auto rounded-xl bg-red-950/80 border border-red-800 text-red-400 flex items-center justify-center font-bold text-xl">
            !
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold">Application Error</h2>
            <p className="text-sm text-slate-400">
              A critical error occurred in the application root. Click below to recover.
            </p>
          </div>
          <button
            onClick={() => reset()}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm transition-all"
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
