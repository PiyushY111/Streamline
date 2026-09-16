import { db } from '../../../../../db/index.js';
import { tasks, projects } from '../../../../../db/schema/index.js';
import { eq, and, desc } from 'drizzle-orm';
import { priorityEngine } from '../../../../priority.service.js';
import { logger } from '../../../../../utils/logger.js';

export interface DagSchedulerOutput {
  activeTasksCount: number;
  criticalPathTask?: { id: string; title: string; urgencyScore: number };
  proposedActions: Array<{ type: 'create_task' | 'link_dependency'; details: Record<string, unknown> }>;
  summary: string;
}

export class DagSchedulerAgent {
  public async execute(userId: string, instruction: string): Promise<DagSchedulerOutput> {
    logger.info({ userId, instruction }, 'DAG Scheduler Agent executing...');

    const userTasks = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        dueAt: tasks.dueAt,
        importance: tasks.importance,
        estimatedMinutes: tasks.estimatedMinutes,
        dependencies: tasks.dependencies,
        projectId: tasks.projectId,
      })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.status, 'todo')))
      .limit(20);

    const ranked = priorityEngine.rankTasks(
      userTasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueAt: t.dueAt,
        importance: t.importance ?? 0.5,
        estimatedMinutes: t.estimatedMinutes ?? 30,
        dependencies: t.dependencies ?? [],
      }))
    );

    const topTask = ranked[0]
      ? {
          id: ranked[0].id,
          title: userTasks.find((t) => t.id === ranked[0].id)?.title || 'Task',
          urgencyScore: ranked[0].score,
        }
      : undefined;

    return {
      activeTasksCount: userTasks.length,
      criticalPathTask: topTask,
      proposedActions: [
        {
          type: 'create_task',
          details: {
            title: `Follow up: ${instruction.slice(0, 40)}`,
            priority: 'high',
          },
        },
      ],
      summary: `DAG Task Dependency graph evaluated (${userTasks.length} active tasks). Top critical path item is "${topTask?.title || 'None'}" (Urgency: ${topTask?.urgencyScore || 0}).`,
    };
  }
}

export const dagSchedulerAgent = new DagSchedulerAgent();
