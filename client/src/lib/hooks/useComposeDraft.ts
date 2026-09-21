'use client';

import { useEffect, useRef, useState } from 'react';
import type { AccountData } from '@/lib/api';
import type { ComposeAttachment } from '@/lib/inbox/types';
import { STORAGE_KEYS } from '@/lib/inbox/constants';
import type { ShowUndoOptions } from '@/lib/hooks/useUndoToast';
import type { ConfidentialModeConfig } from '@/components/inbox/ConfidentialModeModal';

export interface UseComposeDraftOptions {
  accounts: AccountData[];
  loadData: () => Promise<void>;
  showUndo: (opts: ShowUndoOptions) => void;
}

export interface UseComposeDraftResult {
  showComposeModal: boolean;
  isComposeMinimized: boolean;
  isComposeMaximized: boolean;
  composeFromAccountId: string;
  composeTo: string;
  composeCc: string;
  composeBcc: string;
  showCc: boolean;
  showBcc: boolean;
  composeSubject: string;
  composeBody: string;
  composeFiles: ComposeAttachment[];
  isSendingCompose: boolean;
  isScheduledSendOpen: boolean;
  scheduledSendTime: string | null;
  confidentialConfig: ConfidentialModeConfig | null;
  composeFileInputRef: React.RefObject<HTMLInputElement | null>;
  openCompose: () => void;
  closeCompose: () => void;
  discardDraft: () => void;
  minimize: () => void;
  restore: () => void;
  toggleMaximize: () => void;
  setComposeFromAccountId: (id: string) => void;
  setComposeTo: (value: string) => void;
  setComposeCc: (value: string) => void;
  setComposeBcc: (value: string) => void;
  showCcField: () => void;
  showBccField: () => void;
  setComposeSubject: (value: string) => void;
  setComposeBody: (value: string | ((prev: string) => string)) => void;
  removeComposeFile: (index: number) => void;
  handleComposeFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  toggleScheduledSend: () => void;
  closeScheduledSendMenu: () => void;
  setScheduledSendTime: (label: string) => void;
  setConfidentialConfig: (config: ConfidentialModeConfig | null) => void;
  prefillComposeTo: (email: string) => void;
  dispatchSendComposeWithUndo: () => void;
}

/**
 * Owns the floating compose dock's draft state (fields, attachments, minimize/
 * maximize, scheduled send, confidential mode) plus its "5s undo send", and
 * the compose-draft localStorage persistence that used to live at the page level.
 */
export function useComposeDraft({ accounts, loadData, showUndo }: UseComposeDraftOptions): UseComposeDraftResult {
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [isComposeMinimized, setIsComposeMinimized] = useState(false);
  const [isComposeMaximized, setIsComposeMaximized] = useState(false);
  const [composeFromAccountId, setComposeFromAccountId] = useState('');
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeFiles, setComposeFiles] = useState<ComposeAttachment[]>([]);
  // Never actually set to true -- mirrors the original's dead `isSendingCompose` flag. Preserved as-is.
  const [isSendingCompose] = useState(false);
  const [isScheduledSendOpen, setIsScheduledSendOpen] = useState(false);
  const [scheduledSendTime, setScheduledSendTime] = useState<string | null>(null);
  const [confidentialConfig, setConfidentialConfig] = useState<ConfidentialModeConfig | null>(null);
  const composeFileInputRef = useRef<HTMLInputElement>(null);

  // Default the "from" account to the first connected account once accounts load
  // (mirrors the original's "if (!composeFromAccountId && accData[0])" guard in loadData).
  useEffect(() => {
    if (!composeFromAccountId && accounts[0]) {
      setComposeFromAccountId(accounts[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to accounts arriving
  }, [accounts]);

  // Restore a previously-saved draft from localStorage on mount.
  useEffect(() => {
    const savedDraft = localStorage.getItem(STORAGE_KEYS.composeDraft);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed.to) setComposeTo(parsed.to);
        if (parsed.subject) setComposeSubject(parsed.subject);
        if (parsed.body) setComposeBody(parsed.body);
        if (parsed.fromAccountId) setComposeFromAccountId(parsed.fromAccountId);
      } catch (e) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only restore
  }, []);

  // Auto-save the draft to localStorage as it changes.
  useEffect(() => {
    if (composeTo || composeSubject || composeBody || composeFromAccountId) {
      localStorage.setItem(
        STORAGE_KEYS.composeDraft,
        JSON.stringify({ to: composeTo, subject: composeSubject, body: composeBody, fromAccountId: composeFromAccountId }),
      );
    }
  }, [composeTo, composeSubject, composeBody, composeFromAccountId]);

  const openCompose = () => {
    setShowComposeModal(true);
    setIsComposeMinimized(false);
  };

  const closeCompose = () => setShowComposeModal(false);
  const minimize = () => setIsComposeMinimized(true);
  const restore = () => setIsComposeMinimized(false);
  const toggleMaximize = () => setIsComposeMaximized((prev) => !prev);
  const showCcField = () => setShowCc(true);
  const showBccField = () => setShowBcc(true);
  const toggleScheduledSend = () => setIsScheduledSendOpen((prev) => !prev);
  const closeScheduledSendMenu = () => setIsScheduledSendOpen(false);
  const prefillComposeTo = (email: string) => {
    setComposeTo(email);
    openCompose();
  };

  const discardDraft = () => {
    setShowComposeModal(false);
    setComposeTo('');
    setComposeSubject('');
    setComposeBody('');
    setComposeFiles([]);
    setConfidentialConfig(null);
    localStorage.removeItem(STORAGE_KEYS.composeDraft);
  };

  const removeComposeFile = (index: number) => {
    setComposeFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleComposeFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setComposeFiles((prev) => [
          ...prev,
          { filename: file.name, contentType: file.type || 'application/octet-stream', size: file.size, content },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const dispatchSendComposeWithUndo = () => {
    if (!composeTo || !composeSubject || !composeBody) return;
    const savedTo = composeTo;
    const savedSubject = composeSubject;
    const savedBody = composeBody;
    const savedFiles = composeFiles;
    const savedFromAccountId = composeFromAccountId;
    const savedConfidentialConfig = confidentialConfig;

    setShowComposeModal(false);
    setComposeTo('');
    setComposeSubject('');
    setComposeBody('');
    setComposeFiles([]);
    localStorage.removeItem(STORAGE_KEYS.composeDraft);

    showUndo({
      // NOTE: `scheduledSendTime` is read from the closure captured at this render,
      // matching the original's stale-read behavior where a scheduled-send button
      // sets the label and calls this function in the same synchronous handler
      // (before the state update is visible here). Preserved as-is for parity.
      message: scheduledSendTime ? `Email scheduled for ${scheduledSendTime}.` : 'Message sent.',
      onUndo: () => {
        setComposeTo(savedTo);
        setComposeSubject(savedSubject);
        setComposeBody(savedBody);
        setComposeFiles(savedFiles);
        setShowComposeModal(true);
      },
      onCommit: async () => {
        try {
          const senderAcc = accounts.find((a) => a.id === savedFromAccountId);
          await fetch('/api/emails/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accountId: savedFromAccountId,
              to: savedTo,
              subject: savedSubject,
              body: `${savedBody}\n\n--\nSent from ${senderAcc ? senderAcc.label : 'Gmail Client'}${
                savedConfidentialConfig ? `\n[Confidential Mode Active: ${savedConfidentialConfig.expiration}]` : ''
              }`,
              attachments: savedFiles,
            }),
          });
          await loadData();
        } catch (e) {}
      },
    });
  };

  return {
    showComposeModal,
    isComposeMinimized,
    isComposeMaximized,
    composeFromAccountId,
    composeTo,
    composeCc,
    composeBcc,
    showCc,
    showBcc,
    composeSubject,
    composeBody,
    composeFiles,
    isSendingCompose,
    isScheduledSendOpen,
    scheduledSendTime,
    confidentialConfig,
    composeFileInputRef,
    openCompose,
    closeCompose,
    discardDraft,
    minimize,
    restore,
    toggleMaximize,
    setComposeFromAccountId,
    setComposeTo,
    setComposeCc,
    setComposeBcc,
    showCcField,
    showBccField,
    setComposeSubject,
    setComposeBody,
    removeComposeFile,
    handleComposeFileSelect,
    toggleScheduledSend,
    closeScheduledSendMenu,
    setScheduledSendTime,
    setConfidentialConfig,
    prefillComposeTo,
    dispatchSendComposeWithUndo,
  };
}
