/**
 * useEnsQuery Hook Tests
 * @vitest-environment happy-dom
 *
 * Tests the generic ENS query hook that underpins useEnsName, useEnsAddress, etc.
 * Validates input normalization, validator-based enabling, and caching behavior.
 */

import { type QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

// Mock wagmi (some modules may import it transitively)
vi.mock("wagmi", () => ({
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
}));

// Mock appkit config
vi.mock("../../../config/appkit", () => ({
  getWagmiConfig: () => ({}),
}));

import { type UseEnsQueryOptions, useEnsQuery } from "../../../hooks/blockchain/useEnsQuery";

type EnsResolver = (
  normalizedInput: string,
  options?: UseEnsQueryOptions
) => Promise<string | null>;

// ============================================
// Test helpers
// ============================================

// ============================================
// Tests
// ============================================

describe("useEnsQuery", () => {
  let queryClient: QueryClient;
  let mockResolver: ReturnType<typeof vi.fn<EnsResolver>>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    mockResolver = vi.fn<EnsResolver>();
  });

  // ------------------------------------------
  // Input normalization
  // ------------------------------------------

  describe("input normalization", () => {
    it("lowercases and trims input before resolving", async () => {
      mockResolver.mockResolvedValue("vitalik.eth");

      renderHookWithQueryClient(
        () => useEnsQuery("  0xABCDEF  ", mockResolver, ["test", "ens", "0xabcdef"]),
        {
          queryClient,
        }
      );

      await waitFor(() => {
        expect(mockResolver).toHaveBeenCalledWith("0xabcdef", {});
      });
    });

    it("does not call resolver when input is null", async () => {
      const { result } = renderHookWithQueryClient(
        () => useEnsQuery(null, mockResolver, ["test", "ens", "null"]),
        { queryClient }
      );

      // Query should not be enabled
      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });
      expect(mockResolver).not.toHaveBeenCalled();
    });

    it("does not call resolver when input is undefined", async () => {
      const { result } = renderHookWithQueryClient(
        () => useEnsQuery(undefined, mockResolver, ["test", "ens", "undefined"]),
        { queryClient }
      );

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });
      expect(mockResolver).not.toHaveBeenCalled();
    });

    it("does not call resolver when input is empty string", async () => {
      const { result } = renderHookWithQueryClient(
        () => useEnsQuery("", mockResolver, ["test", "ens", "empty"]),
        {
          queryClient,
        }
      );

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

      const { result } = renderHookWithQueryClient(
        () =>
          useEnsQuery("0xabc", mockResolver, ["test", "ens", "invalid"], {
            validator: alwaysFalse,
          }),
        { queryClient }
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

      const { result } = renderHookWithQueryClient(
        () =>
          useEnsQuery("0xabc", mockResolver, ["test", "ens", "valid"], {
            validator: alwaysTrue,
          }),
        { queryClient }
      );

      await waitFor(() => {
        expect(result.current.data).toBe("resolved-value");
      });
      expect(alwaysTrue).toHaveBeenCalledWith("0xabc");
      expect(mockResolver).toHaveBeenCalled();
    });

    it("enables query without validator if input is valid", async () => {
      mockResolver.mockResolvedValue("no-validator-result");

      const { result } = renderHookWithQueryClient(
        () => useEnsQuery("valid-input", mockResolver, ["test", "ens", "no-validator"]),
        { queryClient }
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
      const { result } = renderHookWithQueryClient(
        () =>
          useEnsQuery("valid-input", mockResolver, ["test", "ens", "disabled"], {
            enabled: false,
          }),
        { queryClient }
      );

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });
      expect(mockResolver).not.toHaveBeenCalled();
    });

    it("respects explicit enabled=true even with failing validator", async () => {
      const alwaysFalse = vi.fn().mockReturnValue(false);
      mockResolver.mockResolvedValue("forced-enabled");

      const { result } = renderHookWithQueryClient(
        () =>
          useEnsQuery("input", mockResolver, ["test", "ens", "force-enabled"], {
            enabled: true,
            validator: alwaysFalse,
          }),
        { queryClient }
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

      const { result } = renderHookWithQueryClient(
        () => useEnsQuery("0xaddr", mockResolver, ["test", "ens", "success"]),
        { queryClient }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toBe("resolved-name");
      });
    });

    it("returns null when resolver returns null", async () => {
      mockResolver.mockResolvedValue(null);

      const { result } = renderHookWithQueryClient(
        () => useEnsQuery("0xnoname", mockResolver, ["test", "ens", "null-result"]),
        { queryClient }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toBeNull();
      });
    });

    it("sets error state when resolver rejects", async () => {
      mockResolver.mockRejectedValue(new Error("Network timeout"));

      const { result } = renderHookWithQueryClient(
        () => useEnsQuery("0xfail", mockResolver, ["test", "ens", "error"]),
        { queryClient }
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

      renderHookWithQueryClient(
        () => useEnsQuery("0xaddr", mockResolver, ["test", "ens", "stale-default"]),
        {
          queryClient,
        }
      );

      await waitFor(() => {
        expect(mockResolver).toHaveBeenCalledOnce();
      });

      // Second render should use cache (stale time not elapsed)
      const resolver2 = vi.fn();
      renderHookWithQueryClient(
        () => useEnsQuery("0xaddr", resolver2, ["test", "ens", "stale-default"]),
        {
          queryClient,
        }
      );

      // The second resolver should not be called because data is fresh
      expect(resolver2).not.toHaveBeenCalled();
    });

    it("accepts custom stale time", async () => {
      mockResolver.mockResolvedValue("value");

      renderHookWithQueryClient(
        () =>
          useEnsQuery("0xaddr", mockResolver, ["test", "ens", "custom-stale"], {
            staleTime: 1000,
          }),
        { queryClient }
      );

      await waitFor(() => {
        expect(mockResolver).toHaveBeenCalledOnce();
      });
    });
  });
});
