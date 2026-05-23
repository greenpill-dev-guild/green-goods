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

// JSDOM does not implement scrollTo, but several client views call it during
// interaction flows. Stub it once here so package-wide test runs stay quiet.
window.scrollTo = vi.fn();

// JSDOM likewise does not implement scrollIntoView; the public endowment panel
// nudges a freshly expanded withdrawal row into view. Stub it on the prototype.
window.HTMLElement.prototype.scrollIntoView = vi.fn();
