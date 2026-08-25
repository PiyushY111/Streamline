import React from 'react';
import { GmailAppSettings } from '../GmailSettingsModal';

interface GeneralTabProps {
  settings: GmailAppSettings;
  setSettings: React.Dispatch<React.SetStateAction<GmailAppSettings>>;
}

export function GeneralTab({ settings, setSettings }: GeneralTabProps) {
  return (
    <div className="space-y-4 text-xs text-gray-700 dark:text-gray-300">
      <div>
        <label className="block font-semibold mb-1">Undo Send Cancellation Period</label>
        <select
          value={settings.undoSendSeconds}
          onChange={(e) => setSettings(prev => ({ ...prev, undoSendSeconds: Number(e.target.value) }))}
          className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded focus:outline-none focus:border-blue-500 text-gray-900 dark:text-gray-100"
        >
          <option value={5}>5 seconds</option>
          <option value={10}>10 seconds</option>
          <option value={20}>20 seconds</option>
          <option value={30}>30 seconds</option>
        </select>
      </div>

      <div>
        <label className="block font-semibold mb-1">Default Reply Behavior</label>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="replyMode"
              checked={settings.defaultReplyMode === 'reply'}
              onChange={() => setSettings(prev => ({ ...prev, defaultReplyMode: 'reply' }))}
            />
            Reply
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="replyMode"
              checked={settings.defaultReplyMode === 'replyAll'}
              onChange={() => setSettings(prev => ({ ...prev, defaultReplyMode: 'replyAll' }))}
            />
            Reply All
          </label>
        </div>
      </div>

      <div>
        <label className="block font-semibold mb-1">Default Page Size</label>
        <select
          value={settings.defaultPageSize}
          onChange={(e) => setSettings(prev => ({ ...prev, defaultPageSize: Number(e.target.value) }))}
          className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded focus:outline-none focus:border-blue-500 text-gray-900 dark:text-gray-100"
        >
          <option value={25}>25 conversations per page</option>
          <option value={50}>50 conversations per page</option>
          <option value={100}>100 conversations per page</option>
        </select>
      </div>
    </div>
  );
}
