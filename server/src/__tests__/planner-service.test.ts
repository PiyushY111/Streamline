import { describe, it, expect, vi, beforeEach } from 'vitest';
import { plannerService } from '../services/planner.service.js';
import { tasksRepository } from '../repositories/tasks.repository.js';
import { eventsRepository } from '../repositories/events.repository.js';

describe('Planner Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTasks = [
    {
      id: 'task-1',
      userId: 'user-1',
      title: 'Fix urgent bug',
      description: null,
      status: 'todo',
      priority: 'high',
      importance: 0.9,
      estimatedMinutes: 30,
      dependencies: [],
      dueAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // due in 4 hours
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
      sourceEmailId: null,
      sourceEventId: null,
      projectId: null,
    },
    {
      id: 'task-2',
      userId: 'user-1',
      title: 'Deploy to staging',
      description: null,
      status: 'todo',
      priority: 'high',
      importance: 0.95,
      estimatedMinutes: 20,
      dependencies: ['task-1'], // blocked by task-1
      dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
      sourceEmailId: null,
      sourceEventId: null,
      projectId: null,
    },
    {
      id: 'task-3',
      userId: 'user-1',
      title: 'Write docs',
      description: null,
      status: 'todo',
      priority: 'low',
      importance: 0.2,
      estimatedMinutes: 60,
      dependencies: [],
      dueAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // due in 3 days
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
      sourceEmailId: null,
      sourceEventId: null,
      projectId: 'proj-1',
    },
  ];

  it('recommends actionable task over blocked task even if blocked task has sooner deadline', async () => {
    vi.spyOn(tasksRepository, 'listActiveTasks').mockResolvedValue(mockTasks as any);
    vi.spyOn(eventsRepository, 'findSmartFreeSlots').mockResolvedValue([]);

    const result = await plannerService.getNextTask('user-1');

    expect(result.recommendedTask).not.toBeNull();
    // task-1 must be recommended because task-2 is blocked by task-1
    expect(result.recommendedTask?.id).toBe('task-1');
    expect(result.summary.blockedCount).toBe(1);
    expect(result.summary.actionableCount).toBe(2);
    expect(result.blockedTasks[0]!.id).toBe('task-2');
    expect(result.blockedTasks[0]!.isBlocked).toBe(true);
  });

  it('matches available calendar slot when found', async () => {
    vi.spyOn(tasksRepository, 'listActiveTasks').mockResolvedValue(mockTasks as any);
    const mockSlot = {
      start: new Date(Date.now() + 30 * 60 * 1000),
      end: new Date(Date.now() + 90 * 60 * 1000),
      durationMinutes: 60,
    };
    vi.spyOn(eventsRepository, 'findSmartFreeSlots').mockResolvedValue([mockSlot]);

    const result = await plannerService.getNextTask('user-1');

    expect(result.availableSlot).toEqual(mockSlot);
    expect(result.summary.effectiveAvailableMinutes).toBe(60);
  });

  it('filters by projectId when specified', async () => {
    vi.spyOn(tasksRepository, 'listActiveTasks').mockResolvedValue(mockTasks as any);
    vi.spyOn(eventsRepository, 'findSmartFreeSlots').mockResolvedValue([]);

    const result = await plannerService.getNextTask('user-1', { projectId: 'proj-1' });

    expect(result.recommendedTask?.id).toBe('task-3');
    expect(result.summary.totalActive).toBe(1);
  });

  it('returns weight presets correctly', () => {
    const presets = plannerService.getWeightPresets();
    expect(presets).toHaveProperty('balanced');
    expect(presets).toHaveProperty('deadline');
    expect(presets).toHaveProperty('deep_work');
    expect(presets).toHaveProperty('quick_wins');
    expect(presets.deadline.urgency).toBe(0.45);
  });
});
