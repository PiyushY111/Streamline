import type { GmailAppSettings } from '@/components/inbox/GmailSettingsModal';
import type { CustomLabel } from '@/components/inbox/LabelManagerModal';
import type { EmailTemplate } from '@/components/inbox/EmailTemplatesModal';

export const ITEMS_PER_PAGE = 50;

export const STORAGE_KEYS = {
  composeDraft: 'gmail_compose_draft',
  customLabels: 'gmail_custom_labels',
  emailLabelsMap: 'gmail_email_labels_map',
} as const;

export const DEFAULT_CUSTOM_LABELS: CustomLabel[] = [
  { id: 'lbl-1', name: 'Work', color: '#3b82f6' },
  { id: 'lbl-2', name: 'Finance', color: '#f97316' },
  { id: 'lbl-3', name: 'Urgent', color: '#ef4444' },
];

export const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id: 'tpl-1',
    title: 'Meeting Confirmation',
    subject: 'Confirmed: Meeting Schedule',
    body: 'Hi,\n\nThanks for reaching out! This email confirms our upcoming meeting.\n\nBest regards,',
  },
  {
    id: 'tpl-2',
    title: 'Project Status Update',
    subject: 'Project Status & Milestones',
    body: 'Hi team,\n\nHere is a quick status update on our ongoing project deliverables.\n\nBest,',
  },
];

export const DEFAULT_APP_SETTINGS: GmailAppSettings = {
  undoSendSeconds: 5,
  defaultReplyMode: 'reply',
  vacationResponderActive: false,
  vacationSubject: 'Out of Office',
  vacationMessage: 'I am currently away on vacation.',
  notificationsEnabled: true,
  defaultPageSize: 50,
  keyboardShortcutsEnabled: true,
  readingPaneLayout: 'list',
  enabledCategories: { primary: true, promotions: true, social: true, updates: true },
};
