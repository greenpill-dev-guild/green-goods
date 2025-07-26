/**
 * @fileoverview Test Utilities and Helpers for Green Goods Tests
 *
 * This module provides reusable test utilities, mock factories, and helper functions
 * to reduce code duplication and complexity across the test suite.
 *
 * Key features:
 * - Data factories for common types (Work, Job, User, etc.)
 * - Mock setup helpers for APIs and browser features
 * - React Query test wrappers
 * - Custom render helpers
 * - Common assertions and matchers
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import React from "react";
import { vi, expect } from "vitest";

// ============================================================================
// Type Definitions
// ============================================================================

export interface MockWork {
  id: string;
  title: string;
  actionUID: number;
  gardenerAddress: string;
  gardenAddress: string;
  feedback: string;
  plantCount: number;
  plantSelection: string[];
  images: MockImage[];
  createdAt: number;
  status: "pending" | "approved" | "rejected";
  metadata?: Record<string, any>;
}

export interface MockJob {
  id: string;
  kind: string;
  payload: any; // Using any for flexible testing
  createdAt: number;
  synced: boolean;
  lastError: string | undefined;
  attempts: number;
}

export interface MockImage {
  id: string;
  filename: string;
  url: string;
  size: number;
  type: string;
}

export interface MockUserInterface {
  ready: boolean;
  user: any;
  smartAccountClient: any;
}

export interface MockQueueStats {
  total: number;
  pending: number;
  failed: number;
  synced: number;
}

// ============================================================================
// Data Factories
// ============================================================================

/**
 * Creates a mock Work object with sensible defaults and optional overrides
 */
export const createMockWork = (overrides: Partial<MockWork> = {}): MockWork => ({
  id: `work-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  title: "Test Work Submission",
  actionUID: Math.floor(Math.random() * 10) + 1,
  gardenerAddress: "0x742d35Cc6634C0532925a3b8D162a59395b3afc9",
  gardenAddress: "0x1234567890123456789012345678901234567890",
  feedback: "Great work on this environmental action!",
  plantCount: Math.floor(Math.random() * 20) + 1,
  plantSelection: ["tree", "flower", "herb"].slice(0, Math.floor(Math.random() * 3) + 1),
  images: [createMockImage(), createMockImage()],
  createdAt: Date.now(),
  status: "pending",
  ...overrides,
});

/**
 * Creates a mock Job object with sensible defaults and optional overrides
 */
export const createMockJob = (overrides: Partial<MockJob> = {}): MockJob => ({
  id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  kind: "work",
  payload: {
    title: "Test Work Submission",
    actionUID: Math.floor(Math.random() * 10) + 1,
    gardenAddress: "0x1234567890123456789012345678901234567890",
    feedback: "Great work on this environmental action!",
    plantCount: Math.floor(Math.random() * 20) + 1,
    plantSelection: ["tree", "flower"],
    ...overrides.payload,
  },
  createdAt: Date.now(),
  synced: false,
  lastError: undefined,
  attempts: 0,
  ...overrides,
});

/**
 * Creates a mock Image object with sensible defaults and optional overrides
 */
export const createMockImage = (filename?: string): MockImage => {
  const id = Math.random().toString(36).substr(2, 9);
  const name = filename || `image-${id}.jpg`;
  return {
    id: `img-${id}`,
    filename: name,
    url: `blob:mock-url-${name}`,
    size: Math.floor(Math.random() * 1000000) + 100000, // 100KB - 1MB
    type: "image/jpeg",
  };
};

/**
 * Creates a mock UserInterface object with sensible defaults
 */
export const createMockUserInterface = (
  overrides: Partial<MockUserInterface> = {}
): MockUserInterface => ({
  ready: true,
  user: {
    id: "user-123",
    wallet: {
      address: "0x742d35Cc6634C0532925a3b8D162a59395b3afc9",
    },
  },
  smartAccountClient: {
    address: "0x742d35Cc6634C0532925a3b8D162a59395b3afc9",
    account: {
      address: "0x742d35Cc6634C0532925a3b8D162a59395b3afc9",
    },
  },
  ...overrides,
});

/**
 * Creates a mock SmartAccountClient with sensible defaults
 */
export const createMockSmartAccountClient = (overrides: any = {}) => ({
  address: "0x742d35Cc6634C0532925a3b8D162a59395b3afc9",
  account: {
    address: "0x742d35Cc6634C0532925a3b8D162a59395b3afc9",
  },
  ...overrides,
});

/**
 * Creates mock QueueStats with sensible defaults
 */
export const createMockQueueStats = (overrides: Partial<MockQueueStats> = {}): MockQueueStats => ({
  total: 10,
  pending: 3,
  failed: 1,
  synced: 6,
  ...overrides,
});

// ============================================================================
// Mock Setup Helpers
// ============================================================================

/**
 * Sets up common mocks for browser APIs
 */
export const setupBrowserMocks = () => {
  // Navigator online status
  Object.defineProperty(navigator, "onLine", {
    writable: true,
    value: true,
  });

  // Storage API
  const mockStorageEstimate = vi.fn().mockResolvedValue({
    usage: 50 * 1024 * 1024, // 50MB
    quota: 100 * 1024 * 1024, // 100MB
  });

  Object.defineProperty(navigator, "storage", {
    value: {
      estimate: mockStorageEstimate,
    },
    writable: true,
  });

  // Caches API
  const mockCaches = {
    keys: vi.fn().mockResolvedValue(["cache-v1", "cache-v2"]),
    delete: vi.fn().mockResolvedValue(true),
  };

  if (!global.caches) {
    Object.defineProperty(global, "caches", {
      value: mockCaches,
      writable: true,
    });
  }

  // URL.createObjectURL and revokeObjectURL
  global.URL.createObjectURL = vi.fn((file: File) => `mock-url-${file.name}`);
  global.URL.revokeObjectURL = vi.fn();

  return {
    mockStorageEstimate,
    mockCaches,
  };
};

/**
 * Sets up fetch mock with common response patterns
 */
export const setupFetchMock = () => {
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  const mockResponses = {
    success: (data: any) => ({
      ok: true,
      json: async () => data,
      status: 200,
    }),
    error: (status = 500, message = "Internal Server Error") => ({
      ok: false,
      status,
      statusText: message,
    }),
    networkError: () => Promise.reject(new Error("Network error")),
  };

  return { mockFetch, mockResponses };
};

/**
 * Mocks console methods to avoid noise during tests
 */
export const mockConsole = () => {
  const consoleSpy = {
    log: vi.spyOn(console, "log").mockImplementation(() => {}),
    error: vi.spyOn(console, "error").mockImplementation(() => {}),
    warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
    info: vi.spyOn(console, "info").mockImplementation(() => {}),
  };

  return consoleSpy;
};

/**
 * Sets up IndexedDB mock
 */
export const setupIndexedDBMock = () => {
  const mockIDBRequest = {
    result: {},
    error: null,
    onsuccess: null,
    onerror: null,
  };

  const mockIDBTransaction = {
    objectStore: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue(mockIDBRequest),
      put: vi.fn().mockReturnValue(mockIDBRequest),
      delete: vi.fn().mockReturnValue(mockIDBRequest),
      getAll: vi.fn().mockReturnValue(mockIDBRequest),
    }),
  };

  const mockIDBDatabase = {
    transaction: vi.fn().mockReturnValue(mockIDBTransaction),
    createObjectStore: vi.fn(),
    deleteObjectStore: vi.fn(),
  };

  const mockIDBOpenRequest = {
    ...mockIDBRequest,
    result: mockIDBDatabase,
    onupgradeneeded: null,
  };

  Object.defineProperty(global, "indexedDB", {
    value: {
      open: vi.fn().mockReturnValue(mockIDBOpenRequest),
      deleteDatabase: vi.fn().mockReturnValue(mockIDBRequest),
    },
    writable: true,
  });

  return {
    mockIDBRequest,
    mockIDBTransaction,
    mockIDBDatabase,
    mockIDBOpenRequest,
  };
};

// ============================================================================
// React Query Helpers
// ============================================================================

/**
 * Creates a QueryClient configured for testing
 */
export const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
};

/**
 * Creates a React Query wrapper for testing hooks
 */
export const createQueryWrapper = (queryClient?: QueryClient) => {
  const client = queryClient || createTestQueryClient();

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

// ============================================================================
// Custom Render Helpers
// ============================================================================

interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  queryClient?: QueryClient;
  wrapperProps?: any;
}

/**
 * Custom render function with QueryClient wrapper
 */
export const renderWithQuery = (ui: React.ReactElement, options: CustomRenderOptions = {}) => {
  const { queryClient, wrapperProps, ...renderOptions } = options;
  const Wrapper = createQueryWrapper(queryClient);

  return render(ui, {
    wrapper: (props) => <Wrapper {...wrapperProps} {...props} />,
    ...renderOptions,
  });
};

// ============================================================================
// Common Test Patterns
// ============================================================================

/**
 * Helper to test async loading states
 */
export const testLoadingState = async (hookResult: any, expectedLoadingValue = true) => {
  expect(hookResult.current.isLoading).toBe(expectedLoadingValue);
};

/**
 * Helper to test error states
 */
export const testErrorState = (hookResult: any, expectedError: any) => {
  expect(hookResult.current.error).toBeTruthy();
  if (expectedError) {
    expect(hookResult.current.error).toMatchObject(expectedError);
  }
};

/**
 * Creates a mock event bus for testing
 */
export const createMockEventBus = () => {
  const subscribers = new Map<string, Function[]>();

  return {
    subscribe: vi.fn((event: string, handler: Function) => {
      if (!subscribers.has(event)) {
        subscribers.set(event, []);
      }
      subscribers.get(event)!.push(handler);

      return vi.fn(() => {
        const handlers = subscribers.get(event) || [];
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      });
    }),
    emit: vi.fn((event: string, data?: any) => {
      const handlers = subscribers.get(event) || [];
      handlers.forEach((handler) => handler(data));
    }),
    clear: () => {
      subscribers.clear();
    },
    getSubscribers: () => new Map(subscribers),
  };
};

/**
 * Creates a mock timer helper for testing periodic operations
 */
export const createMockTimer = () => {
  vi.useFakeTimers();

  return {
    advanceTime: (ms: number) => vi.advanceTimersByTime(ms),
    runAllTimers: () => vi.runAllTimers(),
    runOnlyPendingTimers: () => vi.runOnlyPendingTimers(),
    cleanup: () => vi.useRealTimers(),
  };
};

/**
 * Helper to wait for multiple async operations
 */
export const waitForMultiple = async (promises: Promise<any>[]) => {
  return Promise.all(promises);
};

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Asserts that a mock was called with specific partial arguments
 */
export const expectCalledWithPartial = (mockFn: any, expectedArgs: any[]) => {
  expect(mockFn).toHaveBeenCalled();
  const calls = mockFn.mock.calls;
  const lastCall = calls[calls.length - 1];

  expectedArgs.forEach((expectedArg, index) => {
    if (typeof expectedArg === "object" && expectedArg !== null) {
      expect(lastCall[index]).toMatchObject(expectedArg);
    } else {
      expect(lastCall[index]).toBe(expectedArg);
    }
  });
};

/**
 * Asserts that an array contains objects with specific properties
 */
export const expectArrayToContainObject = (array: any[], expectedObject: any) => {
  expect(
    array.some((item) =>
      Object.keys(expectedObject).every((key) => item[key] === expectedObject[key])
    )
  ).toBe(true);
};

/**
 * Asserts that a function eventually returns a specific value
 */
export const expectEventually = async (
  fn: () => any,
  expectedValue: any,
  timeout = 5000,
  interval = 100
) => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const result = await fn();
    if (result === expectedValue) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Expected ${expectedValue} but got ${await fn()} after ${timeout}ms`);
};

// ============================================================================
// Cleanup Helpers
// ============================================================================

/**
 * Comprehensive test cleanup
 */
export const cleanupAfterTest = () => {
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();

  // Restore console
  vi.restoreAllMocks();

  // Clear any remaining intervals/timeouts
  if (typeof global.clearInterval !== "undefined") {
    for (let i = 1; i < 10000; i++) {
      clearInterval(i);
      clearTimeout(i);
    }
  }
};

/**
 * Setup that should run before each test
 */
export const setupBeforeEach = () => {
  vi.clearAllMocks();
  const browserMocks = setupBrowserMocks();
  const consoleMocks = mockConsole();

  return {
    ...browserMocks,
    ...consoleMocks,
  };
};

/**
 * Cleanup that should run after each test
 */
export const cleanupAfterEach = () => {
  cleanupAfterTest();
};

// ============================================================================
// Export commonly used patterns
// ============================================================================

export * from "@testing-library/react";
export { vi, expect } from "vitest";
