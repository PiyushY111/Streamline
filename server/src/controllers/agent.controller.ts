import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { agentOrchestratorService } from '../services/ai/agent-orchestrator.service.js';
import { executeApprovedAction, rejectAction as rejectPolicyAction } from '../agent/policy.js';
import { db } from '../db/index.js';
import { agentSessions } from '../db/schema/index.js';
import { logger } from '../utils/logger.js';

export async function chat(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let { sessionId, message } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    if (!sessionId) {
      const [newSession] = await db
        .insert(agentSessions)
        .values({ userId: req.user.id })
        .returning();
      sessionId = newSession.id;
    }

    const result = await agentOrchestratorService.runAgentTurn(
      req.user.id,
      sessionId,
      message.trim()
    );

    res.json(result);
  } catch (err: any) {
    logger.error({ err: err.message }, 'Agent chat error');
    res.status(500).json({ error: err.message || 'Agent request failed' });
  }
}

export async function chatStream(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let { sessionId, message } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    if (!sessionId) {
      const [newSession] = await db
        .insert(agentSessions)
        .values({ userId: req.user.id })
        .returning();
      sessionId = newSession.id;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });

    res.write(`event: session\ndata: ${JSON.stringify({ sessionId })}\n\n`);

    await agentOrchestratorService.runAgentTurn(req.user.id, sessionId, message.trim(), {
      onStreamEvent: (event) => {
        res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      },
    });

    res.write('event: done\ndata: {}\n\n');
    res.end();
  } catch (err: any) {
    logger.error({ err: err.message }, 'Agent chat stream error');
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Stream failed' });
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
}

export async function listPendingActions(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const actions = await agentOrchestratorService.listPendingActions(req.user.id);
    res.json({ actions });
  } catch (err: any) {
    logger.error({ err: err.message }, 'List pending actions error');
    res.status(500).json({ error: 'Failed to fetch pending actions' });
  }
}

export async function approveAction(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { idempotencyKey } = req.body || {};

    const result = await executeApprovedAction(req.user.id, id, { idempotencyKey });
    res.json({ success: true, result });
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Approve action failed');
    res.status(400).json({ error: err.message });
  }
}

export async function rejectAction(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await rejectPolicyAction(req.user.id, id);
    res.json({ success: true, action: result });
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Reject action failed');
    res.status(400).json({ error: err.message });
  }
}

export async function listSessions(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const sessions = await agentOrchestratorService.listUserSessions(req.user.id);
    res.json({ sessions });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch agent sessions' });
  }
}

export async function getSessionMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const messages = await agentOrchestratorService.getSessionMessages(req.user.id, id);
    if (!messages) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({ messages });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch session messages' });
  }
}
