import { logger } from './logger.js';
import { toError } from './errors.js';

export interface RetryAndTimeoutOptions {
  timeoutMs?: number;
  maxRetries?: number;
  backoffBaseMs?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
  maxBackoffMs?: number;
  operationName?: string;
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Standard retryable error checker.
 * Returns true for rate limits (429), server errors (500, 502, 503, 504), network timeouts, and connection resets.
 */
export function isRetryableError(err: unknown): boolean {
  const error = toError(err);
  const msg = (error.message || '').toLowerCase();
  const rawObj = (typeof err === 'object' && err !== null) ? (err as Record<string, unknown>) : {};
  const status = (rawObj.status as number | undefined) ||
                 (rawObj.statusCode as number | undefined) ||
                 (error as unknown as { status?: number; statusCode?: number }).status ||
                 (error as unknown as { status?: number; statusCode?: number }).statusCode;
  const code = String(rawObj.code || (error as unknown as { code?: string }).code || '').toLowerCase();

  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }

  if (code === 'econnreset' || code === 'etimedout' || code === 'econnrefused' || code === 'enotfound') {
    return true;
  }

  return (
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('exhausted') ||
    msg.includes('quota') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('econnrefused') ||
    msg.includes('rate limit') ||
    msg.includes('timeout') ||
    msg.includes('service unavailable') ||
    msg.includes('503')
  );
}

/**
 * Executes an asynchronous external call with an explicit per-attempt timeout
 * and exponential backoff with randomized jitter.
 */
export async function withRetryAndTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: RetryAndTimeoutOptions = {}
): Promise<T> {
  const {
    timeoutMs = 15000,
    maxRetries = 2,
    backoffBaseMs = options.initialDelayMs || 1000,
    backoffFactor = 2,
    maxBackoffMs = 10000,
    operationName = 'external_operation',
    shouldRetry = isRetryableError,
  } = options;

  let attempt = 0;
  let lastError: Error = new Error(`Unknown failure during ${operationName}`);

  while (attempt <= maxRetries) {
    attempt++;
    const controller = new AbortController();
    let timer: NodeJS.Timeout | null = null;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error(`Operation "${operationName}" timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      const result = await Promise.race([
        operation(controller.signal),
        timeoutPromise,
      ]);

      if (timer) clearTimeout(timer);
      return result;
    } catch (err: unknown) {
      if (timer) clearTimeout(timer);
      const error = toError(err);
      lastError = error;

      if (attempt > maxRetries || !shouldRetry(err)) {
        break;
      }

      // Calculate exponential backoff with full jitter: delay = rand(0, min(maxBackoff, base * factor^(attempt - 1)))
      const exponentialDelay = Math.min(maxBackoffMs, backoffBaseMs * Math.pow(backoffFactor, attempt - 1));
      const jitterDelay = Math.floor(Math.random() * exponentialDelay);

      logger.warn(
        {
          operationName,
          attempt,
          maxRetries,
          delayMs: jitterDelay,
          err: error.message,
        },
        `Retrying external call after backoff`
      );

      await new Promise((resolve) => setTimeout(resolve, jitterDelay));
    }
  }

  throw lastError;
}
