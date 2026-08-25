import React from 'react';
import { Minus, Maximize2, Minimize2, X } from 'lucide-react';

interface ComposeHeaderProps {
  isMinimized: boolean;
  isMaximized: boolean;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
}

export function ComposeHeader({
  isMinimized,
  isMaximized,
  onMinimize,
  onMaximize,
  onClose,
}: ComposeHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 text-white rounded-t-lg select-none">
      <span className="text-xs font-semibold">New Message</span>
      <div className="flex items-center gap-1.5">
        <button onClick={onMinimize} className="p-1 hover:bg-gray-800 rounded">
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button onClick={onMaximize} className="p-1 hover:bg-gray-800 rounded">
          {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
        <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
