import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { LoggerService } from "../../logger.service";
import { ApiError } from "../models/api-error.model";
import { GraphqlClientService } from "./graphql-client.service";

const ENDPOINT = "https://example.test/graphql";
const QUERY = "query GetThing($id: Int) { thing(id: $id) { id } }";

describe("GraphqlClientService", () => {
  let service: GraphqlClientService;
  let httpMock: HttpTestingController;
  const logger = { error: vi.fn(), warn: vi.fn() };

  beforeEach(() => {
    logger.error.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LoggerService, useValue: logger },
      ],
    });
    service = TestBed.inject(GraphqlClientService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function captureError(): { error: ApiError | null } {
    const result: { error: ApiError | null } = { error: null };
    service.request$(ENDPOINT, QUERY).subscribe({
      error: (error: ApiError) => (result.error = error),
    });
    return result;
  }

  it("posts the query and variables and emits data", () => {
    let data: unknown;
    service
      .request$<{ thing: { id: number } }>(ENDPOINT, QUERY, { id: 1 })
      .subscribe((value) => (data = value));

    const req = httpMock.expectOne(ENDPOINT);
    expect(req.request.method).toBe("POST");
    expect(req.request.body).toEqual({ query: QUERY, variables: { id: 1 } });
    req.flush({ data: { thing: { id: 1 } } });

    expect(data).toEqual({ thing: { id: 1 } });
  });

  it("fails with a graphql error when a 200 response contains errors", () => {
    const result = captureError();
    httpMock
      .expectOne(ENDPOINT)
      .flush({ errors: [{ message: "field 'nope' not found" }] });

    expect(result.error).toBeInstanceOf(ApiError);
    expect(result.error?.kind).toBe("graphql");
    expect(result.error?.isRetryable).toBe(false);
    expect(result.error?.userMessage).not.toContain("nope");
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it("fails with a graphql error when data is missing", () => {
    const result = captureError();
    httpMock.expectOne(ENDPOINT).flush({ data: null });

    expect(result.error?.kind).toBe("graphql");
  });

  it("fails with a retryable network error when the connection drops", () => {
    const result = captureError();
    httpMock.expectOne(ENDPOINT).error(new ProgressEvent("error"));

    expect(result.error?.kind).toBe("network");
    expect(result.error?.isRetryable).toBe(true);
  });

  it("fails with a retryable http error on a 5xx response", () => {
    const result = captureError();
    httpMock
      .expectOne(ENDPOINT)
      .flush("Bad gateway", { status: 502, statusText: "Bad Gateway" });

    expect(result.error?.kind).toBe("http");
    expect(result.error?.status).toBe(502);
    expect(result.error?.isRetryable).toBe(true);
  });

  it("fails with a non-retryable http error on a 4xx response", () => {
    const result = captureError();
    httpMock
      .expectOne(ENDPOINT)
      .flush("Not found", { status: 404, statusText: "Not Found" });

    expect(result.error?.kind).toBe("http");
    expect(result.error?.isRetryable).toBe(false);
  });
});
