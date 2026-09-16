import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function MiniCalendar() {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const todayDate = new Date().getDate();

  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between mb-3 text-xs font-semibold text-gray-900 dark:text-gray-100">
        <span>August 2026</span>
        <div className="flex items-center gap-1">
          <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] text-gray-500 font-medium mb-1">
        <span>S</span>
        <span>M</span>
        <span>T</span>
        <span>W</span>
        <span>T</span>
        <span>F</span>
        <span>S</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {days.map((d) => (
          <button
            key={d}
            className={`p-1 rounded-full text-xs hover:bg-gray-100 dark:hover:bg-gray-800 ${
              d === todayDate
                ? 'bg-blue-600 text-white font-bold hover:bg-blue-700'
                : 'text-gray-700 dark:text-gray-300'
            }`}
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}
