'use client';

import { useEffect, useRef, useState } from 'react';
import type { EmailData } from '@/lib/api';
import type { ComposeAttachment } from '@/lib/inbox/types';
import type { ShowUndoOptions } from '@/lib/hooks/useUndoToast';

export interface UseReplyDrafterOptions {
  selectedEmail: EmailData | undefined;
  currentThreadMessages: EmailData[];
  loadData: () => Promise<void>;
  showUndo: (opts: ShowUndoOptions) => void;
}

export interface UseReplyDrafterResult {
  isReplying: boolean;
  replyMode: 'reply' | 'forward';
  replyText: string;
  replyFiles: ComposeAttachment[];
  isSendingReply: boolean;
  replyFileInputRef: React.RefObject<HTMLInputElement | null>;
  startReply: (mode: 'reply' | 'forward') => void;
  cancelReply: () => void;
  /** Appends (or seeds) the draft with AI-generated text and opens the reply box, without changing reply/forward mode. */
  insertAiDraft: (draftText: string) => void;
  setReplyText: (text: string) => void;
  removeReplyFile: (index: number) => void;
  handleReplyFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  dispatchSendReplyWithUndo: () => void;
}

/**
 * Owns the inline reply/forward box's draft state and its "5s undo send".
 * Resets whenever the selected email changes, matching the original
 * page-level effect that reset isReplying on selectedEmailId change.
 */
export function useReplyDrafter({
  selectedEmail,
  currentThreadMessages,
  loadData,
  showUndo,
}: UseReplyDrafterOptions): UseReplyDrafterResult {
  const [isReplying, setIsReplying] = useState(false);
  const [replyMode, setReplyMode] = useState<'reply' | 'forward'>('reply');
  const [replyText, setReplyText] = useState('');
  const [replyFiles, setReplyFiles] = useState<ComposeAttachment[]>([]);
  // Never actually set to true -- mirrors the original's dead `isSendingReply` flag
  // (the send is fire-and-forget behind the 5s undo timer). Preserved as-is for a pure refactor.
  const [isSendingReply] = useState(false);
  const replyFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsReplying(false);
  }, [selectedEmail?.id]);

  const startReply = (mode: 'reply' | 'forward') => {
    setIsReplying(true);
    setReplyMode(mode);
  };

  const cancelReply = () => {
    setIsReplying(false);
    setReplyText('');
    setReplyFiles([]);
  };

  const insertAiDraft = (draftText: string) => {
    setIsReplying(true);
    setReplyText((prev) => (prev ? `${prev}\n\n${draftText}` : draftText));
  };

  const removeReplyFile = (index: number) => {
    setReplyFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReplyFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setReplyFiles((prev) => [
          ...prev,
          { filename: file.name, contentType: file.type || 'application/octet-stream', size: file.size, content },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const dispatchSendReplyWithUndo = () => {
    if (!selectedEmail || !replyText.trim()) return;
    const bodyToSend = `${replyText}\n\n--\nSent from ${selectedEmail.accountName}`;
    const savedText = replyText;
    const savedFiles = replyFiles;
    const savedMode = replyMode;

    setReplyText('');
    setReplyFiles([]);
    setIsReplying(false);

    showUndo({
      message: 'Reply queued for sending.',
      onUndo: () => {
        setReplyText(savedText);
        setReplyFiles(savedFiles);
        setIsReplying(true);
      },
      onCommit: async () => {
        try {
          const lastMsg =
            currentThreadMessages.length > 0
              ? currentThreadMessages[currentThreadMessages.length - 1] || selectedEmail
              : selectedEmail;
          const rawSender = lastMsg?.sender || selectedEmail.sender;
          const senderSplit = rawSender.includes('<') ? rawSender.split('<')[1] : null;
          const recipient = senderSplit ? senderSplit.replace('>', '') : rawSender;
          await fetch('/api/emails/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accountId: selectedEmail.accountId,
              to: recipient,
              subject:
                savedMode === 'reply'
                  ? `Re: ${selectedEmail.subject.replace(/^Re:\s*/i, '')}`
                  : `Fwd: ${selectedEmail.subject}`,
              body: bodyToSend,
              threadId: selectedEmail.threadId,
              attachments: savedFiles,
            }),
          });
          await loadData();
        } catch (e) {}
      },
    });
  };

  return {
    isReplying,
    replyMode,
    replyText,
    replyFiles,
    isSendingReply,
    replyFileInputRef,
    startReply,
    cancelReply,
    insertAiDraft,
    setReplyText,
    removeReplyFile,
    handleReplyFileSelect,
    dispatchSendReplyWithUndo,
  };
}
