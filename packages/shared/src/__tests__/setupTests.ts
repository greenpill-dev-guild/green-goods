/**
 * Shared Package Test Setup
 *
 * Configures the test environment for shared package tests.
 */

import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, vi } from "vitest";

import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

// Setup global mocks
beforeAll(() => {
  // Mock fetch globally
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({}),
    text: vi.fn().mockResolvedValue(""),
  });

  // Mock console methods to reduce noise
  global.console = {
    ...console,
    warn: vi.fn(),
    error: vi.fn(),
    log: console.log,
  };

  // Mock window.location
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

  // Mock navigator.onLine
  Object.defineProperty(navigator, "onLine", {
    value: true,
    writable: true,
    configurable: true,
  });

  // Mock performance.now
  global.performance = {
    ...global.performance,
    now: vi.fn(() => Date.now()),
  };

  // Mock URL.createObjectURL / revokeObjectURL
  if (!global.URL) {
    (global as any).URL = {} as any;
  }
  (global.URL as any).createObjectURL = vi.fn(
    () => `blob:mock-${Math.random().toString(36).slice(2)}`
  );
  (global.URL as any).revokeObjectURL = vi.fn();

  // Mock sessionStorage / localStorage
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

  // Mock IntersectionObserver
  (global as any).IntersectionObserver = vi.fn(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
    unobserve: vi.fn(),
  }));

  // Mock ResizeObserver
  (global as any).ResizeObserver = vi.fn(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
    unobserve: vi.fn(),
  }));

  // Mock crypto.getRandomValues
  if (!(global as any).crypto) {
    (global as any).crypto = {};
  }
  (global as any).crypto.getRandomValues = vi.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  });
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();

  // Reset navigator.onLine
  Object.defineProperty(navigator, "onLine", {
    value: true,
    writable: true,
    configurable: true,
  });
});
