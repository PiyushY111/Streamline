import React from 'react';
import { ComposeHeader } from './ComposeHeader';
import { ComposeForm } from './ComposeForm';
import { ComposeToolbar } from './ComposeToolbar';

interface ComposeModalProps {
  show: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  setIsMinimized: (val: boolean) => void;
  setIsMaximized: (val: boolean) => void;
  onClose: () => void;
  to: string;
  setTo: (val: string) => void;
  subject: string;
  setSubject: (val: string) => void;
  body: string;
  setBody: (val: string) => void;
  onSend: () => void;
  isSending: boolean;
  onOpenTemplates: () => void;
  onOpenConfidential: () => void;
}

export function ComposeModal({
  show,
  isMinimized,
  isMaximized,
  setIsMinimized,
  setIsMaximized,
  onClose,
  to,
  setTo,
  subject,
  setSubject,
  body,
  setBody,
  onSend,
  isSending,
  onOpenTemplates,
  onOpenConfidential,
}: ComposeModalProps) {
  if (!show) return null;

  if (isMinimized) {
    return (
      <div className="fixed bottom-0 right-10 z-50 w-72 bg-gray-900 text-white rounded-t-lg shadow-xl cursor-pointer">
        <ComposeHeader
          isMinimized={true}
          isMaximized={false}
          onMinimize={() => setIsMinimized(false)}
          onMaximize={() => setIsMaximized(true)}
          onClose={onClose}
        />
      </div>
    );
  }

  return (
    <div
      className={`fixed z-50 flex flex-col bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-t-lg shadow-2xl transition-all ${
        isMaximized ? 'inset-6' : 'bottom-0 right-10 w-[540px] h-[480px]'
      }`}
    >
      <ComposeHeader
        isMinimized={false}
        isMaximized={isMaximized}
        onMinimize={() => setIsMinimized(true)}
        onMaximize={() => setIsMaximized(!isMaximized)}
        onClose={onClose}
      />
      <ComposeForm to={to} setTo={setTo} subject={subject} setSubject={setSubject} body={body} setBody={setBody} />
      <ComposeToolbar
        onSend={onSend}
        isSending={isSending}
        onOpenTemplates={onOpenTemplates}
        onOpenConfidential={onOpenConfidential}
      />
    </div>
  );
}
