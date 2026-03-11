/**
 * checkMembership Utility Tests
 * @vitest-environment jsdom
 *
 * Tests the exported checkMembership function from useAutoJoinRootGarden.
 * This standalone async function checks on-chain membership via readContract
 * and manages localStorage onboarding state.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ONBOARDED_STORAGE_KEY = "greengoods_onboarded";
const TEST_ROOT_GARDEN = "0xRootGarden11111111111111111111111111111";
const TEST_ADDRESS = "0x1111111111111111111111111111111111111111";

const mockReadContract = vi.fn();

// Use mutable config so individual tests can override rootGarden address
let mockRootGardenAddress: string | undefined = TEST_ROOT_GARDEN;

vi.mock("@wagmi/core", () => ({
  readContract: (...args: unknown[]) => mockReadContract(...args),
}));

vi.mock("../../../config/appkit", () => ({
  getWagmiConfig: () => ({}),
}));

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
  getDefaultChain: () => ({
    chainId: 11155111,
    rootGarden: { address: mockRootGardenAddress },
  }),
}));

vi.mock("../../../config/app", () => ({
  ONBOARDED_STORAGE_KEY,
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../modules/app/error-tracking", () => ({
  trackNetworkError: vi.fn(),
}));

vi.mock("../../../utils/blockchain/contracts", () => ({
  GardenAccountABI: [
    {
      name: "isGardener",
      type: "function",
      inputs: [{ type: "address" }],
      outputs: [{ type: "bool" }],
    },
  ],
}));

vi.mock("../../../utils/errors/contract-errors", () => ({
  isAlreadyGardenerError: vi.fn().mockReturnValue(false),
}));

vi.mock("../../../components/toast", () => ({
  toastService: {
    loading: vi.fn(() => "toast-id"),
    dismiss: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const { checkMembership } = await import("../../../hooks/garden/useAutoJoinRootGarden");

describe("checkMembership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockRootGardenAddress = TEST_ROOT_GARDEN;
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("sets localStorage onboarded flag when isGardener is true", async () => {
    mockReadContract.mockResolvedValue(true);

    const result = await checkMembership(TEST_ADDRESS);

    expect(result.isGardener).toBe(true);
    expect(result.hasBeenOnboarded).toBe(true);

    // Should have set the address-specific onboarded key
    const key = `${ONBOARDED_STORAGE_KEY}:${TEST_ADDRESS.toLowerCase()}`;
    expect(localStorage.getItem(key)).toBe("true");
  });

  it("returns false when rootGarden address is missing", async () => {
    mockRootGardenAddress = undefined;

    const result = await checkMembership(TEST_ADDRESS);

    expect(result.isGardener).toBe(false);
    expect(result.hasBeenOnboarded).toBe(false);
    // readContract should NOT have been called since we bail early
    expect(mockReadContract).not.toHaveBeenCalled();
  });

  it("falls back to false when offline and never onboarded", async () => {
    mockReadContract.mockRejectedValue(new Error("Network error"));

    const result = await checkMembership(TEST_ADDRESS);

    // Never onboarded + network error => fallback to false
    expect(result.isGardener).toBe(false);
    expect(result.hasBeenOnboarded).toBe(false);
  });
});
