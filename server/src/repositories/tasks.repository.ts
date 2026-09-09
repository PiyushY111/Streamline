import { db } from '../db/index.js';
import { tasks } from '../db/schema/index.js';
import { eq, and, desc, ne } from 'drizzle-orm';

export interface CreateTaskInput {
  userId: string;
  title: string;
  description?: string;
  priority?: string;
  dueAt?: Date;
  projectId?: string | null;
  importance?: number;
  estimatedMinutes?: number | null;
  dependencies?: string[];
  sourceEmailId?: string;
  sourceEventId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  dueAt?: Date | null;
  completedAt?: Date | null;
  projectId?: string | null;
  importance?: number;
  estimatedMinutes?: number | null;
  dependencies?: string[];
}

export class TasksRepository {
  async listUserTasks(userId: string) {
    return db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, userId))
      .orderBy(desc(tasks.createdAt));
  }

  async listActiveTasks(userId: string) {
    return db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), ne(tasks.status, 'completed'), ne(tasks.status, 'cancelled')))
      .orderBy(desc(tasks.createdAt));
  }

  async listByProject(userId: string, projectId: string) {
    return db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.projectId, projectId)))
      .orderBy(desc(tasks.createdAt));
  }

  async getById(id: string, userId: string) {
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
      .limit(1);
    return task || null;
  }

  async create(data: CreateTaskInput) {
    const [newTask] = await db
      .insert(tasks)
      .values({
        userId: data.userId,
        title: data.title,
        description: data.description,
        priority: data.priority || 'medium',
        dueAt: data.dueAt,
        projectId: data.projectId,
        importance: data.importance ?? 0.5,
        estimatedMinutes: data.estimatedMinutes,
        dependencies: data.dependencies ?? [],
        sourceEmailId: data.sourceEmailId,
        sourceEventId: data.sourceEventId,
      })
      .returning();
    return newTask;
  }

  async update(id: string, userId: string, data: UpdateTaskInput) {
    const [updated] = await db
      .update(tasks)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
      .returning();
    return updated;
  }

  async delete(id: string, userId: string) {
    return db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
  }
}

export const tasksRepository = new TasksRepository();

