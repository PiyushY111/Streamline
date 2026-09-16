import { db } from '../db/index.js';
import { projects, tasks } from '../db/schema/index.js';
import { eq, and, desc, sql } from 'drizzle-orm';

export interface ProjectWithStats {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  status: string;
  color: string;
  stack: string | null;
  currentMilestone: string | null;
  totalTasks: number;
  completedTasks: number;
  completionPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

export class ProjectsRepository {
  async listUserProjects(userId: string): Promise<ProjectWithStats[]> {
    const userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.createdAt));

    if (userProjects.length === 0) return [];

    // Query task counts per project for this user
    const taskStats = await db
      .select({
        projectId: tasks.projectId,
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(case when ${tasks.status} = 'completed' then 1 end)::int`,
      })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), sql`${tasks.projectId} IS NOT NULL`))
      .groupBy(tasks.projectId);

    const statsMap = new Map(
      taskStats.map((s) => [
        s.projectId,
        {
          total: s.total || 0,
          completed: s.completed || 0,
        },
      ]),
    );

    return userProjects.map((p) => {
      const stats = statsMap.get(p.id) || { total: 0, completed: 0 };
      const percentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
      return {
        ...p,
        totalTasks: stats.total,
        completedTasks: stats.completed,
        completionPercentage: percentage,
      };
    });
  }

  async getById(id: string, userId: string) {
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .limit(1);

    if (!project) return null;

    const projectTasks = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.projectId, id), eq(tasks.userId, userId)))
      .orderBy(desc(tasks.createdAt));

    const total = projectTasks.length;
    const completed = projectTasks.filter((t) => t.status === 'completed').length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      ...project,
      totalTasks: total,
      completedTasks: completed,
      completionPercentage: percentage,
      tasks: projectTasks,
    };
  }

  async create(data: {
    userId: string;
    name: string;
    description?: string;
    status?: string;
    color?: string;
    stack?: string;
    currentMilestone?: string;
  }) {
    const [newProject] = await db
      .insert(projects)
      .values({
        userId: data.userId,
        name: data.name,
        description: data.description,
        status: data.status || 'active',
        color: data.color || '#3b82f6',
        stack: data.stack,
        currentMilestone: data.currentMilestone,
      })
      .returning();

    return {
      ...newProject,
      totalTasks: 0,
      completedTasks: 0,
      completionPercentage: 0,
    };
  }

  async update(
    id: string,
    userId: string,
    data: Partial<{
      name: string;
      description: string;
      status: string;
      color: string;
      stack: string;
      currentMilestone: string;
    }>,
  ) {
    const [updated] = await db
      .update(projects)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .returning();

    return updated || null;
  }

  async delete(id: string, userId: string) {
    const [deleted] = await db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .returning();
    return deleted || null;
  }
}

export const projectsRepository = new ProjectsRepository();
