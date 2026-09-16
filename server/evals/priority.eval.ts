import { runSuite } from './runner.js';
import { priorityEngine, ScorableTask, RankedTask, PriorityPreset } from '../src/services/priority.service.js';

interface ScenarioTaskInput {
  id: string;
  title: string;
  importance: number;
  hoursUntilDue: number | null;
  estimatedMinutes: number | null;
  dependencies: string[];
}

interface PriorityScenarioInput {
  preset: PriorityPreset;
  availableMinutes?: number;
  tasks: ScenarioTaskInput[];
}

interface PriorityScenarioExpected {
  topTaskId?: string;
  topActionableId?: string;
  overdueUrgency?: number;
  blockedTaskIds?: string[];
  winnerId?: string;
  loserId?: string;
  hasCycles?: boolean;
  urgency?: number;
  minScore?: number;
  contextFit?: number;
  blockedCount?: number;
}

export async function runPriorityEval() {
  const now = new Date('2026-09-09T12:00:00Z');

  return runSuite<PriorityScenarioInput, PriorityScenarioExpected, any>(
    'deterministic-priority-engine',
    'priority-scenarios.json',
    async (input) => {
      const scorableTasks: ScorableTask[] = input.tasks.map((t) => ({
        id: t.id,
        importance: t.importance,
        dueAt: t.hoursUntilDue !== null ? new Date(now.getTime() + t.hoursUntilDue * 60 * 60 * 1000) : null,
        estimatedMinutes: t.estimatedMinutes,
        dependencies: t.dependencies || [],
      }));

      const partitioned = priorityEngine.rankTasksPartitioned(scorableTasks, {
        preset: input.preset,
        availableMinutes: input.availableMinutes,
        now,
      });

      const cycleCheck = priorityEngine.detectCycles(scorableTasks);

      return {
        all: partitioned.all,
        ranked: partitioned.ranked,
        blocked: partitioned.blocked,
        hasCycles: cycleCheck.hasCycles,
      };
    },
    (actual, expected) => {
      // Check topTaskId
      if (expected.topTaskId) {
        if (!actual.all[0] || actual.all[0].id !== expected.topTaskId) {
          return false;
        }
      }

      // Check topActionableId
      if (expected.topActionableId) {
        if (!actual.ranked[0] || actual.ranked[0].id !== expected.topActionableId) {
          return false;
        }
      }

      // Check overdueUrgency
      if (expected.overdueUrgency !== undefined) {
        const top = actual.all[0];
        if (!top || Math.abs(top.breakdown.urgency - expected.overdueUrgency) > 0.001) {
          return false;
        }
      }

      // Check blockedTaskIds
      if (expected.blockedTaskIds) {
        const actualBlockedIds = actual.blocked.map((b: RankedTask) => b.id);
        for (const expId of expected.blockedTaskIds) {
          if (!actualBlockedIds.includes(expId)) return false;
        }
      }

      // Check winner vs loser
      if (expected.winnerId && expected.loserId) {
        const winner = actual.all.find((t: RankedTask) => t.id === expected.winnerId);
        const loser = actual.all.find((t: RankedTask) => t.id === expected.loserId);
        if (!winner || !loser || winner.score <= loser.score) {
          return false;
        }
      }

      // Check hasCycles
      if (expected.hasCycles !== undefined) {
        if (actual.hasCycles !== expected.hasCycles) {
          return false;
        }
      }

      // Check urgency exact match
      if (expected.urgency !== undefined) {
        const item = actual.all[0];
        if (!item || Math.abs(item.breakdown.urgency - expected.urgency) > 0.001) {
          return false;
        }
      }

      // Check minScore
      if (expected.minScore !== undefined) {
        const item = actual.all[0];
        const normalized = expected.minScore > 1 ? expected.minScore / 100 : expected.minScore;
        if (!item || item.score < normalized) {
          return false;
        }
      }

      // Check contextFit
      if (expected.contextFit !== undefined) {
        const item = actual.all[0];
        if (!item || Math.abs(item.breakdown.contextFit - expected.contextFit) > 0.001) {
          return false;
        }
      }

      // Check blockedCount
      if (expected.blockedCount !== undefined) {
        if (actual.blocked.length !== expected.blockedCount) {
          return false;
        }
      }

      return true;
    },
  );
}
