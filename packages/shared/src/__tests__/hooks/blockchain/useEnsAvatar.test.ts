/**
 * useEnsAvatar Hook Tests
 * @vitest-environment jsdom
 *
 * Tests ENS avatar resolution with local caching. Unlike useEnsName/useEnsAddress,
 * this hook uses useQuery directly (not useEnsQuery) because it integrates with
 * the avatar cache for offline support.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================
// Mocks
// ============================================

const mockResolveEnsAvatar = vi.fn();
const mockGetCachedAvatar = vi.fn();
const mockCacheAvatar = vi.fn();

vi.mock("../../../utils/blockchain/ens", () => ({
  resolveEnsAvatar: (...args: unknown[]) => mockResolveEnsAvatar(...args),
}));

vi.mock("../../../utils/storage/avatar-cache", () => ({
  getCachedAvatar: (...args: unknown[]) => mockGetCachedAvatar(...args),
  cacheAvatar: (...args: unknown[]) => mockCacheAvatar(...args),
}));

vi.mock("wagmi", () => ({
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
}));

vi.mock("../../../config/appkit", () => ({
  getWagmiConfig: () => ({}),
}));

import { useEnsAvatar } from "../../../hooks/blockchain/useEnsAvatar";

// ============================================
// Test helpers
// ============================================

const VALID_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as `0x${string}`;
const AVATAR_URL = "https://euc.li/vitalik.eth";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// ============================================
// Tests
// ============================================

describe("useEnsAvatar", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    vi.clearAllMocks();
    mockGetCachedAvatar.mockReturnValue(null);
  });

  // ------------------------------------------
  // Successful fetch from network
  // ------------------------------------------

  describe("network resolution", () => {
    it("fetches avatar from ENS when not in cache", async () => {
      mockResolveEnsAvatar.mockResolvedValue(AVATAR_URL);

      const { result } = renderHook(() => useEnsAvatar(VALID_ADDRESS), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toBe(AVATAR_URL);
      expect(mockResolveEnsAvatar).toHaveBeenCalled();
    });

    it("caches the avatar after fetching from ENS", async () => {
      mockResolveEnsAvatar.mockResolvedValue(AVATAR_URL);

      const { result } = renderHook(() => useEnsAvatar(VALID_ADDRESS), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(mockCacheAvatar).toHaveBeenCalledWith(VALID_ADDRESS.toLowerCase(), AVATAR_URL);
    });

    it("does not cache when avatar is not found", async () => {
      mockResolveEnsAvatar.mockResolvedValue(null);

      const { result } = renderHook(() => useEnsAvatar(VALID_ADDRESS), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toBeNull();
      expect(mockCacheAvatar).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // Cache hit (offline support)
  // ------------------------------------------

  describe("cache behavior", () => {
    it("returns cached avatar without calling ENS resolver", async () => {
      mockGetCachedAvatar.mockReturnValue(AVATAR_URL);

      const { result } = renderHook(() => useEnsAvatar(VALID_ADDRESS), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toBe(AVATAR_URL);
      // resolveEnsAvatar should not be called since cache returned a value
      expect(mockResolveEnsAvatar).not.toHaveBeenCalled();
    });

    it("passes normalized (lowercase) address to cache lookup", async () => {
      mockGetCachedAvatar.mockReturnValue(null);
      mockResolveEnsAvatar.mockResolvedValue(null);

      renderHook(() => useEnsAvatar(VALID_ADDRESS), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockGetCachedAvatar).toHaveBeenCalledWith(VALID_ADDRESS.toLowerCase());
      });
    });
  });

  // ------------------------------------------
  // Disabled states
  // ------------------------------------------

  describe("disabled states", () => {
    it("does not fetch when address is null", async () => {
      const { result } = renderHook(() => useEnsAvatar(null), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });
      expect(mockResolveEnsAvatar).not.toHaveBeenCalled();
      expect(mockGetCachedAvatar).not.toHaveBeenCalled();
    });

    it("does not fetch when address is undefined", async () => {
      const { result } = renderHook(() => useEnsAvatar(undefined), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });
      expect(mockResolveEnsAvatar).not.toHaveBeenCalled();
    });

    it("does not fetch for an invalid address", async () => {
      const { result } = renderHook(() => useEnsAvatar("not-valid" as `0x${string}`), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });
      expect(mockResolveEnsAvatar).not.toHaveBeenCalled();
    });

    it("respects enabled=false option", async () => {
      const { result } = renderHook(() => useEnsAvatar(VALID_ADDRESS, { enabled: false }), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });
      expect(mockResolveEnsAvatar).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // Error handling
  // ------------------------------------------

  describe("error handling", () => {
    it("sets error state when resolver rejects", async () => {
      mockResolveEnsAvatar.mockRejectedValue(new Error("IPFS gateway timeout"));

      const { result } = renderHook(() => useEnsAvatar(VALID_ADDRESS), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
      expect(result.current.error?.message).toBe("IPFS gateway timeout");
    });
  });

  // ------------------------------------------
  // Query key correctness
  // ------------------------------------------

  describe("query key", () => {
    it("caches using lowercase address in query key", async () => {
      mockResolveEnsAvatar.mockResolvedValue(AVATAR_URL);

      renderHook(() => useEnsAvatar(VALID_ADDRESS), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockResolveEnsAvatar).toHaveBeenCalled();
      });

      const cachedData = queryClient.getQueryData([
        "greengoods",
        "ens",
        "avatar",
        VALID_ADDRESS.toLowerCase(),
      ]);
      expect(cachedData).toBe(AVATAR_URL);
    });
  });
});
