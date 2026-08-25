import React from 'react';
import { Square, CheckSquare, RefreshCw, Trash2, Mail, MailOpen, Columns, List, Rows } from 'lucide-react';

interface InboxToolbarProps {
  selectedCount: number;
  totalCount: number;
  onToggleSelectAll: () => void;
  onRefresh: () => void;
  onDeleteSelected: () => void;
  viewMode: 'list' | 'split' | 'bottom';
  setViewMode: (mode: 'list' | 'split' | 'bottom') => void;
}

export function InboxToolbar({
  selectedCount,
  totalCount,
  onToggleSelectAll,
  onRefresh,
  onDeleteSelected,
  viewMode,
  setViewMode,
}: InboxToolbarProps) {
  const isAllSelected = selectedCount > 0 && selectedCount === totalCount;

  return (
    <div className="flex items-center justify-between px-6 py-2.5 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400">
      <div className="flex items-center gap-4">
        <button onClick={onToggleSelectAll} className="flex items-center gap-1.5 hover:text-gray-900 dark:hover:text-gray-200">
          {isAllSelected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
        </button>

        <button onClick={onRefresh} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>

        {selectedCount > 0 && (
          <div className="flex items-center gap-2 border-l border-gray-300 dark:border-gray-700 pl-4 animate-in fade-in">
            <span className="font-medium text-gray-900 dark:text-gray-100">{selectedCount} selected</span>
            <button onClick={onDeleteSelected} className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded" title="Delete">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md p-0.5">
        <button
          onClick={() => setViewMode('list')}
          className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-gray-100 dark:bg-gray-800 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          title="No Split View"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onClick={() => setViewMode('split')}
          className={`p-1.5 rounded ${viewMode === 'split' ? 'bg-gray-100 dark:bg-gray-800 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          title="Vertical Split View"
        >
          <Columns className="w-4 h-4" />
        </button>
        <button
          onClick={() => setViewMode('bottom')}
          className={`p-1.5 rounded ${viewMode === 'bottom' ? 'bg-gray-100 dark:bg-gray-800 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          title="Horizontal Split View"
        >
          <Rows className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
