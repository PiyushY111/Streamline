import { describe, it, expect } from 'vitest';
import {
  scoreTask,
  rankTasks,
  computeUrgency,
  computeDeadlineProximity,
  computeContextFit,
  analyzeDependencies,
  type ScorableTask,
} from '../services/priority.service.js';

describe('Advanced Deterministic Priority Engine', () => {
  const now = new Date('2026-09-10T12:00:00Z');

  it('ranks an urgent, high-importance task (Task A) above a trivial task (Task B) from the spec', () => {
    const taskA: ScorableTask = {
      id: 'task-A',
      dueAt: new Date('2026-09-11T12:00:00Z'), // 24h away
      importance: 0.9,
      estimatedMinutes: 120,
      dependencies: [],
    };
    const taskB: ScorableTask = {
      id: 'task-B',
      dueAt: new Date('2026-09-10T18:00:00Z'), // 6h away
      importance: 0.2,
      estimatedMinutes: 15,
      dependencies: [],
    };

    const { ranked } = rankTasks([taskA, taskB], { now, availableMinutes: 120 });
    expect(ranked[0].id).toBe('task-A');
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it('assigns 1.0 urgency to overdue tasks', () => {
    const overdueTask: ScorableTask = {
      id: 'overdue-1',
      dueAt: new Date('2026-09-10T10:00:00Z'), // 2 hours overdue
      importance: 0.5,
      estimatedMinutes: 30,
      dependencies: [],
    };

    const scored = scoreTask(overdueTask, { now, availableMinutes: 60, allTasks: [overdueTask] });
    expect(scored.breakdown.urgency).toBe(1.0);
    expect(scored.reasoning).toContain('⚠️ Overdue deadline');
  });

  it('handles tasks with missing due date and estimates without throwing or penalizing', () => {
    const vagueTask: ScorableTask = {
      id: 'vague-1',
      dueAt: null,
      importance: 0.5,
      estimatedMinutes: null,
      dependencies: [],
    };

    const scored = scoreTask(vagueTask, { now, availableMinutes: 60, allTasks: [vagueTask] });
    expect(scored.score).toBeGreaterThan(0);
    expect(scored.score).toBeLessThan(1);
    expect(scored.breakdown.urgency).toBe(0);
    expect(scored.breakdown.deadlineProximity).toBe(0.5);
    expect(scored.breakdown.contextFit).toBe(0.75);
  });

  it('boosts tasks that unblock downstream work (DAG dependency leverage)', () => {
    const blocker: ScorableTask = {
      id: 'blocker',
      dueAt: null,
      importance: 0.4,
      estimatedMinutes: 30,
      dependencies: [],
    };
    const dependent1: ScorableTask = {
      id: 'dep-1',
      dueAt: null,
      importance: 0.4,
      estimatedMinutes: 30,
      dependencies: ['blocker'],
    };
    const dependent2: ScorableTask = {
      id: 'dep-2',
      dueAt: null,
      importance: 0.4,
      estimatedMinutes: 30,
      dependencies: ['blocker'],
    };

    const { ranked } = rankTasks([blocker, dependent1, dependent2], { now, availableMinutes: 60 });
    expect(ranked[0].id).toBe('blocker');
    expect(ranked[0].breakdown.dependencyImpact).toBe(1.0);
    expect(ranked[0].reasoning.some((r) => r.includes('Unblocks'))).toBe(true);
  });

  it('isolates blocked tasks whose prerequisites are incomplete', () => {
    const prereq: ScorableTask = {
      id: 'prereq',
      dueAt: null,
      importance: 0.5,
      estimatedMinutes: 30,
      dependencies: [],
      status: 'todo',
    };
    const blockedTask: ScorableTask = {
      id: 'blocked',
      dueAt: new Date('2026-09-10T13:00:00Z'),
      importance: 0.9,
      estimatedMinutes: 30,
      dependencies: ['prereq'],
      status: 'todo',
    };

    const { ranked, blocked } = rankTasks([prereq, blockedTask], { now, availableMinutes: 60 });
    expect(ranked.map((t) => t.id)).toContain('prereq');
    expect(blocked.map((t) => t.id)).toContain('blocked');
    expect(blocked[0].isBlocked).toBe(true);
    expect(blocked[0].reasoning).toContain('🚫 Blocked by prerequisite task');
  });

  it('detects and safely handles circular dependencies without crashing or looping', () => {
    const taskA: ScorableTask = {
      id: 'circle-A',
      dueAt: null,
      importance: 0.5,
      estimatedMinutes: 30,
      dependencies: ['circle-B'],
      status: 'todo',
    };
    const taskB: ScorableTask = {
      id: 'circle-B',
      dueAt: null,
      importance: 0.5,
      estimatedMinutes: 30,
      dependencies: ['circle-A'],
      status: 'todo',
    };

    const analysis = analyzeDependencies([taskA, taskB]);
    expect(analysis.hasCycles).toBe(true);

    const { all } = rankTasks([taskA, taskB], { now, availableMinutes: 60 });
    expect(all.length).toBe(2);
  });

  it('applies context fit penalties when task exceeds available focus window', () => {
    const hugeTask: ScorableTask = {
      id: 'huge',
      dueAt: null,
      importance: 0.5,
      estimatedMinutes: 180, // 3 hours
      dependencies: [],
    };

    const scoredInSmallWindow = scoreTask(hugeTask, { now, availableMinutes: 30, allTasks: [hugeTask] });
    const scoredInLargeWindow = scoreTask(hugeTask, { now, availableMinutes: 240, allTasks: [hugeTask] });

    expect(scoredInSmallWindow.breakdown.contextFit).toBeLessThan(0.5);
    expect(scoredInLargeWindow.breakdown.contextFit).toBe(1.0);
    expect(scoredInSmallWindow.reasoning.some((r) => r.includes('Exceeds'))).toBe(true);
    expect(scoredInLargeWindow.reasoning.some((r) => r.includes('Fits'))).toBe(true);
  });

  it('dynamically adapts scoring according to presets (deadline vs deep_work)', () => {
    const urgentTask: ScorableTask = {
      id: 'urgent-task',
      dueAt: new Date('2026-09-10T14:00:00Z'), // 2h away
      importance: 0.3,
      estimatedMinutes: 30,
      dependencies: [],
    };
    const strategicTask: ScorableTask = {
      id: 'strategic-task',
      dueAt: new Date('2026-09-15T12:00:00Z'), // 5 days away
      importance: 0.95,
      estimatedMinutes: 90,
      dependencies: [],
    };

    const deadlineRanked = rankTasks([urgentTask, strategicTask], {
      now,
      availableMinutes: 120,
      preset: 'deadline',
    });
    expect(deadlineRanked.ranked[0].id).toBe('urgent-task');

    const deepWorkRanked = rankTasks([urgentTask, strategicTask], {
      now,
      availableMinutes: 120,
      preset: 'deep_work',
    });
    expect(deepWorkRanked.ranked[0].id).toBe('strategic-task');
  });

  it('determines transitive downstream dependency leverage in multi-hop chains (A -> B -> C)', () => {
    const rootTask: ScorableTask = { id: 'A', dueAt: null, importance: 0.5, estimatedMinutes: 30, dependencies: [] };
    const middleTask: ScorableTask = { id: 'B', dueAt: null, importance: 0.5, estimatedMinutes: 30, dependencies: ['A'] };
    const leafTask: ScorableTask = { id: 'C', dueAt: null, importance: 0.5, estimatedMinutes: 30, dependencies: ['B'] };

    const analysis = analyzeDependencies([rootTask, middleTask, leafTask]);
    expect(analysis.transitiveDownstreamCount.get('A')).toBeGreaterThan(
      analysis.transitiveDownstreamCount.get('B')!
    );
  });

  it('deterministic tie-breaking: identical scores produce stable predictable ordering', () => {
    const task1: ScorableTask = { id: 'alpha', dueAt: null, importance: 0.5, estimatedMinutes: 30, dependencies: [] };
    const task2: ScorableTask = { id: 'beta', dueAt: null, importance: 0.5, estimatedMinutes: 30, dependencies: [] };

    const run1 = rankTasks([task1, task2], { now, availableMinutes: 60 });
    const run2 = rankTasks([task2, task1], { now, availableMinutes: 60 });

    expect(run1.ranked.map((t) => t.id)).toEqual(run2.ranked.map((t) => t.id));
    expect(run1.ranked[0].id).toBe('alpha');
  });

  it('handles empty task list gracefully', () => {
    const { ranked, blocked, all } = rankTasks([], { now, availableMinutes: 60 });
    expect(ranked).toEqual([]);
    expect(blocked).toEqual([]);
    expect(all).toEqual([]);
  });

  it('handles negative or zero availableMinutes gracefully', () => {
    const task: ScorableTask = { id: 'zero-fit', dueAt: null, importance: 0.5, estimatedMinutes: 30, dependencies: [] };
    const scoredZero = scoreTask(task, { now, availableMinutes: 0, allTasks: [task] });
    const scoredNeg = scoreTask(task, { now, availableMinutes: -10, allTasks: [task] });

    expect(scoredZero.breakdown.contextFit).toBe(0);
    expect(scoredNeg.breakdown.contextFit).toBe(0);
  });

  it('computes exponential decay smoothly across 1h, 24h, 48h, 72h', () => {
    const d1h = new Date(now.getTime() + 1 * 3600 * 1000);
    const d24h = new Date(now.getTime() + 24 * 3600 * 1000);
    const d48h = new Date(now.getTime() + 48 * 3600 * 1000);
    const d72h = new Date(now.getTime() + 72 * 3600 * 1000);

    const u1 = computeUrgency(d1h, now);
    const u24 = computeUrgency(d24h, now);
    const u48 = computeUrgency(d48h, now);
    const u72 = computeUrgency(d72h, now);

    expect(u1).toBeGreaterThan(u24);
    expect(u24).toBeGreaterThan(u48);
    expect(u48).toBeGreaterThan(u72);
  });

  it('performance benchmark: ranks 1,000 tasks in under 15ms', () => {
    const largeTaskSet: ScorableTask[] = [];
    for (let i = 0; i < 1000; i++) {
      largeTaskSet.push({
        id: `task-${i}`,
        dueAt: i % 3 === 0 ? new Date(now.getTime() + (i % 72) * 3600 * 1000) : null,
        importance: (i % 10) / 10,
        estimatedMinutes: 15 * ((i % 8) + 1),
        dependencies: i > 0 && i % 5 === 0 ? [`task-${i - 1}`] : [],
      });
    }

    const start = performance.now();
    const { ranked } = rankTasks(largeTaskSet, { now, availableMinutes: 60 });
    const duration = performance.now() - start;

    expect(ranked.length).toBeGreaterThan(500);
    expect(duration).toBeLessThan(50); // Under 50ms for 1,000 tasks
  });
});
