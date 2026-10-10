/** @vitest-environment happy-dom */
import { act, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePublicCommitmentImpact } from "../../../hooks/public/usePublicCommitmentImpact";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

const response = {
  version: 1,
  chainId: 42161,
  commitmentsMade: "27",
  commitmentsFulfilled: "12",
  confirmedDisbursementTotal: "8000000000000000000",
  confirmedDisbursementUsdCents: "1234",
  partialData: false,
  unavailableSources: {
    commitmentPools: false,
    confirmedSettlement: false,
    fundingValuation: false,
  },
};
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("public commitment impact transport", () => {
  it("makes one API request and decodes large integer figures without querying history", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://agent.greengoods.app/");
    const fetchSnapshot = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
    vi.stubGlobal("fetch", fetchSnapshot);
    const { result } = renderHookWithQueryClient(() => usePublicCommitmentImpact(42161), {
      queryClient: createTestQueryClient(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.confirmedDisbursementTotal).toBe(8000000000000000000n);
    expect(result.current.data?.confirmedDisbursementUsdCents).toBe(1234n);
    expect(fetchSnapshot).toHaveBeenCalledOnce();
    expect(fetchSnapshot).toHaveBeenCalledWith(
      "https://agent.greengoods.app/public/commitments/42161/impact",
      { signal: expect.any(AbortSignal) }
    );
  });

  it("preserves counts when the server cannot value funding", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...response,
          confirmedDisbursementUsdCents: null,
          partialData: true,
          unavailableSources: { ...response.unavailableSources, fundingValuation: true },
        }),
      })
    );
    const { result } = renderHookWithQueryClient(() => usePublicCommitmentImpact(42161), {
      queryClient: createTestQueryClient(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({
      commitmentsMade: 27n,
      confirmedDisbursementUsdCents: null,
      partialData: true,
    });
  });

  it("retries a partial snapshot after 30 seconds and stops once all figures are available", async () => {
    vi.useFakeTimers();
    const fetchSnapshot = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...response,
          confirmedDisbursementUsdCents: null,
          partialData: true,
          unavailableSources: { ...response.unavailableSources, fundingValuation: true },
        }),
      })
      .mockResolvedValue({ ok: true, json: async () => response });
    vi.stubGlobal("fetch", fetchSnapshot);
    const { result, unmount } = renderHookWithQueryClient(() => usePublicCommitmentImpact(42161), {
      queryClient: createTestQueryClient(),
    });

    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(result.current.data?.partialData).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(29_998));
    expect(fetchSnapshot).toHaveBeenCalledOnce();
    await act(async () => vi.advanceTimersByTimeAsync(2));
    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
    expect(result.current.data?.confirmedDisbursementUsdCents).toBe(1234n);
    expect(result.current.data?.partialData).toBe(false);

    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
    unmount();
  });

  it.each([
    { ok: false, json: async () => response },
    { ok: true, json: async () => ({ ...response, chainId: 11155111 }) },
    { ok: true, json: async () => ({ ...response, commitmentsMade: "-1" }) },
    { ok: true, json: async () => ({ ...response, confirmedDisbursementUsdCents: null }) },
  ])("reports unavailable or malformed responses instead of inventing zeroes", async (wire) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(wire));
    const { result } = renderHookWithQueryClient(() => usePublicCommitmentImpact(42161), {
      queryClient: createTestQueryClient(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
