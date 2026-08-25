'use client';

import React, { useState } from 'react';
import { FileText, X, Plus, Check, Trash2 } from 'lucide-react';

export interface EmailTemplate {
  id: string;
  title: string;
  subject: string;
  body: string;
}

interface EmailTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: EmailTemplate[];
  onSelectTemplate: (template: EmailTemplate) => void;
  onCreateTemplate: (title: string, subject: string, body: string) => void;
  onDeleteTemplate: (id: string) => void;
}

export function EmailTemplatesModal({
  isOpen,
  onClose,
  templates,
  onSelectTemplate,
  onCreateTemplate,
  onDeleteTemplate,
}: EmailTemplatesModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newBody.trim()) return;
    onCreateTemplate(newTitle.trim(), newSubject.trim(), newBody.trim());
    setNewTitle('');
    setNewSubject('');
    setNewBody('');
    setIsCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#f6f8fc] dark:bg-[#28292c] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-800 dark:text-white font-bold text-xs">
            <FileText className="w-4 h-4 text-[#0b57d0] dark:text-purple-400" />
            <span>Email Templates & Canned Responses</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 text-xs">
          {!isCreating ? (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full flex items-center justify-center space-x-2 py-2 rounded-xl bg-[#c2e7ff]/60 hover:bg-[#c2e7ff] text-[#001d35] font-semibold transition-all"
            >
              <Plus className="w-4 h-4 text-[#0b57d0]" />
              <span>Save New Template</span>
            </button>
          ) : (
            <form onSubmit={handleCreate} className="p-3 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 bg-slate-50 dark:bg-slate-900">
              <input
                type="text"
                required
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Template Title (e.g. Meeting Confirmation)"
                className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#141517] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
              <input
                type="text"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="Default Subject (optional)"
                className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#141517] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
              <textarea
                rows={4}
                required
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="Template body message..."
                className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#141517] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white resize-none"
              />
              <div className="flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1 rounded-lg border border-slate-200 text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1 rounded-lg bg-[#0b57d0] text-white font-semibold shadow-xs">
                  Save
                </button>
              </div>
            </form>
          )}

          {/* List of Templates */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
              Saved Templates ({templates.length})
            </span>

            {templates.length === 0 ? (
              <p className="text-slate-400 text-center py-4 text-[11px]">No saved templates available.</p>
            ) : (
              templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-[#0b57d0] dark:hover:border-purple-500 bg-white dark:bg-slate-900 flex items-center justify-between group cursor-pointer transition-all"
                  onClick={() => {
                    onSelectTemplate(tpl);
                    onClose();
                  }}
                >
                  <div className="flex flex-col truncate space-y-0.5 pr-2">
                    <span className="font-bold text-slate-900 dark:text-white text-xs truncate">{tpl.title}</span>
                    {tpl.subject && <span className="text-[10px] text-slate-500 font-mono truncate">{tpl.subject}</span>}
                    <span className="text-[10px] text-slate-400 line-clamp-1 truncate">{tpl.body}</span>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTemplate(tpl.id);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2 py-1 rounded-lg bg-[#c2e7ff] text-[#001d35] font-bold text-[10px]">
                      Insert
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
