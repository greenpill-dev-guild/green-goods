/**
 * Admin Package Test Setup
 *
 * Extends base test setup with admin-specific mocks.
 */

import { afterAll, afterEach, beforeAll, vi } from "vitest";

// Import base setup from shared (includes common mocks)
import "@green-goods/shared/__tests__/setupTests.base";

// Import MSW server for GraphQL mocking
import { server } from "@green-goods/shared/mocks";

// Admin-specific: Start MSW server for API mocking
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

// Admin-specific: Mock environment variables
Object.defineProperty(import.meta, "env", {
  value: {
    VITE_PRIVY_APP_ID: "test-app-id",
    VITE_ENVIO_INDEXER_URL: "http://localhost:8081/v1/graphql",
    VITE_DEFAULT_CHAIN_ID: "84532", // Base Sepolia
    VITE_TEST_ADMIN_ADDRESS: "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e",
    VITE_TEST_OPERATOR_ADDRESS: "0x04D60647836bcA09c37B379550038BdaaFD82503",
    VITE_TEST_USER_ADDRESS: "0x1234567890123456789012345678901234567890",
    DEV: true,
  },
  writable: true,
});

// Admin-specific: Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => "toast-id"),
  },
  Toaster: () => null,
}));

// Admin-specific: Mock Reown AppKit to prevent network calls and 403 errors
vi.mock("@reown/appkit", () => ({
  AppKit: class {
    initialize() {
      return Promise.resolve();
    }
    destroy() {}
  },
}));
