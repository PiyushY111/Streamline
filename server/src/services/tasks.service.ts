import { tasksRepository } from '../repositories/tasks.repository.js';

export class TasksService {
  async getTasks(userId: string) {
    return tasksRepository.listUserTasks(userId);
  }

  async createTask(userId: string, data: { title: string; description?: string; priority?: string; dueAt?: string }) {
    return tasksRepository.create({
      userId,
      title: data.title,
      description: data.description,
      priority: data.priority,
      dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
    });
  }

  async updateTask(id: string, userId: string, data: Partial<{ title: string; description: string; status: string; priority: string; dueAt: string; completedAt: string }>) {
    return tasksRepository.update(id, userId, {
      ...data,
      dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
      completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
    });
  }

  async deleteTask(id: string, userId: string) {
    return tasksRepository.delete(id, userId);
  }
}

export const tasksService = new TasksService();
