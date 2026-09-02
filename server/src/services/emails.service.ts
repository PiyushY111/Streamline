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

  async getEmailById(id: string, userId: string) {
    return emailsRepository.findById(id, userId);
  }

  async markAsRead(id: string, userId: string, isRead: boolean = true) {
    const result = await syncGmailMarkAsRead(id, userId, isRead);
    await delCache(`emails:${userId}:*`);
    return result;
  }

  async toggleStar(id: string, userId: string, isStarred: boolean) {
    const result = await syncGmailToggleStar(id, userId, isStarred);
    await delCache(`emails:${userId}:*`);
    return result;
  }

  async updateCategory(id: string, userId: string, category: string) {
    const result = await syncGmailUpdateCategory(id, userId, category);
    await delCache(`emails:${userId}:*`);
    return result;
  }

  async deleteEmail(id: string, userId: string) {
    const result = await syncGmailDeleteEmail(id, userId);
    await delCache(`emails:${userId}:*`);
    return result;
  }

  async sendEmail(userId: string, data: { to: string; subject: string; body: string; accountId?: string }) {
    const result = await syncGmailSendEmail(userId, data);
    await delCache(`emails:${userId}:*`);
    return result;
  }
}

export const emailsService = new EmailsService();
