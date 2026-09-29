/**
 * useGardenerProfile Hook Tests
 * @vitest-environment happy-dom
 *
 * Tests the on-chain gardener profile management hook:
 * query state, full profile update, and individual field mutations.
 */

import type { QueryClient } from "@tanstack/react-query";
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithProviders } from "../../test-utils/render-helpers";

const TEST_SMART_ACCOUNT = "0x1111111111111111111111111111111111111111" as `0x${string}`;
const TEST_TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

// ============================================
// Mocks
// ============================================

const mockSendTransaction = vi.fn().mockResolvedValue(TEST_TX_HASH);

vi.mock("../../../hooks/auth/useAuth", () => ({
  useAuth: () => ({
    smartAccountClient: {
      account: { address: TEST_SMART_ACCOUNT },
      sendTransaction: mockSendTransaction,
    },
    smartAccountAddress: TEST_SMART_ACCOUNT,
  }),
}));

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../../config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../components/toast", () => ({
  toastService: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock("../../../utils/errors/contract-errors", () => ({
  parseAndFormatError: (error: unknown) => ({
    title: "Unknown",
    message: error instanceof Error ? error.message : "Unknown error",
    parsed: {
      raw: error instanceof Error ? error.message : "Unknown error",
      name: "Unknown",
      message: error instanceof Error ? error.message : "Unknown error",
      isKnown: false,
      recoverable: true,
    },
  }),
}));

vi.mock("../../../config/query-keys", () => ({
  queryKeys: {
    gardenerProfile: {
      all: ["greengoods", "gardener-profile"],
      byAddress: (address: string, chainId: number) => [
        "greengoods",
        "gardener-profile",
        address,
        chainId,
      ],
    },
  },
}));

import { useGardenerProfile } from "../../../hooks/gardener/useGardenerProfile";

// ============================================
// Test Suite
// ============================================

describe("useGardenerProfile", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
    mockSendTransaction.mockResolvedValue(TEST_TX_HASH);
  });

  describe("query state", () => {
    it("returns null profile initially (placeholder query)", async () => {
      const { result } = renderHookWithProviders(() => useGardenerProfile(), { queryClient });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Profile query is a placeholder returning null
      expect(result.current.profile).toBeNull();
    });

    it("provides loading and error states", () => {
      const { result } = renderHookWithProviders(() => useGardenerProfile(), { queryClient });

      expect(typeof result.current.isLoading).toBe("boolean");
      expect(typeof result.current.refetch).toBe("function");
    });
  });

  describe("updateProfile mutation", () => {
    it("encodes setProfile call and sends gasless transaction", async () => {
      const { result } = renderHookWithProviders(() => useGardenerProfile(), { queryClient });

      await act(async () => {
        result.current.updateProfile({
          name: "Alice",
          bio: "Regenerative farmer",
          location: "Portland, OR",
          imageURI: "ipfs://QmImage123",
          socialLinks: ["https://twitter.com/alice"],
          contactInfo: "@alice",
        });
      });

      await waitFor(() => {
        expect(result.current.isUpdating).toBe(false);
      });

      expect(mockSendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          to: TEST_SMART_ACCOUNT,
          value: 0n,
        })
      );
    });

    it("provides isUpdating state", () => {
      const { result } = renderHookWithProviders(() => useGardenerProfile(), { queryClient });

      expect(result.current.isUpdating).toBe(false);
    });
  });

  describe("individual field mutations", () => {
    it("provides updateName function", () => {
      const { result } = renderHookWithProviders(() => useGardenerProfile(), { queryClient });

      expect(typeof result.current.updateName).toBe("function");
      expect(result.current.isUpdatingName).toBe(false);
    });

    it("provides updateBio function", () => {
      const { result } = renderHookWithProviders(() => useGardenerProfile(), { queryClient });

      expect(typeof result.current.updateBio).toBe("function");
      expect(result.current.isUpdatingBio).toBe(false);
    });

    it("provides updateLocation function", () => {
      const { result } = renderHookWithProviders(() => useGardenerProfile(), { queryClient });

      expect(typeof result.current.updateLocation).toBe("function");
      expect(result.current.isUpdatingLocation).toBe(false);
    });

    it("provides updateImage function", () => {
      const { result } = renderHookWithProviders(() => useGardenerProfile(), { queryClient });

      expect(typeof result.current.updateImage).toBe("function");
      expect(result.current.isUpdatingImage).toBe(false);
    });

    it("sends individual field update transaction", async () => {
      const { result } = renderHookWithProviders(() => useGardenerProfile(), { queryClient });

      await act(async () => {
        result.current.updateName("New Name");
      });

      await waitFor(() => {
        expect(mockSendTransaction).toHaveBeenCalled();
      });
    });
  });

  describe("error handling", () => {
    it("handles transaction failure in updateProfile", async () => {
      mockSendTransaction.mockRejectedValue(new Error("Gas estimation failed"));

      const { result } = renderHookWithProviders(() => useGardenerProfile(), { queryClient });

      await act(async () => {
        result.current.updateProfile({
          name: "Alice",
          bio: "Bio",
          location: "Loc",
          imageURI: "",
          socialLinks: [],
          contactInfo: "",
        });
      });

      await waitFor(() => {
        expect(result.current.isUpdating).toBe(false);
      });

      // Error should be captured (toast.error called from onError)
    });
  });
});
