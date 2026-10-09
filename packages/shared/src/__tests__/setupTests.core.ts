/**
 * Node-safe test environment shared by every package's setup.
 *
 * Holds what Node and DOM tests both need: strict fetch, storage and IndexedDB, crypto and
 * navigator mocks, and per-test resets. `setupTests.base.ts` adds the DOM layer (Testing Library,
 * jest-dom, jsdom polyfills) on top; the Shared Node projects load only this file.
 */

import { afterEach, beforeAll, vi } from "vitest";

import "fake-indexeddb/auto";

// Import browser mocks
import "../__mocks__/browser/crypto";
import "../__mocks__/browser/navigator";

function strictFetch(url: string | URL | Request): never {
  const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
  throw new Error(
    `Unexpected fetch call to: ${urlStr}. Mock this endpoint explicitly in your test.`
  );
}

/** Registers the Node-safe hooks. `setupTestEnvironment()` in the base setup calls this first. */
export function setupCoreTestEnvironment() {
  beforeAll(() => {
    // Strict fetch mock — throws on unexpected calls so tests must
    // explicitly mock their endpoints. Prevents false-OK network calls.
    global.fetch = vi.fn().mockImplementation(strictFetch);

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

    // Force Polyfill URL.createObjectURL / revokeObjectURL
    if (!global.URL) {
      (global as any).URL = {} as any;
    }
    (global.URL as any).createObjectURL = vi.fn(
      () => `blob:mock-${Math.random().toString(36).slice(2)}`
    );
    (global.URL as any).revokeObjectURL = vi.fn();

    // Polyfill sessionStorage / localStorage
    const createMemoryStorage = () => {
      const store = new Map<string, string>();
      return {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => void store.set(k, String(v)),
        removeItem: (k: string) => void store.delete(k),
        clear: () => void store.clear(),
        key: (i: number) => Array.from(store.keys())[i] || null,
        get length() {
          return store.size;
        },
      } as unknown as Storage;
    };
    if (!(global as any).sessionStorage) {
      (global as any).sessionStorage = createMemoryStorage();
    }
    if (!(global as any).localStorage) {
      (global as any).localStorage = createMemoryStorage();
    }

    // Mock Storage APIs
    const createMockStorage = () => ({
      estimate: vi.fn().mockResolvedValue({
        quota: 100000000, // 100MB
        usage: 10000000, // 10MB
      }),
      persist: vi.fn().mockResolvedValue(true),
      persisted: vi.fn().mockResolvedValue(true),
    });

    if (typeof navigator !== "undefined") {
      Object.defineProperty(navigator, "storage", {
        value: createMockStorage(),
        writable: true,
      });
    }

    // Mock caches API - only if not already defined
    if (!("caches" in global)) {
      const mockCache = {
        keys: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(true),
        match: vi.fn().mockResolvedValue(undefined),
        matchAll: vi.fn().mockResolvedValue([]),
        add: vi.fn().mockResolvedValue(undefined),
        addAll: vi.fn().mockResolvedValue(undefined),
        put: vi.fn().mockResolvedValue(undefined),
      };

      Object.defineProperty(global, "caches", {
        value: {
          open: vi.fn().mockResolvedValue(mockCache),
          keys: vi.fn().mockResolvedValue(["test-cache"]),
          delete: vi.fn().mockResolvedValue(true),
          has: vi.fn().mockResolvedValue(true),
          match: vi.fn().mockResolvedValue(undefined),
        },
        writable: true,
        configurable: true,
      });
    }
  });

  afterEach(() => {
    vi.clearAllMocks();

    // Reset fetch mock to strict default — unexpected calls throw
    if (global.fetch && "mockImplementation" in global.fetch) {
      (global.fetch as any).mockImplementation(strictFetch);
    }

    // Reset navigator.onLine
    if (typeof navigator !== "undefined") {
      Object.defineProperty(navigator, "onLine", {
        value: true,
        writable: true,
        configurable: true,
      });
    }
  });
}
