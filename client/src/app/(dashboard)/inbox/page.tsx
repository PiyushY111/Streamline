'use client';

import React, { useEffect, useState, useRef } from 'react';
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
  SlidersHorizontal,
  Square,
  CheckSquare,
  CheckCircle2,
  Sparkles,
  Paperclip,
  MoreVertical,
  CornerUpLeft,
  CornerUpRight,
  Plus,
  X,
  User,
  Calendar,
  CheckSquare as TaskIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Users,
  Minus,
  Maximize2,
  Minimize2,
  Type,
  Link as LinkIcon,
  Smile,
  Image as ImageIcon,
  HardDrive,
  Download,
  File,
  Pencil,
} from 'lucide-react';
import { fetchEmails, fetchConnectedAccounts, EmailData, AccountData } from '@/lib/api';

export default function InboxPage() {
  const [emails, setEmails] = useState<EmailData[]>([]);
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'starred' | 'snoozed' | 'sent' | 'drafts' | 'trash'>('inbox');
  const [activeCategory, setActiveCategory] = useState<'all' | 'primary' | 'social' | 'updates' | 'promotions'>('all');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmailIds, setSelectedEmailIds] = useState<string[]>([]);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [isComposeMinimized, setIsComposeMinimized] = useState(false);
  const [isComposeMaximized, setIsComposeMaximized] = useState(false);
  const [iframeHeights, setIframeHeights] = useState<Record<string, number>>({});

  // File input refs
  const composeFileInputRef = useRef<HTMLInputElement>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);

  // Reply state
  const [isReplying, setIsReplying] = useState(false);
  const [replyMode, setReplyMode] = useState<'reply' | 'forward'>('reply');
  const [replyText, setReplyText] = useState('');
  const [replyFiles, setReplyFiles] = useState<Array<{ filename: string; contentType: string; size: number; content: string }>>([]);
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Compose state
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeFiles, setComposeFiles] = useState<Array<{ filename: string; contentType: string; size: number; content: string }>>([]);
  const [isSendingCompose, setIsSendingCompose] = useState(false);

  // Gmail 50-item Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const loadData = async () => {
    try {
      setLoading(true);
      const [emailData, accData] = await Promise.all([fetchEmails(), fetchConnectedAccounts()]);
      setEmails(emailData);
      setAccounts(accData);
      if (emailData.length > 0 && !selectedEmailId) {
        setSelectedEmailId(emailData[0].id);
      }
    } catch (err) {
      console.warn('Failed to load inbox data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Listen for iframe postMessage height events
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

  const filteredEmails = emails.filter((email) => {
    if (activeFolder === 'starred') return email.isStarred;
    if (activeFolder === 'sent') return (email as any).folder === 'sent' || email.sender.includes('@gmail.com');
    if (activeFolder === 'drafts') return (email as any).folder === 'drafts';
    if (activeFolder === 'trash') return (email as any).folder === 'trash';
    if (activeFolder === 'snoozed') return (email as any).folder === 'snoozed';
    if (activeFolder === 'inbox') return (email as any).folder === 'inbox' || !(email as any).folder;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        email.subject.toLowerCase().includes(q) ||
        email.sender.toLowerCase().includes(q) ||
        email.snippet.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Group emails by threadId so each conversation appears as 1 thread row in inbox
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

  // All messages in current thread sorted chronologically (oldest to newest)
  const currentThreadMessages = selectedEmail
    ? emails
        .filter((e) => e.threadId === selectedEmail.threadId)
        .sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime())
    : [];

  const toggleSelectAll = () => {
    if (selectedEmailIds.length === filteredEmails.length) {
      setSelectedEmailIds([]);
    } else {
      setSelectedEmailIds(filteredEmails.map((e) => e.id));
    }
  };

  const toggleSelectEmail = (id: string) => {
    setSelectedEmailIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectEmail = (email: EmailData) => {
    setSelectedEmailId(email.id);
    setIsReplying(false);

    if (!email.isRead) {
      setEmails((prev) =>
        prev.map((e) => (e.id === email.id ? { ...e, isRead: true } : e))
      );
      fetch(`/api/emails/${email.id}/read`, { method: 'PATCH' }).catch((err) => {
        console.warn('Failed to mark email as read on server:', err);
      });
    }
  };

  const handleToggleStar = (emailId: string) => {
    setEmails((prev) =>
      prev.map((e) => (e.id === emailId ? { ...e, isStarred: !e.isStarred } : e))
    );
    fetch(`/api/emails/${emailId}/star`, { method: 'PATCH' }).catch((err) => {
      console.warn('Failed to star email on server:', err);
    });
  };

  const handleDeleteEmail = (emailId: string) => {
    setEmails((prev) => prev.filter((e) => e.id !== emailId));
    if (selectedEmailId === emailId) {
      setSelectedEmailId(null);
    }
    fetch(`/api/emails/${emailId}`, { method: 'DELETE' }).catch((err) => {
      console.warn('Failed to delete email on server:', err);
    });
  };

  const handleSendReply = async () => {
    if (!selectedEmail || !replyText.trim()) return;

    try {
      setIsSendingReply(true);

      const lastMsg = currentThreadMessages.length > 0 ? currentThreadMessages[currentThreadMessages.length - 1] : selectedEmail;
      const recipient = lastMsg.sender.includes('<')
        ? lastMsg.sender.split('<')[1].replace('>', '')
        : lastMsg.sender;

      const res = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedEmail.accountId,
          to: recipient,
          subject: replyMode === 'reply' ? `Re: ${selectedEmail.subject.replace(/^Re:\s*/i, '')}` : `Fwd: ${selectedEmail.subject}`,
          body: replyText,
          threadId: selectedEmail.threadId,
          attachments: replyFiles,
        }),
      });

      if (res.ok) {
        alert('Email reply with attachments sent successfully via Gmail API!');
        setReplyText('');
        setReplyFiles([]);
        setIsReplying(false);
        await loadData();
      } else {
        const contentType = res.headers.get('content-type');
        let errMsg = 'Failed to send email';
        if (contentType && contentType.includes('application/json')) {
          const errData = await res.json();
          errMsg = errData.error || errMsg;
        } else {
          errMsg = await res.text();
        }
        alert(`Failed to send email: ${errMsg}`);
      }
    } catch (e: any) {
      alert(`Error sending reply: ${e.message}`);
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleSendCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo || !composeSubject || !composeBody) return;

    try {
      setIsSendingCompose(true);
      const res = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: composeTo,
          subject: composeSubject,
          body: composeBody,
          attachments: composeFiles,
        }),
      });

      if (res.ok) {
        alert('Email with attachments sent successfully via Gmail API!');
        setShowComposeModal(false);
        setComposeTo('');
        setComposeCc('');
        setComposeBcc('');
        setComposeSubject('');
        setComposeBody('');
        setComposeFiles([]);
        loadData();
      } else {
        const contentType = res.headers.get('content-type');
        let errMsg = 'Failed to send email';
        if (contentType && contentType.includes('application/json')) {
          const errData = await res.json();
          errMsg = errData.error || errMsg;
        } else {
          errMsg = await res.text();
        }
        alert(`Failed to send email: ${errMsg}`);
      }
    } catch (e: any) {
      alert(`Error sending email: ${e.message}`);
    } finally {
      setIsSendingCompose(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] -m-6 overflow-hidden bg-[#f6f8fc] dark:bg-[#18191b] transition-colors duration-200">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={composeFileInputRef}
        multiple
        className="hidden"
        onChange={handleComposeFileSelect}
      />
      <input
        type="file"
        ref={replyFileInputRef}
        multiple
        className="hidden"
        onChange={handleReplyFileSelect}
      />

      {/* 1. Gmail Material You Navigation Sidebar */}
      <aside className="w-56 bg-[#f6f8fc] dark:bg-[#1e1e1e] border-r border-slate-200/80 dark:border-slate-800/80 p-3 flex flex-col justify-between shrink-0">
        <div className="space-y-4">
          {/* Gmail Classic Compose Button */}
          <button
            onClick={() => {
              setShowComposeModal(true);
              setIsComposeMinimized(false);
            }}
            className="w-full flex items-center space-x-3 px-5 py-3.5 rounded-2xl bg-[#c2e7ff] hover:bg-[#b3d7f0] dark:bg-purple-600 dark:hover:bg-purple-700 text-[#001d35] dark:text-white font-semibold text-xs shadow-sm transition-all hover:scale-[1.01] active:scale-95"
          >
            <Pencil className="w-4 h-4 text-[#0b57d0] dark:text-white" />
            <span className="font-bold text-xs tracking-wide">Compose</span>
          </button>

          {/* Gmail Folders */}
          <nav className="space-y-1">
            {[
              { id: 'inbox', label: 'Inbox', icon: InboxIcon, count: emails.filter((e) => !e.isRead && (e as any).folder === 'inbox').length },
              { id: 'starred', label: 'Starred', icon: Star, count: emails.filter((e) => e.isStarred).length },
              { id: 'snoozed', label: 'Snoozed', icon: Clock },
              { id: 'sent', label: 'Sent', icon: Send },
              { id: 'drafts', label: 'Drafts', icon: FileText },
              { id: 'trash', label: 'Trash', icon: Trash2 },
            ].map((folder) => {
              const Icon = folder.icon;
              const isActive = activeFolder === folder.id;
              return (
                <button
                  key={folder.id}
                  onClick={() => {
                    setActiveFolder(folder.id as any);
                    setCurrentPage(1);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full text-xs transition-colors ${
                    isActive
                      ? 'bg-[#c2e7ff] text-[#001d35] font-bold dark:bg-[#2d3748] dark:text-[#d3e3fd]'
                      : 'text-[#444746] dark:text-slate-300 hover:bg-[#eaeff6] dark:hover:bg-slate-800/60 font-medium'
                  }`}
                >
                  <div className="flex items-center space-x-3.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#0b57d0] dark:text-[#a855f7]' : 'text-slate-500'}`} />
                    <span>{folder.label}</span>
                  </div>
                  {folder.count !== undefined && folder.count > 0 && (
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                        isActive
                          ? 'bg-[#0b57d0] text-white dark:bg-purple-600'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {folder.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Connected Mailboxes */}
          <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
            <div className="px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Connected Mailboxes
            </div>
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center space-x-2.5 px-3 py-1.5 rounded-xl bg-white/70 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 text-xs"
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: acc.color }} />
                <div className="flex flex-col text-left truncate">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] truncate">{acc.label}</span>
                  <span className="text-[9px] text-slate-400 font-mono truncate">{acc.email}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Sync Indicator */}
        <div className="px-3 py-2 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Gmail Live Sync</span>
          </span>
          <button onClick={loadData} title="Refresh Gmail">
            <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </aside>

      {/* 2. Gmail Mail List Panel */}
      <div className="w-96 border-r border-slate-200/80 dark:border-slate-800 flex flex-col bg-white dark:bg-[#18191b] shrink-0">
        {/* Gmail Search & Categories */}
        <div className="p-3 border-b border-slate-200/80 dark:border-slate-800 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in mail"
              className="w-full bg-[#eaf1fb] dark:bg-[#28292c] border border-transparent dark:border-slate-800 rounded-full pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:bg-white focus:border-[#0b57d0] transition-all"
            />
          </div>

          <div className="flex items-center justify-between px-1 text-slate-500 text-xs">
            <div className="flex items-center space-x-2">
              <button onClick={toggleSelectAll} className="p-1 hover:text-slate-800 dark:hover:text-slate-200">
                {selectedEmailIds.length === filteredEmails.length && filteredEmails.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-[#0b57d0] dark:text-purple-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
              </button>
              <button onClick={loadData} className="p-1 hover:text-slate-800 dark:hover:text-slate-200" title="Refresh">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                {totalCount === 0 ? '0 of 0' : `${startIndex + 1}–${endIndex} of ${totalCount}`}
              </span>
              <div className="flex items-center space-x-0.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 transition-colors"
                  title="Previous 50 messages"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  disabled={currentPage === totalPages || totalCount === 0}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 transition-colors"
                  title="Next 50 messages"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1 pt-1 overflow-x-auto">
            {(['all', 'primary', 'social', 'updates', 'promotions'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-full text-[10px] font-semibold capitalize whitespace-nowrap transition-colors ${
                  activeCategory === cat
                    ? 'bg-[#0b57d0] text-white dark:bg-purple-600'
                    : 'bg-[#eaf1fb] dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Email Thread List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-900">
          {paginatedEmails.length === 0 ? (
            <div className="p-12 text-center space-y-3 my-auto">
              <InboxIcon className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
              <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400">Folder is Empty</h3>
              <p className="text-[10px] text-slate-400">No email messages found in {activeFolder}.</p>
            </div>
          ) : (
            paginatedEmails.map((email) => {
              const isSelected = selectedEmailId === email.id || (selectedEmail && selectedEmail.threadId === email.threadId);
              const isChecked = selectedEmailIds.includes(email.id);
              const count = (email as any).messageCount || 1;
              const hasAttachments = (email as any).attachments && (email as any).attachments.length > 0;

              return (
                <div
                  key={email.id}
                  onClick={() => handleSelectEmail(email)}
                  className={`p-3.5 flex items-start space-x-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#c2e7ff]/80 text-[#001d35] border-l-4 border-l-[#0b57d0] dark:bg-[#2d3748] dark:text-white dark:border-l-purple-500'
                      : !email.isRead
                      ? 'bg-white text-[#1f1f1f] font-bold border-l-4 border-l-[#0b57d0] dark:bg-[#232427] dark:text-[#f1f3f4] dark:border-l-purple-500 shadow-2xs'
                      : 'bg-[#f6f8fc] text-[#444746] dark:bg-[#1e1e1e]/60 dark:text-slate-400 hover:bg-slate-200/50'
                  }`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectEmail(email.id);
                    }}
                    className="mt-0.5 text-slate-400 hover:text-slate-600 shrink-0"
                  >
                    {isChecked ? <CheckSquare className="w-4 h-4 text-[#0b57d0] dark:text-purple-400" /> : <Square className="w-4 h-4 text-slate-300" />}
                  </button>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 truncate">
                        {!email.isRead && (
                          <span className="w-2 h-2 rounded-full bg-[#0b57d0] dark:bg-purple-500 shrink-0" title="Unread" />
                        )}
                        <span className={`text-xs truncate ${!email.isRead ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-600 dark:text-slate-400'}`}>
                          {email.sender}
                        </span>
                        {count > 1 && (
                          <span className="px-1.5 py-0.2 rounded-md bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 font-mono">
                            {count}
                          </span>
                        )}
                        {hasAttachments && (
                          <span title="Has attachments">
                            <Paperclip className="w-3 h-3 text-slate-400 shrink-0" />
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1 shrink-0 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStar(email.id);
                          }}
                          className="text-slate-400 hover:text-amber-500"
                        >
                          <Star className={`w-3.5 h-3.5 ${email.isStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
                        </button>
                        <span className={`text-[10px] font-mono ${!email.isRead ? 'font-bold text-[#0b57d0] dark:text-purple-400' : 'text-slate-400'}`}>
                          {new Date(email.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: email.accountColor || '#0b57d0' }}
                      />
                      <p className={`text-xs truncate ${!email.isRead ? 'font-bold text-slate-900 dark:text-white' : 'font-normal text-slate-600 dark:text-slate-400'}`}>
                        {email.subject}
                      </p>
                    </div>

                    <p className={`text-[11px] line-clamp-1 leading-normal ${!email.isRead ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                      {email.snippet}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. Gmail Native Thread Reader Canvas */}
      <div className="flex-1 flex flex-col bg-white dark:bg-[#1e1e1e] overflow-hidden">
        {selectedEmail ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Subject Header Bar */}
            <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 space-y-2 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{
                      backgroundColor: `${selectedEmail.accountColor}15`,
                      color: selectedEmail.accountColor,
                      border: `1px solid ${selectedEmail.accountColor}30`,
                    }}
                  >
                    {selectedEmail.accountName}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {currentThreadMessages.length} message{currentThreadMessages.length === 1 ? '' : 's'} in thread
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleToggleStar(selectedEmail.id)}
                    className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-amber-500 transition-colors"
                    title="Star message on Gmail"
                  >
                    <Star className={`w-4 h-4 ${selectedEmail.isStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
                  </button>
                  <button
                    className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-[#0b57d0] dark:hover:text-purple-400 transition-colors"
                    title="Create Action Item / Task"
                  >
                    <TaskIcon className="w-4 h-4" />
                  </button>
                  <button
                    className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-colors"
                    title="Schedule Calendar Event"
                  >
                    <Calendar className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteEmail(selectedEmail.id)}
                    className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-rose-600 transition-colors"
                    title="Trash Message on Gmail"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-snug tracking-tight">
                {selectedEmail.subject}
              </h1>
            </div>

            {/* Messages Flow */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-200/80 dark:divide-slate-800">
              {currentThreadMessages.map((msg, index) => {
                const match = msg.sender.match(/^(.*?)\s*<([^>]+)>$/);
                const senderName = match ? match[1].replace(/['"]/g, '').trim() || match[2] : msg.sender;
                const senderEmail = match ? match[2] : msg.sender;
                const recipientClean = msg.recipients.replace(/[<>]/g, '');
                let attachmentsList: Array<{ filename: string; mimeType?: string; size?: number; content?: string }> = [];
                try {
                  const rawAtt = (msg as any).attachments;
                  if (Array.isArray(rawAtt)) {
                    attachmentsList = rawAtt;
                  } else if (typeof rawAtt === 'string') {
                    attachmentsList = JSON.parse(rawAtt);
                  }
                } catch (e) {
                  attachmentsList = [];
                }

                return (
                  <div key={msg.id} className="px-6 py-4 space-y-3 hover:bg-slate-50/40 dark:hover:bg-slate-900/20 transition-colors">
                    {/* Header Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="h-9 w-9 rounded-full bg-[#0b57d0] dark:bg-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-xs shrink-0">
                          {senderName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="text-xs font-bold text-slate-900 dark:text-white">{senderName}</h3>
                            <span className="text-[11px] text-slate-500 font-normal">&lt;{senderEmail}&gt;</span>
                          </div>
                          <div className="flex items-center space-x-1 text-[10px] text-slate-400 mt-0.5">
                            <span>to me</span>
                            <ChevronDown className="w-3 h-3 text-slate-400" />
                            <span className="font-mono">({recipientClean})</span>
                          </div>
                        </div>
                      </div>

                      <span className="text-[11px] text-slate-400 font-mono shrink-0">
                        {new Date(msg.receivedAt).toLocaleString([], {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>

                    {/* Body Row */}
                    <div className="pt-1 text-slate-800 dark:text-slate-200 text-xs leading-relaxed">
                      {msg.bodyHtml && msg.bodyHtml.includes('<') ? (
                        <iframe
                          id={`iframe-${msg.id}`}
                          title={`Email Body ${index}`}
                          scrolling="no"
                          srcDoc={`<!DOCTYPE html><html><head><base target="_blank"><style>html,body{margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;font-size:14px;color:#1e293b;line-height:1.5;background:transparent;overflow:hidden;} img{max-width:100%;height:auto;} a{color:#7c3aed;}</style></head><body><div id="content-root">${msg.bodyHtml}</div><script>function sendHeight(){var el=document.getElementById('content-root');if(el){window.parent.postMessage({frameId:'${msg.id}',height:el.offsetHeight},'*');}}window.addEventListener('load',sendHeight);setTimeout(sendHeight,50);setTimeout(sendHeight,300);setTimeout(sendHeight,1000);</script></body></html>`}
                          className="w-full border-0 bg-transparent overflow-hidden"
                          style={{ height: iframeHeights[msg.id] ? `${iframeHeights[msg.id]}px` : '40px' }}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap text-xs text-slate-800 dark:text-slate-200 leading-relaxed py-1">
                          {msg.bodyText || msg.snippet}
                        </p>
                      )}
                    </div>

                    {/* Attachments Section */}
                    {attachmentsList.length > 0 && (
                      <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800 space-y-2">
                        <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-semibold">
                          <Paperclip className="w-3.5 h-3.5 text-[#0b57d0] dark:text-purple-400" />
                          <span>{attachmentsList.length} Attachment{attachmentsList.length === 1 ? '' : 's'}</span>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          {attachmentsList.map((att, attIdx) => {
                            const isImage = att.mimeType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(att.filename);
                            return (
                              <div
                                key={attIdx}
                                className="flex flex-col p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs hover:border-[#0b57d0] dark:hover:border-purple-800 transition-all shadow-2xs max-w-[220px]"
                              >
                                {isImage && att.content && (
                                  <div className="w-full h-28 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 mb-2 relative">
                                    <img src={att.content} alt={att.filename} className="w-full h-full object-cover" />
                                  </div>
                                )}
                                <div className="flex items-center justify-between space-x-2">
                                  <div className="flex items-center space-x-1.5 truncate">
                                    <File className="w-3.5 h-3.5 text-[#0b57d0] dark:text-purple-400 shrink-0" />
                                    <span className="font-semibold text-slate-900 dark:text-white truncate">{att.filename}</span>
                                  </div>
                                  {att.content && (
                                    <a
                                      href={att.content}
                                      download={att.filename}
                                      className="p-1 rounded-lg bg-blue-50 dark:bg-purple-900/40 text-[#0b57d0] dark:text-purple-300 hover:bg-blue-100 transition-colors shrink-0"
                                      title="Download file"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono mt-0.5">{formatFileSize(att.size || 0)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Action Container */}
            <div className="p-5 border-t border-slate-200/80 dark:border-slate-800 bg-[#f6f8fc]/50 dark:bg-[#18191b] space-y-3 shrink-0">
              {!isReplying ? (
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      setIsReplying(true);
                      setReplyMode('reply');
                    }}
                    className="inline-flex items-center space-x-2 px-5 py-2 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs"
                  >
                    <CornerUpLeft className="w-4 h-4 text-slate-500" />
                    <span>Reply</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsReplying(true);
                      setReplyMode('forward');
                    }}
                    className="inline-flex items-center space-x-2 px-5 py-2 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs"
                  >
                    <CornerUpRight className="w-4 h-4 text-slate-500" />
                    <span>Forward</span>
                  </button>
                </div>
              ) : (
                <div className="p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl space-y-3 shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {replyMode === 'reply' ? <CornerUpLeft className="w-4 h-4 text-[#0b57d0] dark:text-purple-400" /> : <CornerUpRight className="w-4 h-4 text-[#0b57d0] dark:text-purple-400" />}
                      <span>{replyMode === 'reply' ? `Reply to ${selectedEmail.sender}` : `Forward message`}</span>
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

                  {/* Reply Attachments Badges */}
                  {replyFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {replyFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-purple-950/40 border border-blue-200 dark:border-purple-800 text-xs text-[#0b57d0] dark:text-purple-200"
                        >
                          <Paperclip className="w-3.5 h-3.5 text-[#0b57d0] shrink-0" />
                          <span className="truncate max-w-[140px] font-medium">{file.filename}</span>
                          <span className="text-[10px] opacity-70 font-mono">({formatFileSize(file.size)})</span>
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
                        onClick={handleSendReply}
                        className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-[#0b57d0] hover:bg-[#0a4ab8] text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{isSendingReply ? 'Sending via Gmail...' : 'Send'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => replyFileInputRef.current?.click()}
                        className="p-2 text-slate-400 hover:text-[#0b57d0] transition-colors"
                        title="Attach files"
                      >
                        <Paperclip className="w-4 h-4" />
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
          <div className="flex-1 flex flex-col items-center justify-center my-auto text-center p-12 space-y-3">
            <InboxIcon className="w-12 h-12 text-slate-300 dark:text-slate-700" />
            <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">No Email Selected</h3>
            <p className="text-xs text-slate-400 max-w-sm">Select an email thread from your inbox to view full details and reply.</p>
          </div>
        )}
      </div>

      {/* Gmail Floating Bottom-Right Compose Dock */}
      {showComposeModal && (
        isComposeMinimized ? (
          <div
            onClick={() => setIsComposeMinimized(false)}
            className="fixed bottom-0 right-12 z-50 bg-[#1f1f1f] hover:bg-slate-800 text-white rounded-t-xl px-5 py-2.5 text-xs font-semibold shadow-2xl flex items-center space-x-4 cursor-pointer transition-all border-t border-x border-slate-700"
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
            className={`fixed z-50 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-t-2xl shadow-2xl flex flex-col transition-all duration-200 overflow-hidden ${
              isComposeMaximized
                ? 'inset-6 rounded-2xl'
                : 'bottom-0 right-12 w-[580px] h-[540px]'
            }`}
          >
            {/* Header Bar */}
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

            {/* Compose Form Inputs */}
            <form onSubmit={handleSendCompose} className="flex-1 flex flex-col min-h-0">
              <div className="divide-y divide-slate-200/80 dark:divide-slate-800">
                {/* To Row */}
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

                {/* Cc Row */}
                {showCc && (
                  <div className="px-4 py-2 flex items-center space-x-2 text-xs animate-in fade-in">
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

                {/* Bcc Row */}
                {showBcc && (
                  <div className="px-4 py-2 flex items-center space-x-2 text-xs animate-in fade-in">
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

                {/* Subject Row */}
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

              {/* Message Body Textarea */}
              <div className="flex-1 p-4 flex flex-col min-h-0 space-y-2">
                <textarea
                  required
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder="Write your email here..."
                  className="flex-1 w-full bg-transparent border-0 focus:outline-none text-xs text-slate-900 dark:text-white leading-relaxed resize-none"
                />

                {/* Compose Attachments Badges */}
                {composeFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    {composeFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-purple-950/40 border border-blue-200 dark:border-purple-800 text-xs text-[#0b57d0] dark:text-purple-200"
                      >
                        <Paperclip className="w-3.5 h-3.5 text-[#0b57d0] shrink-0" />
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

              {/* Gmail Action & Formatting Footer Bar */}
              <div className="px-4 py-3 border-t border-slate-200/80 dark:border-slate-800 bg-[#f6f8fc] dark:bg-slate-950 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3">
                  <button
                    type="submit"
                    disabled={isSendingCompose}
                    className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-full bg-[#0b57d0] hover:bg-[#0a4ab8] text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <span>{isSendingCompose ? 'Sending...' : 'Send'}</span>
                    <ChevronDown className="w-3.5 h-3.5 border-l border-blue-400 pl-1" />
                  </button>

                  <div className="flex items-center space-x-1 text-slate-500 dark:text-slate-400">
                    <button type="button" className="p-1.5 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg" title="Formatting options">
                      <Type className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => composeFileInputRef.current?.click()}
                      className="p-1.5 hover:text-[#0b57d0] transition-colors rounded-lg"
                      title="Attach files"
                    >
                      <Paperclip className="w-4 h-4 text-[#0b57d0]" />
                    </button>
                    <button type="button" className="p-1.5 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg" title="Insert link">
                      <LinkIcon className="w-4 h-4" />
                    </button>
                    <button type="button" className="p-1.5 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg" title="Insert emoji">
                      <Smile className="w-4 h-4" />
                    </button>
                    <button type="button" className="p-1.5 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg" title="Insert files using Drive">
                      <HardDrive className="w-4 h-4" />
                    </button>
                    <button type="button" className="p-1.5 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg" title="Insert photo">
                      <ImageIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowComposeModal(false);
                    setComposeTo('');
                    setComposeSubject('');
                    setComposeBody('');
                    setComposeFiles([]);
                  }}
                  className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                  title="Discard draft"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )
      )}
    </div>
  );
}
