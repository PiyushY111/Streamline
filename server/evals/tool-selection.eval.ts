import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSuite } from './runner.js';
import { TOOL_REGISTRY } from '../src/services/ai/agent/tools/index.js';
import { enforcePolicy, ProposedToolCall, PolicyOutcome } from '../src/services/ai/agent/policy.js';
import { db } from '../src/db/index.js';
import { auditService } from '../src/services/audit.service.js';
import { TasksRepository } from '../src/repositories/tasks.repository.js';
import { EventsRepository } from '../src/repositories/events.repository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  const userId = '00000000-0000-0000-0000-000000000001';
  const sessionId = '00000000-0000-0000-0000-000000000002';

  // Setup mock database and repository layers for deterministic zero-cost evaluation
  if (!db.insert.bind) {
    // Already mocked or native
  }

  // Intercept db inserts for pending_actions
  const originalInsert = db.insert;
  db.insert = ((table: any) => ({
    values: (val: any) => ({
      returning: async () => [
        {
          id: 'eval-pending-uuid-999',
          userId,
          toolName: val.toolName,
          status: 'pending',
          impactPreview: val.impactPreview,
          expiresAt: val.expiresAt,
        },
      ],
    }),
  })) as any;

  // Intercept auditService
  auditService.logAction = async () => {};

  // Mock repositories for read queries
  TasksRepository.prototype.listUserTasks = async () => [];
  EventsRepository.prototype.findSmartFreeSlots = async () => [];

  try {
    const report = await runSuite<ToolSelectionScenarioInput, ToolSelectionScenarioExpected>(
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
      },
    );

    // Regression Snapshot Verification
    const baselinePath = path.join(__dirname, 'results', 'baseline-tool-selection.json');
    if (!fs.existsSync(baselinePath)) {
      console.log('  📸 Creating baseline tool selection snapshot...');
      fs.writeFileSync(baselinePath, JSON.stringify(report, null, 2));
    } else {
      try {
        const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
        const baselinePassedMap = new Map(baseline.results.map((r: any) => [r.scenarioId, r.passed]));
        const regressions = report.results.filter((r) => !r.passed && baselinePassedMap.get(r.scenarioId) === true);

        if (regressions.length > 0) {
          console.error(`  ⚠️ Regression detected in ${regressions.length} scenarios compared to baseline!`);
          regressions.forEach((reg) => console.error(`    - Regressed scenario: ${reg.scenarioId}`));
        } else {
          console.log('  ✅ Zero regressions detected against baseline snapshot.');
        }
      } catch (err: any) {
        console.warn('  ⚠️ Failed to parse baseline snapshot for comparison:', err.message);
      }
    }

    const passRate = report.total > 0 ? (report.passed / report.total) * 100 : 0;
    if (passRate < 95) {
      console.error(`  ❌ Tool selection pass rate ${passRate.toFixed(1)}% is below 95% threshold.`);
    }

    return report;
  } finally {
    // Restore db.insert
    db.insert = originalInsert;
  }
}
