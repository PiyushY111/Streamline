import React from 'react';
import { GmailAppSettings } from '../GmailSettingsModal';

interface CategoryTabProps {
  settings: GmailAppSettings;
  setSettings: React.Dispatch<React.SetStateAction<GmailAppSettings>>;
}

export function CategoryTab({ settings, setSettings }: CategoryTabProps) {
  const toggleCat = (cat: keyof GmailAppSettings['enabledCategories']) => {
    setSettings(prev => ({
      ...prev,
      enabledCategories: {
        ...prev.enabledCategories,
        [cat]: !prev.enabledCategories[cat],
      },
    }));
  };

  return (
    <div className="space-y-3 text-xs text-gray-700 dark:text-gray-300">
      <p className="text-gray-500 mb-2">Select which inbox category tabs are visible in your top navigation bar:</p>
      {['primary', 'promotions', 'social', 'updates'].map((catKey) => (
        <label key={catKey} className="flex items-center gap-2 cursor-pointer capitalize">
          <input
            type="checkbox"
            checked={Boolean(settings.enabledCategories[catKey as keyof GmailAppSettings['enabledCategories']])}
            onChange={() => toggleCat(catKey as keyof GmailAppSettings['enabledCategories'])}
          />
          {catKey} Category Tab
        </label>
      ))}
    </div>
  );
}
