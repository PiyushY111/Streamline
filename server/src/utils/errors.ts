import { AppError } from '../errors/index.js';

/**
 * Standardizes any caught unknown value into a real JavaScript Error instance.
 * Guarantees message and stack availability for structured logging and predictable error responses.
 */
export function toError(err: unknown): Error {
  if (err instanceof Error) {
    return err;
  }
  if (typeof err === 'string') {
    return new Error(err);
  }
  if (typeof err === 'object' && err !== null) {
    const candidate = err as Record<string, unknown>;
    if (typeof candidate.message === 'string') {
      const e = new Error(candidate.message);
      if (typeof candidate.stack === 'string') {
        e.stack = candidate.stack;
      }
      return e;
    }
    try {
      return new Error(JSON.stringify(err));
    } catch {
      return new Error(String(err));
    }
  }
  return new Error(String(err));
}

/**
 * Type guard to check if an unknown error is an application domain AppError.
 */
export function isAppError(err: unknown): err is AppError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    'code' in err &&
    typeof (err as AppError).statusCode === 'number'
  );
}

/**
 * Thrown when all model candidates in the cascade fallback have been exhausted.
 */
export class AllModelsExhaustedError extends AppError {
  public readonly attemptedModels: string[];
  /** Why the last (and typically most informative) attempt failed — see failure-classifier.ts. */
  public readonly lastReason: string;
  /** Per-model failure reason, in attempt order — lets callers see if the cascade failed for one consistent reason (e.g. the whole account is rate-limited) vs. mixed reasons. */
  public readonly attemptReasons: Array<{ model: string; reason: string }>;

  constructor(
    attemptedModels: string[],
    lastErrorMessage?: string,
    lastReason: string = 'unknown',
    attemptReasons: Array<{ model: string; reason: string }> = [],
  ) {
    super(
      `All AI model candidates failed: [${attemptedModels.join(', ')}]. ${lastErrorMessage || 'Service temporarily degraded.'}`,
      503,
      'ALL_AI_MODELS_EXHAUSTED',
    );
    this.name = 'AllModelsExhaustedError';
    this.attemptedModels = attemptedModels;
    this.lastReason = lastReason;
    this.attemptReasons = attemptReasons;
  }
}

/**
 * Thrown when external API dependencies (Google OAuth, Gmail API, etc.) fail or timeout.
 */
export class ExternalApiError extends AppError {
  public readonly service: string;
  public readonly originalStatus?: number;

  constructor(service: string, message: string, originalStatus?: number) {
    super(`External API failure (${service}): ${message}`, 502, 'EXTERNAL_API_ERROR');
    this.name = 'ExternalApiError';
    this.service = service;
    this.originalStatus = originalStatus;
  }
}
