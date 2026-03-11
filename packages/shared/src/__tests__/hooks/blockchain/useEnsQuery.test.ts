/**
 * useEnsQuery Hook Tests
 * @vitest-environment jsdom
 *
 * Tests the generic ENS query hook that underpins useEnsName, useEnsAddress, etc.
 * Validates input normalization, validator-based enabling, and caching behavior.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock wagmi (some modules may import it transitively)
vi.mock("wagmi", () => ({
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
}));

// Mock appkit config
vi.mock("../../../config/appkit", () => ({
  getWagmiConfig: () => ({}),
}));

import { useEnsQuery } from "../../../hooks/blockchain/useEnsQuery";

// ============================================
// Test helpers
// ============================================

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

// ============================================
// Tests
// ============================================

describe("useEnsQuery", () => {
  let queryClient: QueryClient;
  let mockResolver: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    queryClient = createQueryClient();
    mockResolver = vi.fn();
  });

  // ------------------------------------------
  // Input normalization
  // ------------------------------------------

  describe("input normalization", () => {
    it("lowercases and trims input before resolving", async () => {
      mockResolver.mockResolvedValue("vitalik.eth");

      renderHook(() => useEnsQuery("  0xABCDEF  ", mockResolver, ["test", "ens", "0xabcdef"]), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockResolver).toHaveBeenCalledWith("0xabcdef", {});
      });
    });

    it("does not call resolver when input is null", async () => {
      const { result } = renderHook(
        () => useEnsQuery(null, mockResolver, ["test", "ens", "null"]),
        { wrapper: createWrapper(queryClient) }
      );

      // Query should not be enabled
      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });
      expect(mockResolver).not.toHaveBeenCalled();
    });

    it("does not call resolver when input is undefined", async () => {
      const { result } = renderHook(
        () => useEnsQuery(undefined, mockResolver, ["test", "ens", "undefined"]),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });
      expect(mockResolver).not.toHaveBeenCalled();
    });

    it("does not call resolver when input is empty string", async () => {
      const { result } = renderHook(() => useEnsQuery("", mockResolver, ["test", "ens", "empty"]), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });
      expect(mockResolver).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // Validator
  // ------------------------------------------

  describe("validator", () => {
    it("disables query when validator returns false", async () => {
      const alwaysFalse = vi.fn().mockReturnValue(false);

      const { result } = renderHook(
        () =>
          useEnsQuery("0xabc", mockResolver, ["test", "ens", "invalid"], {
            validator: alwaysFalse,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });
      expect(alwaysFalse).toHaveBeenCalledWith("0xabc");
      expect(mockResolver).not.toHaveBeenCalled();
    });

    it("enables query when validator returns true", async () => {
      const alwaysTrue = vi.fn().mockReturnValue(true);
      mockResolver.mockResolvedValue("resolved-value");

      const { result } = renderHook(
        () =>
          useEnsQuery("0xabc", mockResolver, ["test", "ens", "valid"], {
            validator: alwaysTrue,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.data).toBe("resolved-value");
      });
      expect(alwaysTrue).toHaveBeenCalledWith("0xabc");
      expect(mockResolver).toHaveBeenCalled();
    });

    it("enables query without validator if input is valid", async () => {
      mockResolver.mockResolvedValue("no-validator-result");

      const { result } = renderHook(
        () => useEnsQuery("valid-input", mockResolver, ["test", "ens", "no-validator"]),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.data).toBe("no-validator-result");
      });
    });
  });

  // ------------------------------------------
  // Enabled option override
  // ------------------------------------------

  describe("enabled option", () => {
    it("respects explicit enabled=false even with valid input", async () => {
      const { result } = renderHook(
        () =>
          useEnsQuery("valid-input", mockResolver, ["test", "ens", "disabled"], {
            enabled: false,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });
      expect(mockResolver).not.toHaveBeenCalled();
    });

    it("respects explicit enabled=true even with failing validator", async () => {
      const alwaysFalse = vi.fn().mockReturnValue(false);
      mockResolver.mockResolvedValue("forced-enabled");

      const { result } = renderHook(
        () =>
          useEnsQuery("input", mockResolver, ["test", "ens", "force-enabled"], {
            enabled: true,
            validator: alwaysFalse,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.data).toBe("forced-enabled");
      });
    });
  });

  // ------------------------------------------
  // Resolver behavior
  // ------------------------------------------

  describe("resolver", () => {
    it("returns resolved value on success", async () => {
      mockResolver.mockResolvedValue("resolved-name");

      const { result } = renderHook(
        () => useEnsQuery("0xaddr", mockResolver, ["test", "ens", "success"]),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toBe("resolved-name");
      });
    });

    it("returns null when resolver returns null", async () => {
      mockResolver.mockResolvedValue(null);

      const { result } = renderHook(
        () => useEnsQuery("0xnoname", mockResolver, ["test", "ens", "null-result"]),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toBeNull();
      });
    });

    it("sets error state when resolver rejects", async () => {
      mockResolver.mockRejectedValue(new Error("Network timeout"));

      const { result } = renderHook(
        () => useEnsQuery("0xfail", mockResolver, ["test", "ens", "error"]),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
        expect(result.current.error?.message).toBe("Network timeout");
      });
    });
  });

  // ------------------------------------------
  // Stale time
  // ------------------------------------------

  describe("stale time", () => {
    it("uses default stale time of STALE_TIME_RARE (300_000ms)", async () => {
      mockResolver.mockResolvedValue("cached-value");

      renderHook(() => useEnsQuery("0xaddr", mockResolver, ["test", "ens", "stale-default"]), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(mockResolver).toHaveBeenCalledOnce();
      });

      // Second render should use cache (stale time not elapsed)
      const resolver2 = vi.fn();
      renderHook(() => useEnsQuery("0xaddr", resolver2, ["test", "ens", "stale-default"]), {
        wrapper: createWrapper(queryClient),
      });

      // The second resolver should not be called because data is fresh
      expect(resolver2).not.toHaveBeenCalled();
    });

    it("accepts custom stale time", async () => {
      mockResolver.mockResolvedValue("value");

      renderHook(
        () =>
          useEnsQuery("0xaddr", mockResolver, ["test", "ens", "custom-stale"], {
            staleTime: 1000,
          }),
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(mockResolver).toHaveBeenCalledOnce();
      });
    });
  });
});
