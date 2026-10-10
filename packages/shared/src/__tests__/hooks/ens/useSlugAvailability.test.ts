/**
 * useSlugAvailability Hook Tests
 *
 * Tests the debounced RPC availability check for ENS slugs across L2 and L1.
 * This is tier 2 of the three-tier validation pipeline:
 *   1. Sync Zod (instant) — useSlugForm
 *   2. Debounced RPC (300ms) — this hook
 *   3. On-submit recheck — useENSClaim
 */

import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

// ============================================================================
// MOCKS
// ============================================================================

const mockReadContract = vi.fn();
const ENS_ADDRESS = "0xENSContract000000000000000000000000000001";
const L1_RECEIVER_ADDRESS = "0xReceiver0000000000000000000000000000000001";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

vi.mock("../../../utils/blockchain/contracts", () => ({
  GreenGoodsENSABI: [
    { name: "available", type: "function", inputs: [{ name: "slug", type: "string" }] },
    { name: "l1Receiver", type: "function", inputs: [] },
  ],
  getNetworkContracts: vi.fn(() => ({
    greenGoodsENS: ENS_ADDRESS,
  })),
  createClients: vi.fn(() => ({
    publicClient: {
      readContract: mockReadContract,
    },
  })),
}));

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../../config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

// Mock useDebouncedValue to return value immediately for test determinism
vi.mock("../../../hooks/utils/useDebouncedValue", () => ({
  useDebouncedValue: vi.fn((value: unknown) => value),
}));

// Import after mocks
import { useSlugAvailability } from "../../../hooks/ens/useSlugAvailability";

// ============================================================================
// TESTS
// ============================================================================

describe("useSlugAvailability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadContract.mockImplementation(({ functionName }) => {
      if (functionName === "available") return Promise.resolve(true);
      if (functionName === "l1Receiver") return Promise.resolve(L1_RECEIVER_ADDRESS);
      return Promise.resolve(undefined);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("disabled conditions", () => {
    it("does not fetch when slug is undefined", () => {
      const { result } = renderHookWithQueryClient(() => useSlugAvailability(undefined));

      expect(result.current.fetchStatus).toBe("idle");
      expect(mockReadContract).not.toHaveBeenCalled();
    });

    it("does not fetch when slug is empty string", () => {
      const { result } = renderHookWithQueryClient(() => useSlugAvailability(""));

      expect(result.current.fetchStatus).toBe("idle");
      expect(mockReadContract).not.toHaveBeenCalled();
    });

    it("does not fetch for invalid slug format", () => {
      // "AB" is invalid: too short and uppercase
      const { result } = renderHookWithQueryClient(() => useSlugAvailability("AB"));

      expect(result.current.fetchStatus).toBe("idle");
      expect(mockReadContract).not.toHaveBeenCalled();
    });

    it("does not fetch when ENS module not configured (zero address)", async () => {
      const { getNetworkContracts } = await import("../../../utils/blockchain/contracts");
      (getNetworkContracts as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        greenGoodsENS: ZERO_ADDRESS,
      });

      const { result } = renderHookWithQueryClient(() => useSlugAvailability("alice"));

      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("availability results", () => {
    it("returns true when slug is available on L2 and L1", async () => {
      const { result } = renderHookWithQueryClient(() => useSlugAvailability("alice"));

      await waitFor(() => expect(result.current.data).toBe(true));
    });

    it("returns false when slug is taken on L2", async () => {
      mockReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "available") return Promise.resolve(false);
        return Promise.resolve(undefined);
      });

      const { result } = renderHookWithQueryClient(() => useSlugAvailability("bob"));

      await waitFor(() => expect(result.current.data).toBe(false));
    });

    it("returns false when slug is available on L2 but taken on L1", async () => {
      const availabilityResponses = [true, false];
      mockReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "available") {
          return Promise.resolve(availabilityResponses.shift());
        }
        if (functionName === "l1Receiver") return Promise.resolve(L1_RECEIVER_ADDRESS);
        return Promise.resolve(undefined);
      });

      const { result } = renderHookWithQueryClient(() => useSlugAvailability("carol"));

      await waitFor(() => expect(result.current.data).toBe(false));
    });

    it("returns false when the L1 receiver is not configured", async () => {
      mockReadContract.mockImplementation(({ functionName }) => {
        if (functionName === "available") return Promise.resolve(true);
        if (functionName === "l1Receiver") return Promise.resolve(ZERO_ADDRESS);
        return Promise.resolve(undefined);
      });

      const { result } = renderHookWithQueryClient(() => useSlugAvailability("dave"));

      await waitFor(() => expect(result.current.data).toBe(false));
    });

    it("calls both availability checks with the slug", async () => {
      renderHookWithQueryClient(() => useSlugAvailability("my-garden"));

      await waitFor(() =>
        expect(mockReadContract).toHaveBeenCalledWith(
          expect.objectContaining({
            functionName: "available",
            args: ["my-garden"],
          })
        )
      );
      await waitFor(() => {
        const availabilityCalls = mockReadContract.mock.calls.filter(
          ([call]) => call.functionName === "available"
        );
        expect(availabilityCalls).toHaveLength(2);
      });
    });
  });
});
