/**
 * isGardenMember Utility Tests
 * @vitest-environment happy-dom
 *
 * Tests the exported isGardenMember function from useJoinGarden.
 * This is a pure function (no hooks) that checks membership via:
 *   1. Actual list membership (gardeners/stewards)
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
  trackGardenJoinCancelled: vi.fn(),
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
  parseContractError: vi.fn().mockReturnValue({ name: "UnknownError" }),
}));

vi.mock("../../../config/appkit", () => ({
  getWagmiConfig: () => ({}),
}));

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
  getDefaultChain: () => ({ chainId: 11155111, rootGarden: null }),
}));

vi.mock("../../../config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
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
const { forgetListedPendingJoins } = await import("../../../modules/garden/pending-joins");
const { logger } = await import("../../../modules/app/logger");

describe("forgetListedPendingJoins", () => {
  const user = "0x5555555555555555555555555555555555555555";
  const other = "0x6666666666666666666666666666666666666666";

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("forgets only the account's own joins in gardens whose roster lists it", () => {
    const joinedAt = Date.now();
    localStorage.setItem(
      PENDING_JOINS_KEY,
      JSON.stringify({
        "garden-listed": { address: user, timestamp: joinedAt },
        "garden-waiting": { address: user, timestamp: joinedAt },
        "garden-shared": { address: other, timestamp: joinedAt },
      })
    );

    forgetListedPendingJoins(user.toUpperCase().replace("0X", "0x"), [
      "GARDEN-LISTED",
      "garden-shared",
    ]);

    expect(JSON.parse(localStorage.getItem(PENDING_JOINS_KEY) ?? "{}")).toEqual({
      "garden-waiting": { address: user, timestamp: joinedAt },
      "garden-shared": { address: other, timestamp: joinedAt },
    });
  });

  it("keeps going when storage refuses the write, and says so", () => {
    const saved = JSON.stringify({ "garden-listed": { address: user, timestamp: Date.now() } });
    vi.stubGlobal("localStorage", {
      getItem: () => saved,
      setItem: () => {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      },
    });

    expect(() => forgetListedPendingJoins(user, ["garden-listed"])).not.toThrow();
    expect(logger.warn).toHaveBeenCalledWith(
      "Could not forget a settled pending join",
      expect.objectContaining({ source: "forgetListedPendingJoins" })
    );
  });
});

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

  it("returns true when user is in stewards list", () => {
    const user = "0x1111111111111111111111111111111111111111";
    const stewards = ["0x1111111111111111111111111111111111111111"];

    expect(isGardenMember(user, [], stewards)).toBe(true);
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

  it("leaves a pending join to the roster read when the list names the user", () => {
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

    // The list may only hold the join's own optimistic entry.
    const result = isGardenMember(user, [user], [], gardenId);
    expect(result).toBe(true);

    // `useMyGardens` settles it once a read of the roster lists the user.
    expect(localStorage.getItem(PENDING_JOINS_KEY)).toBe(JSON.stringify(pendingJoins));
  });
});
