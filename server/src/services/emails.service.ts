import { emailsRepository } from '../repositories/emails.repository.js';
import {
  syncGmailMarkAsRead,
  syncGmailToggleStar,
  syncGmailDeleteEmail,
  syncGmailSendEmail,
} from './google/gmail-sync.service.js';

export class EmailsService {
  async getEmails(userId: string, folder?: string) {
    return emailsRepository.listUserEmails(userId, folder);
  }

  async markAsRead(id: string, isRead: boolean = true) {
    return syncGmailMarkAsRead(id, isRead);
  }

  async toggleStar(id: string, isStarred: boolean) {
    return syncGmailToggleStar(id, isStarred);
  }

  async deleteEmail(id: string) {
    return syncGmailDeleteEmail(id);
  }

  async sendEmail(userId: string, data: { to: string; subject: string; body: string; accountId?: string }) {
    return syncGmailSendEmail(userId, data);
  }
}

export const emailsService = new EmailsService();
