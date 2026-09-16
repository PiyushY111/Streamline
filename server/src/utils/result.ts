/**
 * Functional Result / Either Monad for Type-Safe Error Handling.
 * Eliminates untyped thrown runtime exceptions across service boundaries.
 */

export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T; readonly error?: never }
  | { readonly ok: false; readonly error: E; readonly value?: never };

/**
 * Construct a successful Result containing a value.
 */
export function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/**
 * Construct a failed Result containing an error.
 */
export function Err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Check if a Result is successful (type guard).
 */
export function isOk<T, E>(result: Result<T, E>): result is { readonly ok: true; readonly value: T } {
  return result.ok === true;
}

/**
 * Check if a Result is a failure (type guard).
 */
export function isErr<T, E>(result: Result<T, E>): result is { readonly ok: false; readonly error: E } {
  return result.ok === false;
}

/**
 * Extract the value from a Result or throw the error if failed.
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw result.error;
}

/**
 * Extract the value from a Result or return a default fallback.
 */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  if (result.ok) {
    return result.value;
  }
  return fallback;
}

/**
 * Transform the value inside a successful Result.
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  if (result.ok) {
    return Ok(fn(result.value));
  }
  return result;
}

/**
 * Transform the error inside a failed Result.
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  if (!result.ok) {
    return Err(fn(result.error));
  }
  return result;
}

/**
 * Wrap a synchronous function execution in a Result.
 */
export function tryCatch<T, E = Error>(fn: () => T, onError?: (err: unknown) => E): Result<T, E> {
  try {
    return Ok(fn());
  } catch (rawErr: unknown) {
    const err = onError ? onError(rawErr) : (rawErr as E);
    return Err(err);
  }
}

/**
 * Wrap an asynchronous Promise execution in a Result.
 */
export async function fromPromise<T, E = Error>(
  promise: Promise<T>,
  onError?: (err: unknown) => E,
): Promise<Result<T, E>> {
  try {
    const value = await promise;
    return Ok(value);
  } catch (rawErr: unknown) {
    const err = onError ? onError(rawErr) : (rawErr as E);
    return Err(err);
  }
}
