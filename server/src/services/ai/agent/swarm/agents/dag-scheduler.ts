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
        dueDate: tasks.dueDate,
        projectId: tasks.projectId,
      })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.status, 'todo')))
      .limit(20);

    const scoredTasks = userTasks.map((t) => {
      const urgency = priorityEngine.calculateUrgencyScore({
        dueDate: t.dueDate,
        status: t.status,
      });
      return {
        id: t.id,
        title: t.title,
        urgencyScore: urgency,
      };
    }).sort((a, b) => b.urgencyScore - a.urgencyScore);

    const topTask = scoredTasks[0];

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
