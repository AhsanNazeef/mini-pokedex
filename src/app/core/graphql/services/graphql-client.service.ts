import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { Observable, catchError, map, throwError, timeout } from "rxjs";
import { API_REQUEST_TIMEOUT_MS } from "../../../common/constants/api.constants";
import { LoggerService } from "../../logger.service";
import { ApiError } from "../models/api-error.model";
import { GraphqlResponse, GraphqlVariables } from "../models/graphql.model";

@Injectable({ providedIn: "root" })
export class GraphqlClientService {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);

  /**
   * Sends a GraphQL query or mutation and emits the response `data` once.
   *
   * Every failure is normalised to an {@link ApiError}: network errors,
   * timeouts, non-2xx responses and — because GraphQL servers report them
   * with HTTP 200 — a non-empty `errors` array or missing `data`.
   * No retries happen here; callers opt in where a retry is safe.
   *
   * @param endpoint GraphQL server URL.
   * @param query Query or mutation document.
   * @param variables Operation variables.
   */
  request$<TData>(
    endpoint: string,
    query: string,
    variables: GraphqlVariables = {},
  ): Observable<TData> {
    return this.http
      .post<GraphqlResponse<TData>>(endpoint, { query, variables })
      .pipe(
        timeout(API_REQUEST_TIMEOUT_MS),
        map((response) => {
          if (response.errors?.length) {
            throw ApiError.fromGraphqlErrors(response.errors);
          }
          if (response.data == null) {
            throw new ApiError("graphql", "Response contained no data");
          }
          return response.data;
        }),
        catchError((error: unknown) => {
          const apiError = ApiError.from(error);
          this.logger.error("GraphQL request failed", {
            endpoint,
            kind: apiError.kind,
            error: apiError,
          });
          return throwError(() => apiError);
        }),
      );
  }
}
