import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, vi } from "vitest";

// import "@testing-library/jest-dom"; // Extend expect with custom matchers
import "@testing-library/jest-dom/vitest";

// Import test mocks - use relative paths instead of alias for test setup
import "../__mocks__/indexeddb";
import "../__mocks__/navigator";
import "../__mocks__/crypto";

// Setup global mocks
beforeAll(() => {
  // Mock fetch globally
  global.fetch = vi.fn();

  // Mock console methods to reduce noise in tests
  global.console = {
    ...console,
    warn: vi.fn(),
    error: vi.fn(),
  };

  // Mock window.addEventListener for online/offline events
  const eventListeners: Record<string, Function[]> = {};
  (global.window.addEventListener as any) = vi.fn((event: string, listener: Function) => {
    if (!eventListeners[event]) eventListeners[event] = [];
    eventListeners[event].push(listener);
  });

  (global.window.removeEventListener as any) = vi.fn((event: string, listener: Function) => {
    if (eventListeners[event]) {
      const index = eventListeners[event].indexOf(listener);
      if (index > -1) eventListeners[event].splice(index, 1);
    }
  });

  (global.window.dispatchEvent as any) = vi.fn((event: Event) => {
    const listeners = eventListeners[event.type] || [];
    listeners.forEach((listener) => listener(event));
    return true;
  });

  // Mock performance.now for consistent timing in tests
  global.performance = {
    ...global.performance,
    now: vi.fn(() => Date.now()),
    // Add missing Performance API methods for undici/fetch compatibility
    clearResourceTimings: vi.fn(),
    getEntriesByType: vi.fn(() => []),
    getEntriesByName: vi.fn(() => []),
    mark: vi.fn(),
    measure: vi.fn(),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
  };

  // Mock IntersectionObserver
  (global as any).IntersectionObserver = vi.fn(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
    unobserve: vi.fn(),
    root: null,
    rootMargin: "",
    thresholds: [],
    takeRecords: vi.fn(() => []),
  }));

  // Mock ResizeObserver
  (global as any).ResizeObserver = vi.fn(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
    unobserve: vi.fn(),
  }));
});

// runs a clean after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();

  // Clear all mocks after each test
  vi.clearAllMocks();

  // Reset fetch mock
  if (global.fetch && "mockClear" in global.fetch) {
    (global.fetch as any).mockClear();
  }

  // Reset navigator.onLine
  Object.defineProperty(navigator, "onLine", {
    value: true,
    writable: true,
  });
});
