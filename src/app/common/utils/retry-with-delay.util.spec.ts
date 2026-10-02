import { Observable, defer, of, throwError } from "rxjs";
import { retryWithDelay } from "./retry-with-delay.util";

/** A source that fails `failures` times, then emits "ok". */
function flakySource(failures: number): {
  source$: Observable<string>;
  attempts: () => number;
} {
  let attempts = 0;
  const source$ = defer(() => {
    attempts++;
    return attempts <= failures
      ? throwError(() => new Error(`attempt ${attempts} failed`))
      : of("ok");
  });
  return { source$, attempts: () => attempts };
}

describe("retryWithDelay", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("retries after a doubling delay and emits once the source succeeds", () => {
    const { source$, attempts } = flakySource(2);
    let value: string | undefined;
    source$
      .pipe(retryWithDelay({ count: 2, delayMs: 1000 }))
      .subscribe((v) => (value = v));

    expect(attempts()).toBe(1);
    vi.advanceTimersByTime(999);
    expect(attempts()).toBe(1);
    vi.advanceTimersByTime(1);
    expect(attempts()).toBe(2);

    vi.advanceTimersByTime(1999);
    expect(attempts()).toBe(2);
    vi.advanceTimersByTime(1);
    expect(attempts()).toBe(3);
    expect(value).toBe("ok");
  });

  it("errors with the last failure after exhausting all retries", () => {
    const { source$, attempts } = flakySource(Infinity);
    let error: Error | undefined;
    source$
      .pipe(retryWithDelay({ count: 2, delayMs: 1000 }))
      .subscribe({ error: (e: Error) => (error = e) });

    vi.advanceTimersByTime(1000 + 2000);

    expect(attempts()).toBe(3);
    expect(error?.message).toBe("attempt 3 failed");
  });

  it("fails immediately when shouldRetry rejects the error", () => {
    const { source$, attempts } = flakySource(Infinity);
    let error: Error | undefined;
    source$
      .pipe(
        retryWithDelay({ count: 2, delayMs: 1000, shouldRetry: () => false }),
      )
      .subscribe({ error: (e: Error) => (error = e) });

    expect(attempts()).toBe(1);
    expect(error?.message).toBe("attempt 1 failed");
  });
});
