'use client';

import { Paperclip, File, Download } from 'lucide-react';
import { SenderContactCard } from '@/components/inbox/SenderContactCard';
import { SanitizedEmailBody } from '@/components/inbox/thread/SanitizedEmailBody';
import { formatFileSize } from '@/lib/inbox/format';
import type { EmailData } from '@/lib/api';

interface ThreadAttachment {
  filename: string;
  mimeType?: string;
  size?: number;
  content?: string;
}

function parseAttachments(raw: unknown): ThreadAttachment[] {
  try {
    if (Array.isArray(raw)) return raw as ThreadAttachment[];
    if (typeof raw === 'string') return JSON.parse(raw);
  } catch (e) {
    // fall through to empty list
  }
  return [];
}

interface ThreadMessageCardProps {
  message: EmailData;
  onFilterBySender: (email: string) => void;
  onComposeToSender: (email: string) => void;
}

export function ThreadMessageCard({ message: msg, onFilterBySender, onComposeToSender }: ThreadMessageCardProps) {
  const match = msg.sender.match(/^(.*?)\s*<([^>]+)>$/);
  const senderName =
    (match && match[1] ? match[1].replace(/['"]/g, '').trim() : '') || (match && match[2] ? match[2] : msg.sender) || msg.sender;
  const senderEmail = match && match[2] ? match[2] : msg.sender;
  const recipientClean = msg.recipients.replace(/[<>]/g, '');
  const attachmentsList = parseAttachments(msg.attachments);

  return (
    <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#1a1b1e] space-y-4 shadow-xs">
      {/* Sender info */}
      <div className="flex items-center justify-between">
        <SenderContactCard
          senderName={senderName}
          senderEmail={senderEmail}
          avatarInitial={senderName.charAt(0).toUpperCase()}
          avatarColor={msg.accountColor || '#0b57d0'}
          onFilterBySender={onFilterBySender}
          onComposeToSender={onComposeToSender}
        >
          <div className="flex items-center space-x-3 cursor-pointer">
            <div className="h-10 w-10 rounded-full bg-[#0b57d0] dark:bg-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0">
              {senderName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{senderName}</h3>
                <span className="text-xs text-slate-500">&lt;{senderEmail}&gt;</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">to me ({recipientClean})</div>
            </div>
          </div>
        </SenderContactCard>

        <span className="text-xs text-slate-400 font-mono">
          {new Date(msg.receivedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      </div>

      {/* Email HTML / Plain Text Body */}
      <div className="pt-2 text-slate-800 dark:text-slate-200 text-sm leading-relaxed">
        {msg.bodyHtml || msg.bodyText ? (
          <SanitizedEmailBody html={msg.bodyHtml} text={msg.bodyText} />
        ) : msg.snippet && msg.snippet !== '(No content snippet)' ? (
          <div className="whitespace-pre-wrap font-sans text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
            {msg.snippet}
          </div>
        ) : (
          <div className="text-xs text-slate-400 italic py-2">(No content in this message body)</div>
        )}
      </div>

      {/* Attachments */}
      {attachmentsList.length > 0 && (
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <Paperclip className="w-4 h-4 text-[#0b57d0]" />
            <span>
              {attachmentsList.length} Attachment{attachmentsList.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="flex flex-wrap gap-3">
            {attachmentsList.map((att, attIdx) => (
              <div
                key={attIdx}
                className="flex items-center space-x-2.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs shadow-2xs"
              >
                <File className="w-4 h-4 text-[#0b57d0] shrink-0" />
                <div className="flex flex-col truncate max-w-[160px]">
                  <span className="font-semibold text-slate-900 dark:text-white truncate">{att.filename}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{formatFileSize(att.size || 0)}</span>
                </div>
                {att.content && (
                  <a
                    href={att.content}
                    download={att.filename}
                    className="p-1 rounded-lg bg-blue-50 dark:bg-purple-900/40 text-[#0b57d0] hover:bg-blue-100 transition-colors shrink-0"
                    title="Download"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
