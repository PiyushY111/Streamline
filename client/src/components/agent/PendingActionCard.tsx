'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  Mail,
  CheckSquare,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Paperclip,
  Eye,
  Download,
  Sparkles,
  User,
  MapPin,
  Tag,
  ArrowRight,
  FileText,
  Image as ImageIcon,
  File,
  Archive,
  Code,
} from 'lucide-react';
import { PendingActionData } from '@/lib/api';
import { useApproveAction, useRejectAction } from '@/lib/hooks/useAgentActions';
import { AttachmentPreviewModal, ActionAttachment } from './AttachmentPreviewModal';

interface PendingActionCardProps {
  action: PendingActionData;
  onResolved?: () => void;
}

export function PendingActionCard({ action, onResolved }: PendingActionCardProps) {
  const [resolvedStatus, setResolvedStatus] = useState<string | null>(null);
  const [selectedAttachment, setSelectedAttachment] = useState<ActionAttachment | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isExpandedBody, setIsExpandedBody] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const rejectBtnRef = useRef<HTMLButtonElement>(null);
  const approveBtnRef = useRef<HTMLButtonElement>(null);

  const approveMutation = useApproveAction();
  const rejectMutation = useRejectAction();

  const loading = approveMutation.isPending || rejectMutation.isPending;

  // Accessibility: Focus Reject button by default and handle Escape / Tab keyboard trapping
  useEffect(() => {
    if (!resolvedStatus) {
      rejectBtnRef.current?.focus();
    }
  }, [resolvedStatus]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (resolvedStatus || isPreviewModalOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        handleReject();
      }

      if (e.key === 'Tab') {
        const rejectBtn = rejectBtnRef.current;
        const approveBtn = approveBtnRef.current;
        if (!rejectBtn || !approveBtn) return;

        if (e.shiftKey && document.activeElement === rejectBtn) {
          e.preventDefault();
          approveBtn.focus();
        } else if (!e.shiftKey && document.activeElement === approveBtn) {
          e.preventDefault();
          rejectBtn.focus();
        }
      }
    };

    const element = cardRef.current;
    element?.addEventListener('keydown', handleKeyDown);
    return () => {
      element?.removeEventListener('keydown', handleKeyDown);
    };
  }, [resolvedStatus, isPreviewModalOpen]);

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync({ actionId: action.id });
      setResolvedStatus('executed');
      onResolved?.();
    } catch {
      // Error handled by mutation toast
    }
  };

  const handleReject = async () => {
    try {
      await rejectMutation.mutateAsync(action.id);
      setResolvedStatus('rejected');
      onResolved?.();
    } catch {
      // Error handled by mutation toast
    }
  };

  const getToolMeta = () => {
    switch (action.toolName) {
      case 'create_calendar_event':
        return {
          label: 'Calendar Event',
          icon: Calendar,
          iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
          gradient: 'from-blue-500/5 via-transparent to-transparent',
          border: 'border-blue-200/80 dark:border-blue-900/40 hover:border-blue-400 dark:hover:border-blue-700',
          badge: 'Write Action',
          badgeColor:
            'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        };
      case 'send_email':
        return {
          label: 'External Email',
          icon: Mail,
          iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
          gradient: 'from-rose-500/5 via-transparent to-transparent',
          border: 'border-rose-200/80 dark:border-rose-900/40 hover:border-rose-400 dark:hover:border-rose-700',
          badge: 'Send Action • High Consequence',
          badgeColor:
            'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        };
      case 'create_task':
        return {
          label: 'Create Task',
          icon: CheckSquare,
          iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
          gradient: 'from-amber-500/5 via-transparent to-transparent',
          border: 'border-amber-200/80 dark:border-amber-900/40 hover:border-amber-400 dark:hover:border-amber-700',
          badge: 'Write Action',
          badgeColor:
            'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        };
      default:
        return {
          label: action.toolName.replace(/_/g, ' '),
          icon: AlertTriangle,
          iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
          gradient: 'from-indigo-500/5 via-transparent to-transparent',
          border: 'border-indigo-200/80 dark:border-indigo-900/40 hover:border-indigo-400 dark:hover:border-indigo-700',
          badge: 'Action Proposal',
          badgeColor:
            'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
        };
    }
  };

  const meta = getToolMeta();
  const Icon = meta.icon;
  const preview = (action.impactPreview || action.toolArgs || {}) as Record<string, any>;

  // Extract all attachments from impactPreview, toolArgs, or security contexts
  const extractAttachments = (): ActionAttachment[] => {
    const list: ActionAttachment[] = [];

    const rawList =
      preview.attachments ||
      (action.toolArgs as Record<string, any>)?.attachments ||
      preview.files ||
      (action.toolArgs as Record<string, any>)?.files ||
      [];

    if (Array.isArray(rawList)) {
      rawList.forEach((item, index) => {
        if (typeof item === 'string') {
          list.push({
            id: `att-${index}`,
            filename: item,
            mimeType: 'application/octet-stream',
            size: 154000,
          });
        } else if (item && typeof item === 'object') {
          list.push({
            id: item.id || `att-${index}`,
            filename: item.filename || item.name || `attachment-${index + 1}.pdf`,
            mimeType: item.mimeType || item.contentType || 'application/octet-stream',
            size: item.size || 245000,
            url: item.url,
            content: item.content,
            previewUrl: item.previewUrl,
          });
        }
      });
    }

    // If no attachments in payload, but it's an email proposal or untrusted trigger with external context,
    // provide contextual attachment chips for inspection if referenced
    if (list.length === 0 && preview.attachmentName) {
      list.push({
        id: 'att-context',
        filename: preview.attachmentName,
        size: preview.attachmentSize || 310000,
        mimeType: preview.attachmentMime || 'application/pdf',
      });
    }

    return list;
  };

  const attachments = extractAttachments();

  const expiresTime = new Date(action.expiresAt);
  const hoursRemaining = Math.max(0, Math.round((expiresTime.getTime() - Date.now()) / 3600000));

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '128 KB';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getAttachmentIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
      return <ImageIcon className="w-4 h-4 text-emerald-500" />;
    } else if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) {
      return <FileText className="w-4 h-4 text-rose-500" />;
    } else if (['zip', 'tar', 'gz', 'rar'].includes(ext)) {
      return <Archive className="w-4 h-4 text-amber-500" />;
    } else if (['json', 'js', 'ts', 'tsx', 'py'].includes(ext)) {
      return <Code className="w-4 h-4 text-purple-500" />;
    }
    return <File className="w-4 h-4 text-blue-500" />;
  };

  const openAttachmentPreview = (att: ActionAttachment) => {
    setSelectedAttachment(att);
    setIsPreviewModalOpen(true);
  };

  if (resolvedStatus === 'executed') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex items-center space-x-3 text-xs text-emerald-800 dark:text-emerald-300 shadow-sm animate-in fade-in duration-200"
      >
        <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
        </div>
        <div>
          <h5 className="font-bold text-sm text-emerald-950 dark:text-emerald-200">Action Approved &amp; Executed</h5>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
            The changes were executed successfully on your connected account.
          </p>
        </div>
      </div>
    );
  }

  if (resolvedStatus === 'rejected') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center space-x-3 text-xs text-slate-500 shadow-sm animate-in fade-in duration-200"
      >
        <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400">
          <XCircle className="w-4 h-4" aria-hidden="true" />
        </div>
        <div>
          <h5 className="font-bold text-sm text-slate-700 dark:text-slate-300">Action Rejected</h5>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            The proposed action was dismissed. No changes were made.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={cardRef}
        role="region"
        aria-label={`${meta.label} Human-in-the-Loop Review Card`}
        aria-busy={loading}
        data-testid="shield-action-card"
        tabIndex={0}
        className={`rounded-2xl border ${meta.border} bg-white dark:bg-[#121316] bg-gradient-to-b ${meta.gradient} p-4 sm:p-5 space-y-4 shadow-sm hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary/40`}
      >
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-xl border ${meta.iconBg} shadow-xs`}>
              <Icon className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 id={`action-title-${action.id}`} className="text-sm font-bold text-slate-900 dark:text-white">
                  {meta.label} Proposal
                </h4>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${meta.badgeColor}`}>
                  {meta.badge}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                <span>
                  Created {new Date(action.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {attachments.length > 0 && (
                  <>
                    <span>•</span>
                    <span className="flex items-center space-x-1 text-primary font-medium">
                      <Paperclip className="w-3 h-3" />
                      <span>
                        {attachments.length} attachment{attachments.length > 1 ? 's' : ''}
                      </span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
            <Clock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <span>Expires in {hoursRemaining}h</span>
          </div>
        </div>

        {/* Shield Security Alert Box */}
        {preview?._securityNotice && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center space-x-2">
              <div className="p-1 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <ShieldAlert className="w-4 h-4" aria-hidden="true" />
              </div>
              <span className="font-bold text-[11px] tracking-wider uppercase text-amber-700 dark:text-amber-300">
                Shield Alert: Untrusted Inbound Trigger
              </span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed pl-7">
              This action proposal was prompted after ingesting external content from{' '}
              <code className="px-2 py-0.5 rounded-md bg-amber-500/15 dark:bg-amber-900/60 border border-amber-500/30 font-mono text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                {preview._securityNotice.sourceSender}
              </code>
              . Verify all parameters and attachments before confirming.
            </p>
          </div>
        )}

        {/* Agent Stated Reasoning */}
        {action.reasoning && (
          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800/70 flex items-start space-x-2.5 text-xs">
            <Sparkles className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5 min-w-0 flex-1">
              <span className="font-semibold text-slate-900 dark:text-white text-[11px] block">
                Agent Stated Reasoning
              </span>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-xs">{action.reasoning}</p>
            </div>
          </div>
        )}

        {/* What Will Change Upon Approval */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
              <span>What will change upon approval:</span>
            </span>
          </div>

          {/* Calendar Event Details */}
          {action.toolName === 'create_calendar_event' && (
            <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Event Title</span>
                  <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center space-x-1.5">
                    <Calendar className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>{preview.title || preview.name || 'Untitled Event'}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Duration</span>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-semibold text-xs">
                    {preview.durationMinutes || 60} mins
                  </span>
                </div>

                <div className="col-span-1 sm:col-span-2 space-y-1 pt-1 border-t border-slate-200/50 dark:border-slate-800/50">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                    Scheduled Time
                  </span>
                  <div className="font-mono text-xs text-slate-800 dark:text-slate-200 font-medium flex items-center space-x-2">
                    <span>
                      {new Date(preview.startTime).toLocaleDateString([], {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <span>•</span>
                    <span>
                      {new Date(preview.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                      {new Date(preview.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                {preview.location && preview.location !== 'None' && (
                  <div className="col-span-1 sm:col-span-2 flex items-center space-x-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{preview.location}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Email Send Details */}
          {action.toolName === 'send_email' && (
            <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 space-y-3">
              <div className="space-y-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">To:</span>
                  <span className="font-mono font-semibold px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white">
                    {preview.to}
                  </span>
                </div>

                <div className="flex items-baseline space-x-2">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Subject:</span>
                  <strong className="text-sm font-bold text-slate-900 dark:text-white">{preview.subject}</strong>
                </div>

                {/* Email Body Preview Box */}
                {(preview.body || preview.bodySnippet) && (
                  <div className="mt-2 p-3.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 text-xs space-y-1.5 shadow-inner">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                      <span>Message Preview</span>
                      {preview.characterCount && <span>{preview.characterCount} characters</span>}
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 italic whitespace-pre-wrap leading-relaxed font-sans">
                      &quot;{isExpandedBody ? preview.body || preview.bodySnippet : preview.bodySnippet || preview.body}
                      &quot;
                    </p>
                    {preview.body && preview.body.length > 200 && (
                      <button
                        type="button"
                        onClick={() => setIsExpandedBody(!isExpandedBody)}
                        className="text-[11px] text-primary hover:underline font-semibold pt-1 block"
                      >
                        {isExpandedBody ? 'Show less' : 'Show full email body'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Task Creation Details */}
          {action.toolName === 'create_task' && (
            <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Task Title</span>
                  <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center space-x-1.5">
                    <CheckSquare className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>{preview.title}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Priority</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-bold uppercase text-[10px]">
                    {preview.priority || 'medium'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Attachments Section with Quick Preview & Download Options */}
          {attachments.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-primary" />
                  <span>Attached Files ({attachments.length})</span>
                </span>
                <span className="text-[11px] text-slate-400">Click preview to inspect content</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {attachments.map((att, idx) => (
                  <div
                    key={att.id || idx}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 hover:bg-slate-100 dark:hover:bg-slate-800/60 flex items-center justify-between gap-2 transition-all group"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                      <div className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0">
                        {getAttachmentIcon(att.filename)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h6 className="font-bold text-xs text-slate-900 dark:text-white truncate" title={att.filename}>
                          {att.filename}
                        </h6>
                        <span className="text-[10px] text-slate-400 font-mono block">{formatFileSize(att.size)}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openAttachmentPreview(att)}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-primary hover:text-white dark:hover:bg-primary border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center space-x-1 transition-colors cursor-pointer shadow-2xs"
                        title="Preview attachment content"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Decision Action Buttons */}
        <div className="flex items-center justify-end space-x-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/60">
          <button
            ref={rejectBtnRef}
            type="button"
            disabled={loading}
            onClick={handleReject}
            data-testid="reject-action-btn"
            aria-label="Reject proposed action"
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 dark:hover:border-rose-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-slate-400 cursor-pointer disabled:opacity-50"
          >
            Reject (Esc)
          </button>
          <button
            ref={approveBtnRef}
            type="button"
            disabled={loading}
            onClick={handleApprove}
            data-testid="approve-action-btn"
            aria-label="Approve and execute proposed action"
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-sm hover:shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-98 flex items-center space-x-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            <span>{loading ? 'Executing...' : 'Approve & Execute'}</span>
          </button>
        </div>
      </div>

      {/* Attachment Preview Modal */}
      <AttachmentPreviewModal
        attachment={selectedAttachment}
        isOpen={isPreviewModalOpen}
        onClose={() => {
          setIsPreviewModalOpen(false);
          setSelectedAttachment(null);
        }}
      />
    </>
  );
}
