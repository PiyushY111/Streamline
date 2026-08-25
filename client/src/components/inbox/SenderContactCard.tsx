'use client';

import React, { useState } from 'react';
import { Mail, Search, MessageSquare, ExternalLink } from 'lucide-react';

interface SenderContactCardProps {
  senderName: string;
  senderEmail: string;
  avatarInitial: string;
  avatarColor?: string;
  onFilterBySender: (email: string) => void;
  onComposeToSender: (email: string) => void;
  children: React.ReactNode;
}

export function SenderContactCard({
  senderName,
  senderEmail,
  avatarInitial,
  avatarColor = '#0b57d0',
  onFilterBySender,
  onComposeToSender,
  children,
}: SenderContactCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {children}

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-72 bg-white dark:bg-[#1e1e1e] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 shadow-2xl animate-in zoom-in-95 duration-150 text-xs">
          {/* Header */}
          <div className="flex items-center space-x-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div
              className="w-11 h-11 rounded-full text-white font-bold flex items-center justify-center text-base shadow-xs shrink-0"
              style={{ backgroundColor: avatarColor }}
            >
              {avatarInitial}
            </div>
            <div className="flex flex-col truncate">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">{senderName}</h4>
              <span className="text-[11px] text-slate-400 font-mono truncate">{senderEmail}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 space-y-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onComposeToSender(senderEmail);
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Mail className="w-3.5 h-3.5 text-[#0b57d0]" />
                <span>Send Email</span>
              </div>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onFilterBySender(senderEmail);
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span>Search threads from sender</span>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
