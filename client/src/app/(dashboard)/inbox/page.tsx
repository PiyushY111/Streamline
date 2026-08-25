'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useInboxState } from '@/components/inbox/hooks/useInboxState';
import { useCompose } from '@/components/inbox/hooks/useCompose';
import { useUndoSend } from '@/components/inbox/hooks/useUndoSend';
import { InboxHeader } from '@/components/inbox/list/InboxHeader';
import { InboxToolbar } from '@/components/inbox/list/InboxToolbar';
import { CategoryTabs } from '@/components/inbox/list/CategoryTabs';
import { EmailListTable } from '@/components/inbox/list/EmailListTable';
import { EmailThreadView } from '@/components/inbox/thread/EmailThreadView';
import { ComposeModal } from '@/components/inbox/compose/ComposeModal';
import { UndoSendToast } from '@/components/inbox/list/UndoSendToast';
import { GmailSettingsModal, GmailAppSettings } from '@/components/inbox/GmailSettingsModal';

function InboxContent() {
  const searchParams = useSearchParams();
  const urlEmailId = searchParams.get('id');

  const inbox = useInboxState(urlEmailId);
  const compose = useCompose();
  const { undoToast, triggerUndoToast, cancelUndo } = useUndoSend();

  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [appSettings, setAppSettings] = React.useState<GmailAppSettings>({
    undoSendSeconds: 5,
    defaultReplyMode: 'reply',
    vacationResponderActive: false,
    vacationSubject: 'Out of Office',
    vacationMessage: 'I am currently on vacation.',
    notificationsEnabled: true,
    defaultPageSize: 50,
    keyboardShortcutsEnabled: true,
    readingPaneLayout: 'list',
    enabledCategories: { primary: true, promotions: true, social: true, updates: true },
  });

  const selectedEmailObj = inbox.emails.find(e => e.id === inbox.selectedEmailId);

  const handleSendCompose = () => {
    compose.setIsSendingCompose(true);
    setTimeout(() => {
      compose.setIsSendingCompose(false);
      compose.resetCompose();
      triggerUndoToast(appSettings.undoSendSeconds, 'Message sent.', () => {
        alert('Send undone!');
      });
    }, 600);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <InboxHeader
        searchQuery={inbox.searchQuery}
        setSearchQuery={inbox.setSearchQuery}
        onOpenAdvancedSearch={() => {}}
        accounts={inbox.accounts}
        selectedAccountFilter={inbox.selectedAccountFilter}
        setSelectedAccountFilter={inbox.setSelectedAccountFilter}
        isAccountDropdownOpen={inbox.isAccountDropdownOpen}
        setIsAccountDropdownOpen={inbox.setIsAccountDropdownOpen}
        onOpenCompose={() => compose.setShowComposeModal(true)}
      />

      <InboxToolbar
        selectedCount={inbox.selectedEmailIds.length}
        totalCount={inbox.emails.length}
        onToggleSelectAll={() => inbox.toggleSelectAll(inbox.emails)}
        onRefresh={() => {}}
        onDeleteSelected={() => inbox.setSelectedEmailIds([])}
        viewMode={inbox.viewMode}
        setViewMode={inbox.setViewMode}
      />

      <CategoryTabs
        activeCategory={inbox.activeCategory}
        setActiveCategory={inbox.setActiveCategory}
        enabledCategories={appSettings.enabledCategories}
      />

      <div className="flex-1 flex overflow-hidden">
        {inbox.isReadingThread && selectedEmailObj ? (
          <EmailThreadView
            email={selectedEmailObj}
            onBack={() => inbox.setIsReadingThread(false)}
            onStar={(id, isStarred) => {
              inbox.setEmails(prev => prev.map(e => e.id === id ? { ...e, isStarred } : e));
            }}
            onDelete={(id) => {
              inbox.setEmails(prev => prev.filter(e => e.id !== id));
              inbox.setIsReadingThread(false);
            }}
          />
        ) : (
          <EmailListTable
            emails={inbox.emails}
            selectedEmailIds={inbox.selectedEmailIds}
            onSelectEmail={inbox.toggleSelectEmail}
            onStarEmail={(id, isStarred) => {
              inbox.setEmails(prev => prev.map(e => e.id === id ? { ...e, isStarred } : e));
            }}
            onSelectThread={(email) => {
              inbox.setSelectedEmailId(email.id);
              inbox.setIsReadingThread(true);
            }}
            loading={inbox.loading}
          />
        )}
      </div>

      <ComposeModal
        show={compose.showComposeModal}
        isMinimized={compose.isComposeMinimized}
        isMaximized={compose.isComposeMaximized}
        setIsMinimized={compose.setIsComposeMinimized}
        setIsMaximized={compose.setIsComposeMaximized}
        onClose={compose.resetCompose}
        to={compose.composeTo}
        setTo={compose.setComposeTo}
        subject={compose.composeSubject}
        setSubject={compose.setComposeSubject}
        body={compose.composeBody}
        setBody={compose.setComposeBody}
        onSend={handleSendCompose}
        isSending={compose.isSendingCompose}
        onOpenTemplates={() => {}}
        onOpenConfidential={() => {}}
      />

      <GmailSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={appSettings}
        setSettings={setAppSettings}
      />

      <UndoSendToast toast={undoToast} onCancel={cancelUndo} />
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading inbox...</div>}>
      <InboxContent />
    </Suspense>
  );
}
