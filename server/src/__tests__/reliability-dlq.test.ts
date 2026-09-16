import { describe, it, expect, vi, beforeEach } from 'vitest';
import { routeToDeadLetterQueue, deadLetterQueue } from '../queues/dlq.queue.js';
import { withRetryAndTimeout } from '../utils/resilience.js';
import { AllModelsExhaustedError } from '../utils/errors.js';
import { generateContentWithFallback } from '../services/ai/core/gemini.client.js';

describe('Reliability & Dead-Letter Queue (DLQ) Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('routeToDeadLetterQueue', () => {
    it('does NOT push to DLQ if job has not exhausted max attempts', async () => {
      const addSpy = vi.spyOn(deadLetterQueue, 'add').mockResolvedValue({} as any);

      const mockJob: any = {
        id: 'job-123',
        name: 'sync-account',
        data: { accountId: 'acc-1' },
        attemptsMade: 1,
        opts: { attempts: 3 },
      };

      await routeToDeadLetterQueue('account-sync-queue', mockJob, new Error('Transient 503'));
      expect(addSpy).not.toHaveBeenCalled();
    });

    it('pushes failed job payload and stacktrace to DLQ when retries are exhausted', async () => {
      const addSpy = vi.spyOn(deadLetterQueue, 'add').mockResolvedValue({} as any);

      const mockJob: any = {
        id: 'job-exhausted-999',
        name: 'triage-email-batch',
        data: { emailIds: ['e-1', 'e-2'] },
        attemptsMade: 3,
        opts: { attempts: 3 },
        stacktrace: ['Error: Permanent failure at ...'],
      };

      const terminalError = new Error('Permanent API quota exceeded');
      await routeToDeadLetterQueue('ai-email-triage-queue', mockJob, terminalError);

      expect(addSpy).toHaveBeenCalledWith(
        'ai-email-triage-queue-dead-letter',
        expect.objectContaining({
          originalQueue: 'ai-email-triage-queue',
          jobId: 'job-exhausted-999',
          jobName: 'triage-email-batch',
          failedReason: 'Permanent API quota exceeded',
          attemptsMade: 3,
          data: { emailIds: ['e-1', 'e-2'] },
        }),
      );
    });
  });

  describe('withRetryAndTimeout', () => {
    it('retries transient failures up to maxRetries and succeeds on subsequent attempt', async () => {
      let callCount = 0;
      const result = await withRetryAndTimeout(
        async () => {
          callCount++;
          if (callCount === 1) {
            throw new Error('Socket timeout');
          }
          return 'success-value';
        },
        {
          timeoutMs: 2000,
          maxRetries: 2,
          backoffBaseMs: 10,
          operationName: 'test-retry',
        },
      );

      expect(callCount).toBe(2);
      expect(result).toBe('success-value');
    });

    it('fails fast without retry when error is non-retryable (e.g. 400 Bad Request)', async () => {
      let callCount = 0;
      const nonRetryableErr = Object.assign(new Error('Bad Request Parameter'), { status: 400 });

      await expect(
        withRetryAndTimeout(
          async () => {
            callCount++;
            throw nonRetryableErr;
          },
          {
            timeoutMs: 2000,
            maxRetries: 3,
            backoffBaseMs: 10,
            operationName: 'test-non-retryable',
          },
        ),
      ).rejects.toThrow('Bad Request Parameter');

      expect(callCount).toBe(1);
    });
  });

  describe('generateContentWithFallback Cascade Degradation', () => {
    it('throws AllModelsExhaustedError with status 503 when all cascade tiers fail', async () => {
      const mockAi: any = {
        models: {
          generateContent: vi.fn().mockRejectedValue(new Error('Model overloaded')),
        },
      };

      const models = ['gemini-3.5-flash-lite', 'gemini-3.6-flash'];

      try {
        await generateContentWithFallback(mockAi, models, { contents: [] });
        expect.unreachable('Should have thrown AllModelsExhaustedError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AllModelsExhaustedError);
        const appErr = err as AllModelsExhaustedError;
        expect(appErr.statusCode).toBe(503);
        expect(appErr.attemptedModels).toEqual(models);
        expect(appErr.message).toContain('All AI model candidates failed');
      }
    });
  });
});
