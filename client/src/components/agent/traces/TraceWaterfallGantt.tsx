import React from 'react';
import { OTelSpanData } from '@/lib/api';

interface TraceWaterfallGanttProps {
  waterfallSpans: OTelSpanData[];
  maxWaterfallDuration: number;
}

export const TraceWaterfallGantt: React.FC<TraceWaterfallGanttProps> = ({ waterfallSpans, maxWaterfallDuration }) => {
  return (
    <div className="p-4 rounded-2xl bg-white/80 dark:bg-[#0B101D]/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-xs space-y-4">
      <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-200 dark:border-slate-800">
        <span className="font-semibold">Execution Span Hierarchy</span>
        <span className="font-mono">Time Window: 0ms → {maxWaterfallDuration}ms</span>
      </div>

      <div className="space-y-3">
        {waterfallSpans.map((span) => {
          const startPercent = (span.startTimeMs / maxWaterfallDuration) * 100;
          const widthPercent = Math.max((span.durationMs / maxWaterfallDuration) * 100, 2);

          let barColor = 'bg-indigo-500';
          if (span.statusCode === 'INTERCEPTED') barColor = 'bg-rose-500';
          else if (span.name.includes('memory')) barColor = 'bg-purple-500';
          else if (span.name.includes('tool')) barColor = 'bg-amber-500';
          else if (span.name.includes('generate')) barColor = 'bg-emerald-500';

          return (
            <div key={span.spanId} className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-800 dark:text-slate-200 font-semibold truncate max-w-md">{span.name}</span>
                <span className="text-slate-400">
                  {span.startTimeMs}ms (+{span.durationMs}ms)
                </span>
              </div>

              {/* Horizontal Waterfall Bar */}
              <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800/80 overflow-hidden relative">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{
                    marginLeft: `${Math.min(startPercent, 95)}%`,
                    width: `${Math.min(widthPercent, 100 - startPercent)}%`,
                  }}
                  title={`${span.name}: ${span.durationMs}ms`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TraceWaterfallGantt;
