/**
 * Classifies WHY an AI provider call failed, for structured logging and trace spans.
 *
 * Before this, every cascade fallback attempt (gemini.client.ts) and every cost-guard
 * short-circuit (cost-guard.service.ts / orchestrator.service.ts) logged only that something
 * failed — "Gemini model invocation failed or timed out" covered rate limits, timeouts, auth
 * errors, and 5xx failures identically, and cost-guard trips weren't logged at all. This makes
 * the distinction explicit and consistent across both call sites.
 */
export type AiFailureReason =
  | 'rate_limit'
  | 'timeout'
  | 'server_error'
  | 'client_error'
  | 'cost_guard_daily_limit'
  | 'cost_guard_single_turn_limit'
  | 'unknown';

function extractHttpStatus(err: unknown): number | undefined {
  const candidate = err as { status?: unknown; statusCode?: unknown; code?: unknown } | null;
  const direct = candidate?.status ?? candidate?.statusCode ?? candidate?.code;
  if (typeof direct === 'number') return direct;

  // The @google/genai SDK sometimes surfaces the real status only inside a JSON-stringified
  // message, e.g. `{"error":{"code":403,"status":"PERMISSION_DENIED","message":"..."}}`.
  const message = (err as { message?: unknown })?.message;
  if (typeof message === 'string') {
    try {
      const parsed = JSON.parse(message);
      const nestedCode = parsed?.error?.code;
      if (typeof nestedCode === 'number') return nestedCode;
    } catch {
      // Not JSON — fall through to text-based classification.
    }
  }
  return undefined;
}

export function classifyAiFailureReason(err: unknown): AiFailureReason {
  const message = (err instanceof Error ? err.message : String(err)).toLowerCase();
  const status = extractHttpStatus(err);

  if (status === 429 || message.includes('rate limit') || message.includes('resource_exhausted') || message.includes('quota')) {
    return 'rate_limit';
  }

  if (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('deadline exceeded') ||
    message.includes('etimedout')
  ) {
    return 'timeout';
  }

  if (status !== undefined && status >= 500) {
    return 'server_error';
  }

  if (status !== undefined && status >= 400) {
    return 'client_error';
  }

  if (
    message.includes('permission_denied') ||
    message.includes('unauthorized') ||
    message.includes('invalid_argument') ||
    message.includes('invalid_grant') ||
    message.includes('unauthenticated')
  ) {
    return 'client_error';
  }

  return 'unknown';
}
