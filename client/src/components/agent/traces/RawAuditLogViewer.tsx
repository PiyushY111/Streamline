import React from 'react';
import { Copy, Check } from 'lucide-react';
import { AgentTraceResponseData } from '@/lib/api';

interface RawAuditLogViewerProps {
  trace: AgentTraceResponseData;
  onCopy: () => void;
  copied: boolean;
}

export const RawAuditLogViewer: React.FC<RawAuditLogViewerProps> = ({
  trace,
  onCopy,
  copied,
}) => {
  return (
    <div className="p-4 rounded-2xl bg-white/80 dark:bg-[#0B101D]/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md shadow-xs space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500 font-medium">Compliance Audit Payload</span>
        <button
          onClick={onCopy}
          className="flex items-center space-x-1 text-purple-600 dark:text-purple-400 hover:underline"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? 'Copied' : 'Copy Payload'}</span>
        </button>
      </div>
      <pre className="text-[11px] font-mono p-4 rounded-xl bg-black/5 dark:bg-black/50 text-slate-800 dark:text-slate-200 overflow-x-auto max-h-[600px] whitespace-pre-wrap">
        {JSON.stringify(trace, null, 2)}
      </pre>
    </div>
  );
};

export default RawAuditLogViewer;
