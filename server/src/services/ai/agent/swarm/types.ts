export type SwarmAgentRole =
  | 'supervisor'
  | 'inbox_sentry'
  | 'calendar_negotiator'
  | 'dossier_researcher'
  | 'dag_scheduler'
  | 'critic';

export type SubTaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface SwarmSubTask {
  id: string;
  role: SwarmAgentRole;
  title: string;
  instruction: string;
  status: SubTaskStatus;
  output?: Record<string, unknown> | string;
  error?: string;
  durationMs?: number;
}

export interface SwarmExecutionState {
  userId: string;
  sessionId: string;
  userGoal: string;
  subTasks: SwarmSubTask[];
  currentStepIndex: number;
  intermediateResults: Record<string, unknown>;
  criticPassed: boolean;
  criticFeedback?: string;
  criticIterations: number;
  pendingActions: Array<{
    id?: string;
    toolName: string;
    toolArgs: Record<string, unknown>;
    reasoning: string;
    status: 'pending';
  }>;
  finalAnswer?: string;
  executionLog: string[];
}

export interface SwarmProgressEvent {
  stepId: string;
  role: SwarmAgentRole;
  status: SubTaskStatus;
  title: string;
  message?: string;
  intermediateData?: Record<string, unknown>;
}
