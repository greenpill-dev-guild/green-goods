/**
 * Offline Test Utilities
 *
 * Provides helpers for testing offline functionality, job queues, and network conditions.
 */

import { vi } from "vitest";

// ============================================
// Type Definitions
// ============================================

export interface OfflineWork {
  id: string;
  type: "work" | "approval";
  data: unknown;
  images?: File[];
  timestamp: number;
  synced: boolean;
  error?: string;
  contentHash: string;
  submissionAttempts: number;
  lastSubmissionAttempt?: number;
  priority: "low" | "normal" | "high" | "urgent";
  retryAfter?: number;
  conflictDetected?: boolean;
  userSkipped?: boolean;
}

export interface ConflictData {
  workId: string;
  type: "data_modified" | "already_submitted" | "garden_changed" | "schema_mismatch";
  localWork: OfflineWork;
  remoteWork?: any;
  description: string;
  autoResolvable: boolean;
}

// ============================================
// Offline Work Factories
// ============================================

export const createMockOfflineWork = (overrides: Partial<OfflineWork> = {}): OfflineWork => {
  const defaultData = {
    title: "Test Work",
    description: "Test description",
    gardenAddress: "0x123...",
    actionUID: 1,
  };

  const { data: overrideData, ...otherOverrides } = overrides;

  return {
    id: crypto.randomUUID(),
    type: "work",
    data: {
      ...defaultData,
      ...((overrideData as any) || {}),
    },
    timestamp: Date.now(),
    synced: false,
    contentHash: "abcd1234",
    submissionAttempts: 0,
    priority: "normal",
    ...otherOverrides,
  };
};

export const createMockConflict = (
  workId: string,
  type: ConflictData["type"] = "already_submitted"
): ConflictData => ({
  workId,
  type,
  localWork: createMockOfflineWork({ id: workId }),
  description: `Test conflict: ${type}`,
  autoResolvable: true,
});

// ============================================
// Storage & Retry Helpers
// ============================================

export const createMockStorageQuota = (used: number = 1000, total: number = 10000) => ({
  used,
  available: total - used,
  total,
  percentage: (used / total) * 100,
});

export const createMockRetryState = (attempts: number = 0, nextAttempt: number = 0) => ({
  attempts,
  lastAttempt: Date.now() - 1000,
  nextAttempt,
  backoffDelay: 1000 * Math.pow(2, attempts),
});

// ============================================
// Fetch Mocking Utilities
// ============================================

export const mockFetch = (response: any, ok = true, status = 200) => {
  global.fetch = vi.fn(
    () =>
      Promise.resolve({
        ok,
        status,
        json: () => Promise.resolve(response),
        text: () => Promise.resolve(JSON.stringify(response)),
      }) as any
  );
};

export const mockFetchError = (error: Error) => {
  global.fetch = vi.fn(() => Promise.reject(error));
};

export const mockFetchSequence = (
  responses: Array<{ response: any; ok?: boolean; status?: number }>
) => {
  let callCount = 0;
  global.fetch = vi.fn(() => {
    const config = responses[callCount] || responses[responses.length - 1];
    callCount++;
    return Promise.resolve({
      ok: config.ok ?? true,
      status: config.status ?? 200,
      json: () => Promise.resolve(config.response),
      text: () => Promise.resolve(JSON.stringify(config.response)),
    }) as any;
  });
};

// ============================================
// Network Condition Simulation
// ============================================

export const waitFor = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const simulateNetworkConditions = {
  offline: () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });
    window.dispatchEvent(new Event("offline"));
  },
  online: () => {
    Object.defineProperty(navigator, "onLine", { value: true, writable: true, configurable: true });
    window.dispatchEvent(new Event("online"));
  },
  slow: () => {
    // Mock slow network by adding delays to fetch
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async (input: any, init?: any) => {
      await waitFor(1000); // 1 second delay
      return originalFetch?.(input, init);
    });
  },
};

// ============================================
// Mock Reset Utilities
// ============================================

export const resetAllMocks = () => {
  vi.clearAllMocks();
  // Reset fetch
  if (global.fetch && "mockRestore" in global.fetch) {
    (global.fetch as any).mockRestore();
  }
  // Reset URL mocks
  if (global.URL.createObjectURL && "mockClear" in global.URL.createObjectURL) {
    (global.URL.createObjectURL as any).mockClear();
  }
  if (global.URL.revokeObjectURL && "mockClear" in global.URL.revokeObjectURL) {
    (global.URL.revokeObjectURL as any).mockClear();
  }
};
