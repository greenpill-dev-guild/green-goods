/**
 * Base Test Setup for Green Goods Monorepo
 *
 * Provides common test environment configuration shared across all packages.
 * Individual packages extend this base setup with package-specific mocks.
 */

import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, vi } from "vitest";

import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

// Import browser mocks
import "../__mocks__/browser/crypto";
import "../__mocks__/browser/navigator";

/**
 * Setup common test environment
 * Call this from package-specific setupTests files
 */
export function setupTestEnvironment() {
  beforeAll(() => {
    // Mock fetch globally with better error handling
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({}),
      text: vi.fn().mockResolvedValue(""),
    });

    // Mock console methods to reduce noise in tests but keep log for debugging
    global.console = {
      ...console,
      warn: vi.fn(),
      error: vi.fn(),
      log: console.log, // Keep log for debugging
    };

    // Mock window properties
    Object.defineProperty(window, "location", {
      value: {
        href: "http://localhost:3000",
        origin: "http://localhost:3000",
        pathname: "/",
        search: "",
        hash: "",
        hostname: "localhost",
        assign: vi.fn(),
        replace: vi.fn(),
        reload: vi.fn(),
      },
      writable: true,
    });

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

    // Polyfill URL.createObjectURL / revokeObjectURL
    if (!global.URL) {
      (global as any).URL = {} as any;
    }
    if (!(global.URL as any).createObjectURL) {
      (global.URL as any).createObjectURL = vi.fn(
        () => `blob:mock-${Math.random().toString(36).slice(2)}`
      );
    }
    if (!(global.URL as any).revokeObjectURL) {
      (global.URL as any).revokeObjectURL = vi.fn();
    }

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

    Object.defineProperty(navigator, "storage", {
      value: createMockStorage(),
      writable: true,
    });

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

  // Cleanup after each test
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();

    // Reset fetch mock to default behavior
    if (global.fetch && "mockResolvedValue" in global.fetch) {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({}),
        text: vi.fn().mockResolvedValue(""),
      });
    }

    // Reset navigator.onLine
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });
  });
}

// Auto-run setup for shared package tests
setupTestEnvironment();
