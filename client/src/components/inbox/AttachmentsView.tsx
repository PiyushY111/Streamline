'use client';

import React from 'react';
import { Paperclip, File, Download, ExternalLink, FileText, Image as ImageIcon, Archive } from 'lucide-react';
import { EmailData } from '@/lib/api';

interface AttachmentsViewProps {
  emails: EmailData[];
  onJumpToEmail: (email: EmailData) => void;
}

export function AttachmentsView({ emails, onJumpToEmail }: AttachmentsViewProps) {
  // Gather all attachments from all emails
  const allAttachments: Array<{
    email: EmailData;
    filename: string;
    mimeType?: string;
    size?: number;
    content?: string;
  }> = [];

  emails.forEach((email) => {
    try {
      const rawAtt = (email as any).attachments;
      let list: Array<any> = [];
      if (Array.isArray(rawAtt)) list = rawAtt;
      else if (typeof rawAtt === 'string') list = JSON.parse(rawAtt);

      list.forEach((att) => {
        allAttachments.push({
          email,
          filename: att.filename || 'attachment',
          mimeType: att.contentType || att.mimeType,
          size: att.size || 0,
          content: att.content,
        });
      });
    } catch (e) {}
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
      return <ImageIcon className="w-5 h-5 text-emerald-500" />;
    } else if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) {
      return <FileText className="w-5 h-5 text-[#0b57d0]" />;
    } else if (['zip', 'tar', 'gz', 'rar'].includes(ext)) {
      return <Archive className="w-5 h-5 text-amber-500" />;
    }
    return <File className="w-5 h-5 text-purple-500" />;
  };

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-[#141517] overflow-hidden min-h-0">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-[#f6f8fc]/40 dark:bg-[#1a1b1e]">
        <div className="flex items-center space-x-3">
          <Paperclip className="w-5 h-5 text-[#0b57d0] dark:text-purple-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Inbox Attachment Center ({allAttachments.length})
          </h2>
        </div>
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        {allAttachments.length === 0 ? (
          <div className="p-16 text-center space-y-3 my-auto">
            <Paperclip className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">No attachments found</h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              There are no files attached to emails in your current inbox.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {allAttachments.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 shadow-xs hover:shadow-md transition-all group flex flex-col justify-between"
              >
                <div className="flex items-start space-x-3">
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
                    {getFileIcon(item.filename)}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate" title={item.filename}>
                      {item.filename}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {formatFileSize(item.size || 0)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                  <div className="text-[10px] text-slate-400 truncate">
                    From:{' '}
                    <span className="text-slate-700 dark:text-slate-300 font-medium truncate">{item.email.sender}</span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => onJumpToEmail(item.email)}
                      className="text-[10px] text-[#0b57d0] dark:text-purple-400 hover:underline flex items-center space-x-1 font-semibold"
                    >
                      <span>Jump to email</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>

                    {item.content && (
                      <a
                        href={item.content}
                        download={item.filename}
                        className="p-1.5 rounded-lg bg-blue-50 dark:bg-purple-900/40 text-[#0b57d0] hover:bg-blue-100 transition-colors"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
