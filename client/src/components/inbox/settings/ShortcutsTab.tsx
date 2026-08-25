import React from 'react';
import { GmailAppSettings } from '../GmailSettingsModal';

interface ShortcutsTabProps {
  settings: GmailAppSettings;
  setSettings: React.Dispatch<React.SetStateAction<GmailAppSettings>>;
}

export function ShortcutsTab({ settings, setSettings }: ShortcutsTabProps) {
  return (
    <div className="space-y-4 text-xs text-gray-700 dark:text-gray-300">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="shortcutsActive"
          checked={settings.keyboardShortcutsEnabled}
          onChange={(e) => setSettings(prev => ({ ...prev, keyboardShortcutsEnabled: e.target.checked }))}
        />
        <label htmlFor="shortcutsActive" className="font-semibold cursor-pointer">
          Enable Keyboard Shortcuts (c = compose, / = search, e = archive)
        </label>
      </div>
    </div>
  );
}
