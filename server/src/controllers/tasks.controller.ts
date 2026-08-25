import { Request, Response } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { tasks, users } from '../db/schema/index.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { logger } from '../utils/logger.js';

async function getOrCreateDefaultUser() {
  const existingUsers = await db.select().from(users).limit(1);
  if (existingUsers.length > 0) return existingUsers[0];
  const [newUser] = await db.insert(users).values({ email: 'piyush@streamline.app', name: 'Piyush' }).returning();
  return newUser;
}

export async function listTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    let userId = req.user?.id;
    if (!userId) {
      const user = await getOrCreateDefaultUser();
      userId = user.id;
    }

    const taskList = await db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, userId))
      .orderBy(desc(tasks.createdAt));

    res.json({ tasks: taskList });
  } catch (err: any) {
    logger.error({ err }, 'Error listing tasks');
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
}

export async function createTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { title, description, priority, dueAt, sourceEmailId, sourceEventId } = req.body;

  if (!title) {
    res.status(400).json({ error: 'Task title is required' });
    return;
  }

  try {
    let userId = req.user?.id;
    if (!userId) {
      const user = await getOrCreateDefaultUser();
      userId = user.id;
    }

    const [newTask] = await db.insert(tasks).values({
      userId,
      title,
      description: description || null,
      priority: priority || 'medium',
      status: 'todo',
      dueAt: dueAt ? new Date(dueAt) : null,
      sourceEmailId: sourceEmailId || null,
      sourceEventId: sourceEventId || null,
    }).returning();

    res.status(201).json({ task: newTask });
  } catch (err: any) {
    logger.error({ err }, 'Error creating task');
    res.status(500).json({ error: 'Failed to create task' });
  }
}

export async function updateTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  const taskId = String(req.params.id);
  const { status, title, description, priority, dueAt } = req.body;

  try {
    const [updatedTask] = await db
      .update(tasks)
      .set({
        ...(status && { status }),
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(priority && { priority }),
        ...(dueAt !== undefined && { dueAt: dueAt ? new Date(dueAt) : null }),
        ...(status === 'completed' && { completedAt: new Date() }),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId))
      .returning();

    res.json({ task: updatedTask });
  } catch (err: any) {
    logger.error({ err }, 'Error updating task');
    res.status(500).json({ error: 'Failed to update task' });
  }
}

export async function deleteTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  const taskId = String(req.params.id);
  try {
    await db.delete(tasks).where(eq(tasks.id, taskId));
    res.json({ message: 'Task deleted successfully', taskId });
  } catch (err: any) {
    logger.error({ err }, 'Error deleting task');
    res.status(500).json({ error: 'Failed to delete task' });
  }
}
