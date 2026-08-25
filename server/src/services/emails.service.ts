import { emailsRepository } from '../repositories/emails.repository.js';

export class EmailsService {
  async getEmails(userId: string, folder?: string) {
    return emailsRepository.listUserEmails(userId, folder);
  }

  async markAsRead(id: string, isRead: boolean = true) {
    return emailsRepository.markAsRead(id, isRead);
  }

  async toggleStar(id: string, isStarred: boolean) {
    return emailsRepository.toggleStar(id, isStarred);
  }

  async deleteEmail(id: string) {
    return emailsRepository.deleteEmail(id);
  }
}

export const emailsService = new EmailsService();
