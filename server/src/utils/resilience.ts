import { logger } from './logger.js';
import { toError } from './errors.js';

export interface RetryOptions {
  timeoutMs?: number;
  maxRetries?: number;
  backoffBaseMs?: number;
  maxBackoffMs?: number;
  operationName?: string;
  shouldRetry?: (err: unknown) => boolean;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  timeoutMs: 15000,
  maxRetries: 2,
  backoffBaseMs: 500,
  maxBackoffMs: 5000,
  operationName: 'external_operation',
  shouldRetry: (err: unknown) => {
    const error = toError(err);
    const msg = error.message.toLowerCase();

    // Check for HTTP status codes commonly retryable
    const status = (err as { status?: number; statusCode?: number })?.status ||
                   (err as { status?: number; statusCode?: number })?.statusCode;
    if (status && (status === 429 || status >= 500)) {
      return true;
    }

    // Network / timeout strings
    if (
      msg.includes('timeout') ||
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('socket hang up') ||
      msg.includes('aborted') ||
      msg.includes('resource exhausted') ||
      msg.includes('rate limit') ||
      msg.includes('temporarily unavailable')
    ) {
      return true;
    }

    // Do not retry 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found
    if (status && status >= 400 && status < 500) {
      return false;
    }

    return true;
  },
};

/**
 * Executes an async operation with per-attempt timeout and exponential backoff with jitter.
 */
export async function withRetryAndTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= config.maxRetries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new Error(`Operation "${config.operationName}" timed out after ${config.timeoutMs}ms`));
    }, config.timeoutMs);

    try {
      const result = await operation(controller.signal);
      clearTimeout(timeoutId);
      return result;
    } catch (rawErr: unknown) {
      clearTimeout(timeoutId);
      const err = toError(rawErr);
      lastError = err;
      attempt++;

      const isRetryable = config.shouldRetry(rawErr);
      if (attempt > config.maxRetries || !isRetryable) {
        logger.warn(
          {
            operationName: config.operationName,
            attempt,
            maxRetries: config.maxRetries,
            isRetryable,
            err: err.message,
          },
          `External operation failed permanently`
        );
        throw err;
      }

      // Exponential backoff with full jitter
      const exponentialDelay = config.backoffBaseMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * (config.backoffBaseMs / 2);
      const delay = Math.min(exponentialDelay + jitter, config.maxBackoffMs);

      logger.warn(
        {
          operationName: config.operationName,
          attempt,
          nextRetryInMs: Math.round(delay),
          err: err.message,
        },
        `External operation failed, retrying with backoff`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error(`Exhausted retries for ${config.operationName}`);
}
