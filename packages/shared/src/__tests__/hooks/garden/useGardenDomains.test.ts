/**
 * useGardenDomains Tests
 *
 * Tests the wagmi useReadContract wrapper that reads the gardenDomains
 * bitmask from the ActionRegistry contract.
 */

/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Mocks (must be before imports)
// ============================================

const mockUseReadContract = vi.fn();
vi.mock("wagmi", () => ({
  useReadContract: (options: any) => mockUseReadContract(options),
}));

const mockUseCurrentChain = vi.fn().mockReturnValue(11155111);
vi.mock("../../../hooks/blockchain/useChainConfig", () => ({
  useCurrentChain: () => mockUseCurrentChain(),
}));

vi.mock("../../../utils/blockchain/contracts", () => ({
  ActionRegistryABI: [
    {
      type: "function",
      name: "gardenDomains",
      inputs: [{ name: "garden", type: "address" }],
      outputs: [{ type: "uint8" }],
    },
  ],
  getNetworkContracts: (chainId: number) => ({
    actionRegistry: `0xActionRegistry${chainId}`,
  }),
}));

// ============================================
// Import after mocks
// ============================================

import { useGardenDomains } from "../../../hooks/garden/useGardenDomains";

// ============================================
// Tests
// ============================================

describe("useGardenDomains", () => {
  const GARDEN_ADDRESS = "0x1234567890123456789012345678901234567890" as `0x${string}`;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReadContract.mockReturnValue({ data: undefined, isLoading: false });
  });

  it("passes correct contract address and ABI", () => {
    useGardenDomains(GARDEN_ADDRESS);

    expect(mockUseReadContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: `0xActionRegistry11155111`,
        functionName: "gardenDomains",
      })
    );
  });

  it("passes gardenAddress as args when provided", () => {
    useGardenDomains(GARDEN_ADDRESS);

    const options = mockUseReadContract.mock.calls[0][0];
    expect(options.args).toEqual([GARDEN_ADDRESS]);
  });

  it("passes undefined args when gardenAddress is undefined", () => {
    useGardenDomains(undefined);

    const options = mockUseReadContract.mock.calls[0][0];
    expect(options.args).toBeUndefined();
  });

  it("sets query enabled to true when gardenAddress is provided", () => {
    useGardenDomains(GARDEN_ADDRESS);

    const options = mockUseReadContract.mock.calls[0][0];
    expect(options.query.enabled).toBe(true);
  });

  it("sets query enabled to false when gardenAddress is undefined", () => {
    useGardenDomains(undefined);

    const options = mockUseReadContract.mock.calls[0][0];
    expect(options.query.enabled).toBe(false);
  });

  it("uses chain ID from useCurrentChain", () => {
    mockUseCurrentChain.mockReturnValue(42161);
    useGardenDomains(GARDEN_ADDRESS);

    const options = mockUseReadContract.mock.calls[0][0];
    expect(options.address).toBe("0xActionRegistry42161");
  });
});
