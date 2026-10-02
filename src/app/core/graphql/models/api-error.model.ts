import { HttpErrorResponse } from "@angular/common/http";
import { TimeoutError } from "rxjs";
import { GraphqlErrorEntry, GraphqlResponse } from "./graphql.model";

export type ApiErrorKind =
  "network" | "timeout" | "http" | "graphql" | "unknown";

const USER_MESSAGES: Record<ApiErrorKind, string> = {
  network: "Can't reach the server. Check your connection and try again.",
  timeout: "The server is taking too long to respond. Please try again.",
  http: "The server ran into a problem. Please try again.",
  graphql: "The server couldn't complete the request. Please try again.",
  unknown: "Something went wrong. Please try again.",
};

/**
 * A failed API call, normalised so the UI can show a friendly message and
 * callers can decide whether retrying makes sense.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;

  constructor(
    kind: ApiErrorKind,
    message: string,
    options: { status?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ApiError";
    this.kind = kind;
    this.status = options.status ?? null;
  }

  /** Message that is safe to show to users — never raw server output. */
  get userMessage(): string {
    return USER_MESSAGES[this.kind];
  }

  /** True when the same request may succeed later: network, timeout, 5xx or 429. */
  get isRetryable(): boolean {
    if (this.kind === "network" || this.kind === "timeout") return true;
    return (
      this.kind === "http" &&
      this.status !== null &&
      (this.status >= 500 || this.status === 429)
    );
  }

  /**
   * Builds an error from a GraphQL response's `errors` array.
   * @param errors The non-empty `errors` array from the response body.
   * @param status HTTP status of the response, if known.
   */
  static fromGraphqlErrors(
    errors: GraphqlErrorEntry[],
    status?: number,
  ): ApiError {
    const message = errors.map((entry) => entry.message).join("; ");
    return new ApiError("graphql", message, { status });
  }

  /**
   * Converts any thrown value into an `ApiError`.
   * @param error Value caught from an HTTP or RxJS pipeline.
   */
  static from(error: unknown): ApiError {
    if (error instanceof ApiError) return error;

    if (error instanceof TimeoutError) {
      return new ApiError("timeout", "Request timed out", { cause: error });
    }

    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return new ApiError("network", error.message, {
          status: 0,
          cause: error,
        });
      }
      const body = error.error as GraphqlResponse<unknown> | null;
      if (body?.errors?.length) {
        return ApiError.fromGraphqlErrors(body.errors, error.status);
      }
      return new ApiError("http", error.message, {
        status: error.status,
        cause: error,
      });
    }

    const message = error instanceof Error ? error.message : String(error);
    return new ApiError("unknown", message, { cause: error });
  }
}
