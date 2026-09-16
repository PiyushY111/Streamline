import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  spanId?: string;
  source?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

/**
 * Executes a function within the specified RequestContext.
 */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return requestContext.run(context, fn);
}

/**
 * Returns the currently active RequestContext, or undefined if outside a context.
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}

/**
 * Returns the current correlated request ID, falling back to 'system-background'.
 */
export function getRequestId(): string {
  return requestContext.getStore()?.requestId || 'system-background';
}

/**
 * Returns the current correlated user ID, or undefined.
 */
export function getCurrentUserId(): string | undefined {
  return requestContext.getStore()?.userId;
}

/**
 * Returns the current correlated session ID, or undefined.
 */
export function getCurrentSessionId(): string | undefined {
  return requestContext.getStore()?.sessionId;
}
