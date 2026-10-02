import { MonoTypeOperatorFunction, retry, throwError, timer } from "rxjs";

export interface RetryWithDelayConfig {
  /** Maximum number of retries after the first failure. */
  count: number;
  /** Wait before the first retry; doubles on each further retry. */
  delayMs: number;
  /** Return `false` for errors that should fail immediately. Defaults to retrying all. */
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * Re-subscribes to the source after a failure, waiting `delayMs`, then twice
 * as long before each further attempt. Errors rejected by `shouldRetry` are
 * rethrown without retrying.
 */
export function retryWithDelay<T>({
  count,
  delayMs,
  shouldRetry = () => true,
}: RetryWithDelayConfig): MonoTypeOperatorFunction<T> {
  return retry({
    count,
    delay: (error: unknown, retryCount: number) =>
      shouldRetry(error)
        ? timer(delayMs * 2 ** (retryCount - 1))
        : throwError(() => error),
  });
}
