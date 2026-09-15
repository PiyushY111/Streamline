import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sseService } from '../services/sse.service.js';
import { googlePubSubService } from '../services/google/pubsub.service.js';
import { db } from '../db/index.js';

// Mock DB
vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
  },
}));

// Mock Google Token Manager
vi.mock('../services/google/token-manager.service.js', () => ({
  googleTokenManager: {
    getAuthorizedClient: vi.fn(),
  },
}));

// Mock Google Sync
vi.mock('../services/google/google-sync.service.js', () => ({
  syncGoogleAccountData: vi.fn().mockResolvedValue(undefined),
}));

// Mock Cache
vi.mock('../services/cache.service.js', () => ({
  delCache: vi.fn().mockResolvedValue(undefined),
}));

describe('Server-Sent Events (SSE) Service', () => {
  it('should register client connection and handle payload emission', () => {
    const mockRes: any = {
      writeHead: vi.fn(),
      write: vi.fn(),
      on: vi.fn(),
    };

    const userId = 'user-sse-test-1';
    sseService.addClient(userId, mockRes);

    expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'Content-Type': 'text/event-stream',
    }));
    expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining(': connected'));

    // Emit event
    sseService.emitToUser(userId, 'email.received', { test: true });

    expect(mockRes.write).toHaveBeenCalledWith(
      'event: email.received\ndata: {"test":true}\n\n'
    );
  });
});

describe('Google PubSub Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process Pub/Sub push notification and emit SSE event', async () => {
    const mockAccount = {
      id: 'acc-pubsub-123',
      userId: 'user-pubsub-456',
      email: 'test@example.com',
      status: 'active',
    };

    const mockSelectChain: any = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockAccount]),
    };
    (db.select as any).mockReturnValue(mockSelectChain);

    const emitSpy = vi.spyOn(sseService, 'emitToUser');

    const result = await googlePubSubService.handlePubSubPush({
      emailAddress: 'test@example.com',
      historyId: '99999',
    });

    expect(result.synced).toBe(true);
    expect(result.accountId).toBe('acc-pubsub-123');
    expect(emitSpy).toHaveBeenCalledWith('user-pubsub-456', 'email.received', expect.objectContaining({
      accountId: 'acc-pubsub-123',
      emailAddress: 'test@example.com',
      historyId: '99999',
    }));
  });

  it('should safely ignore push notification if account is not found', async () => {
    const mockSelectChain: any = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    (db.select as any).mockReturnValue(mockSelectChain);

    const result = await googlePubSubService.handlePubSubPush({
      emailAddress: 'nonexistent@example.com',
      historyId: '10001',
    });

    expect(result.synced).toBe(false);
  });
});
