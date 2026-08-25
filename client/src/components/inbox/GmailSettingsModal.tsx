import React, { useState } from 'react';
import { X, Settings } from 'lucide-react';
import { GeneralTab } from './settings/GeneralTab';
import { VacationTab } from './settings/VacationTab';
import { CategoryTab } from './settings/CategoryTab';
import { ShortcutsTab } from './settings/ShortcutsTab';

export interface GmailAppSettings {
  undoSendSeconds: number;
  defaultReplyMode: 'reply' | 'replyAll';
  vacationResponderActive: boolean;
  vacationSubject: string;
  vacationMessage: string;
  notificationsEnabled: boolean;
  defaultPageSize: number;
  keyboardShortcutsEnabled: boolean;
  readingPaneLayout: 'list' | 'split' | 'bottom';
  enabledCategories: {
    primary: boolean;
    promotions: boolean;
    social: boolean;
    updates: boolean;
  };
}

interface GmailSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GmailAppSettings;
  setSettings: React.Dispatch<React.SetStateAction<GmailAppSettings>>;
}

export function GmailSettingsModal({ isOpen, onClose, settings, setSettings }: GmailSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'vacation' | 'categories' | 'shortcuts'>('general');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-950 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 font-semibold text-sm text-gray-900 dark:text-gray-100">
            <Settings className="w-4 h-4 text-blue-600" />
            Gmail & Inbox Preferences
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex border-b border-gray-200 dark:border-gray-800 px-4 bg-gray-50 dark:bg-gray-900/50">
          {[
            { id: 'general', label: 'General' },
            { id: 'vacation', label: 'Vacation Responder' },
            { id: 'categories', label: 'Categories' },
            { id: 'shortcuts', label: 'Shortcuts' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5 flex-1 overflow-y-auto">
          {activeTab === 'general' && <GeneralTab settings={settings} setSettings={setSettings} />}
          {activeTab === 'vacation' && <VacationTab settings={settings} setSettings={setSettings} />}
          {activeTab === 'categories' && <CategoryTab settings={settings} setSettings={setSettings} />}
          {activeTab === 'shortcuts' && <ShortcutsTab settings={settings} setSettings={setSettings} />}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-end bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-sm"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
