import { eventsRepository } from '../repositories/events.repository.js';

export class EventsService {
  async getEvents(userId: string, startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return eventsRepository.listUserEvents(userId, start, end);
  }

  async getCalendars(userId: string) {
    return eventsRepository.listUserCalendars(userId);
  }

  async createEvent(data: {
    calendarId: string;
    accountId: string;
    externalEventId: string;
    title: string;
    description?: string;
    location?: string;
    startTime: string;
    endTime: string;
  }) {
    return eventsRepository.create({
      ...data,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
    });
  }

  async updateEvent(id: string, data: Partial<{ title: string; description: string; startTime: string; endTime: string }>) {
    return eventsRepository.update(id, {
      ...data,
      startTime: data.startTime ? new Date(data.startTime) : undefined,
      endTime: data.endTime ? new Date(data.endTime) : undefined,
    });
  }

  async deleteEvent(id: string) {
    return eventsRepository.delete(id);
  }
}

export const eventsService = new EventsService();
