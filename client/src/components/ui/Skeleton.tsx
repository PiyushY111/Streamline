'use client';

import React from 'react';

export function Skeleton({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-200/70 dark:bg-slate-800/60 backdrop-blur-sm ${className}`}
      {...props}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-12" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-3 rounded-xl border border-slate-200/40 dark:border-slate-800/40 bg-white/30 dark:bg-slate-900/30 backdrop-blur-sm"
        >
          <Skeleton className="w-9 h-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          <Skeleton className="h-4 w-12 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function GraphSkeleton() {
  return (
    <div className="w-full h-80 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 bg-slate-900/50 backdrop-blur-md flex flex-col items-center justify-center space-y-4 p-6">
      <div className="w-16 h-16 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin" />
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}
