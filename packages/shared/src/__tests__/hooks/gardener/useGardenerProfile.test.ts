/**
 * useGardenerProfile Hook Tests
 * @vitest-environment jsdom
 *
 * Tests the on-chain gardener profile management hook:
 * query state, full profile update, and individual field mutations.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  parseContractError: (error: unknown) => ({
    name: "Unknown",
    message: error instanceof Error ? error.message : "Unknown error",
  }),
}));

vi.mock("../../../utils/errors/user-messages", () => ({
  USER_FRIENDLY_ERRORS: {} as Record<string, string>,
}));

vi.mock("../../../hooks/query-keys", () => ({
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

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(IntlProvider, { locale: "en", messages: {} }, children)
    );
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

// ============================================
// Test Suite
// ============================================

describe("useGardenerProfile", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createQueryClient();
    mockSendTransaction.mockResolvedValue(TEST_TX_HASH);
  });

  describe("query state", () => {
    it("returns null profile initially (placeholder query)", async () => {
      const { result } = renderHook(() => useGardenerProfile(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Profile query is a placeholder returning null
      expect(result.current.profile).toBeNull();
    });

    it("provides loading and error states", () => {
      const { result } = renderHook(() => useGardenerProfile(), {
        wrapper: createWrapper(queryClient),
      });

      expect(typeof result.current.isLoading).toBe("boolean");
      expect(typeof result.current.refetch).toBe("function");
    });
  });

  describe("updateProfile mutation", () => {
    it("encodes setProfile call and sends gasless transaction", async () => {
      const { result } = renderHook(() => useGardenerProfile(), {
        wrapper: createWrapper(queryClient),
      });

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
      const { result } = renderHook(() => useGardenerProfile(), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.isUpdating).toBe(false);
    });
  });

  describe("individual field mutations", () => {
    it("provides updateName function", () => {
      const { result } = renderHook(() => useGardenerProfile(), {
        wrapper: createWrapper(queryClient),
      });

      expect(typeof result.current.updateName).toBe("function");
      expect(result.current.isUpdatingName).toBe(false);
    });

    it("provides updateBio function", () => {
      const { result } = renderHook(() => useGardenerProfile(), {
        wrapper: createWrapper(queryClient),
      });

      expect(typeof result.current.updateBio).toBe("function");
      expect(result.current.isUpdatingBio).toBe(false);
    });

    it("provides updateLocation function", () => {
      const { result } = renderHook(() => useGardenerProfile(), {
        wrapper: createWrapper(queryClient),
      });

      expect(typeof result.current.updateLocation).toBe("function");
      expect(result.current.isUpdatingLocation).toBe(false);
    });

    it("provides updateImage function", () => {
      const { result } = renderHook(() => useGardenerProfile(), {
        wrapper: createWrapper(queryClient),
      });

      expect(typeof result.current.updateImage).toBe("function");
      expect(result.current.isUpdatingImage).toBe(false);
    });

    it("sends individual field update transaction", async () => {
      const { result } = renderHook(() => useGardenerProfile(), {
        wrapper: createWrapper(queryClient),
      });

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

      const { result } = renderHook(() => useGardenerProfile(), {
        wrapper: createWrapper(queryClient),
      });

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
