import { describe, it, expect, vi } from 'vitest';
import { withRetryAndTimeout, isRetryableError } from '../utils/resilience.js';
import {
  AllModelsExhaustedError,
  AgentLoopDetectedError,
  StructuredOutputValidationError,
  AppError,
} from '../errors/index.js';

describe('Task 1.2: Resilience & AI Domain Errors', () => {
  describe('AI Domain Errors', () => {
    it('AllModelsExhaustedError captures attempted models and causes', () => {
      const err = new AllModelsExhaustedError(['gemini-2.0-flash', 'gemini-1.5-flash'], {
        'gemini-2.0-flash': 'RESOURCE_EXHAUSTED',
      });
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(503);
      expect(err.isOperational).toBe(true);
      expect(err.attemptedModels).toEqual(['gemini-2.0-flash', 'gemini-1.5-flash']);
      expect(err.message).toContain('gemini-2.0-flash');
    });

    it('AgentLoopDetectedError captures iteration count and repeated action', () => {
      const err = new AgentLoopDetectedError(10, 'search_emails:{"query":"urgent"}');
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(422);
      expect(err.iterationCount).toBe(10);
      expect(err.repeatedAction).toBe('search_emails:{"query":"urgent"}');
    });

    it('StructuredOutputValidationError captures schema name and raw response', () => {
      const err = new StructuredOutputValidationError('TriageSchema', '{"invalid": json}', 'Unexpected token');
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(502);
      expect(err.schemaName).toBe('TriageSchema');
      expect(err.rawResponse).toBe('{"invalid": json}');
    });
  });

  describe('withRetryAndTimeout', () => {
    it('succeeds on first attempt without retrying', async () => {
      const fn = vi.fn().mockResolvedValue('ok');
      const res = await withRetryAndTimeout(fn, { maxRetries: 3, initialDelayMs: 10 });
      expect(res).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on retryable errors and succeeds', async () => {
      let attempts = 0;
      const fn = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          const err: any = new Error('rate limit exceeded');
          err.status = 429;
          throw err;
        }
        return 'success after retry';
      });

      const res = await withRetryAndTimeout(fn, {
        maxRetries: 3,
        initialDelayMs: 5,
        backoffFactor: 1.5,
      });

      expect(res).toBe('success after retry');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('fails immediately on non-retryable errors without wasting retries', async () => {
      const fn = vi.fn().mockImplementation(async () => {
        const err: any = new Error('Invalid authentication token');
        err.status = 401;
        throw err;
      });

      await expect(
        withRetryAndTimeout(fn, { maxRetries: 3, initialDelayMs: 5 })
      ).rejects.toThrow('Invalid authentication token');

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('times out when operation exceeds timeoutMs', async () => {
      const slowFn = vi.fn().mockImplementation(() => new Promise((r) => setTimeout(r, 200)));

      await expect(
        withRetryAndTimeout(slowFn, { timeoutMs: 30, maxRetries: 1, initialDelayMs: 5 })
      ).rejects.toThrow(/timed out after 30ms/);
    });

    it('correctly classifies retryable vs non-retryable errors', () => {
      expect(isRetryableError({ status: 429 })).toBe(true);
      expect(isRetryableError({ status: 503 })).toBe(true);
      expect(isRetryableError({ code: 'ECONNRESET' })).toBe(true);
      expect(isRetryableError({ message: 'Resource has been exhausted (e.g. check quota).' })).toBe(true);
      expect(isRetryableError({ status: 400 })).toBe(false);
      expect(isRetryableError({ status: 404 })).toBe(false);
    });
  });
});
