'use client';

import { AdvancedSearchModal, SearchFilterState } from '@/components/inbox/AdvancedSearchModal';
import { SnoozeModal } from '@/components/inbox/SnoozeModal';
import { LabelManagerModal, CustomLabel } from '@/components/inbox/LabelManagerModal';
import { EmailTemplatesModal, EmailTemplate } from '@/components/inbox/EmailTemplatesModal';
import { ConfidentialModeModal, ConfidentialModeConfig } from '@/components/inbox/ConfidentialModeModal';
import { GmailSettingsModal, GmailAppSettings } from '@/components/inbox/GmailSettingsModal';
import type { AccountData } from '@/lib/api';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: SearchFilterState) => void;
  onResetFilters: () => void;
}

interface SnoozeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSnooze: (snoozeDate: Date, label: string) => void;
}

interface LabelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  labels: CustomLabel[];
  onCreateLabel: (name: string, color: string) => void;
  onToggleLabelOnEmail: (labelId: string) => void;
  assignedLabelIds: string[];
}

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: EmailTemplate[];
  onSelectTemplate: (tpl: EmailTemplate) => void;
  onCreateTemplate: (title: string, subject: string, body: string) => void;
  onDeleteTemplate: (id: string) => void;
}

interface ConfidentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: ConfidentialModeConfig | null;
  onSave: (config: ConfidentialModeConfig) => void;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GmailAppSettings;
  onUpdateSettings: (newSettings: Partial<GmailAppSettings>) => void;
  accounts: AccountData[];
  onRefreshAccounts: () => void;
  customLabels: CustomLabel[];
  onCreateLabel: (name: string, color: string) => void;
  onDeleteLabel: (id: string) => void;
}

interface InboxProductivityModalsProps {
  search: SearchModalProps;
  snooze: SnoozeModalProps;
  labels: LabelsModalProps;
  templates: TemplatesModalProps;
  confidential: ConfidentialModalProps;
  settings: SettingsModalProps;
}

/** Groups the inbox's non-thread-specific modals (search, snooze, labels, templates, confidential mode, settings). */
export function InboxProductivityModals({
  search,
  snooze,
  labels,
  templates,
  confidential,
  settings,
}: InboxProductivityModalsProps) {
  return (
    <>
      <AdvancedSearchModal
        isOpen={search.isOpen}
        onClose={search.onClose}
        onApplyFilters={search.onApplyFilters}
        onResetFilters={search.onResetFilters}
      />

      <SnoozeModal isOpen={snooze.isOpen} onClose={snooze.onClose} onSnooze={snooze.onSnooze} />

      <LabelManagerModal
        isOpen={labels.isOpen}
        onClose={labels.onClose}
        labels={labels.labels}
        onCreateLabel={labels.onCreateLabel}
        onToggleLabelOnEmail={labels.onToggleLabelOnEmail}
        assignedLabelIds={labels.assignedLabelIds}
      />

      <EmailTemplatesModal
        isOpen={templates.isOpen}
        onClose={templates.onClose}
        templates={templates.templates}
        onSelectTemplate={templates.onSelectTemplate}
        onCreateTemplate={templates.onCreateTemplate}
        onDeleteTemplate={templates.onDeleteTemplate}
      />

      <ConfidentialModeModal
        isOpen={confidential.isOpen}
        onClose={confidential.onClose}
        currentConfig={confidential.currentConfig}
        onSave={confidential.onSave}
      />

      <GmailSettingsModal
        isOpen={settings.isOpen}
        onClose={settings.onClose}
        settings={settings.settings}
        onUpdateSettings={settings.onUpdateSettings}
        accounts={settings.accounts}
        onRefreshAccounts={settings.onRefreshAccounts}
        customLabels={settings.customLabels}
        onCreateLabel={settings.onCreateLabel}
        onDeleteLabel={settings.onDeleteLabel}
      />
    </>
  );
}
