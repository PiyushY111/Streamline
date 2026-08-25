import { useState, useEffect } from 'react';
import { fetchEmails, fetchConnectedAccounts, EmailData, AccountData } from '@/lib/api';

export function useInboxState(urlEmailId: string | null) {
  const [emails, setEmails] = useState<EmailData[]>([]);
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'starred' | 'snoozed' | 'sent' | 'drafts' | 'trash' | 'attachments'>('inbox');
  const [activeCategory, setActiveCategory] = useState<'primary' | 'promotions' | 'social' | 'updates' | 'all'>('primary');
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string | 'all'>('all');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(urlEmailId);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmailIds, setSelectedEmailIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'split' | 'bottom'>('list');
  const [isReadingThread, setIsReadingThread] = useState(Boolean(urlEmailId));

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [fetchedEmails, fetchedAccounts] = await Promise.all([
        fetchEmails(),
        fetchConnectedAccounts(),
      ]);
      setEmails(fetchedEmails);
      setAccounts(fetchedAccounts);
      setLoading(false);
    }
    loadData();
  }, []);

  const toggleSelectEmail = (id: string) => {
    setSelectedEmailIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const toggleSelectAll = (filteredEmails: EmailData[]) => {
    if (selectedEmailIds.length === filteredEmails.length) {
      setSelectedEmailIds([]);
    } else {
      setSelectedEmailIds(filteredEmails.map(e => e.id));
    }
  };

  return {
    emails,
    setEmails,
    accounts,
    loading,
    isAccountDropdownOpen,
    setIsAccountDropdownOpen,
    activeFolder,
    setActiveFolder,
    activeCategory,
    setActiveCategory,
    selectedAccountFilter,
    setSelectedAccountFilter,
    selectedEmailId,
    setSelectedEmailId,
    searchQuery,
    setSearchQuery,
    selectedEmailIds,
    setSelectedEmailIds,
    viewMode,
    setViewMode,
    isReadingThread,
    setIsReadingThread,
    toggleSelectEmail,
    toggleSelectAll,
  };
}
