// GraphQL endpoints
export const POKEAPI_GRAPHQL_URL = "https://beta.pokeapi.co/graphql/v1beta";
export const MOCK_GRAPHQL_URL = "http://localhost:4000/";

// API configuration
export const API_REQUEST_TIMEOUT_MS = 30 * 1000; // 30 seconds
export const API_MAX_RETRIES = 2;
export const API_RETRY_DELAY_MS = 1000; // doubles on each retry: 1s, 2s
