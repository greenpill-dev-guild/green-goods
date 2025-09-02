import "@testing-library/jest-dom";

// Mock environment variables
Object.defineProperty(import.meta, "env", {
  value: {
    VITE_PRIVY_APP_ID: "test-app-id",
    VITE_INDEXER_URL: "http://localhost:8081/v1/graphql",
    VITE_DEFAULT_CHAIN_ID: "42161",
    DEV: true,
  },
  writable: true,
});