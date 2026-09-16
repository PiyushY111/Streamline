import { EventEmitter } from 'events';
import crypto from 'crypto';

export const agentTraceEmitter = new EventEmitter();

export class AgentLoopDetectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentLoopDetectedError';
  }
}

/**
 * Generates an 8-character hexadecimal span ID for distributed tracing.
 */
export function generateSpanId(): string {
  return crypto.randomBytes(4).toString('hex');
}

/**
 * Computes a deterministic SHA-256 fingerprint for a tool call to detect execution loops.
 */
export function computeToolFingerprint(toolName: string, args: Record<string, unknown>): string {
  const sortedArgs: Record<string, unknown> = {};
  if (args && typeof args === 'object') {
    for (const key of Object.keys(args).sort()) {
      sortedArgs[key] = args[key];
    }
  }
  const normalized = JSON.stringify(sortedArgs);
  const hash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 12);
  return `${toolName}:${hash}`;
}

export interface AgentTurnResult {
  text: string;
  pendingActions: string[];
  sessionId: string;
  recalledMemories?: Array<{ id: string; type: string; content: string }>;
  spanId?: string;
  totalLatencyMs?: number;
}

export type AgentStreamEvent =
  | { type: 'turn_start'; turn: number; spanId?: string }
  | { type: 'memory_recalled'; memories: Array<{ id: string; type: string; content: string }>; latencyMs?: number }
  | { type: 'tool_proposing'; toolName: string; args: Record<string, unknown>; spanId?: string }
  | { type: 'tool_executed'; toolName: string; result: unknown; spanId?: string; latencyMs?: number }
  | {
      type: 'action_queued';
      toolName: string;
      pendingActionId: string;
      impactPreview: Record<string, unknown>;
      spanId?: string;
    }
  | { type: 'tool_rejected'; toolName: string; reason: string; spanId?: string }
  | { type: 'text_chunk'; chunk: string }
  | { type: 'turn_complete'; result: AgentTurnResult };

export interface AgentTurnOptions {
  onStreamEvent?: (event: AgentStreamEvent) => void;
  models?: string[];
  abortSignal?: AbortSignal;
}
