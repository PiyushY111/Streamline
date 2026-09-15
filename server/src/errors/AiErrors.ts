import { AppError } from './AppError.js';

/**
 * Thrown when all cascade candidate models in the multi-tier fallback hierarchy fail.
 * Provides clean 503 HTTP status and clear user-facing explanation instead of unhandled rejection.
 */
export class AllModelsExhaustedError extends AppError {
  public readonly attemptedModels: string[];
  public readonly originalError?: unknown;

  constructor(
    attemptedModels: string[],
    originalError?: unknown,
    message?: string
  ) {
    const defaultMsg = `AI copilot services are temporarily experiencing elevated upstream latency across all attempted model tiers (${attemptedModels.join(', ')}). Your request has been safely preserved.`;
    super(
      message || defaultMsg,
      503,
      'AI_MODELS_EXHAUSTED',
      {
        attemptedModels,
        lastErrorMessage: originalError instanceof Error ? originalError.message : String(originalError ?? ''),
      }
    );
    this.name = 'AllModelsExhaustedError';
    this.attemptedModels = attemptedModels;
    this.originalError = originalError;
  }
}

export class AgentLoopDetectedError extends AppError {
  public readonly iterationCount?: number;
  public readonly repeatedAction?: string;

  constructor(
    iterationOrTool: number | string,
    repeatedActionOrMessage?: string
  ) {
    let iterationCount: number | undefined;
    let repeatedAction: string | undefined;
    let message: string;

    if (typeof iterationOrTool === 'number') {
      iterationCount = iterationOrTool;
      repeatedAction = repeatedActionOrMessage;
      message = `Agent loop detected after ${iterationCount} iterations. Repeated action: "${repeatedAction || 'unknown'}".`;
    } else {
      repeatedAction = iterationOrTool;
      message =
        repeatedActionOrMessage ||
        `Agent execution halted: loop detected on tool "${iterationOrTool}" with identical parameters.`;
    }

    super(message, 422, 'AGENT_LOOP_DETECTED', { iterationCount, repeatedAction });
    this.name = 'AgentLoopDetectedError';
    this.iterationCount = iterationCount;
    this.repeatedAction = repeatedAction;
  }
}

export class StructuredOutputValidationError extends AppError {
  public readonly schemaName?: string;
  public readonly rawResponse?: string;

  constructor(
    schemaNameOrMessage = 'Model structured output failed schema validation after retries.',
    rawResponseOrDetails?: unknown,
    causeMessage?: string
  ) {
    const isSchemaCall = typeof schemaNameOrMessage === 'string' && typeof rawResponseOrDetails === 'string';
    const message = isSchemaCall
      ? `Model structured output failed validation against schema "${schemaNameOrMessage}": ${causeMessage || 'Invalid output format'}`
      : schemaNameOrMessage;

    super(message, 502, 'STRUCTURED_OUTPUT_VALIDATION_FAILED', {
      schemaName: isSchemaCall ? schemaNameOrMessage : undefined,
      rawResponse: isSchemaCall ? rawResponseOrDetails : undefined,
      causeMessage,
      details: !isSchemaCall ? rawResponseOrDetails : undefined,
    });
    this.name = 'StructuredOutputValidationError';
    if (isSchemaCall) {
      this.schemaName = schemaNameOrMessage;
      this.rawResponse = rawResponseOrDetails;
    }
  }
}
