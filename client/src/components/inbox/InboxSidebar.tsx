'use client';

import {
  ChevronDown,
  Pencil,
  Plus,
  Inbox as InboxIcon,
  Star,
  Clock,
  Send,
  FileText,
  Trash2,
  Paperclip,
} from 'lucide-react';
import type { AccountData } from '@/lib/api';
import type { CustomLabel } from '@/components/inbox/LabelManagerModal';
import type { ActiveFolder } from '@/lib/inbox/types';

const FOLDER_NAV_ITEMS = [
  { id: 'inbox', label: 'Inbox', icon: InboxIcon },
  { id: 'starred', label: 'Starred', icon: Star },
  { id: 'snoozed', label: 'Snoozed', icon: Clock },
  { id: 'sent', label: 'Sent', icon: Send },
  { id: 'drafts', label: 'Drafts', icon: FileText },
  { id: 'trash', label: 'Trash', icon: Trash2 },
  { id: 'attachments', label: 'Attachments', icon: Paperclip },
] as const;

interface AccountSelectorProps {
  accounts: AccountData[];
  totalEmailsCount: number;
  selectedAccountFilter: string | 'all';
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (accountId: string | 'all') => void;
}

interface FolderNavProps {
  activeFolder: ActiveFolder;
  unreadInboxCount: number;
  starredCount: number;
  onSelectFolder: (folderId: ActiveFolder) => void;
}

interface LabelsNavProps {
  customLabels: CustomLabel[];
  selectedCustomLabelFilter: string | 'all';
  onSelectCustomLabelFilter: (labelId: string | 'all') => void;
  onOpenLabelModal: () => void;
}

interface InboxSidebarProps {
  accountSelector: AccountSelectorProps;
  folderNav: FolderNavProps;
  labelsNav: LabelsNavProps;
  onOpenCompose: () => void;
}

export function InboxSidebar({ accountSelector, folderNav, labelsNav, onOpenCompose }: InboxSidebarProps) {
  const { accounts, totalEmailsCount, selectedAccountFilter, isOpen, onToggle, onSelect } = accountSelector;
  const { activeFolder, unreadInboxCount, starredCount, onSelectFolder } = folderNav;
  const { customLabels, selectedCustomLabelFilter, onSelectCustomLabelFilter, onOpenLabelModal } = labelsNav;
  const folderCounts: Partial<Record<ActiveFolder, number>> = { inbox: unreadInboxCount, starred: starredCount };

  return (
    <aside className="w-64 bg-[#f6f8fc] dark:bg-[#1f1f1f] p-3 flex flex-col justify-between shrink-0 select-none h-full overflow-hidden">
      {/* Top Fixed Compose & Account Selector Section */}
      <div className="shrink-0 space-y-2.5 pb-3">
        {/* Account Selector Pill shifted to Sidebar Slider */}
        <div className="relative">
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-between px-3 py-2 rounded-2xl bg-white dark:bg-[#28292c] border border-slate-200/80 dark:border-slate-800 text-xs font-semibold shadow-xs hover:bg-slate-50 dark:hover:bg-[#323338] transition-all"
          >
            <div className="flex items-center space-x-2 truncate">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{
                  backgroundColor:
                    selectedAccountFilter === 'all'
                      ? '#0b57d0'
                      : accounts.find((a) => a.id === selectedAccountFilter)?.color || '#0b57d0',
                }}
              />
              <div className="flex flex-col text-left truncate">
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">
                  {selectedAccountFilter === 'all'
                    ? 'All Accounts'
                    : accounts.find((a) => a.id === selectedAccountFilter)?.label || 'Mailbox'}
                </span>
                <span className="text-[9px] text-slate-400 font-mono truncate">
                  {selectedAccountFilter === 'all'
                    ? 'Unified Inbox'
                    : accounts.find((a) => a.id === selectedAccountFilter)?.email}
                </span>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
          </button>

          {/* Account Dropdown Menu */}
          {isOpen && (
            <div className="absolute top-11 left-0 right-0 z-50 bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-2xl space-y-1 text-xs animate-in zoom-in-95 duration-100">
              <button
                onClick={() => onSelect('all')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors ${
                  selectedAccountFilter === 'all'
                    ? 'bg-[#c2e7ff] text-[#001d35] font-bold dark:bg-slate-800 dark:text-white'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="text-[11px]">All Accounts (Unified)</span>
                <span className="text-[10px] font-mono text-slate-400 font-bold">{totalEmailsCount}</span>
              </button>

              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => onSelect(acc.id)}
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
          onClick={onOpenCompose}
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
          {FOLDER_NAV_ITEMS.map((folder) => {
            const Icon = folder.icon;
            const isActive = activeFolder === folder.id;
            const count = folderCounts[folder.id as ActiveFolder];
            return (
              <button
                key={folder.id}
                onClick={() => onSelectFolder(folder.id)}
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
                {count !== undefined && count > 0 && (
                  <span
                    className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-bold ${
                      isActive
                        ? 'bg-[#0b57d0] text-white dark:bg-purple-600'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {count}
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
              onClick={onOpenLabelModal}
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
                onClick={() => onSelectCustomLabelFilter(isActive ? 'all' : lbl.id)}
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
  );
}
