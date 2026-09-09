import { tasksRepository } from '../repositories/tasks.repository.js';
import { eventsRepository } from '../repositories/events.repository.js';
import {
  priorityEngine,
  PriorityWeights,
  RankedTask,
  WEIGHT_PRESETS,
} from './priority.service.js';

export interface GetNextTaskOptions {
  preset?: 'balanced' | 'deadline' | 'deep_work' | 'quick_wins';
  weights?: Partial<PriorityWeights>;
  availableMinutes?: number;
  projectId?: string;
}

export interface NextTaskResult {
  recommendedTask: RankedTask | null;
  availableSlot: {
    start: Date;
    end: Date;
    durationMinutes: number;
  } | null;
  summary: {
    totalActive: number;
    actionableCount: number;
    blockedCount: number;
    hasCycles: boolean;
    activePreset: string;
    effectiveAvailableMinutes?: number;
  };
  rankedTasks: RankedTask[];
  blockedTasks: RankedTask[];
}

export class PlannerService {
  /**
   * Deterministically finds the next best task to execute,
   * factoring in free calendar slots, task dependencies (DAG),
   * urgency decay, and importance.
   */
  async getNextTask(userId: string, options: GetNextTaskOptions = {}): Promise<NextTaskResult> {
    // 1. Fetch active tasks
    let activeTasks = await tasksRepository.listActiveTasks(userId);

    if (options.projectId) {
      activeTasks = activeTasks.filter((t) => t.projectId === options.projectId);
    }

    // 2. Discover next calendar slot if availableMinutes is not explicitly given
    let availableSlot: { start: Date; end: Date; durationMinutes: number } | null = null;
    let effectiveMinutes = options.availableMinutes;

    if (effectiveMinutes === undefined) {
      const now = new Date();
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const freeSlots = await eventsRepository.findSmartFreeSlots(userId, {
        startTime: now,
        endTime: endOfToday,
        minDurationMinutes: 15,
        bufferMinutes: 10,
      });

      if (freeSlots.length > 0) {
        availableSlot = freeSlots[0];
        effectiveMinutes = freeSlots[0].durationMinutes;
      }
    }

    // 3. Score and rank tasks through deterministic PriorityEngine
    const ranked = priorityEngine.rankTasks(activeTasks, {
      weights: options.weights,
      preset: options.preset || 'balanced',
      availableMinutes: effectiveMinutes,
      now: new Date(),
    });

    // 4. Split into actionable vs blocked
    const actionableTasks = ranked.filter((t) => !t.isBlocked);
    const blockedTasks = ranked.filter((t) => t.isBlocked);

    // Recommended task is the highest-ranked actionable task
    const recommendedTask = actionableTasks.length > 0 ? actionableTasks[0] : null;

    // Check for cycles across dependencies
    const cycleCheck = priorityEngine.detectCycles(activeTasks);

    return {
      recommendedTask,
      availableSlot,
      summary: {
        totalActive: activeTasks.length,
        actionableCount: actionableTasks.length,
        blockedCount: blockedTasks.length,
        hasCycles: cycleCheck.hasCycles,
        activePreset: options.preset || 'balanced',
        effectiveAvailableMinutes: effectiveMinutes,
      },
      rankedTasks: actionableTasks,
      blockedTasks,
    };
  }

  /**
   * Score and rank all tasks for a user
   */
  async rankTasks(userId: string, options: GetNextTaskOptions = {}) {
    const activeTasks = await tasksRepository.listActiveTasks(userId);
    return priorityEngine.rankTasks(activeTasks, {
      weights: options.weights,
      preset: options.preset || 'balanced',
      availableMinutes: options.availableMinutes,
    });
  }

  /**
   * Return available preset weights for frontend selection
   */
  getWeightPresets() {
    return WEIGHT_PRESETS;
  }
}

export const plannerService = new PlannerService();
