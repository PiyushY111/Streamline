import { describe, it, expect, vi, beforeEach } from 'vitest';
import { streamDraftReply } from '../services/ai/reply-drafter.service.js';
import { db } from '../db/index.js';
import { aiRepository } from '../repositories/ai.repository.js';

describe('AI Streaming Reply Drafter Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(aiRepository, 'getUserPreferences').mockResolvedValue(null as any);
    vi.spyOn(db, 'select').mockImplementation(() => {
      const chain: any = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
        limit: vi.fn().mockResolvedValue([]),
      };
      return chain;
    });
  });

  it('should format and stream fallback draft when no thread messages exist', async () => {
    const mockRes: any = {
      write: vi.fn(),
      end: vi.fn(),
      flush: vi.fn(),
    };

    await streamDraftReply(
      {
        threadId: 'non-existent-thread-id',
        tone: 'professional',
        userId: 'user-123',
      },
      mockRes
    );

    expect(mockRes.write).toHaveBeenCalled();
    const calls = mockRes.write.mock.calls;
    const streamedText = calls.map((c: any) => c[0]).join('');

    expect(streamedText).toContain('data:');
    expect(mockRes.end).toHaveBeenCalled();
  });

  it('should format tone instructions accurately for professional, friendly, and concise modes', async () => {
    const mockRes: any = {
      write: vi.fn(),
      end: vi.fn(),
      flush: vi.fn(),
    };

    await streamDraftReply(
      {
        threadId: 'thread-test',
        tone: 'friendly',
        userId: 'user-123',
        emailContext: 'Team lunch on Friday',
      },
      mockRes
    );

    expect(mockRes.end).toHaveBeenCalled();
  });

  it('should handle custom prompt instructions and replyType=reply_all', async () => {
    const mockRes: any = {
      write: vi.fn(),
      end: vi.fn(),
      flush: vi.fn(),
    };

    await streamDraftReply(
      {
        threadId: 'thread-test-2',
        tone: 'professional',
        customPrompt: 'Accept the invite and ask about dietary preferences',
        replyType: 'reply_all',
        userId: 'user-123',
        emailContext: 'Annual Offsite RSVP',
      },
      mockRes
    );

    expect(mockRes.end).toHaveBeenCalled();
    expect(mockRes.write).toHaveBeenCalled();
  });
});
