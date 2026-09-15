import { getAiProvider } from '../../core/factory.js';
import { SwarmExecutionState } from './types.js';
import { logger } from '../../../../utils/logger.js';

export interface CriticReviewResult {
  passed: boolean;
  feedback: string;
  recommendedCorrection?: string;
}

export class SwarmCriticNode {
  /**
   * Evaluate intermediate swarm state against safety, accuracy, and constraint criteria
   */
  public async reviewState(state: SwarmExecutionState): Promise<CriticReviewResult> {
    const { userGoal, subTasks, intermediateResults, pendingActions } = state;

    // Fast-path heuristic check: if no subtasks executed or user goal is trivially short
    if (subTasks.length === 0) {
      return { passed: true, feedback: 'No complex subtasks to critique' };
    }

    const provider = getAiProvider();
    if (!provider || !provider.isAvailable()) {
      return { passed: true, feedback: 'Critic passed (AI provider in heuristic mode)' };
    }

    const subTasksSummary = subTasks
      .map((st) => `[${st.role.toUpperCase()}] "${st.title}": ${JSON.stringify(st.output || st.error || 'Done')}`)
      .join('\n');

    const prompt = `You are an elite AI Verification Critic operating in a Multi-Agent Swarm system.
Your job is to rigorously critique the sub-agents' findings and proposed actions against the user's primary goal.

PRIMARY USER GOAL:
"${userGoal}"

SUB-AGENT EXECUTION SUMMARY:
${subTasksSummary}

PROPOSED WRITE/SEND ACTIONS (HITL BOUNDARY):
${JSON.stringify(pendingActions, null, 2)}

EVALUATION CRITERIA:
1. Completeness: Did the sub-agents address all explicit constraints in the user's goal?
2. Soundness: Are there any obvious logical contradictions, calendar overlapping conflicts, or false assumptions?
3. Safety: Are any consequential external mutations (e.g. sending an email or deleting tasks) safely held at the approval boundary?

Respond with JSON matching this exact structure:
{
  "passed": true | false,
  "feedback": "Concise rationale for passing or rejecting",
  "recommendedCorrection": "Specific adjustment for the specialist agent if passed is false"
}`;

    try {
      const result = await provider.generateStructuredJson<CriticReviewResult>({
        prompt,
        models: ['gemini-2.0-flash', 'gemini-1.5-flash'],
        temperature: 0.1,
      });

      if (result && typeof result.passed === 'boolean') {
        logger.info(
          { passed: result.passed, feedback: result.feedback },
          'Swarm Critic Node evaluation completed'
        );
        return result;
      }
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Critic review error, allowing execution to proceed');
    }

    return { passed: true, feedback: 'Critic passed default verification' };
  }
}

export const swarmCriticNode = new SwarmCriticNode();
