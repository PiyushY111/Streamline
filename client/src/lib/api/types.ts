export interface AccountData {
  id: string;
  providerAccountId: string;
  email: string;
  label: string;
  color: string;
  avatar?: string;
  status: 'active' | 'syncing' | 'error';
  scopes: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailData {
  id: string;
  threadId: string;
  accountId: string;
  accountName: string;
  accountEmail?: string;
  accountColor: string;
  sender: string;
  recipients: string;
  subject: string;
  snippet: string;
  bodyText?: string;
  bodyHtml?: string;
  receivedAt: string;
  isRead: boolean;
  isStarred: boolean;
  folder?: string;
  category?: 'primary' | 'promotions' | 'social' | 'updates';
  attachments?: any[];
  aiPriority?: 'p1_urgent' | 'p2_important' | 'p3_updates' | 'p4_newsletter' | 'p5_low';
  aiUrgencyScore?: number;
  aiSummary?: string;
  aiNewsletterTopic?: string;
  aiSentiment?: string;
  aiExtractedTasks?: any[];
}


export interface EventData {
  id: string;
  calendarId: string;
  accountId: string;
  accountName: string;
  accountColor: string;
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  hasConflict: boolean;
  conflictingWith: string[];
  guests?: string[];
  type?: 'event' | 'task' | 'reminder';
  colorSwatch?: string;
  meetLink?: string;
  isAllDay?: boolean;
}

export interface TaskData {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  dueAt?: string;
  completedAt?: string | null;
  sourceEmailId?: string;
  sourceEventId?: string;
  projectId?: string | null;
  importance?: number;
  estimatedMinutes?: number | null;
  dependencies?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectData {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  status: 'active' | 'completed' | 'archived' | 'on_hold';
  color: string;
  stack?: string | null;
  currentMilestone?: string | null;
  totalTasks: number;
  completedTasks: number;
  completionPercentage: number;
  createdAt: string;
  updatedAt: string;
  tasks?: TaskData[];
}

export interface RankedTaskData extends TaskData {
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

export interface NextTaskResponse {
  recommendedTask: RankedTaskData | null;
  availableSlot: {
    start: string;
    end: string;
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
  rankedTasks: RankedTaskData[];
  blockedTasks: RankedTaskData[];
}

// Stage 2 Agent & Pending Actions Types
export interface PendingActionData {
  id: string;
  userId: string;
  sessionId?: string | null;
  toolName: string;
  toolArgs: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed' | 'expired';
  reasoning?: string | null;
  impactPreview?: Record<string, any> | null;
  expiresAt: string;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface AgentSessionData {
  id: string;
  title?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentMessageData {
  id: string;
  sessionId: string;
  role: 'user' | 'model' | 'tool';
  content?: string | null;
  toolCalls?: Array<{ id?: string; name: string; args: Record<string, any> }>;
  toolName?: string;
  toolResult?: any;
  createdAt: string;
}

export interface UserMemoryData {
  id: string;
  type: 'preference' | 'decision' | 'project_fact';
  content: string;
  sourceRef?: string | null;
  createdAt: string;
}

export interface MemorySearchResultData {
  id: string;
  type: 'preference' | 'decision' | 'project_fact';
  content: string;
  distance: number;
  score: number;
  sourceRef?: string | null;
  createdAt: string;
}

export interface AiProviderInfoData {
  provider: string;
  isAvailable: boolean;
  dimensions: number;
}

// Stage 4 Prompt-Injection Defense & Security Types
export interface PendingActionSecurityNotice {
  untrustedContentTriggered: boolean;
  source: string;
  sourceSender: string;
  threatWarning: string;
}

export interface SecurityStatusData {
  status: string;
  policyEngine: string;
  untrustedIngestion: string;
  interceptionRate: string;
  evalScenariosPassed: number;
  totalEvalScenarios: number;
  registeredTools: Array<{
    name: string;
    description: string;
    permissionClass: 'read' | 'write' | 'send';
  }>;
  safetyInvariants: string[];
}

export interface InjectionSimulationResultData {
  success: boolean;
  attackType: string;
  payloadSnippet: string;
  pipeline: {
    step1_ingestion: {
      status: string;
      marker: string;
      description: string;
    };
    step2_anomalyDetection: {
      status: string;
      riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
      detectedVectors: string[];
    };
    step3_policyBoundary: {
      status: string;
      action: string;
      directWritesExecuted: number;
      policyGate: string;
    };
    step4_auditTrail: {
      status: string;
      tamperEvidentLog: string;
    };
  };
  verdict: string;
}


