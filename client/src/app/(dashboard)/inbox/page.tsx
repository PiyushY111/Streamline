'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Inbox as InboxIcon,
  Star,
  Clock,
  Send,
  FileText,
  Trash2,
  Tag,
  AlertOctagon,
  RefreshCw,
  Search,
  Square,
  CheckSquare,
  Paperclip,
  ArrowLeft,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Users,
  Minus,
  Maximize2,
  Minimize2,
  Download,
  File,
  Pencil,
  Columns,
  List,
  SlidersHorizontal,
  Mail,
  MailOpen,
  Printer,
  CornerUpLeft,
  CornerUpRight,
  Undo2,
  Calendar as CalendarIcon,
  Plus,
  Bookmark,
  Check,
  Lock,
  Rows,
  ShieldAlert,
  FolderInput,
  Settings as SettingsIcon,
  Flame,
  Sparkles,
} from 'lucide-react';

import {
  fetchEmails,
  fetchConnectedAccounts,
  markEmailAsReadApi,
  toggleStarEmailApi,
  deleteEmailApi,
  sendEmailApi,
  triggerSyncApi,
  updateEmailCategoryApi,
  fetchEmailByIdApi,
  EmailData,
  AccountData,
} from '@/lib/api';
import { safeFetch } from '@/lib/api/client';

import { SanitizedEmailBody } from '@/components/inbox/thread/SanitizedEmailBody';
import { formatEmailDate } from '@/lib/utils';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { AdvancedSearchModal, SearchFilterState } from '@/components/inbox/AdvancedSearchModal';
import { SnoozeModal } from '@/components/inbox/SnoozeModal';
import { LabelManagerModal, CustomLabel } from '@/components/inbox/LabelManagerModal';
import { WorkspaceRightPanel } from '@/components/inbox/WorkspaceRightPanel';
import { EmailTemplatesModal, EmailTemplate } from '@/components/inbox/EmailTemplatesModal';
import { ConfidentialModeModal, ConfidentialModeConfig } from '@/components/inbox/ConfidentialModeModal';
import { SenderContactCard } from '@/components/inbox/SenderContactCard';
import { AttachmentsView } from '@/components/inbox/AttachmentsView';
import { GmailSettingsModal, GmailAppSettings } from '@/components/inbox/GmailSettingsModal';
import { AiReplyDrafterModal } from '@/components/inbox/AiReplyDrafterModal';
import { useCopilot } from '@/providers/CopilotContext';
import { PendingActionsBanner } from '@/components/agent/PendingActionsBanner';

function InboxContent() {
  const { openCopilot, pendingCount } = useCopilot();
  const searchParams = useSearchParams();
  const urlEmailId = searchParams.get('id');

  const [emails, setEmails] = useState<EmailData[]>([]);
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'starred' | 'snoozed' | 'sent' | 'drafts' | 'trash' | 'attachments'>('inbox');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string | 'all'>('all');

  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(urlEmailId);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmailIds, setSelectedEmailIds] = useState<string[]>([]);
  
  // View mode: 'list' (Full table), 'split' (Right 2-pane), or 'bottom' (Bottom horizontal split)
  const [viewMode, setViewMode] = useState<'list' | 'split' | 'bottom'>('list');
  const [isReadingThread, setIsReadingThread] = useState(Boolean(urlEmailId));

  // Modals & Productivity State
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<SearchFilterState | null>(null);

  const [isSnoozeModalOpen, setIsSnoozeModalOpen] = useState(false);
  const [snoozeTargetEmailId, setSnoozeTargetEmailId] = useState<string | null>(null);
  const [snoozedMetaMap, setSnoozedMetaMap] = useState<Record<string, string>>({});
  const [isAiDraftModalOpen, setIsAiDraftModalOpen] = useState(false);
  const [isAutoLabeling, setIsAutoLabeling] = useState(false);



  const [customLabels, setCustomLabels] = useState<CustomLabel[]>([
    { id: 'lbl-1', name: 'Work', color: '#3b82f6' },
    { id: 'lbl-2', name: 'Finance', color: '#f97316' },
    { id: 'lbl-3', name: 'Urgent', color: '#ef4444' },
  ]);
  const [emailLabelsMap, setEmailLabelsMap] = useState<Record<string, string[]>>({});
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [labelTargetEmailId, setLabelTargetEmailId] = useState<string | null>(null);
  const [selectedCustomLabelFilter, setSelectedCustomLabelFilter] = useState<string | 'all'>('all');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  // Email Templates State
  const [savedTemplates, setSavedTemplates] = useState<EmailTemplate[]>([
    { id: 'tpl-1', title: 'Meeting Confirmation', subject: 'Confirmed: Meeting Schedule', body: 'Hi,\n\nThanks for reaching out! This email confirms our upcoming meeting.\n\nBest regards,' },
    { id: 'tpl-2', title: 'Project Status Update', subject: 'Project Status & Milestones', body: 'Hi team,\n\nHere is a quick status update on our ongoing project deliverables.\n\nBest,' },
  ]);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);

  // Confidential Mode State
  const [isConfidentialModalOpen, setIsConfidentialModalOpen] = useState(false);
  const [confidentialConfig, setConfidentialConfig] = useState<ConfidentialModeConfig | null>(null);

  // Gmail Settings State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<GmailAppSettings>({
    undoSendSeconds: 5,
    defaultReplyMode: 'reply',
    vacationResponderActive: false,
    vacationSubject: 'Out of Office',
    vacationMessage: 'I am currently away on vacation.',
    notificationsEnabled: true,
    defaultPageSize: 50,
    keyboardShortcutsEnabled: true,
    readingPaneLayout: 'list',
    enabledCategories: { primary: true, promotions: true, social: true, updates: true },
  });

  // Undo Send Toast State
  const [undoToast, setUndoToast] = useState<{ active: boolean; message: string; countdown: number; onUndo: () => void } | null>(null);
  const undoTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Scheduled Send state in Compose
  const [isScheduledSendOpen, setIsScheduledSendOpen] = useState(false);
  const [scheduledSendTime, setScheduledSendTime] = useState<string | null>(null);

  // Floating Compose modal state
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [isComposeMinimized, setIsComposeMinimized] = useState(false);
  const [isComposeMaximized, setIsComposeMaximized] = useState(false);
  const [iframeHeights, setIframeHeights] = useState<Record<string, number>>({});

  // File input refs
  const composeFileInputRef = useRef<HTMLInputElement>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);

  // Inline Reply / Forward state
  const [isReplying, setIsReplying] = useState(false);
  const [replyMode, setReplyMode] = useState<'reply' | 'forward'>('reply');
  const [replyText, setReplyText] = useState('');
  const [replyFiles, setReplyFiles] = useState<Array<{ filename: string; contentType: string; size: number; content: string }>>([]);
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Compose modal state
  const [composeFromAccountId, setComposeFromAccountId] = useState<string>('');
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeFiles, setComposeFiles] = useState<Array<{ filename: string; contentType: string; size: number; content: string }>>([]);
  const [isSendingCompose, setIsSendingCompose] = useState(false);

  // Pagination state (50 items per page like Gmail)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Restore Drafts & Custom Labels from localStorage
  useEffect(() => {
    const savedDraft = localStorage.getItem('gmail_compose_draft');
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed.to) setComposeTo(parsed.to);
        if (parsed.subject) setComposeSubject(parsed.subject);
        if (parsed.body) setComposeBody(parsed.body);
        if (parsed.fromAccountId) setComposeFromAccountId(parsed.fromAccountId);
      } catch (e) {}
    }

    const savedLabels = localStorage.getItem('gmail_custom_labels');
    if (savedLabels) {
      try {
        setCustomLabels(JSON.parse(savedLabels));
      } catch (e) {}
    }

    const savedEmailLabels = localStorage.getItem('gmail_email_labels_map');
    if (savedEmailLabels) {
      try {
        setEmailLabelsMap(JSON.parse(savedEmailLabels));
      } catch (e) {}
    }
  }, []);

  // Auto-save compose draft to localStorage
  useEffect(() => {
    if (composeTo || composeSubject || composeBody || composeFromAccountId) {
      localStorage.setItem('gmail_compose_draft', JSON.stringify({ to: composeTo, subject: composeSubject, body: composeBody, fromAccountId: composeFromAccountId }));
    }
  }, [composeTo, composeSubject, composeBody, composeFromAccountId]);

  const updateEmailsState = (incoming: EmailData[]) => {
    setEmails((prev) => {
      const prevMap = new Map(prev.map((e) => [e.id, e]));
      return incoming.map((item) => {
        const existing = prevMap.get(item.id);
        if (existing) {
          return {
            ...item,
            bodyHtml: existing.bodyHtml || item.bodyHtml,
            bodyText: existing.bodyText || item.bodyText,
            attachments: existing.attachments || item.attachments,
          };
        }
        return item;
      });
    });
  };

  const loadData = async (forceSync: boolean = false) => {
    try {
      setLoading(true);
      if (forceSync) {
        await triggerSyncApi();
      }
      const [emailData, accData] = await Promise.all([fetchEmails(), fetchConnectedAccounts()]);
      updateEmailsState(emailData);
      setAccounts(accData);
      if (emailData.length > 0 && !selectedEmailId) {
        setSelectedEmailId(emailData[0].id);
      }
      if (accData.length > 0 && !composeFromAccountId) {
        setComposeFromAccountId(accData[0].id);
      }
    } catch (err) {
      console.warn('Failed to load inbox data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial load with live sync to pull latest incoming emails
    loadData(true);

    // Auto-polling interval every 15 seconds to automatically receive incoming emails
    const pollInterval = setInterval(() => {
      fetchEmails().then((emailData) => {
        if (emailData.length > 0) updateEmailsState(emailData);
      }).catch(() => {});
    }, 15000);

    return () => {
      clearInterval(pollInterval);
      if (undoTimerRef.current) {
        clearInterval(undoTimerRef.current);
      }
    };
  }, []);


  // Automatically fetch full HTML body for all messages in current thread if missing
  useEffect(() => {
    if (!selectedEmailId) return;
    const target = emails.find((e) => e.id === selectedEmailId);
    if (!target) return;

    // Find all messages in the selected thread that lack full body
    const threadMsgsToFetch = emails.filter(
      (e) => e.threadId === target.threadId && !e.bodyHtml && !e.bodyText
    );

    if (threadMsgsToFetch.length === 0) return;

    threadMsgsToFetch.forEach((msg) => {
      fetchEmailByIdApi(msg.id)
        .then((full) => {
          if (full) {
            setEmails((prev) =>
              prev.map((e) => (e.id === msg.id ? { ...e, ...full } : e))
            );
          }
        })
        .catch((err) => console.warn('Failed to auto-fetch full email details:', err));
    });
  }, [selectedEmailId, emails]);


  // Sync selected email and thread view when URL query 'id' changes or on initial load
  useEffect(() => {
    if (urlEmailId && emails.length > 0) {
      const targetEmail = emails.find((e) => e.id === urlEmailId);
      if (targetEmail) {
        setSelectedEmailId(targetEmail.id);
        setIsReadingThread(true);
      }
    } else if (!urlEmailId && viewMode === 'list') {
      setIsReadingThread(false);
    }
  }, [urlEmailId, emails, viewMode]);

  // Reset modal state whenever user switches emails
  useEffect(() => {
    setIsAiDraftModalOpen(false);
    setIsReplying(false);
  }, [selectedEmailId]);


  // Handle browser Back / Forward popstate history buttons
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      if (id) {
        setSelectedEmailId(id);
        setIsReadingThread(true);
      } else if (viewMode === 'list') {
        setIsReadingThread(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [viewMode]);

  // Listen for iframe height adjustments
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.frameId && typeof event.data.height === 'number') {
        const newH = Math.ceil(event.data.height);
        setIframeHeights((prev) => {
          if (!prev[event.data.frameId] || Math.abs(prev[event.data.frameId] - newH) > 4) {
            return { ...prev, [event.data.frameId]: newH };
          }
          return prev;
        });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const getEmailCategory = (email: EmailData): string => {
    if (email.aiPriority) {
      if (email.aiPriority === 'p1_urgent') return 'p1_urgent';
      if (email.aiPriority === 'p2_important') return 'p2_important';
      if (email.aiPriority === 'p3_updates') return 'p3_updates';
      if (email.aiPriority === 'p4_newsletter') return 'p4_newsletter';
      if (email.aiPriority === 'p5_low') return 'p4_newsletter';
    }

    const cat = (email.category || '').toLowerCase();
    if (cat === 'promotions') return 'p4_newsletter';
    if (cat === 'social') return 'p3_updates';
    if (cat === 'updates') return 'p3_updates';

    const senderLower = email.sender.toLowerCase();
    const subjectLower = email.subject.toLowerCase();

    if (
      senderLower.includes('newsletter') ||
      senderLower.includes('substack') ||
      senderLower.includes('digest') ||
      senderLower.includes('marketing')
    ) {
      return 'p4_newsletter';
    }

    if (
      senderLower.includes('noreply') ||
      senderLower.includes('notification') ||
      subjectLower.includes('receipt') ||
      subjectLower.includes('invoice') ||
      subjectLower.includes('security')
    ) {
      return 'p3_updates';
    }

    if (
      subjectLower.includes('urgent') ||
      subjectLower.includes('action required') ||
      subjectLower.includes('asap')
    ) {
      return 'p1_urgent';
    }

    return 'p2_important';
  };


  // Filter emails by active folder, category tab, account label, custom label, search query, and advanced filters
  const filteredEmails = emails.filter((email) => {
    // Account / Mailbox Label filter
    if (selectedAccountFilter !== 'all' && email.accountId !== selectedAccountFilter) {
      return false;
    }

    // Custom Label filter
    if (selectedCustomLabelFilter !== 'all') {
      const assigned = emailLabelsMap[email.id] || [];
      if (!assigned.includes(selectedCustomLabelFilter)) return false;
    }

    // Folder filter
    if (activeFolder === 'starred') {
      if (!email.isStarred) return false;
    } else if (activeFolder === 'sent') {
      if ((email as any).folder !== 'sent' && !email.sender.includes('@gmail.com')) return false;
    } else if (activeFolder === 'drafts') {
      if ((email as any).folder !== 'drafts') return false;
    } else if (activeFolder === 'trash') {
      if ((email as any).folder !== 'trash') return false;
    } else if (activeFolder === 'snoozed') {
      if ((email as any).folder !== 'snoozed' && !snoozedMetaMap[email.id]) return false;
    } else if (activeFolder === 'inbox') {
      if ((email as any).folder && (email as any).folder !== 'inbox') return false;
    }

    // Category filter for Inbox
    if (activeFolder === 'inbox' && activeCategory !== 'all') {
      const emailCat = getEmailCategory(email);
      if (emailCat !== activeCategory) {
        return false;
      }
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        email.subject.toLowerCase().includes(q) ||
        email.sender.toLowerCase().includes(q) ||
        email.snippet.toLowerCase().includes(q);
      if (!match) return false;
    }

    // Advanced Filters
    if (advancedFilters) {
      if (advancedFilters.from && !email.sender.toLowerCase().includes(advancedFilters.from.toLowerCase())) return false;
      if (advancedFilters.to && !email.recipients.toLowerCase().includes(advancedFilters.to.toLowerCase())) return false;
      if (advancedFilters.subject && !email.subject.toLowerCase().includes(advancedFilters.subject.toLowerCase())) return false;
      if (advancedFilters.hasAttachment) {
        const hasAtt = (email as any).attachments && (email as any).attachments.length > 0;
        if (!hasAtt) return false;
      }
    }

    return true;
  });

  // Group emails by threadId
  const uniqueThreadsMap = new Map<string, { latestEmail: EmailData; messageCount: number }>();
  filteredEmails.forEach((email) => {
    const existing = uniqueThreadsMap.get(email.threadId);
    if (!existing) {
      uniqueThreadsMap.set(email.threadId, { latestEmail: email, messageCount: 1 });
    } else {
      existing.messageCount++;
      if (new Date(email.receivedAt).getTime() > new Date(existing.latestEmail.receivedAt).getTime()) {
        existing.latestEmail = email;
      }
    }
  });

  const groupedThreads = Array.from(uniqueThreadsMap.values()).map((t) => ({
    ...t.latestEmail,
    messageCount: t.messageCount,
  }));

  const totalCount = groupedThreads.length;
  const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalCount);
  const paginatedEmails = groupedThreads.slice(startIndex, endIndex);

  const selectedEmail = emails.find((e) => e.id === selectedEmailId);

  // All messages in current selected thread
  const currentThreadMessages = selectedEmail
    ? emails
        .filter((e) => e.threadId === selectedEmail.threadId)
        .sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime())
    : [];

  // GMAIL KEYBOARD SHORTCUTS HANDLER
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setShowComposeModal(true);
        setIsComposeMinimized(false);
      } else if (e.key === '/') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[placeholder="Search in mail"]')?.focus();
      } else if (e.key === 'r' || e.key === 'R') {
        if (selectedEmail) {
          e.preventDefault();
          setIsReplying(true);
          setReplyMode('reply');
        }
      } else if (e.key === 'f' || e.key === 'F') {
        if (selectedEmail) {
          e.preventDefault();
          setIsReplying(true);
          setReplyMode('forward');
        }
      } else if (e.key === 'e' || e.key === 'E') {
        if (selectedEmail) {
          e.preventDefault();
          handleDeleteEmail(selectedEmail.id);
        }
      } else if (e.key === 'j' || e.key === 'J') {
        if (paginatedEmails.length > 0) {
          const currIndex = paginatedEmails.findIndex((e) => e.id === selectedEmailId);
          const nextIndex = Math.min(paginatedEmails.length - 1, currIndex + 1);
          handleSelectEmail(paginatedEmails[nextIndex]);
        }
      } else if (e.key === 'k' || e.key === 'K') {
        if (paginatedEmails.length > 0) {
          const currIndex = paginatedEmails.findIndex((e) => e.id === selectedEmailId);
          const prevIndex = Math.max(0, currIndex - 1);
          handleSelectEmail(paginatedEmails[prevIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEmail, selectedEmailId, paginatedEmails]);

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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const toggleSelectAll = () => {
    if (selectedEmailIds.length === paginatedEmails.length && paginatedEmails.length > 0) {
      setSelectedEmailIds([]);
    } else {
      setSelectedEmailIds(paginatedEmails.map((e) => e.id));
    }
  };

  const toggleSelectEmail = (id: string) => {
    setSelectedEmailIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBackToList = () => {
    setIsReadingThread(false);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('id');
      window.history.pushState({}, '', url.pathname + url.search);
    }
  };

  const handleCategoryShift = async (emailId: string, newCategory: 'primary' | 'promotions' | 'social' | 'updates') => {
    setEmails((prev) =>
      prev.map((e) => (e.id === emailId ? { ...e, category: newCategory } : e))
    );
    try {
      await updateEmailCategoryApi(emailId, newCategory);
    } catch (err) {
      console.warn('Failed to shift email category:', err);
    }
  };

  const handleAutoLabelAll = async () => {
    setIsAutoLabeling(true);
    try {
      const res = await safeFetch('/ai/triage/all', { method: 'POST' });
      if (res.ok) {
        await loadData(true);
      }
    } catch (err) {
      console.warn('Auto-labeling error:', err);
    } finally {
      setIsAutoLabeling(false);
    }
  };

  const handleLabelSingleEmail = async (emailId: string) => {
    try {
      const res = await safeFetch(`/ai/emails/${emailId}/triage`, { method: 'POST' });
      if (res.ok) {
        await loadData(true);
      }
    } catch (err) {
      console.warn('Single email label error:', err);
    }
  };


  const handleSelectEmail = async (email: EmailData) => {
    setSelectedEmailId(email.id);
    setIsReadingThread(true);
    setIsReplying(false);
    setIsAiDraftModalOpen(false);


    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('id', email.id);
      window.history.pushState({}, '', url.pathname + url.search);
    }

    if (!email.isRead) {
      setEmails((prev) =>
        prev.map((e) => (e.id === email.id ? { ...e, isRead: true } : e))
      );
      markEmailAsReadApi(email.id, true).catch((err) => {
        console.warn('Failed to mark email as read:', err);
      });
    }

    // Immediately fetch full HTML content for the selected email
    try {
      const full = await fetchEmailByIdApi(email.id);
      if (full) {
        setEmails((prev) =>
          prev.map((e) => (e.id === email.id ? { ...e, ...full } : e))
        );
      }
    } catch (err) {
      console.warn('Failed to fetch full email body:', err);
    }
  };

  const handleToggleStar = (emailId: string) => {
    const target = emails.find((e) => e.id === emailId);
    const nextStarred = target ? !target.isStarred : true;
    setEmails((prev) =>
      prev.map((e) => (e.id === emailId ? { ...e, isStarred: nextStarred } : e))
    );
    toggleStarEmailApi(emailId, nextStarred).catch((err) => {
      console.warn('Failed to star email:', err);
    });
  };

  const handleDeleteEmail = (emailId: string) => {
    setEmails((prev) => prev.filter((e) => e.id !== emailId));
    if (selectedEmailId === emailId) {
      setSelectedEmailId(null);
      handleBackToList();
    }
    deleteEmailApi(emailId).catch((err) => {
      console.warn('Failed to delete email:', err);
    });
  };

  const handleSnoozeEmail = (snoozeDate: Date, label: string) => {
    if (!snoozeTargetEmailId) return;
    setEmails((prev) =>
      prev.map((e) => (e.id === snoozeTargetEmailId ? { ...e, folder: 'snoozed' as any } : e))
    );
    setSnoozedMetaMap((prev) => ({ ...prev, [snoozeTargetEmailId]: label }));
  };

  const handleCreateCustomLabel = (name: string, color: string) => {
    const newLbl: CustomLabel = { id: `lbl-${Date.now()}`, name, color };
    const updated = [...customLabels, newLbl];
    setCustomLabels(updated);
    localStorage.setItem('gmail_custom_labels', JSON.stringify(updated));
  };

  const handleToggleLabelOnEmail = (emailId: string, labelId: string) => {
    setEmailLabelsMap((prev) => {
      const current = prev[emailId] || [];
      const updated = current.includes(labelId) ? current.filter((l) => l !== labelId) : [...current, labelId];
      const nextMap = { ...prev, [emailId]: updated };
      localStorage.setItem('gmail_email_labels_map', JSON.stringify(nextMap));
      return nextMap;
    });
  };

  const handleBulkDelete = () => {
    if (selectedEmailIds.length === 0) return;
    setEmails((prev) => prev.filter((e) => !selectedEmailIds.includes(e.id)));
    if (selectedEmailId && selectedEmailIds.includes(selectedEmailId)) {
      setSelectedEmailId(null);
      handleBackToList();
    }
    selectedEmailIds.forEach((id) => {
      fetch(`/api/emails/${id}`, { method: 'DELETE' }).catch(() => {});
    });
    setSelectedEmailIds([]);
  };

  const handleBulkMarkRead = () => {
    if (selectedEmailIds.length === 0) return;
    setEmails((prev) =>
      prev.map((e) => (selectedEmailIds.includes(e.id) ? { ...e, isRead: true } : e))
    );
    selectedEmailIds.forEach((id) => {
      fetch(`/api/emails/${id}/read`, { method: 'PATCH' }).catch(() => {});
    });
    setSelectedEmailIds([]);
  };

  // SEND WITH 5-SECOND UNDO TOAST
  const dispatchSendReplyWithUndo = async () => {
    if (!selectedEmail || !replyText.trim()) return;
    const bodyToSend = `${replyText}\n\n--\nSent from ${selectedEmail.accountName}`;
    const savedText = replyText;
    const savedFiles = replyFiles;

    setReplyText('');
    setReplyFiles([]);
    setIsReplying(false);

    let seconds = 5;
    const toastObj = {
      active: true,
      message: 'Reply queued for sending.',
      countdown: seconds,
      onUndo: () => {
        if (undoTimerRef.current) clearInterval(undoTimerRef.current);
        setUndoToast(null);
        setReplyText(savedText);
        setReplyFiles(savedFiles);
        setIsReplying(true);
      },
    };
    setUndoToast(toastObj);

    undoTimerRef.current = setInterval(async () => {
      seconds -= 1;
      if (seconds <= 0) {
        if (undoTimerRef.current) clearInterval(undoTimerRef.current);
        setUndoToast(null);

        try {
          const lastMsg = currentThreadMessages.length > 0 ? currentThreadMessages[currentThreadMessages.length - 1] : selectedEmail;
          const recipient = lastMsg.sender.includes('<') ? lastMsg.sender.split('<')[1].replace('>', '') : lastMsg.sender;
          await fetch('/api/emails/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accountId: selectedEmail.accountId,
              to: recipient,
              subject: replyMode === 'reply' ? `Re: ${selectedEmail.subject.replace(/^Re:\s*/i, '')}` : `Fwd: ${selectedEmail.subject}`,
              body: bodyToSend,
              threadId: selectedEmail.threadId,
              attachments: savedFiles,
            }),
          });
          await loadData();
        } catch (e) {}
      } else {
        setUndoToast((prev) => (prev ? { ...prev, countdown: seconds } : null));
      }
    }, 1000);
  };

  const dispatchSendComposeWithUndo = async () => {
    if (!composeTo || !composeSubject || !composeBody) return;
    const savedTo = composeTo;
    const savedSubject = composeSubject;
    const savedBody = composeBody;
    const savedFiles = composeFiles;

    setShowComposeModal(false);
    setComposeTo('');
    setComposeSubject('');
    setComposeBody('');
    setComposeFiles([]);
    localStorage.removeItem('gmail_compose_draft');

    let seconds = 5;
    const toastObj = {
      active: true,
      message: scheduledSendTime ? `Email scheduled for ${scheduledSendTime}.` : 'Message sent.',
      countdown: seconds,
      onUndo: () => {
        if (undoTimerRef.current) clearInterval(undoTimerRef.current);
        setUndoToast(null);
        setComposeTo(savedTo);
        setComposeSubject(savedSubject);
        setComposeBody(savedBody);
        setComposeFiles(savedFiles);
        setShowComposeModal(true);
      },
    };
    setUndoToast(toastObj);

    undoTimerRef.current = setInterval(async () => {
      seconds -= 1;
      if (seconds <= 0) {
        if (undoTimerRef.current) clearInterval(undoTimerRef.current);
        setUndoToast(null);

        try {
          const senderAcc = accounts.find((a) => a.id === composeFromAccountId);
          await fetch('/api/emails/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accountId: composeFromAccountId,
              to: savedTo,
              subject: savedSubject,
              body: `${savedBody}\n\n--\nSent from ${senderAcc ? senderAcc.label : 'Gmail Client'}${confidentialConfig ? `\n[Confidential Mode Active: ${confidentialConfig.expiration}]` : ''}`,
              attachments: savedFiles,
            }),
          });
          loadData();
        } catch (e) {}
      } else {
        setUndoToast((prev) => (prev ? { ...prev, countdown: seconds } : null));
      }
    }, 1000);
  };

  const unreadInboxCount = emails.filter((e) => !e.isRead && ((e as any).folder === 'inbox' || !(e as any).folder)).length;
  const starredCount = emails.filter((e) => e.isStarred).length;

  return (
    <div className="flex flex-col h-full bg-[#f6f8fc] dark:bg-[#1f1f1f] text-[#1f1f1f] dark:text-[#e3e3e3] overflow-hidden font-sans transition-colors duration-200 select-none min-h-0">
      {/* Hidden File Inputs */}
      <input type="file" ref={composeFileInputRef} multiple className="hidden" style={{ display: 'none' }} onChange={handleComposeFileSelect} />
      <input type="file" ref={replyFileInputRef} multiple className="hidden" style={{ display: 'none' }} onChange={handleReplyFileSelect} />

      {/* 1. GMAIL TOP SEARCH HEADER BAR */}
      <header className="h-16 px-4 bg-[#f6f8fc] dark:bg-[#1f1f1f] border-b border-slate-200/60 dark:border-slate-800 flex items-center justify-between shrink-0 gap-4">
        {/* Left: Gmail Header Search Bar */}
        <div className="flex-1 max-w-3xl flex items-center space-x-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in mail (press '/' to focus)"
              className="w-full pl-12 pr-10 py-2.5 rounded-full bg-[#eaf1fb] dark:bg-[#2e2f33] text-slate-900 dark:text-white placeholder-slate-500 text-sm focus:outline-none focus:bg-white focus:dark:bg-[#28292c] focus:ring-2 focus:ring-[#0b57d0] transition-all shadow-xs"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setIsSearchModalOpen(true)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-[#0b57d0]"
                title="Advanced search filters"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Right: View Mode Toggle, Sync Button, Theme Toggle, User Avatar */}
        <div className="flex items-center space-x-3">
          {/* Layout Split Mode Switcher (List vs Split) */}
          <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => {
                setViewMode('list');
                handleBackToList();
              }}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 text-[#0b57d0] dark:text-purple-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title="Full List View"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">List</span>
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all ${
                viewMode === 'split'
                  ? 'bg-white dark:bg-slate-700 text-[#0b57d0] dark:text-purple-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
              title="Split View"
            >
              <Columns className="w-4 h-4" />
              <span className="hidden sm:inline text-[11px]">Split</span>
            </button>
          </div>

          {/* AI Copilot Trigger Button */}
          <button
            onClick={openCopilot}
            className="relative flex items-center space-x-1.5 px-3 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-800/80 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50 hover:from-indigo-100 hover:to-purple-100 dark:hover:from-indigo-900/60 dark:hover:to-purple-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold transition-all shadow-2xs group"
            title="Open Streamline AI Copilot (⌘K)"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 group-hover:rotate-12 transition-transform" />
            <span className="hidden sm:inline font-bold">Copilot</span>
            <kbd className="hidden md:inline-block px-1.5 py-0.2 text-[9px] font-mono bg-white/70 dark:bg-slate-800/70 border border-indigo-200/80 dark:border-indigo-700/60 rounded text-indigo-600 dark:text-indigo-300">
              ⌘K
            </kbd>
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse shadow-sm">
                {pendingCount}
              </span>
            )}
          </button>

          {/* Sync Button */}
          <button
            onClick={() => loadData(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 text-xs font-semibold transition-all shadow-2xs"
            title="Sync Gmail Accounts"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#0b57d0]' : ''}`} />
            <span className="hidden md:inline">Sync Now</span>
          </button>

          {/* Theme Switcher Button */}
          <ThemeToggle />

          {/* Gmail Settings Gear Button */}
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Gmail Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>

          {/* User Profile Avatar */}
          <div className="w-8 h-8 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-xs shadow-xs" title="Connected Account: Piyush">
            P
          </div>
        </div>
      </header>

      {/* MAIN BODY AREA */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* 2. GMAIL MATERIAL 3 NAVIGATION SIDEBAR */}
        <aside className="w-64 bg-[#f6f8fc] dark:bg-[#1f1f1f] p-3 flex flex-col justify-between shrink-0 select-none h-full overflow-hidden">
          {/* Top Fixed Compose & Account Selector Section */}
          <div className="shrink-0 space-y-2.5 pb-3">
            {/* Account Selector Pill shifted to Sidebar Slider */}
            <div className="relative">
              <button
                onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-2xl bg-white dark:bg-[#28292c] border border-slate-200/80 dark:border-slate-800 text-xs font-semibold shadow-xs hover:bg-slate-50 dark:hover:bg-[#323338] transition-all"
              >
                <div className="flex items-center space-x-2 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: selectedAccountFilter === 'all' ? '#0b57d0' : (accounts.find((a) => a.id === selectedAccountFilter)?.color || '#0b57d0') }}
                  />
                  <div className="flex flex-col text-left truncate">
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">
                      {selectedAccountFilter === 'all' ? 'All Accounts' : accounts.find((a) => a.id === selectedAccountFilter)?.label || 'Mailbox'}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono truncate">
                      {selectedAccountFilter === 'all' ? 'Unified Inbox' : accounts.find((a) => a.id === selectedAccountFilter)?.email}
                    </span>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
              </button>

              {/* Account Dropdown Menu */}
              {isAccountDropdownOpen && (
                <div className="absolute top-11 left-0 right-0 z-50 bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-2xl space-y-1 text-xs animate-in zoom-in-95 duration-100">
                  <button
                    onClick={() => {
                      setSelectedAccountFilter('all');
                      setIsAccountDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors ${
                      selectedAccountFilter === 'all'
                        ? 'bg-[#c2e7ff] text-[#001d35] font-bold dark:bg-slate-800 dark:text-white'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-[11px]">All Accounts (Unified)</span>
                    <span className="text-[10px] font-mono text-slate-400 font-bold">{emails.length}</span>
                  </button>

                  {accounts.map((acc) => (
                    <button
                      key={acc.id}
                      onClick={() => {
                        setSelectedAccountFilter(acc.id);
                        setIsAccountDropdownOpen(false);
                      }}
                      className={`w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-left transition-colors ${
                        selectedAccountFilter === acc.id
                          ? 'bg-[#c2e7ff] text-[#001d35] font-bold dark:bg-slate-800 dark:text-white'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: acc.color }} />
                      <div className="flex flex-col truncate">
                        <span className="text-[11px] font-bold truncate">{acc.label}</span>
                        <span className="text-[9px] text-slate-400 font-mono truncate">{acc.email}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setShowComposeModal(true);
                setIsComposeMinimized(false);
              }}
              className="w-full flex items-center space-x-3 px-6 py-4 rounded-2xl bg-[#c2e7ff] hover:bg-[#b3d7f0] dark:bg-[#37393e] dark:hover:bg-[#484b52] text-[#001d35] dark:text-[#c2e7ff] font-semibold text-sm shadow-sm hover:shadow-md transition-all active:scale-95"
            >
              <Pencil className="w-5 h-5 text-[#0b57d0] dark:text-[#c2e7ff]" />
              <span className="tracking-wide">Compose</span>
            </button>
          </div>

          {/* Scrollable Folder Navigation & Mailbox Labels List */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Folder Navigation Menu */}
            <nav className="space-y-0.5">
              {[
                { id: 'inbox', label: 'Inbox', icon: InboxIcon, count: unreadInboxCount },
                { id: 'starred', label: 'Starred', icon: Star, count: starredCount },
                { id: 'snoozed', label: 'Snoozed', icon: Clock },
                { id: 'sent', label: 'Sent', icon: Send },
                { id: 'drafts', label: 'Drafts', icon: FileText },
                { id: 'trash', label: 'Trash', icon: Trash2 },
                { id: 'attachments', label: 'Attachments', icon: Paperclip },
              ].map((folder) => {
                const Icon = folder.icon;
                const isActive = activeFolder === folder.id;
                return (
                  <button
                    key={folder.id}
                    onClick={() => {
                      setActiveFolder(folder.id as any);
                      setCurrentPage(1);
                      if (viewMode === 'list') handleBackToList();
                    }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-[#c2e7ff] text-[#001d35] font-bold dark:bg-[#2d3748] dark:text-[#d3e3fd]'
                        : 'text-[#444746] dark:text-slate-300 hover:bg-[#eaeff6] dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center space-x-3.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-[#0b57d0] dark:text-purple-400' : 'text-slate-500'}`} />
                      <span>{folder.label}</span>
                    </div>
                    {folder.count !== undefined && folder.count > 0 && (
                      <span
                        className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-bold ${
                          isActive
                            ? 'bg-[#0b57d0] text-white dark:bg-purple-600'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {folder.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Custom Labels Section */}
            <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Custom Labels</span>
                <button
                  onClick={() => setIsLabelModalOpen(true)}
                  className="text-[9px] text-[#0b57d0] dark:text-purple-400 hover:underline flex items-center space-x-0.5"
                >
                  <Plus className="w-3 h-3" />
                  <span>New</span>
                </button>
              </div>

              {customLabels.map((lbl) => {
                const isActive = selectedCustomLabelFilter === lbl.id;
                return (
                  <button
                    key={lbl.id}
                    onClick={() => setSelectedCustomLabelFilter(isActive ? 'all' : lbl.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-1.5 rounded-xl text-xs transition-colors ${
                      isActive
                        ? 'bg-[#c2e7ff]/70 text-[#001d35] font-bold dark:bg-slate-800 dark:text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: lbl.color }} />
                      <span className="text-[11px] font-medium truncate">{lbl.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fixed Live Sync Footer */}
          <div className="shrink-0 pt-2 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Gmail Live Sync</span>
            </span>
          </div>
        </aside>

        {/* 3. MAIN WORKSPACE CANVAS */}
        {activeFolder === 'attachments' ? (
          <AttachmentsView emails={emails} onJumpToEmail={handleSelectEmail} />
        ) : (
          <div className="flex-1 flex bg-white dark:bg-[#141517] overflow-hidden rounded-tl-2xl border-l border-slate-200/80 dark:border-slate-800 shadow-xs min-h-0">
            {/* A. EMAIL LIST / TABLE PANEL */}
            {(!isReadingThread || viewMode === 'split') && (
              <div
                className={`flex flex-col bg-white dark:bg-[#141517] border-r border-slate-200/80 dark:border-slate-800 ${
                  viewMode === 'split' ? 'w-96 shrink-0' : 'w-full'
                } h-full overflow-hidden min-h-0`}
              >
                {/* Top Gmail Action Bar */}
                <div className="px-4 py-2 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 shrink-0 bg-white dark:bg-[#141517]">
                  <div className="flex items-center space-x-3">
                    {/* Select All Checkbox */}
                    <button
                      onClick={toggleSelectAll}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                      title="Select all"
                    >
                      {selectedEmailIds.length === paginatedEmails.length && paginatedEmails.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-[#0b57d0] dark:text-purple-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>

                    {/* Bulk Action Buttons */}
                    {selectedEmailIds.length > 0 ? (
                      <div className="flex items-center space-x-1 text-slate-700 dark:text-slate-200">
                        <button
                          onClick={handleBulkMarkRead}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title="Mark as read"
                        >
                          <MailOpen className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleBulkDelete}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-rose-600 dark:text-rose-400 transition-colors"
                          title="Delete selected"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <span className="text-[11px] font-medium text-slate-500 ml-2">
                          {selectedEmailIds.length} selected
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => loadData(true)}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
                          title="Refresh inbox"
                        >
                          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>

                        <button
                          onClick={handleAutoLabelAll}
                          disabled={isAutoLabeling}
                          className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-purple-600/10 via-indigo-600/10 to-pink-600/10 hover:from-purple-600/20 hover:to-indigo-600/20 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60 text-[11px] font-semibold transition-all shadow-2xs active:scale-95 disabled:opacity-60"
                          title="Run Gemini AI Auto-Labeling on all synced emails"
                        >
                          <Sparkles className={`w-3.5 h-3.5 text-purple-600 dark:text-purple-400 ${isAutoLabeling ? 'animate-spin' : ''}`} />
                          <span>{isAutoLabeling ? 'Auto-Labeling with Gemini...' : '✨ AI Auto-Label'}</span>
                        </button>
                      </div>
                    )}

                  </div>

                  {/* Pagination Controls */}
                  <div className="flex items-center space-x-3 text-slate-500">
                    <span className="text-[11px] font-mono">
                      {totalCount === 0 ? '0 of 0' : `${startIndex + 1}–${endIndex} of ${totalCount}`}
                    </span>
                    <div className="flex items-center space-x-0.5">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
                        title="Previous page"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        disabled={currentPage === totalPages || totalCount === 0}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
                        title="Next page"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Gmail Category Tabs Bar (Primary, Promotions, Social, Updates, All Mail) */}
                {activeFolder === 'inbox' && (
                  <div className="flex items-center border-b border-slate-200/80 dark:border-slate-800 bg-[#f6f8fc]/60 dark:bg-[#1a1b1e] shrink-0 overflow-x-auto">
                    {[
                      { id: 'all', label: 'All Mail', icon: Mail, color: 'border-slate-600 text-slate-600 dark:border-slate-300 dark:text-slate-300' },
                      { id: 'p1_urgent', label: '🔥 Action Required', icon: Flame, color: 'border-red-500 text-red-600 dark:border-red-400 dark:text-red-400' },
                      { id: 'p2_important', label: '💬 Direct', icon: InboxIcon, color: 'border-[#0b57d0] text-[#0b57d0] dark:border-purple-400 dark:text-purple-400' },
                      { id: 'p3_updates', label: '🔔 Updates', icon: AlertOctagon, color: 'border-[#b06000] text-[#b06000] dark:border-amber-400 dark:text-amber-400' },
                      { id: 'p4_newsletter', label: '📰 Subscriptions', icon: Tag, color: 'border-[#137333] text-[#137333] dark:border-emerald-400 dark:text-emerald-400' },
                    ].map((cat) => {

                      const Icon = cat.icon;
                      const isActive = activeCategory === cat.id;
                      const count = emails.filter((e) => {
                        if (e.folder && e.folder !== 'inbox') return false;
                        if (selectedAccountFilter !== 'all' && e.accountId !== selectedAccountFilter) return false;
                        if (cat.id === 'all') return true;
                        return getEmailCategory(e) === cat.id;
                      }).length;

                      return (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setActiveCategory(cat.id as any);
                            setCurrentPage(1);
                          }}
                          className={`flex-1 min-w-[120px] py-3.5 px-4 flex items-center justify-center space-x-2.5 text-xs font-semibold transition-all border-b-[3px] ${
                            isActive
                              ? `${cat.color} bg-white dark:bg-[#141517]`
                              : 'border-transparent text-[#5f6368] dark:text-slate-400 hover:bg-[#eaeff6]/60 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{cat.label}</span>
                          {count > 0 && (
                            <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono font-bold ${
                              isActive ? 'bg-purple-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Staged AI Actions Awaiting Approval Banner */}
                <div className="p-3 pb-0">
                  <PendingActionsBanner onActionResolved={() => loadData(false)} />
                </div>

                {/* Email Table Rows */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 min-h-0">
                  {paginatedEmails.length === 0 ? (
                    <div className="p-16 text-center space-y-3 my-auto">
                      <InboxIcon className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
                      <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">No emails found</h3>
                      <p className="text-xs text-slate-400 max-w-xs mx-auto">There are no messages matching your filters.</p>
                    </div>
                  ) : (
                    paginatedEmails.map((email) => {
                      const isSelected = selectedEmailId === email.id || (selectedEmail && selectedEmail.threadId === email.threadId);
                      const isChecked = selectedEmailIds.includes(email.id);
                      const count = (email as any).messageCount || 1;
                      const hasAttachments = (email as any).attachments && (email as any).attachments.length > 0;

                      const match = email.sender.match(/^(.*?)\s*<([^>]+)>$/);
                      const senderName = match ? match[1].replace(/['"]/g, '').trim() || match[2] : email.sender;
                      const senderEmail = match ? match[2] : email.sender;
                      const assignedLabels = emailLabelsMap[email.id] || [];

                      return (
                        <div
                          key={email.id}
                          onClick={() => handleSelectEmail(email)}
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
                              toggleSelectEmail(email.id);
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
                              handleToggleStar(email.id);
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
                            onFilterBySender={(e) => setSearchQuery(`from:${e}`)}
                            onComposeToSender={(e) => {
                              setComposeTo(e);
                              setShowComposeModal(true);
                            }}
                          >
                            <div className="w-44 shrink-0 flex items-center space-x-1.5 truncate">
                              {!email.isRead && <span className="w-2 h-2 rounded-full bg-[#0b57d0] dark:bg-purple-400 shrink-0" />}
                              <span className={`text-xs truncate ${!email.isRead ? 'font-bold text-slate-900 dark:text-white' : 'font-normal text-slate-700 dark:text-slate-300'}`}>
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
                          {(() => {
                            const priority = email.aiPriority || getEmailCategory(email);
                            if (priority === 'p1_urgent') {
                              return (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 shrink-0 flex items-center space-x-1 shadow-2xs" title="Gemini AI: P1 Urgent / Action Required">
                                  <Flame className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                                  <span>P1 Action</span>
                                </span>
                              );
                            }
                            if (priority === 'p2_important') {
                              return (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 shrink-0 shadow-2xs" title="Gemini AI: P2 Direct Conversation">
                                  P2 Direct
                                </span>
                              );
                            }
                            if (priority === 'p3_updates') {
                              return (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0 shadow-2xs" title="Gemini AI: P3 Updates / Notifications">
                                  P3 Updates
                                </span>
                              );
                            }
                            if (priority === 'p4_newsletter') {
                              return (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0 shadow-2xs" title="Gemini AI: P4 Subscriptions / Newsletters">
                                  P4 News
                                </span>
                              );
                            }
                            return null;
                          })()}

                          {/* Gemini AI Smart Topic Tag */}
                          {(() => {
                            const topic = email.aiNewsletterTopic || (() => {
                              const s = `${email.sender} ${email.subject}`.toLowerCase();
                              if (s.includes('nst') || s.includes('office') || s.includes('rishihood') || s.includes('exam') || s.includes('csai') || s.includes('registrar')) return '🎓 Academics';
                              if (s.includes('dev club') || s.includes('devclub') || s.includes('bootcamp') || s.includes('hack')) return '💼 DevClub';
                              if (s.includes('atlassian') || s.includes('github') || s.includes('ai') || s.includes('code') || s.includes('tech')) return '🚀 Tech & AI';
                              if (s.includes('linkedin')) return '👥 Community';
                              if (getEmailCategory(email) === 'p4_newsletter') return '📰 Newsletter';
                              return null;
                            })();

                            if (!topic) return null;
                            return (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 shrink-0 max-w-[120px] truncate shadow-2xs" title={`Smart Topic: ${topic}`}>
                                {topic}
                              </span>
                            );
                          })()}

                          {/* Gemini AI Action Items Detected */}
                          {email.aiExtractedTasks && email.aiExtractedTasks.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 shrink-0 shadow-2xs" title={`${email.aiExtractedTasks.length} action item(s) detected`}>
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
                            <span className={`truncate ${!email.isRead ? 'font-bold text-slate-900 dark:text-white' : 'font-normal text-slate-800 dark:text-slate-200'}`}>
                              {email.subject}
                            </span>
                            <span className="text-slate-400 font-normal truncate">
                              — {email.snippet}
                            </span>
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
                                  setSnoozeTargetEmailId(email.id);
                                  setIsSnoozeModalOpen(true);
                                }}
                                className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-amber-500"
                                title="Snooze"
                              >
                                <Clock className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLabelTargetEmailId(email.id);
                                  setIsLabelModalOpen(true);
                                }}
                                className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-purple-500"
                                title="Labels"
                              >
                                <Tag className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteEmail(email.id);
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
                    })
                  )}
                </div>
              </div>
            )}

            {/* B. THREAD READER CANVAS */}
            {(isReadingThread || (viewMode === 'split' && selectedEmail)) ? (
              <div className="flex-1 flex flex-col bg-white dark:bg-[#141517] overflow-hidden min-w-0 h-full">
                {/* Thread Action Header Bar */}
                <div className="px-6 py-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0 bg-[#f6f8fc]/40 dark:bg-[#1a1b1e]">
                  <div className="flex items-center space-x-3">
                    {/* Back to Inbox Arrow Button */}
                    <button
                      onClick={handleBackToList}
                      className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                      title="Back to inbox"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>

                    <span
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-2xs"
                      style={{
                        backgroundColor: `${selectedEmail?.accountColor || '#0b57d0'}20`,
                        color: selectedEmail?.accountColor || '#0b57d0',
                        border: `1px solid ${selectedEmail?.accountColor || '#0b57d0'}40`,
                      }}
                      title={`Belongs to mailbox: ${selectedEmail?.accountName || selectedEmail?.accountEmail}`}
                    >
                      {selectedEmail?.accountName || selectedEmail?.accountEmail || 'Mailbox'}
                    </span>

                    {/* Shift Category Pill Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                        className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all shadow-2xs cursor-pointer hover:opacity-90"
                        style={{
                          backgroundColor: `${selectedEmail?.accountColor || '#0b57d0'}15`,
                          color: selectedEmail?.accountColor || '#0b57d0',
                          borderColor: `${selectedEmail?.accountColor || '#0b57d0'}40`,
                        }}
                        title="Move to category"
                      >
                        <FolderInput className="w-3 h-3" />
                        <span className="capitalize">{selectedEmail?.category || 'primary'}</span>
                        <ChevronDown className="w-3 h-3" />
                      </button>

                      {isCategoryDropdownOpen && (
                        <div className="absolute left-0 mt-2 w-44 rounded-2xl bg-white dark:bg-[#1a1b1e] border border-slate-200 dark:border-slate-800 shadow-xl z-50 py-1.5 animate-in fade-in zoom-in-95">
                          <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Move to Category
                          </div>
                          {[
                            { id: 'primary', label: 'Primary', icon: InboxIcon, color: 'text-[#0b57d0]' },
                            { id: 'promotions', label: 'Promotions', icon: Tag, color: 'text-emerald-600' },
                            { id: 'social', label: 'Social', icon: Users, color: 'text-blue-600' },
                            { id: 'updates', label: 'Updates', icon: AlertOctagon, color: 'text-amber-600' },
                          ].map((cat) => {
                            const Icon = cat.icon;
                            return (
                              <button
                                key={cat.id}
                                onClick={() => {
                                  if (selectedEmail) {
                                    handleCategoryShift(selectedEmail.id, cat.id as any);
                                  }
                                  setIsCategoryDropdownOpen(false);
                                }}
                                className={`w-full flex items-center space-x-2.5 px-3.5 py-2 text-xs font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${
                                  (selectedEmail?.category || 'primary') === cat.id ? 'font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-600' : 'text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <Icon className={`w-4 h-4 ${cat.color}`} />
                                <span>{cat.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        if (selectedEmail) {
                          setSnoozeTargetEmailId(selectedEmail.id);
                          setIsSnoozeModalOpen(true);
                        }
                      }}
                      className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                      title="Snooze email"
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (selectedEmail) {
                          setLabelTargetEmailId(selectedEmail.id);
                          setIsLabelModalOpen(true);
                        }
                      }}
                      className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                      title="Labels"
                    >
                      <Tag className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => selectedEmail && handleToggleStar(selectedEmail.id)}
                      className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                      title="Star message"
                    >
                      <Star className={`w-4 h-4 ${selectedEmail?.isStarred ? 'fill-[#f4b400] text-[#f4b400]' : ''}`} />
                    </button>
                    <button
                      onClick={() => selectedEmail && handleDeleteEmail(selectedEmail.id)}
                      className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 transition-colors"
                      title="Delete message"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => window.print()}
                      className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                      title="Print email"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Thread Content Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">
                  {/* Subject Header */}
                  <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                    {selectedEmail?.subject}
                  </h1>

                  {/* Gemini AI Intelligence Card */}
                  {selectedEmail && (selectedEmail.aiPriority || selectedEmail.aiSummary || (selectedEmail.aiExtractedTasks && selectedEmail.aiExtractedTasks.length > 0) || selectedEmail.aiNewsletterTopic) && (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/8 via-indigo-500/5 to-pink-500/8 border border-purple-200/80 dark:border-purple-800/50 space-y-3 shadow-xs">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <div className="p-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs">
                            <Sparkles className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                            Gemini Intelligence
                          </span>

                          {selectedEmail.aiPriority === 'p1_urgent' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 flex items-center space-x-1">
                              <Flame className="w-3 h-3 text-rose-500" />
                              <span>P1 Action Required</span>
                            </span>
                          )}
                          {selectedEmail.aiPriority === 'p2_important' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                              💬 P2 Direct
                            </span>
                          )}
                          {selectedEmail.aiPriority === 'p3_updates' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                              🔔 P3 Updates
                            </span>
                          )}
                          {selectedEmail.aiPriority === 'p4_newsletter' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                              📰 P4 Subscription
                            </span>
                          )}

                          {selectedEmail.aiUrgencyScore !== undefined && selectedEmail.aiUrgencyScore !== null && (
                            <span className="text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                              Urgency: {selectedEmail.aiUrgencyScore}/100
                            </span>
                          )}

                          {selectedEmail.aiNewsletterTopic && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-800">
                              {selectedEmail.aiNewsletterTopic}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => handleLabelSingleEmail(selectedEmail.id)}
                          className="text-[11px] font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center space-x-1 transition-colors"
                          title="Re-analyze email with Gemini AI"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Re-analyze</span>
                        </button>
                      </div>

                      {selectedEmail.aiSummary && (
                        <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-white/70 dark:bg-slate-900/50 p-3 rounded-xl border border-purple-100 dark:border-purple-900/30">
                          <span className="font-bold text-slate-900 dark:text-white mr-1.5">Executive Summary:</span>
                          {selectedEmail.aiSummary}
                        </div>
                      )}

                      {selectedEmail.aiExtractedTasks && selectedEmail.aiExtractedTasks.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Extracted Action Items ({selectedEmail.aiExtractedTasks.length}):
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {selectedEmail.aiExtractedTasks.map((t: any) => (
                              <div
                                key={t.id || t.title}
                                className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs space-x-2 shadow-2xs"
                              >
                                <span className="truncate text-slate-800 dark:text-slate-200 font-medium">{t.title}</span>
                                <button
                                  onClick={async () => {
                                    await safeFetch('/ai/tasks/convert', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        emailId: selectedEmail.id,
                                        taskId: t.id,
                                        title: t.title,
                                        priority: t.priority,
                                        dueDate: t.dueDate,
                                      }),
                                    });
                                    loadData(true);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-[10px] font-bold shrink-0 shadow-2xs transition-all active:scale-95"
                                >
                                  Accept Task
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}


                  {/* Chronological Messages Flow */}
                  <div className="space-y-6">
                    {currentThreadMessages.map((msg, index) => {
                      const match = msg.sender.match(/^(.*?)\s*<([^>]+)>$/);
                      const senderName = match ? match[1].replace(/['"]/g, '').trim() || match[2] : msg.sender;
                      const senderEmail = match ? match[2] : msg.sender;
                      const recipientClean = msg.recipients.replace(/[<>]/g, '');

                      let attachmentsList: Array<{ filename: string; mimeType?: string; size?: number; content?: string }> = [];
                      try {
                        const rawAtt = (msg as any).attachments;
                        if (Array.isArray(rawAtt)) attachmentsList = rawAtt;
                        else if (typeof rawAtt === 'string') attachmentsList = JSON.parse(rawAtt);
                      } catch (e) {
                        attachmentsList = [];
                      }

                      return (
                        <div key={msg.id} className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#1a1b1e] space-y-4 shadow-xs">
                          {/* Sender info */}
                          <div className="flex items-center justify-between">
                            <SenderContactCard
                              senderName={senderName}
                              senderEmail={senderEmail}
                              avatarInitial={senderName.charAt(0).toUpperCase()}
                              avatarColor={msg.accountColor || '#0b57d0'}
                              onFilterBySender={(e) => setSearchQuery(`from:${e}`)}
                              onComposeToSender={(e) => {
                                setComposeTo(e);
                                setShowComposeModal(true);
                              }}
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
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    to me ({recipientClean})
                                  </div>
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
                              <div className="text-xs text-slate-400 italic py-2">
                                (No content in this message body)
                              </div>
                            )}
                          </div>


                          {/* Attachments */}
                          {attachmentsList.length > 0 && (
                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                <Paperclip className="w-4 h-4 text-[#0b57d0]" />
                                <span>{attachmentsList.length} Attachment{attachmentsList.length === 1 ? '' : 's'}</span>
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
                    })}
                  </div>
                </div>

                {/* Bottom Action Area (Reply & Forward Box) */}
                <div className="p-4 border-t border-slate-200/80 dark:border-slate-800 bg-[#f6f8fc]/60 dark:bg-[#1a1b1e] shrink-0 space-y-3">
                  {!isReplying ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => {
                            setIsReplying(true);
                            setReplyMode('reply');
                          }}
                          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs"
                        >
                          <CornerUpLeft className="w-4 h-4 text-slate-500" />
                          <span>Reply</span>
                        </button>

                        <button
                          onClick={() => {
                            setIsReplying(true);
                            setReplyMode('forward');
                          }}
                          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs"
                        >
                          <CornerUpRight className="w-4 h-4 text-slate-500" />
                          <span>Forward</span>
                        </button>

                        <button
                          onClick={() => setIsAiDraftModalOpen(true)}
                          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-semibold shadow-md shadow-purple-600/25 transition-all hover:scale-[1.02] active:scale-95"
                        >
                          <Sparkles className="w-4 h-4 text-purple-200" />
                          <span>Draft with Gemini</span>
                        </button>
                      </div>

                      <button
                        onClick={() => setIsTemplatesModalOpen(true)}
                        className="p-2 rounded-xl text-slate-500 hover:text-[#0b57d0] hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-semibold flex items-center space-x-1 transition-colors"
                        title="Insert Email Template"
                      >
                        <FileText className="w-4 h-4 text-[#0b57d0]" />
                        <span className="hidden sm:inline text-[11px]">Templates</span>
                      </button>
                    </div>

                  ) : (
                    <div className="p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl space-y-3 shadow-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {replyMode === 'reply' ? <CornerUpLeft className="w-4 h-4 text-[#0b57d0]" /> : <CornerUpRight className="w-4 h-4 text-[#0b57d0]" />}
                          <span>{replyMode === 'reply' ? `Reply to ${selectedEmail?.sender}` : `Forward message`}</span>
                        </div>
                        <button onClick={() => setIsReplying(false)} className="text-slate-400 hover:text-slate-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <textarea
                        rows={4}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write your response..."
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#0b57d0] resize-none"
                      />

                      {replyFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {replyFiles.map((file, idx) => (
                            <div
                              key={idx}
                              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-purple-950/40 border border-blue-200 dark:border-purple-800 text-xs text-[#0b57d0]"
                            >
                              <Paperclip className="w-3.5 h-3.5" />
                              <span className="truncate max-w-[140px] font-medium">{file.filename}</span>
                              <button
                                type="button"
                                onClick={() => setReplyFiles((prev) => prev.filter((_, i) => i !== idx))}
                                className="text-slate-400 hover:text-rose-600 ml-1"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center space-x-2">
                          <button
                            disabled={isSendingReply || !replyText.trim()}
                            onClick={dispatchSendReplyWithUndo}
                            className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-[#0b57d0] hover:bg-[#0a4ab8] text-white text-xs font-semibold shadow-md transition-all active:scale-95 disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{isSendingReply ? 'Sending...' : 'Send'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => replyFileInputRef.current?.click()}
                            className="p-2 text-slate-400 hover:text-[#0b57d0] transition-colors"
                            title="Attach files"
                          >
                            <Paperclip className="w-4 h-4 text-[#0b57d0]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsTemplatesModalOpen(true)}
                            className="p-2 text-slate-400 hover:text-[#0b57d0] transition-colors"
                            title="Insert template"
                          >
                            <FileText className="w-4 h-4 text-[#0b57d0]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsAiDraftModalOpen(true)}
                            className="p-1.5 px-2.5 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg transition-colors flex items-center space-x-1"
                            title="Draft with Gemini"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                            <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hidden sm:inline">AI Draft</span>
                          </button>
                        </div>

                        <button
                          onClick={() => {
                            setIsReplying(false);
                            setReplyText('');
                            setReplyFiles([]);
                          }}
                          className="p-2 text-slate-400 hover:text-rose-600"
                          title="Discard draft"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              viewMode === 'split' && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-3 bg-slate-50/50 dark:bg-[#141517]">
                  <InboxIcon className="w-12 h-12 text-slate-300 dark:text-slate-700" />
                  <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">No Email Selected</h3>
                  <p className="text-xs text-slate-400 max-w-sm">Select an email thread from your inbox to view full details.</p>
                </div>
              )
            )}
          </div>
        )}

        {/* 4. WORKSPACE RIGHT SIDE PANEL (Google Calendar, Tasks, Notes) */}
        <WorkspaceRightPanel currentEmailSubject={selectedEmail?.subject} currentEmailId={selectedEmail?.id} />
      </div>

      {/* FLOATING UNDO SEND TOAST NOTIFICATION */}
      {undoToast && (
        <div className="fixed bottom-6 left-6 z-50 bg-[#1e1e1e] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center space-x-4 border border-slate-700 animate-in slide-in-from-bottom-5 duration-200">
          <span className="text-xs font-semibold">{undoToast.message}</span>
          <button
            onClick={undoToast.onUndo}
            className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-[#c2e7ff] text-[#001d35] text-xs font-bold hover:bg-[#b3d7f0] transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5 text-[#0b57d0]" />
            <span>Undo ({undoToast.countdown}s)</span>
          </button>
        </div>
      )}

      {/* GMAIL FLOATING BOTTOM-RIGHT COMPOSE DOCK */}
      {showComposeModal && (
        isComposeMinimized ? (
          <div
            onClick={() => setIsComposeMinimized(false)}
            className="fixed bottom-0 right-16 z-50 bg-[#1f1f1f] hover:bg-slate-800 text-white rounded-t-xl px-5 py-3 text-xs font-semibold shadow-2xl flex items-center space-x-4 cursor-pointer transition-all border-t border-x border-slate-700"
          >
            <span>New Message</span>
            <div className="flex items-center space-x-2 text-slate-400">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsComposeMinimized(false);
                }}
                className="hover:text-white"
                title="Expand"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowComposeModal(false);
                }}
                className="hover:text-white"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`fixed z-50 bg-white dark:bg-[#1e1e1e] border border-slate-200/90 dark:border-slate-800 rounded-t-2xl shadow-2xl flex flex-col transition-all duration-200 overflow-hidden ${
              isComposeMaximized
                ? 'inset-6 rounded-2xl'
                : 'bottom-0 right-16 w-[580px] h-[540px]'
            }`}
          >
            {/* Compose Header Bar */}
            <div className="bg-[#f2f6fc] dark:bg-slate-800 text-[#1f1f1f] dark:text-white px-4 py-3 rounded-t-2xl flex items-center justify-between shrink-0 select-none border-b border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold tracking-tight">New Message</span>
              <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400">
                <button
                  onClick={() => setIsComposeMinimized(true)}
                  className="p-1 hover:text-slate-900 dark:hover:text-white transition-colors"
                  title="Minimize"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsComposeMaximized(!isComposeMaximized)}
                  className="p-1 hover:text-slate-900 dark:hover:text-white transition-colors"
                  title={isComposeMaximized ? 'Restore' : 'Maximize'}
                >
                  {isComposeMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setShowComposeModal(false)}
                  className="p-1 hover:text-slate-900 dark:hover:text-white transition-colors"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Compose Form */}
            <form onSubmit={(e) => { e.preventDefault(); dispatchSendComposeWithUndo(); }} className="flex-1 flex flex-col min-h-0">
              <div className="divide-y divide-slate-200/80 dark:divide-slate-800">
                {/* From Field (Select Sender Account) */}
                <div className="px-4 py-2 flex items-center space-x-2 text-xs bg-[#f6f8fc]/40 dark:bg-slate-900/40">
                  <span className="text-slate-400 font-semibold w-8 shrink-0">From</span>
                  <select
                    value={composeFromAccountId}
                    onChange={(e) => setComposeFromAccountId(e.target.value)}
                    className="flex-1 bg-transparent border-0 focus:outline-none text-slate-900 dark:text-white font-semibold text-xs cursor-pointer"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium">
                        {acc.label} &lt;{acc.email}&gt;
                      </option>
                    ))}
                  </select>
                </div>

                {/* To Field */}
                <div className="px-4 py-2 flex items-center space-x-2 text-xs">
                  <span className="text-slate-400 font-semibold w-8 shrink-0">To</span>
                  <input
                    type="email"
                    required
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    placeholder="Recipients"
                    className="flex-1 bg-transparent border-0 focus:outline-none text-slate-900 dark:text-white text-xs"
                  />
                  <div className="flex items-center space-x-2 text-slate-400 text-[11px] font-mono">
                    {!showCc && (
                      <button type="button" onClick={() => setShowCc(true)} className="hover:text-[#0b57d0]">
                        Cc
                      </button>
                    )}
                    {!showBcc && (
                      <button type="button" onClick={() => setShowBcc(true)} className="hover:text-[#0b57d0]">
                        Bcc
                      </button>
                    )}
                  </div>
                </div>

                {/* Cc Field */}
                {showCc && (
                  <div className="px-4 py-2 flex items-center space-x-2 text-xs">
                    <span className="text-slate-400 font-semibold w-8 shrink-0">Cc</span>
                    <input
                      type="email"
                      value={composeCc}
                      onChange={(e) => setComposeCc(e.target.value)}
                      placeholder="Cc recipients"
                      className="flex-1 bg-transparent border-0 focus:outline-none text-slate-900 dark:text-white text-xs"
                    />
                  </div>
                )}

                {/* Bcc Field */}
                {showBcc && (
                  <div className="px-4 py-2 flex items-center space-x-2 text-xs">
                    <span className="text-slate-400 font-semibold w-8 shrink-0">Bcc</span>
                    <input
                      type="email"
                      value={composeBcc}
                      onChange={(e) => setComposeBcc(e.target.value)}
                      placeholder="Bcc recipients"
                      className="flex-1 bg-transparent border-0 focus:outline-none text-slate-900 dark:text-white text-xs"
                    />
                  </div>
                )}

                {/* Subject Field */}
                <div className="px-4 py-2 flex items-center text-xs">
                  <input
                    type="text"
                    required
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    placeholder="Subject"
                    className="w-full bg-transparent border-0 focus:outline-none text-slate-900 dark:text-white font-medium text-xs"
                  />
                </div>
              </div>

              {/* Body Textarea */}
              <div className="flex-1 p-4 flex flex-col min-h-0 space-y-2">
                {confidentialConfig && (
                  <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-amber-800 dark:text-amber-300 text-[11px] flex items-center justify-between">
                    <span className="flex items-center space-x-1.5 font-semibold">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Confidential mode ({confidentialConfig.expiration})</span>
                    </span>
                    <button type="button" onClick={() => setConfidentialConfig(null)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <textarea
                  required
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write your email here..."
                  className="flex-1 w-full bg-transparent border-0 focus:outline-none text-xs text-slate-900 dark:text-white leading-relaxed resize-none"
                />

                {composeFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    {composeFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-purple-950/40 border border-blue-200 dark:border-purple-800 text-xs text-[#0b57d0]"
                      >
                        <Paperclip className="w-3.5 h-3.5 text-[#0b57d0]" />
                        <span className="truncate max-w-[160px] font-medium">{file.filename}</span>
                        <span className="text-[10px] opacity-70 font-mono">({formatFileSize(file.size)})</span>
                        <button
                          type="button"
                          onClick={() => setComposeFiles((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-rose-600 ml-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Compose Action Bar */}
              <div className="px-4 py-3 border-t border-slate-200/80 dark:border-slate-800 bg-[#f6f8fc] dark:bg-[#1a1b1e] flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="relative flex items-center">
                    <button
                      type="submit"
                      disabled={isSendingCompose}
                      className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-l-full bg-[#0b57d0] hover:bg-[#0a4ab8] text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
                    >
                      <span>{isSendingCompose ? 'Sending...' : 'Send'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsScheduledSendOpen(!isScheduledSendOpen)}
                      className="px-2 py-2.5 rounded-r-full bg-[#0a4ab8] hover:bg-[#083b94] text-white border-l border-blue-400/40"
                      title="Schedule send"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>

                    {isScheduledSendOpen && (
                      <div className="absolute left-0 bottom-12 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-xl z-50 text-xs space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">Schedule Send</span>
                        <button
                          type="button"
                          onClick={() => {
                            setScheduledSendTime('Tomorrow 8:00 AM');
                            setIsScheduledSendOpen(false);
                            dispatchSendComposeWithUndo();
                          }}
                          className="w-full text-left px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                        >
                          Tomorrow morning (8 AM)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setScheduledSendTime('Monday 8:00 AM');
                            setIsScheduledSendOpen(false);
                            dispatchSendComposeWithUndo();
                          }}
                          className="w-full text-left px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                        >
                          Next Monday (8 AM)
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => composeFileInputRef.current?.click()}
                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors text-[#0b57d0]"
                    title="Attach files"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsTemplatesModalOpen(true)}
                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors text-[#0b57d0]"
                    title="Insert template"
                  >
                    <FileText className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsConfidentialModalOpen(true)}
                    className={`p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors ${confidentialConfig ? 'text-amber-500 font-bold' : 'text-slate-400'}`}
                    title="Toggle Confidential Mode"
                  >
                    <Lock className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowComposeModal(false);
                    setComposeTo('');
                    setComposeSubject('');
                    setComposeBody('');
                    setComposeFiles([]);
                    setConfidentialConfig(null);
                    localStorage.removeItem('gmail_compose_draft');
                  }}
                  className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                  title="Discard draft"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )
      )}

      {/* Modals */}
      <AdvancedSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onApplyFilters={(filters) => setAdvancedFilters(filters)}
        onResetFilters={() => setAdvancedFilters(null)}
      />

      <SnoozeModal
        isOpen={isSnoozeModalOpen}
        onClose={() => setIsSnoozeModalOpen(false)}
        onSnooze={handleSnoozeEmail}
      />

      <LabelManagerModal
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
        labels={customLabels}
        onCreateLabel={handleCreateCustomLabel}
        onToggleLabelOnEmail={(lblId) => labelTargetEmailId && handleToggleLabelOnEmail(labelTargetEmailId, lblId)}
        assignedLabelIds={labelTargetEmailId ? emailLabelsMap[labelTargetEmailId] || [] : []}
      />

      <EmailTemplatesModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
        templates={savedTemplates}
        onSelectTemplate={(tpl) => {
          if (tpl.subject && !composeSubject) setComposeSubject(tpl.subject);
          setComposeBody((prev) => (prev ? `${prev}\n\n${tpl.body}` : tpl.body));
        }}
        onCreateTemplate={(title, subject, body) => {
          setSavedTemplates((prev) => [...prev, { id: `tpl-${Date.now()}`, title, subject, body }]);
        }}
        onDeleteTemplate={(id) => setSavedTemplates((prev) => prev.filter((t) => t.id !== id))}
      />

      <ConfidentialModeModal
        isOpen={isConfidentialModalOpen}
        onClose={() => setIsConfidentialModalOpen(false)}
        currentConfig={confidentialConfig}
        onSave={(config) => setConfidentialConfig(config)}
      />

      <GmailSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={appSettings}
        onUpdateSettings={(newSettings) => setAppSettings((prev) => ({ ...prev, ...newSettings }))}
        accounts={accounts}
        onRefreshAccounts={loadData}
        customLabels={customLabels}
        onCreateLabel={handleCreateCustomLabel}
        onDeleteLabel={(id) => {
          const updated = customLabels.filter((l) => l.id !== id);
          setCustomLabels(updated);
          localStorage.setItem('gmail_custom_labels', JSON.stringify(updated));
        }}
      />

      {/* Gemini AI Reply Drafter Modal */}
      {selectedEmail && (
        <AiReplyDrafterModal
          isOpen={isAiDraftModalOpen}
          onClose={() => setIsAiDraftModalOpen(false)}
          threadId={selectedEmail.threadId || selectedEmail.id}
          emailId={selectedEmail.id}
          threadSubject={selectedEmail.subject}
          emailContext={
            currentThreadMessages.length > 0
              ? currentThreadMessages
                  .map(
                    (m, idx) =>
                      `[Message ${idx + 1} of ${currentThreadMessages.length}]\nFrom: ${m.sender}\nTo: ${m.recipients}\nDate: ${new Date(m.receivedAt).toLocaleString()}\nSubject: ${m.subject || ''}\nBody:\n${m.bodyText || m.snippet || ''}`
                  )
                  .join('\n\n------------------------\n\n')
              : `From: ${selectedEmail.sender}\nTo: ${selectedEmail.recipients}\nSubject: ${selectedEmail.subject || ''}\nBody:\n${selectedEmail.bodyText || selectedEmail.snippet || ''}`
          }
          onInsertDraft={(draftText) => {
            setIsReplying(true);
            setReplyText((prev) => (prev ? `${prev}\n\n${draftText}` : draftText));
          }}
        />
      )}

    </div>

  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-slate-400">Loading Gmail...</div>}>
      <InboxContent />
    </Suspense>
  );
}
