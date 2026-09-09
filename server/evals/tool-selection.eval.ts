import { runSuite } from './runner.js';
import { TOOL_REGISTRY } from '../src/agent/tools/index.js';
import { enforcePolicy, ProposedToolCall, PolicyOutcome } from '../src/agent/policy.js';
import { db } from '../src/db/index.js';
import { auditService } from '../src/services/audit.service.js';
import { TasksRepository } from '../src/repositories/tasks.repository.js';
import { EventsRepository } from '../src/repositories/events.repository.js';

interface ToolSelectionScenarioInput {
  userMessage: string;
  proposedTool: {
    name: string;
    args: Record<string, unknown>;
  };
}

interface ToolSelectionScenarioExpected {
  tool: string;
  permissionClass: 'read' | 'write' | 'send' | null;
  policyOutcome: 'executed' | 'pending' | 'rejected';
}

export async function runToolSelectionEval() {
  const userId = 'eval-user-uuid-1';
  const sessionId = 'eval-session-uuid-1';

  // Setup mock database and repository layers for deterministic zero-cost evaluation
  if (!db.insert.bind) {
    // Already mocked or native
  }

  // Intercept db inserts for pending_actions
  const originalInsert = db.insert;
  db.insert = ((table: any) => ({
    values: (val: any) => ({
      returning: async () => [{
        id: 'eval-pending-uuid-999',
        userId,
        toolName: val.toolName,
        status: 'pending',
        impactPreview: val.impactPreview,
        expiresAt: val.expiresAt,
      }],
    }),
  })) as any;

  // Intercept auditService
  auditService.logAction = async () => {};

  // Mock repositories for read queries
  TasksRepository.prototype.listUserTasks = async () => [];
  EventsRepository.prototype.findSmartFreeSlots = async () => [];

  try {
    return await runSuite<ToolSelectionScenarioInput, ToolSelectionScenarioExpected>(
      'agent-tool-selection-and-policy-engine',
      'tool-selection.json',
      async (input) => {
        const toolDef = TOOL_REGISTRY[input.proposedTool.name];
        const permissionClass = toolDef?.permissionClass || null;

        const outcome = await enforcePolicy(userId, sessionId, {
          name: input.proposedTool.name,
          args: input.proposedTool.args,
        });

        return {
          toolName: input.proposedTool.name,
          permissionClass,
          policyOutcome: outcome.kind,
          outcome,
        };
      },
      (actual: any, expected) => {
        // 1. Tool name matches expected
        if (actual.toolName !== expected.tool) {
          return false;
        }

        // 2. Permission class matches expected
        if (actual.permissionClass !== expected.permissionClass) {
          return false;
        }

        // 3. Policy outcome matches expected (executed, pending, rejected)
        if (actual.policyOutcome !== expected.policyOutcome) {
          return false;
        }

        // 4. Invariant: Write & Send tools MUST produce impact preview and pending action id
        if (expected.policyOutcome === 'pending') {
          if (!actual.outcome.pendingActionId || !actual.outcome.impactPreview) {
            return false;
          }
        }

        return true;
      }
    );
  } finally {
    // Restore db.insert
    db.insert = originalInsert;
  }
}
