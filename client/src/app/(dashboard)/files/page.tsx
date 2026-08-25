'use client';

import React from 'react';
import { Paperclip, FileText, Download, Mail, HardDrive } from 'lucide-react';

interface MockFile {
  id: string;
  filename: string;
  size: string;
  mimeType: string;
  sourceEmail: string;
  accountName: string;
  receivedAt: string;
}

const mockFiles: MockFile[] = [
  {
    id: 'f-1',
    filename: 'Q3_Architecture_Review_v2.pdf',
    size: '2.4 MB',
    mimeType: 'application/pdf',
    sourceEmail: 'Q3 Product Roadmap Review',
    accountName: 'Agency Work',
    receivedAt: 'Aug 25, 2026',
  },
  {
    id: 'f-2',
    filename: 'Retainer_Agreement_Signed.pdf',
    size: '1.1 MB',
    mimeType: 'application/pdf',
    sourceEmail: 'Signed Retainer Agreement',
    accountName: 'Consulting',
    receivedAt: 'Aug 24, 2026',
  },
];

export default function FilesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between glass-panel p-6 rounded-3xl border border-purple-500/20 bg-gradient-to-r from-slate-950 via-purple-950/20 to-slate-950">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs font-mono text-purple-300">
            <HardDrive className="w-3 h-3 text-purple-400" />
            <span>Unified Attachment Hub</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Files & Attachments</h1>
          <p className="text-xs text-slate-400">Fetch-on-demand unified attachments across all email threads.</p>
        </div>
      </div>

      <div className="space-y-3">
        {mockFiles.map((file) => (
          <div
            key={file.id}
            className="p-4 rounded-2xl glass-panel glass-panel-hover border border-slate-800 flex items-center justify-between gap-4"
          >
            <div className="flex items-center space-x-3.5">
              <div className="h-10 w-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold text-white">{file.filename}</h3>
                <div className="flex items-center space-x-2 text-xs text-slate-400">
                  <span className="font-mono">{file.size}</span>
                  <span>•</span>
                  <span className="inline-flex items-center space-x-1 text-purple-300">
                    <Mail className="w-3 h-3" />
                    <span>{file.sourceEmail} ({file.accountName})</span>
                  </span>
                </div>
              </div>
            </div>

            <button className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
              <Download className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
