/**
 * Error utility functions for type-safe error handling and standard formatting.
 */

export function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (typeof err === 'string') return new Error(err);
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const errorObj = err as { message: unknown; stack?: unknown };
    const error = new Error(String(errorObj.message));
    if (typeof errorObj.stack === 'string') {
      error.stack = errorObj.stack;
    }
    return error;
  }
  return new Error(String(err));
}

export function getErrorMessage(err: unknown): string {
  return toError(err).message;
}
