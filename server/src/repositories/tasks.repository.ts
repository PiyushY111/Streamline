import { db } from '../db/index.js';
import { tasks } from '../db/schema/index.js';
import { eq, and, desc } from 'drizzle-orm';

export class TasksRepository {
  async listUserTasks(userId: string) {
    return db.select()
      .from(tasks)
      .where(eq(tasks.userId, userId))
      .orderBy(desc(tasks.createdAt));
  }

  async create(data: {
    userId: string;
    title: string;
    description?: string;
    priority?: string;
    dueAt?: Date;
  }) {
    const [newTask] = await db.insert(tasks).values({
      userId: data.userId,
      title: data.title,
      description: data.description,
      priority: data.priority || 'medium',
      dueAt: data.dueAt,
    }).returning();
    return newTask;
  }

  async update(id: string, userId: string, data: Partial<{ title: string; description: string; status: string; priority: string; dueAt: Date; completedAt: Date }>) {
    const [updated] = await db.update(tasks)
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
