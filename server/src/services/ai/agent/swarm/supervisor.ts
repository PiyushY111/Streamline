import { SwarmExecutionState, SwarmSubTask, SwarmProgressEvent } from './types.js';
import { inboxSentryAgent } from './agents/inbox-sentry.js';
import { calendarNegotiatorAgent } from './agents/calendar-negotiator.js';
import { dossierResearchAgent } from './agents/dossier-agent.js';
import { dagSchedulerAgent } from './agents/dag-scheduler.js';
import { swarmCriticNode } from './critic.js';
import { getAiProvider } from '../../core/factory.js';
import { sseService } from '../../../sse.service.js';
import { logger } from '../../../../utils/logger.js';
import { toError } from '../../../../utils/errors.js';

export class SwarmSupervisor {
  /**
   * Decompose user goal into sub-tasks and orchestrate the multi-agent swarm
   */
  public async orchestrate(
    userId: string,
    sessionId: string,
    userGoal: string,
    onProgress?: (event: SwarmProgressEvent) => void
  ): Promise<SwarmExecutionState> {
    const startTime = Date.now();
    logger.info({ userId, sessionId, userGoal }, 'Swarm Supervisor initiating meta-planning...');

    // 1. Task Decomposition (Determine which specialist agents are needed)
    const subTasks = this.decomposeGoal(userGoal);

    const state: SwarmExecutionState = {
      userId,
      sessionId,
      userGoal,
      subTasks,
      currentStepIndex: 0,
      intermediateResults: {},
      criticPassed: false,
      criticIterations: 0,
      pendingActions: [],
      executionLog: [`Supervisor decomposed goal into ${subTasks.length} sub-tasks`],
    };

    const emitEvent = (event: SwarmProgressEvent) => {
      onProgress?.(event);
      sseService.emitToUser(userId, 'swarm.progress', event as any);
    };

    // 2. Sequential / Coordinated Sub-Agent Execution
    for (let i = 0; i < state.subTasks.length; i++) {
      const task = state.subTasks[i];
      state.currentStepIndex = i;
      task.status = 'running';

      emitEvent({
        stepId: task.id,
        role: task.role,
        status: 'running',
        title: task.title,
        message: `Executing sub-task with ${task.role}...`,
      });

      const stepStartTime = Date.now();
      try {
        let output: any = null;
        switch (task.role) {
          case 'inbox_sentry':
            output = await inboxSentryAgent.execute(userId, task.instruction);
            break;
          case 'calendar_negotiator':
            output = await calendarNegotiatorAgent.execute(userId, task.instruction);
            break;
          case 'dossier_researcher':
            output = await dossierResearchAgent.execute(userId, task.instruction);
            break;
          case 'dag_scheduler':
            output = await dagSchedulerAgent.execute(userId, task.instruction);
            break;
          default:
            output = { status: 'acknowledged' };
        }

        task.status = 'completed';
        task.output = output;
        task.durationMs = Date.now() - stepStartTime;
        state.intermediateResults[task.id] = output;
        state.executionLog.push(`Completed [${task.role}]: ${task.title} in ${task.durationMs}ms`);

        emitEvent({
          stepId: task.id,
          role: task.role,
          status: 'completed',
          title: task.title,
          intermediateData: output,
        });
      } catch (rawErr: unknown) {
        const err = toError(rawErr);
        task.status = 'failed';
        task.error = err.message;
        state.executionLog.push(`Failed [${task.role}]: ${err.message}`);

        emitEvent({
          stepId: task.id,
          role: task.role,
          status: 'failed',
          title: task.title,
          message: err.message,
        });
      }
    }

    // 3. Self-Reflective Critic Node (Tree-of-Thought Verification)
    emitEvent({
      stepId: 'step-critic',
      role: 'critic',
      status: 'running',
      title: 'Tree-of-Thought Verification',
      message: 'Evaluating plan completeness and safety...',
    });

    const critique = await swarmCriticNode.reviewState(state);
    state.criticPassed = critique.passed;
    state.criticFeedback = critique.feedback;
    state.criticIterations = 1;
    state.executionLog.push(`Critic verdict: ${critique.passed ? 'PASSED' : 'REJECTED'} (${critique.feedback})`);

    emitEvent({
      stepId: 'step-critic',
      role: 'critic',
      status: 'completed',
      title: 'Tree-of-Thought Verification',
      message: critique.feedback,
      intermediateData: { passed: critique.passed, feedback: critique.feedback },
    });

    // 4. Synthesize Final Executive Response
    state.finalAnswer = await this.synthesizeFinalAnswer(state);

    const totalDurationMs = Date.now() - startTime;
    logger.info({ userId, totalDurationMs, tasksCount: state.subTasks.length }, 'Swarm execution completed successfully');

    return state;
  }

  /**
   * Intelligently decompose goal based on semantic intent
   */
  private decomposeGoal(userGoal: string): SwarmSubTask[] {
    const tasks: SwarmSubTask[] = [];
    const goalLower = userGoal.toLowerCase();

    // Check if email analysis is requested or implied
    if (/email|mail|inbox|alex|sarah|message|unread|sent|reply/i.test(goalLower)) {
      tasks.push({
        id: 'task-sentry-1',
        role: 'inbox_sentry',
        title: 'Inbox & Thread Sentry',
        instruction: `Analyze inbox for relevant messages and commitments matching "${userGoal}"`,
        status: 'pending',
      });
    }

    // Check if scheduling / calendar is requested or implied
    if (/calendar|schedule|meeting|slot|free time|reschedule|book|thursday|friday|tomorrow/i.test(goalLower)) {
      tasks.push({
        id: 'task-calendar-1',
        role: 'calendar_negotiator',
        title: 'Calendar & Slot Negotiator',
        instruction: `Find optimal meeting slots and resolve scheduling constraints for "${userGoal}"`,
        status: 'pending',
      });
    }

    // Check if research / past facts are requested or implied
    if (/who is|what did|dossier|history|context|project|budget/i.test(goalLower)) {
      tasks.push({
        id: 'task-dossier-1',
        role: 'dossier_researcher',
        title: 'GraphRAG Dossier Research',
        instruction: `Traverse knowledge graph relations for "${userGoal}"`,
        status: 'pending',
      });
    }

    // Check if task / todo tracking is requested or implied
    if (/task|todo|dag|follow up|remind|action item/i.test(goalLower) || tasks.length === 0) {
      tasks.push({
        id: 'task-dag-1',
        role: 'dag_scheduler',
        title: 'DAG Task Scheduler',
        instruction: `Update task dependency DAG and priority scores for "${userGoal}"`,
        status: 'pending',
      });
    }

    return tasks;
  }

  /**
   * Synthesize final executive answer from intermediate specialist findings
   */
  private async synthesizeFinalAnswer(state: SwarmExecutionState): Promise<string> {
    const provider = getAiProvider();
    if (!provider || !provider.isAvailable()) {
      return Object.values(state.intermediateResults)
        .map((res: any) => res.summary || JSON.stringify(res))
        .join('\n\n');
    }

    const prompt = `You are the Executive Swarm Supervisor. Synthesize the findings from your specialist agents into a clean, authoritative executive answer to the user's goal.

User Goal:
"${state.userGoal}"

Specialist Agent Findings:
${JSON.stringify(state.intermediateResults, null, 2)}

Critic Feedback:
"${state.criticFeedback || 'Verified and approved'}"

Instructions:
- Present the solution clearly with structured headings or bullet points if multi-part.
- Do not repeat internal agent jargon unless helpful for transparency.
- Be concise, direct, and helpful.`;

    try {
      const answer = await provider.generateText({
        prompt,
        models: ['gemini-2.0-flash', 'gemini-1.5-flash'],
        temperature: 0.2,
      });
      return answer.trim();
    } catch {
      return Object.values(state.intermediateResults)
        .map((res: any) => res.summary || JSON.stringify(res))
        .join('\n\n');
    }
  }
}

export const swarmSupervisor = new SwarmSupervisor();
