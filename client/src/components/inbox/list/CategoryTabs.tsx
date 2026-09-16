import React from 'react';
import { Inbox, Tag, Users, AlertOctagon, Mail } from 'lucide-react';

interface CategoryTabsProps {
  activeCategory: 'primary' | 'promotions' | 'social' | 'updates' | 'all';
  setActiveCategory: (cat: 'primary' | 'promotions' | 'social' | 'updates' | 'all') => void;
  enabledCategories?: { primary: boolean; promotions: boolean; social: boolean; updates: boolean };
}

export function CategoryTabs({ activeCategory, setActiveCategory, enabledCategories }: CategoryTabsProps) {
  const tabs = [
    { key: 'all', label: 'All Mail', icon: Mail, enabled: true },
    { key: 'primary', label: 'Primary', icon: Inbox, enabled: enabledCategories?.primary !== false },
    { key: 'promotions', label: 'Promotions', icon: Tag, enabled: enabledCategories?.promotions !== false },
    { key: 'social', label: 'Social', icon: Users, enabled: enabledCategories?.social !== false },
    { key: 'updates', label: 'Updates', icon: AlertOctagon, enabled: enabledCategories?.updates !== false },
  ];

  return (
    <div className="flex border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-4">
      {tabs
        .filter((t) => t.enabled)
        .map((tab) => {
          const Icon = tab.icon;
          const isActive = activeCategory === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveCategory(tab.key as any)}
              className={`flex items-center gap-2.5 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 font-semibold'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
    </div>
  );
}
