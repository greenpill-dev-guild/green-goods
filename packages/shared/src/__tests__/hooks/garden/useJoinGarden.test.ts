/**
 * isGardenMember Utility Tests
 * @vitest-environment jsdom
 *
 * Tests the exported isGardenMember function from useJoinGarden.
 * This is a pure function (no hooks) that checks membership via:
 *   1. Actual list membership (gardeners/operators)
 *   2. Pending join optimistic state (localStorage, 15-min TTL)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PENDING_JOINS_KEY = "greengoods:pending-joins";

// Mock the analytics/error-tracking modules that useJoinGarden imports
vi.mock("../../../modules/app/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("../../../modules/app/analytics-events", () => ({
  trackGardenJoinStarted: vi.fn(),
  trackGardenJoinSuccess: vi.fn(),
  trackGardenJoinFailed: vi.fn(),
  trackGardenJoinAlreadyMember: vi.fn(),
}));

vi.mock("../../../modules/app/error-tracking", () => ({
  addBreadcrumb: vi.fn(),
  trackContractError: vi.fn(),
  trackNetworkError: vi.fn(),
}));

vi.mock("../../../utils/blockchain/simulation", () => ({
  simulateJoinGarden: vi.fn(),
}));

vi.mock("../../../utils/errors/contract-errors", () => ({
  isAlreadyGardenerError: vi.fn().mockReturnValue(false),
}));

vi.mock("../../../config/appkit", () => ({
  getWagmiConfig: () => ({}),
}));

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
  getDefaultChain: () => ({ chainId: 11155111, rootGarden: null }),
}));

vi.mock("wagmi", () => ({
  useWriteContract: () => ({ writeContractAsync: vi.fn(), isPending: false }),
}));

vi.mock("@wagmi/core", () => ({
  readContract: vi.fn(),
}));

vi.mock("../../../hooks/auth/useUser", () => ({
  useUser: () => ({ smartAccountAddress: null, smartAccountClient: null, eoa: null }),
}));

vi.mock("../../../hooks/utils/useTimeout", () => ({
  useDelayedInvalidation: () => ({ start: vi.fn(), cancel: vi.fn() }),
}));

const { isGardenMember } = await import("../../../hooks/garden/useJoinGarden");

describe("isGardenMember", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns false when userAddress is null", () => {
    expect(isGardenMember(null, ["0xabc"], ["0xdef"])).toBe(false);
    expect(isGardenMember(undefined, ["0xabc"], ["0xdef"])).toBe(false);
  });

  it("returns true when user is in gardeners list (case-insensitive)", () => {
    const user = "0xAbCdEf1234567890123456789012345678901234";
    const gardeners = ["0xabcdef1234567890123456789012345678901234"];

    expect(isGardenMember(user, gardeners, [])).toBe(true);
  });

  it("returns true when user is in operators list", () => {
    const user = "0x1111111111111111111111111111111111111111";
    const operators = ["0x1111111111111111111111111111111111111111"];

    expect(isGardenMember(user, [], operators)).toBe(true);
  });

  it("returns true for pending join within TTL (localStorage)", () => {
    const user = "0x2222222222222222222222222222222222222222";
    const gardenId = "garden-test";

    // Simulate a recent pending join
    const pendingJoins = {
      [gardenId]: {
        address: user,
        timestamp: Date.now() - 5 * 60 * 1000, // 5 minutes ago (within 15-min TTL)
      },
    };
    localStorage.setItem(PENDING_JOINS_KEY, JSON.stringify(pendingJoins));

    // Not in any list, but has a pending join
    expect(isGardenMember(user, [], [], gardenId)).toBe(true);
  });

  it("returns false for expired pending join (>15 min)", () => {
    const user = "0x3333333333333333333333333333333333333333";
    const gardenId = "garden-expired";

    // Simulate an expired pending join (20 minutes ago)
    const pendingJoins = {
      [gardenId]: {
        address: user,
        timestamp: Date.now() - 20 * 60 * 1000, // 20 minutes ago (beyond 15-min TTL)
      },
    };
    localStorage.setItem(PENDING_JOINS_KEY, JSON.stringify(pendingJoins));

    // Not in any list, expired pending join
    expect(isGardenMember(user, [], [], gardenId)).toBe(false);

    // Should also clean up the expired entry
    const stored = JSON.parse(localStorage.getItem(PENDING_JOINS_KEY) || "{}");
    expect(stored[gardenId]).toBeUndefined();
  });

  it("cleans up pending join when confirmed in gardeners list", () => {
    const user = "0x4444444444444444444444444444444444444444";
    const gardenId = "garden-confirmed";

    // Set up a pending join
    const pendingJoins = {
      [gardenId]: {
        address: user,
        timestamp: Date.now(),
      },
    };
    localStorage.setItem(PENDING_JOINS_KEY, JSON.stringify(pendingJoins));

    // User is now confirmed in gardeners list
    const result = isGardenMember(user, [user], [], gardenId);
    expect(result).toBe(true);

    // Pending join should be cleaned up since the user is now confirmed
    const stored = JSON.parse(localStorage.getItem(PENDING_JOINS_KEY) || "{}");
    expect(stored[gardenId]).toBeUndefined();
  });
});
