/**
 * Client Package Test Setup
 *
 * Extends base test setup with client-specific mocks.
 */

import { createRequire } from "node:module";
import { vi } from "vitest";

// Import base setup from shared (includes common mocks)
import "@green-goods/shared/__tests__/setupTests.base";
import { setupTestEnvironment } from "@green-goods/shared/__tests__/setupTests.base";

// Call the setup function to ensure proper cleanup between tests
setupTestEnvironment();

// Client-specific: Ensure diagnostics_channel polyfill for pino
const ensureDiagnosticsChannel = () => {
  const require = createRequire(import.meta.url);
  const stub = () => ({
    subscribe: () => undefined,
    unsubscribe: () => undefined,
    hasSubscribers: false,
  });

  try {
    const diagCjs = require("node:diagnostics_channel");
    if (typeof diagCjs.tracingChannel !== "function") {
      diagCjs.tracingChannel = stub;
    }
  } catch {
    // ignore
  }
};

ensureDiagnosticsChannel();

// Client-specific: Mock Reown AppKit
vi.mock("@reown/appkit", () => ({
  AppKit: class {
    initialize() {
      return Promise.resolve();
    }
    destroy() {}
  },
}));
