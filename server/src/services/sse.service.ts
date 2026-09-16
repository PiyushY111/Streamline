import { Response } from 'express';
import { logger } from '../utils/logger.js';

export interface SSEEventPayload {
  event: string;
  data: Record<string, unknown> | unknown[];
}

class SSEService {
  private userClients = new Map<string, Set<Response>>();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startHeartbeat();
  }

  /**
   * Register an authenticated client response stream for SSE
   */
  public addClient(userId: string, res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering for Nginx/Cloudflare
    });

    res.write(`: connected ${new Date().toISOString()}\n\n`);

    if (!this.userClients.has(userId)) {
      this.userClients.set(userId, new Set());
    }

    const clientSet = this.userClients.get(userId)!;
    clientSet.add(res);

    logger.info({ userId, activeClients: clientSet.size }, 'SSE client connected');

    res.on('close', () => {
      clientSet.delete(res);
      if (clientSet.size === 0) {
        this.userClients.delete(userId);
      }
      logger.info({ userId, remainingClients: clientSet.size }, 'SSE client disconnected');
    });
  }

  /**
   * Emit an event to all active SSE streams belonging to a specific user
   */
  public emitToUser(userId: string, event: string, data: Record<string, unknown> | unknown[]): void {
    const clients = this.userClients.get(userId);
    if (!clients || clients.size === 0) {
      logger.debug({ userId, event }, 'SSE: No active clients connected for user');
      return;
    }

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) {
      try {
        res.write(payload);
      } catch (err) {
        logger.warn({ userId, err }, 'Failed to write SSE payload to client connection');
      }
    }

    logger.info({ userId, event, clientCount: clients.size }, 'Dispatched SSE event to user');
  }

  /**
   * Broadcast an event to all connected clients across all users
   */
  public broadcast(event: string, data: Record<string, unknown> | unknown[]): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    let count = 0;

    for (const clients of this.userClients.values()) {
      for (const res of clients) {
        try {
          res.write(payload);
          count++;
        } catch {
          // ignore closed socket
        }
      }
    }

    logger.debug({ event, totalRecipients: count }, 'Broadcast SSE event');
  }

  /**
   * Heartbeat to prevent intermediate proxies, firewalls, or load balancers from dropping idle connections
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const ping = `: ping ${Date.now()}\n\n`;
      for (const clients of this.userClients.values()) {
        for (const res of clients) {
          try {
            res.write(ping);
          } catch {
            // connection dropped
          }
        }
      }
    }, 20000);

    if (this.heartbeatTimer.unref) {
      this.heartbeatTimer.unref();
    }
  }

  public getActiveUserCount(): number {
    return this.userClients.size;
  }
}

export const sseService = new SSEService();
