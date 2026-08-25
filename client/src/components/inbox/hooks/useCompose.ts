import { useState, useRef } from 'react';

export interface ComposeFileAttachment {
  filename: string;
  contentType: string;
  size: number;
  content: string;
}

export function useCompose() {
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [isComposeMinimized, setIsComposeMinimized] = useState(false);
  const [isComposeMaximized, setIsComposeMaximized] = useState(false);
  const [composeFromAccountId, setComposeFromAccountId] = useState<string>('');
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeFiles, setComposeFiles] = useState<ComposeFileAttachment[]>([]);
  const [isSendingCompose, setIsSendingCompose] = useState(false);
  const composeFileInputRef = useRef<HTMLInputElement>(null);

  const resetCompose = () => {
    setComposeTo('');
    setComposeCc('');
    setComposeBcc('');
    setComposeSubject('');
    setComposeBody('');
    setComposeFiles([]);
    setShowComposeModal(false);
  };

  return {
    showComposeModal,
    setShowComposeModal,
    isComposeMinimized,
    setIsComposeMinimized,
    isComposeMaximized,
    setIsComposeMaximized,
    composeFromAccountId,
    setComposeFromAccountId,
    composeTo,
    setComposeTo,
    composeCc,
    setComposeCc,
    composeBcc,
    setComposeBcc,
    showCcBcc,
    setShowCcBcc,
    composeSubject,
    setComposeSubject,
    composeBody,
    setComposeBody,
    composeFiles,
    setComposeFiles,
    isSendingCompose,
    setIsSendingCompose,
    composeFileInputRef,
    resetCompose,
  };
}
