'use client';

import React, { useState } from 'react';
import { Tag, X, Plus, Check } from 'lucide-react';

export interface CustomLabel {
  id: string;
  name: string;
  color: string;
}

interface LabelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  labels: CustomLabel[];
  onCreateLabel: (name: string, color: string) => void;
  onToggleLabelOnEmail?: (labelId: string) => void;
  assignedLabelIds?: string[];
}

const COLOR_PALETTE = [
  '#ef4444', // Red / Urgent
  '#f97316', // Orange / Finance
  '#3b82f6', // Blue / Work
  '#8b5cf6', // Purple / Personal
  '#10b981', // Green / Travel
  '#ec4899', // Pink
];

export function LabelManagerModal({
  isOpen,
  onClose,
  labels,
  onCreateLabel,
  onToggleLabelOnEmail,
  assignedLabelIds = [],
}: LabelManagerModalProps) {
  const [newLabelName, setNewLabelName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0] ?? '#3b82f6');
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabelName.trim()) return;
    onCreateLabel(newLabelName.trim(), selectedColor);
    setNewLabelName('');
    setIsCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#f6f8fc] dark:bg-[#28292c] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-800 dark:text-white font-bold text-xs">
            <Tag className="w-4 h-4 text-[#0b57d0] dark:text-purple-400" />
            <span>Manage Custom Labels</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 text-xs">
          {/* Create New Label Bar */}
          {!isCreating ? (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full flex items-center justify-center space-x-2 py-2 rounded-xl bg-[#c2e7ff]/60 hover:bg-[#c2e7ff] text-[#001d35] font-semibold transition-all"
            >
              <Plus className="w-4 h-4 text-[#0b57d0]" />
              <span>Create New Label</span>
            </button>
          ) : (
            <form onSubmit={handleCreate} className="p-3 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 bg-slate-50 dark:bg-slate-900">
              <input
                type="text"
                required
                autoFocus
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                placeholder="Label name (e.g. Work, Finance)"
                className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#141517] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#0b57d0]"
              />

              <div className="flex items-center space-x-2">
                <span className="text-[10px] text-slate-400 font-semibold">Color:</span>
                <div className="flex items-center space-x-1.5">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      className={`w-5 h-5 rounded-full border transition-all ${
                        selectedColor === c ? 'ring-2 ring-[#0b57d0] scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1 rounded-lg border border-slate-200 text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1 rounded-lg bg-[#0b57d0] text-white font-semibold shadow-xs"
                >
                  Save Label
                </button>
              </div>
            </form>
          )}

          {/* Labels List */}
          <div className="space-y-1.5 max-h-56 overflow-y-auto">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
              Your Labels ({labels.length})
            </span>

            {labels.length === 0 ? (
              <p className="text-slate-400 text-center py-4 text-[11px]">No custom labels created yet.</p>
            ) : (
              labels.map((lbl) => {
                const isAssigned = assignedLabelIds.includes(lbl.id);
                return (
                  <div
                    key={lbl.id}
                    onClick={() => onToggleLabelOnEmail && onToggleLabelOnEmail(lbl.id)}
                    className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: lbl.color }} />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{lbl.name}</span>
                    </div>

                    {onToggleLabelOnEmail && (
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${isAssigned ? 'bg-[#0b57d0] border-[#0b57d0] text-white' : 'border-slate-300'}`}>
                        {isAssigned && <Check className="w-3 h-3" />}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
