import type { EmailData } from '@/lib/api';
import type { EmailCategoryId } from './types';

export function getEmailCategory(email: EmailData): EmailCategoryId {
  if (email.aiPriority) {
    if (email.aiPriority === 'p1_urgent') return 'p1_urgent';
    if (email.aiPriority === 'p2_important') return 'p2_important';
    if (email.aiPriority === 'p3_updates') return 'p3_updates';
    if (email.aiPriority === 'p4_newsletter') return 'p4_newsletter';
    if (email.aiPriority === 'p5_low') return 'p4_newsletter';
  }

  const cat = (email.category || '').toLowerCase();
  if (cat === 'promotions') return 'p4_newsletter';
  if (cat === 'social') return 'p3_updates';
  if (cat === 'updates') return 'p3_updates';

  const senderLower = email.sender.toLowerCase();
  const subjectLower = email.subject.toLowerCase();

  if (
    senderLower.includes('newsletter') ||
    senderLower.includes('substack') ||
    senderLower.includes('digest') ||
    senderLower.includes('marketing')
  ) {
    return 'p4_newsletter';
  }

  if (
    senderLower.includes('noreply') ||
    senderLower.includes('notification') ||
    subjectLower.includes('receipt') ||
    subjectLower.includes('invoice') ||
    subjectLower.includes('security')
  ) {
    return 'p3_updates';
  }

  if (subjectLower.includes('urgent') || subjectLower.includes('action required') || subjectLower.includes('asap')) {
    return 'p1_urgent';
  }

  return 'p2_important';
}

/** Best-effort smart topic tag derived from sender/subject, used as a row badge. */
export function detectSmartTopic(email: EmailData): string | null {
  if (email.aiNewsletterTopic) return email.aiNewsletterTopic;

  const s = `${email.sender} ${email.subject}`.toLowerCase();
  if (s.includes('nst') || s.includes('office') || s.includes('rishihood') || s.includes('exam') || s.includes('csai') || s.includes('registrar')) {
    return '🎓 Academics';
  }
  if (s.includes('dev club') || s.includes('devclub') || s.includes('bootcamp') || s.includes('hack')) {
    return '💼 DevClub';
  }
  if (s.includes('atlassian') || s.includes('github') || s.includes('ai') || s.includes('code') || s.includes('tech')) {
    return '🚀 Tech & AI';
  }
  if (s.includes('linkedin')) return '👥 Community';
  if (getEmailCategory(email) === 'p4_newsletter') return '📰 Newsletter';
  return null;
}
