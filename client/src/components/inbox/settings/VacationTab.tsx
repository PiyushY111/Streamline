import React from 'react';
import { GmailAppSettings } from '../GmailSettingsModal';

interface VacationTabProps {
  settings: GmailAppSettings;
  setSettings: React.Dispatch<React.SetStateAction<GmailAppSettings>>;
}

export function VacationTab({ settings, setSettings }: VacationTabProps) {
  return (
    <div className="space-y-4 text-xs text-gray-700 dark:text-gray-300">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="vacationActive"
          checked={settings.vacationResponderActive}
          onChange={(e) => setSettings(prev => ({ ...prev, vacationResponderActive: e.target.checked }))}
        />
        <label htmlFor="vacationActive" className="font-semibold cursor-pointer">
          Enable Vacation Auto-Responder
        </label>
      </div>

      {settings.vacationResponderActive && (
        <div className="space-y-3 pl-5 border-l-2 border-blue-500">
          <div>
            <label className="block font-semibold mb-1">Subject</label>
            <input
              type="text"
              value={settings.vacationSubject}
              onChange={(e) => setSettings(prev => ({ ...prev, vacationSubject: e.target.value }))}
              className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Auto-Response Message</label>
            <textarea
              value={settings.vacationMessage}
              onChange={(e) => setSettings(prev => ({ ...prev, vacationMessage: e.target.value }))}
              className="w-full h-24 p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded resize-none text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
      )}
    </div>
  );
}
