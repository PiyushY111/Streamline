'use client';

import { CheckSquare, Square, Star, Flame, Paperclip, Clock, Tag, Trash2 } from 'lucide-react';
import { SenderContactCard } from '@/components/inbox/SenderContactCard';
import { formatEmailDate } from '@/lib/utils';
import { getEmailCategory, detectSmartTopic } from '@/lib/inbox/categorize';
import type { EmailThreadSummary } from '@/lib/inbox/filters';
import type { CustomLabel } from '@/components/inbox/LabelManagerModal';

interface EmailListRowProps {
  email: EmailThreadSummary;
  isSelected: boolean;
  isChecked: boolean;
  assignedLabels: string[];
  customLabels: CustomLabel[];
  onSelect: () => void;
  onToggleCheck: () => void;
  onToggleStar: () => void;
  onFilterBySender: (email: string) => void;
  onComposeToSender: (email: string) => void;
  onSnooze: () => void;
  onOpenLabels: () => void;
  onDelete: () => void;
}

export function EmailListRow({
  email,
  isSelected,
  isChecked,
  assignedLabels,
  customLabels,
  onSelect,
  onToggleCheck,
  onToggleStar,
  onFilterBySender,
  onComposeToSender,
  onSnooze,
  onOpenLabels,
  onDelete,
}: EmailListRowProps) {
  const count = email.messageCount || 1;
  const hasAttachments = email.attachments && email.attachments.length > 0;

  const match = email.sender.match(/^(.*?)\s*<([^>]+)>$/);
  const senderName =
    (match && match[1] ? match[1].replace(/['"]/g, '').trim() : '') || (match && match[2] ? match[2] : email.sender) || email.sender;
  const senderEmail = match && match[2] ? match[2] : email.sender;

  const priority = email.aiPriority || getEmailCategory(email);
  const topic = detectSmartTopic(email);

  return (
    <div
      onClick={onSelect}
      className={`group px-4 py-2.5 flex items-center space-x-3 cursor-pointer transition-all ${
        isSelected
          ? 'bg-[#c2e7ff]/70 text-[#001d35] dark:bg-[#2d3748] dark:text-white'
          : !email.isRead
            ? 'bg-white text-slate-900 font-bold dark:bg-[#1a1b1e] dark:text-white'
            : 'bg-[#f6f8fc]/40 text-slate-700 dark:bg-[#141517] dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/50'
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleCheck();
        }}
        className="text-slate-400 hover:text-slate-600 shrink-0"
      >
        {isChecked ? (
          <CheckSquare className="w-4 h-4 text-[#0b57d0] dark:text-purple-400" />
        ) : (
          <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
        )}
      </button>

      {/* Star Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar();
        }}
        className="text-slate-300 dark:text-slate-600 hover:text-amber-400 shrink-0"
      >
        <Star className={`w-4 h-4 ${email.isStarred ? 'fill-[#f4b400] text-[#f4b400]' : ''}`} />
      </button>

      {/* Sender Contact Card with Popover */}
      <SenderContactCard
        senderName={senderName}
        senderEmail={senderEmail}
        avatarInitial={senderName.charAt(0).toUpperCase()}
        avatarColor={email.accountColor || '#0b57d0'}
        onFilterBySender={onFilterBySender}
        onComposeToSender={onComposeToSender}
      >
        <div className="w-44 shrink-0 flex items-center space-x-1.5 truncate">
          {!email.isRead && <span className="w-2 h-2 rounded-full bg-[#0b57d0] dark:bg-purple-400 shrink-0" />}
          <span
            className={`text-xs truncate ${!email.isRead ? 'font-bold text-slate-900 dark:text-white' : 'font-normal text-slate-700 dark:text-slate-300'}`}
          >
            {senderName}
          </span>
          {count > 1 && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 font-bold">
              {count}
            </span>
          )}
        </div>
      </SenderContactCard>

      {/* Account / Mailbox Label Badge */}
      <span
        className="px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 transition-transform hover:scale-105 shadow-2xs"
        style={{
          backgroundColor: `${email.accountColor || '#0b57d0'}20`,
          color: email.accountColor || '#0b57d0',
          border: `1px solid ${email.accountColor || '#0b57d0'}40`,
        }}
        title={`Belongs to mailbox: ${email.accountName || email.accountEmail || 'Connected Account'}`}
      >
        {email.accountName || email.accountEmail || 'Mailbox'}
      </span>

      {/* Gemini AI Priority Badge */}
      {priority === 'p1_urgent' && (
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 shrink-0 flex items-center space-x-1 shadow-2xs"
          title="Gemini AI: P1 Urgent / Action Required"
        >
          <Flame className="w-2.5 h-2.5 text-rose-500 shrink-0" />
          <span>P1 Action</span>
        </span>
      )}
      {priority === 'p2_important' && (
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 shrink-0 shadow-2xs"
          title="Gemini AI: P2 Direct Conversation"
        >
          P2 Direct
        </span>
      )}
      {priority === 'p3_updates' && (
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0 shadow-2xs"
          title="Gemini AI: P3 Updates / Notifications"
        >
          P3 Updates
        </span>
      )}
      {priority === 'p4_newsletter' && (
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0 shadow-2xs"
          title="Gemini AI: P4 Subscriptions / Newsletters"
        >
          P4 News
        </span>
      )}

      {/* Gemini AI Smart Topic Tag */}
      {topic && (
        <span
          className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 shrink-0 max-w-[120px] truncate shadow-2xs"
          title={`Smart Topic: ${topic}`}
        >
          {topic}
        </span>
      )}

      {/* Gemini AI Action Items Detected */}
      {email.aiExtractedTasks && email.aiExtractedTasks.length > 0 && (
        <span
          className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 shrink-0 shadow-2xs"
          title={`${email.aiExtractedTasks.length} action item(s) detected`}
        >
          {email.aiExtractedTasks.length} Action{email.aiExtractedTasks.length > 1 ? 's' : ''}
        </span>
      )}

      {/* Assigned Custom Labels */}
      {assignedLabels.map((lblId) => {
        const lbl = customLabels.find((l) => l.id === lblId);
        if (!lbl) return null;
        return (
          <span
            key={lbl.id}
            className="px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0"
            style={{ backgroundColor: `${lbl.color}20`, color: lbl.color, border: `1px solid ${lbl.color}40` }}
          >
            {lbl.name}
          </span>
        );
      })}

      {/* Subject + Snippet inline */}
      <div
        className="flex-1 min-w-0 flex items-center space-x-2 truncate text-xs"
        title={email.aiSummary ? `✨ Gemini Summary: ${email.aiSummary}` : undefined}
      >
        <span
          className={`truncate ${!email.isRead ? 'font-bold text-slate-900 dark:text-white' : 'font-normal text-slate-800 dark:text-slate-200'}`}
        >
          {email.subject}
        </span>
        <span className="text-slate-400 font-normal truncate">— {email.snippet}</span>
      </div>

      {/* Attachment indicator */}
      {hasAttachments && (
        <span title="Has attachments">
          <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </span>
      )}

      {/* Timestamp & Hover Quick Actions */}
      <div className="w-32 shrink-0 flex items-center justify-end">
        <span className="group-hover:hidden text-[11px] text-slate-500 dark:text-slate-400 font-mono">
          {formatEmailDate(email.receivedAt)}
        </span>

        <div className="hidden group-hover:flex items-center space-x-1 text-slate-500">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSnooze();
            }}
            className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-amber-500"
            title="Snooze"
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenLabels();
            }}
            className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-purple-500"
            title="Labels"
          >
            <Tag className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-rose-600"
            title="Delete email"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
