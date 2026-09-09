export interface ScorableTask {
  id: string;
  dueAt: Date | null;
  importance: number;
  estimatedMinutes: number | null;
  dependencies: string[];
  projectId?: string | null;
  status?: string;
}

export type PriorityPreset = 'balanced' | 'deadline' | 'deep_work' | 'quick_wins';

export interface PriorityWeights {
  urgency: number;
  importance: number;
  deadlineProximity: number;
  dependencyImpact: number;
  contextFit: number;
}

export const PRESET_WEIGHTS: Record<PriorityPreset, PriorityWeights> = {
  balanced: {
    urgency: 0.30,
    importance: 0.25,
    deadlineProximity: 0.20,
    dependencyImpact: 0.15,
    contextFit: 0.10,
  },
  deadline: {
    urgency: 0.45,
    importance: 0.10,
    deadlineProximity: 0.35,
    dependencyImpact: 0.05,
    contextFit: 0.05,
  },
  deep_work: {
    urgency: 0.15,
    importance: 0.40,
    deadlineProximity: 0.10,
    dependencyImpact: 0.25,
    contextFit: 0.10,
  },
  quick_wins: {
    urgency: 0.20,
    importance: 0.25,
    deadlineProximity: 0.10,
    dependencyImpact: 0.05,
    contextFit: 0.40,
  },
};

export interface DependencyAnalysisResult {
  dependencyScores: Map<string, number>;
  blockedTaskIds: Set<string>;
  hasCycles: boolean;
  transitiveDownstreamCount: Map<string, number>;
}

export interface PriorityContext {
  now: Date;
  availableMinutes: number;
  preset?: PriorityPreset;
  customWeights?: Partial<PriorityWeights>;
  allTasks: ScorableTask[];
  depAnalysis?: DependencyAnalysisResult;
}

export interface ScoredTask extends ScorableTask {
  score: number;
  isBlocked: boolean;
  breakdown: {
    urgency: number;
    importance: number;
    deadlineProximity: number;
    dependencyImpact: number;
    contextFit: number;
  };
  reasoning: string[];
}

/**
 * 1. Exponential Urgency Decay
 * Overdue: 1.0 (maximum urgency)
 * Horizon decay: e^(-hoursRemaining / 48) concentrates urgency near deadline.
 * Missing due date: 0.0
 */
export function computeUrgency(dueAt: Date | null, now: Date): number {
  if (!dueAt) return 0;
  const hoursRemaining = (dueAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursRemaining <= 0) return 1;
  return Math.max(0, Math.min(1, Math.exp(-hoursRemaining / 48)));
}

/**
 * 2. Deadline Proximity Ratio
 * Compares estimated effort against remaining time until deadline.
 * Missing estimate or due date: 0.5 (neutral default).
 */
export function computeDeadlineProximity(
  dueAt: Date | null,
  estimatedMinutes: number | null,
  now: Date
): number {
  if (!dueAt || !estimatedMinutes || estimatedMinutes <= 0) return 0.5;
  const minutesRemaining = (dueAt.getTime() - now.getTime()) / (1000 * 60);
  if (minutesRemaining <= 0) return 1;
  const ratio = estimatedMinutes / minutesRemaining;
  return Math.max(0, Math.min(1, ratio));
}

/**
 * 3. Context Fit
 * Evaluates how cleanly estimated effort fits within caller's available focus window.
 * Missing estimate: optimistic 0.75 fit.
 * <= available: 1.0
 * > available: proportional penalty with partial credit for near-fits.
 */
export function computeContextFit(estimatedMinutes: number | null, availableMinutes: number): number {
  if (availableMinutes <= 0) return 0;
  if (!estimatedMinutes || estimatedMinutes <= 0) return 0.75;
  if (estimatedMinutes <= availableMinutes) return 1;
  const overBy = estimatedMinutes - availableMinutes;
  return Math.max(0, 1 - overBy / availableMinutes);
}

/**
 * 4. Directed Acyclic Graph (DAG) Dependency Analyzer
 * - Detects circular dependency cycles using Kahn's algorithm
 * - Computes transitive downstream leverage (direct dependents + 0.5 * indirect dependents)
 * - Identifies blocked tasks (tasks depending on unfinished sibling tasks)
 */
export function analyzeDependencies(allTasks: ScorableTask[]): DependencyAnalysisResult {
  const taskMap = new Map(allTasks.map((t) => [t.id, t]));
  const directDependents = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  for (const task of allTasks) {
    directDependents.set(task.id, new Set());
    inDegree.set(task.id, 0);
  }

  const blockedTaskIds = new Set<string>();

  for (const task of allTasks) {
    const validDeps = (task.dependencies || []).filter((depId) => taskMap.has(depId) && depId !== task.id);
    if (validDeps.length > 0) {
      // Check if any prerequisite is unfinished
      const hasUnfinishedDep = validDeps.some((depId) => {
        const depTask = taskMap.get(depId);
        return depTask?.status !== 'completed';
      });
      if (hasUnfinishedDep) {
        blockedTaskIds.add(task.id);
      }
    }

    for (const depId of validDeps) {
      directDependents.get(depId)?.add(task.id);
      inDegree.set(task.id, (inDegree.get(task.id) || 0) + 1);
    }
  }

  // Kahn's Algorithm for cycle detection
  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }

  let visitedCount = 0;
  while (queue.length > 0) {
    const u = queue.shift()!;
    visitedCount++;
    for (const v of directDependents.get(u) || []) {
      const newDeg = (inDegree.get(v) || 0) - 1;
      inDegree.set(v, newDeg);
      if (newDeg === 0) queue.push(v);
    }
  }

  const hasCycles = visitedCount < allTasks.length;

  // Transitive downstream count computation (DFS with cycle safety)
  const transitiveDownstreamCount = new Map<string, number>();
  for (const task of allTasks) {
    const visited = new Set<string>();
    const stack = Array.from(directDependents.get(task.id) || []);
    let directCount = stack.length;
    let indirectCount = 0;

    while (stack.length > 0) {
      const nextId = stack.pop()!;
      if (!visited.has(nextId) && nextId !== task.id) {
        visited.add(nextId);
        const children = directDependents.get(nextId);
        if (children) {
          for (const child of children) {
            if (!visited.has(child) && child !== task.id) {
              stack.push(child);
              indirectCount++;
            }
          }
        }
      }
    }

    transitiveDownstreamCount.set(task.id, directCount + 0.5 * indirectCount);
  }

  const maxLeverage = Math.max(...Array.from(transitiveDownstreamCount.values()), 1);
  const dependencyScores = new Map<string, number>();

  for (const task of allTasks) {
    const rawLeverage = transitiveDownstreamCount.get(task.id) || 0;
    dependencyScores.set(task.id, rawLeverage > 0 ? Math.min(1, rawLeverage / maxLeverage) : 0);
  }

  return {
    dependencyScores,
    blockedTaskIds,
    hasCycles,
    transitiveDownstreamCount,
  };
}

/**
 * Score a single task against full context
 */
export function scoreTask(task: ScorableTask, ctx: PriorityContext): ScoredTask {
  const preset = ctx.preset || 'balanced';
  const baseWeights = PRESET_WEIGHTS[preset];
  const weights: PriorityWeights = {
    ...baseWeights,
    ...(ctx.customWeights || {}),
  };

  const depAnalysis = ctx.depAnalysis || analyzeDependencies(ctx.allTasks);
  const isBlocked = depAnalysis.blockedTaskIds.has(task.id);

  const urgency = computeUrgency(task.dueAt, ctx.now);
  const importance = Math.max(0, Math.min(1, task.importance ?? 0.5));
  const deadlineProximity = computeDeadlineProximity(task.dueAt, task.estimatedMinutes, ctx.now);
  const dependencyImpact = depAnalysis.dependencyScores.get(task.id) || 0;
  const contextFit = computeContextFit(task.estimatedMinutes, ctx.availableMinutes);

  let score =
    weights.urgency * urgency +
    weights.importance * importance +
    weights.deadlineProximity * deadlineProximity +
    weights.dependencyImpact * dependencyImpact +
    weights.contextFit * contextFit;

  // Blocked penalty: tasks that cannot yet be started have their actionable score dampened
  if (isBlocked) {
    score = score * 0.4;
  }

  score = Math.max(0, Math.min(1, score));

  // Plain-language, transparent reasoning array
  const reasoning: string[] = [];
  if (task.dueAt) {
    const hrs = Math.round((task.dueAt.getTime() - ctx.now.getTime()) / (1000 * 60 * 60));
    if (hrs <= 0) reasoning.push('⚠️ Overdue deadline');
    else if (hrs <= 24) reasoning.push(`⏰ Due in ${hrs}h`);
    else {
      const days = Math.round(hrs / 24);
      reasoning.push(`📅 Due in ${days}d`);
    }
  }

  if (task.estimatedMinutes) {
    reasoning.push(`⏱️ Est. ${task.estimatedMinutes}m`);
  }

  const downstreamCount = Math.round(depAnalysis.transitiveDownstreamCount.get(task.id) || 0);
  if (downstreamCount > 0) {
    reasoning.push(`🔓 Unblocks ${downstreamCount} work item${downstreamCount > 1 ? 's' : ''}`);
  }

  if (isBlocked) {
    reasoning.push('🚫 Blocked by prerequisite task');
  }

  if (contextFit >= 1 && task.estimatedMinutes) {
    reasoning.push(`🎯 Fits your ${ctx.availableMinutes}m window`);
  } else if (task.estimatedMinutes && task.estimatedMinutes > ctx.availableMinutes) {
    reasoning.push(`⏳ Exceeds current ${ctx.availableMinutes}m window`);
  }

  if (importance >= 0.8) {
    reasoning.push('⭐ High strategic importance');
  }

  return {
    ...task,
    score,
    isBlocked,
    breakdown: {
      urgency,
      importance,
      deadlineProximity,
      dependencyImpact,
      contextFit,
    },
    reasoning,
  };
}

/**
 * Rank an array of tasks deterministically, isolating unblocked from blocked tasks
 */
export function rankTasks(
  tasks: ScorableTask[],
  ctx: Omit<PriorityContext, 'allTasks' | 'depAnalysis'>
): {
  ranked: ScoredTask[];
  blocked: ScoredTask[];
  all: ScoredTask[];
} {
  const fullCtx: PriorityContext = {
    ...ctx,
    allTasks: tasks,
    depAnalysis: analyzeDependencies(tasks),
  };

  const scored = tasks.map((t) => scoreTask(t, fullCtx));

  // Deterministic stable sorting by score DESC, tie-breaking by dueAt ASC, then id ASC
  const sortComparator = (a: ScoredTask, b: ScoredTask) => {
    if (Math.abs(b.score - a.score) > 0.0001) {
      return b.score - a.score;
    }
    if (a.dueAt && b.dueAt) {
      return a.dueAt.getTime() - b.dueAt.getTime();
    }
    if (a.dueAt && !b.dueAt) return -1;
    if (!a.dueAt && b.dueAt) return 1;
    return a.id.localeCompare(b.id);
  };

  const unblocked = scored.filter((s) => !s.isBlocked).sort(sortComparator);
  const blocked = scored.filter((s) => s.isBlocked).sort(sortComparator);
  const all = [...unblocked, ...blocked];

  return {
    ranked: unblocked,
    blocked,
    all,
  };
}
