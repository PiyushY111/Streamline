import { tasksRepository, CreateTaskInput, UpdateTaskInput } from '../repositories/tasks.repository.js';

export class TasksService {
  async getTasks(userId: string) {
    return tasksRepository.listUserTasks(userId);
  }

  async getTasksByProject(userId: string, projectId: string) {
    return tasksRepository.listByProject(userId, projectId);
  }

  async createTask(
    userId: string,
    data: {
      title: string;
      description?: string;
      priority?: string;
      dueAt?: string;
      projectId?: string | null;
      importance?: number;
      estimatedMinutes?: number | null;
      dependencies?: string[];
    },
  ) {
    return tasksRepository.create({
      userId,
      title: data.title,
      description: data.description,
      priority: data.priority,
      dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
      projectId: data.projectId,
      importance: data.importance !== undefined ? Number(data.importance) : 0.5,
      estimatedMinutes:
        data.estimatedMinutes !== undefined && data.estimatedMinutes !== null ? Number(data.estimatedMinutes) : null,
      dependencies: data.dependencies || [],
    });
  }

  async updateTask(
    id: string,
    userId: string,
    data: Partial<{
      title: string;
      description: string;
      status: string;
      priority: string;
      dueAt: string | null;
      completedAt: string | null;
      projectId: string | null;
      importance: number;
      estimatedMinutes: number | null;
      dependencies: string[];
    }>,
  ) {
    const updatePayload: UpdateTaskInput = {
      ...data,
      dueAt: data.dueAt ? new Date(data.dueAt) : data.dueAt === null ? null : undefined,
      completedAt: data.completedAt ? new Date(data.completedAt) : data.completedAt === null ? null : undefined,
      importance: data.importance !== undefined ? Number(data.importance) : undefined,
      estimatedMinutes:
        data.estimatedMinutes !== undefined
          ? data.estimatedMinutes !== null
            ? Number(data.estimatedMinutes)
            : null
          : undefined,
    };
    return tasksRepository.update(id, userId, updatePayload);
  }

  async deleteTask(id: string, userId: string) {
    return tasksRepository.delete(id, userId);
  }
}

export const tasksService = new TasksService();
