export type GraphqlVariables = Record<string, unknown>;

export interface GraphqlErrorEntry {
  message: string;
  extensions?: Record<string, unknown>;
}

/** Standard GraphQL-over-HTTP response envelope. */
export interface GraphqlResponse<TData> {
  data?: TData | null;
  errors?: GraphqlErrorEntry[];
}
