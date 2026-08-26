import { emailsRepository } from '../repositories/emails.repository.js';
import {
  syncGmailMarkAsRead,
  syncGmailToggleStar,
  syncGmailDeleteEmail,
  syncGmailSendEmail,
  syncGmailUpdateCategory,
} from './google/gmail-sync.service.js';

import { getCache, setCache, delCache } from './cache.service.js';

export class EmailsService {
  async getEmails(userId: string, folder: string = 'inbox', limit: number = 1000, page: number = 1) {
    const cacheKey = `emails:${userId}:${folder}:${page}:${limit}`;
    const cached = await getCache<any[]>(cacheKey);
    if (cached) return cached;

    const emailList = await emailsRepository.listUserEmails(userId, folder, limit, page);
    await setCache(cacheKey, emailList, 30);
    return emailList;
  }

  async getEmailById(id: string) {
    return emailsRepository.findById(id);
  }

  async markAsRead(id: string, isRead: boolean = true) {
    const result = await syncGmailMarkAsRead(id, isRead);
    await delCache('emails:*');
    return result;
  }

  async toggleStar(id: string, isStarred: boolean) {
    const result = await syncGmailToggleStar(id, isStarred);
    await delCache('emails:*');
    return result;
  }

  async updateCategory(id: string, category: string) {
    const result = await syncGmailUpdateCategory(id, category);
    await delCache('emails:*');
    return result;
  }

  async deleteEmail(id: string) {
    const result = await syncGmailDeleteEmail(id);
    await delCache('emails:*');
    return result;
  }

  async sendEmail(userId: string, data: { to: string; subject: string; body: string; accountId?: string }) {
    const result = await syncGmailSendEmail(userId, data);
    await delCache(`emails:${userId}:*`);
    return result;
  }
}

export const emailsService = new EmailsService();
