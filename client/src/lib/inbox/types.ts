export type ActiveFolder = 'inbox' | 'starred' | 'snoozed' | 'sent' | 'drafts' | 'trash' | 'attachments';

export type EmailCategoryId = 'p1_urgent' | 'p2_important' | 'p3_updates' | 'p4_newsletter';

export type MoveToCategory = 'primary' | 'promotions' | 'social' | 'updates';

export interface ComposeAttachment {
  filename: string;
  contentType: string;
  size: number;
  content: string;
}

export interface UndoToastState {
  active: boolean;
  message: string;
  countdown: number;
  onUndo: () => void;
}
