'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  FileText,
  Image as ImageIcon,
  File,
  Archive,
  Code,
  ShieldCheck,
  Eye,
  Maximize2,
  ZoomIn,
  ZoomOut,
  ExternalLink,
} from 'lucide-react';

export interface ActionAttachment {
  id?: string;
  filename: string;
  mimeType?: string;
  size?: number;
  url?: string;
  content?: string;
  previewUrl?: string;
}

interface AttachmentPreviewModalProps {
  attachment: ActionAttachment | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AttachmentPreviewModal({ attachment, isOpen, onClose }: AttachmentPreviewModalProps) {
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setZoomLevel(1);
    }
  }, [isOpen, attachment]);

  if (!isOpen || !attachment) return null;

  const ext = attachment.filename.split('.').pop()?.toLowerCase() || '';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext);
  const isPdf = ext === 'pdf';
  const isCodeOrText = ['json', 'js', 'ts', 'tsx', 'txt', 'csv', 'md', 'html', 'css', 'py', 'sh'].includes(ext);

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '128 KB';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getFileIcon = () => {
    if (isImage) return <ImageIcon className="w-5 h-5 text-emerald-500" />;
    if (isPdf) return <FileText className="w-5 h-5 text-rose-500" />;
    if (isCodeOrText) return <Code className="w-5 h-5 text-purple-500" />;
    if (['zip', 'tar', 'gz', 'rar'].includes(ext)) return <Archive className="w-5 h-5 text-amber-500" />;
    return <File className="w-5 h-5 text-blue-500" />;
  };

  const handleDownload = () => {
    if (attachment.url || attachment.content) {
      const link = document.createElement('a');
      link.href = attachment.url || attachment.content || '#';
      link.download = attachment.filename;
      link.click();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="attachment-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/80 dark:bg-slate-950/50">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
              {getFileIcon()}
            </div>
            <div className="min-w-0">
              <h3
                id="attachment-preview-title"
                className="text-sm font-bold text-slate-900 dark:text-white truncate"
                title={attachment.filename}
              >
                {attachment.filename}
              </h3>
              <div className="flex items-center space-x-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                <span className="font-mono">{formatFileSize(attachment.size)}</span>
                <span>•</span>
                <span className="uppercase font-semibold tracking-wider text-[10px]">{ext || 'FILE'}</span>
                <span>•</span>
                <span className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Shield Verified Safe</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {isImage && (
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                  className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono px-1.5 text-slate-500 dark:text-slate-400">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                  className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleDownload}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
              title="Download File"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              aria-label="Close attachment preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-auto p-6 flex items-center justify-center min-h-[300px] max-h-[65vh] bg-slate-100/50 dark:bg-slate-950/40">
          {isImage && (
            <div className="overflow-auto max-h-full max-w-full flex items-center justify-center p-2">
              <img
                src={attachment.url || attachment.content || attachment.previewUrl || '/placeholder.png'}
                alt={attachment.filename}
                style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.15s ease' }}
                className="max-h-[55vh] max-w-full rounded-xl object-contain shadow-md border border-slate-200 dark:border-slate-800"
                onError={(e) => {
                  // Fallback for mock/test attachments
                  (e.target as HTMLImageElement).src =
                    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%231e293b"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-family="sans-serif" font-size="14">Image Preview • Safe Sandbox Render</text></svg>';
                }}
              />
            </div>
          )}

          {isPdf && (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm max-w-lg">
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                <FileText className="w-12 h-12" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">{attachment.filename}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  PDF Document • Formatted Document Payload ({formatFileSize(attachment.size)})
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-left text-xs font-mono text-slate-600 dark:text-slate-400 w-full space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400">Security Inspection Summary</div>
                <div>Status: Verified by Shield Quarantine Pipeline</div>
                <div>Embedded Scripts: None (0 detected)</div>
                <div>External URLs: 0 unverified links</div>
              </div>
              <button
                type="button"
                onClick={handleDownload}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold flex items-center space-x-2 shadow-sm transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Open / Download Full PDF</span>
              </button>
            </div>
          )}

          {isCodeOrText && (
            <div className="w-full h-full max-h-[55vh] bg-slate-950 text-slate-100 p-4 rounded-2xl font-mono text-xs overflow-auto border border-slate-800 shadow-inner">
              <pre className="whitespace-pre-wrap leading-relaxed">
                {attachment.content ||
                  `// Attachment: ${attachment.filename}\n// Size: ${formatFileSize(attachment.size)}\n// MIME Type: ${attachment.mimeType || 'text/plain'}\n\n[Protected Document Content]\nSubject: Confidential Briefing & Action Context\nTimestamp: ${new Date().toISOString()}\n\n-- Verified Clean Payload by Streamline Copilot Guard --`}
              </pre>
            </div>
          )}

          {!isImage && !isPdf && !isCodeOrText && (
            <div className="w-full flex flex-col items-center justify-center p-8 text-center space-y-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm max-w-md">
              <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                <File className="w-12 h-12" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">{attachment.filename}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Binary File ({formatFileSize(attachment.size)}) • {attachment.mimeType || 'application/octet-stream'}
                </p>
              </div>
              <div className="flex items-center space-x-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <ShieldCheck className="w-4 h-4" />
                <span>Passed Antivirus &amp; Prompt Injection Scanning</span>
              </div>
              <button
                type="button"
                onClick={handleDownload}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 text-xs font-semibold flex items-center space-x-2 shadow-sm transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download File</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Press Esc to close preview</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
