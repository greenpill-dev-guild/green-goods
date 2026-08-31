/** @vitest-environment jsdom */

import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { commitmentPoolingKeys } from "../config/query-keys/commitment-pooling";
import { usePoolFunding } from "../hooks/commitment-pooling/usePoolFunding";
import { createTestQueryClient, renderHookWithProviders } from "./test-utils";

const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const OTHER_GARDEN = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;

const mocks = vi.hoisted(() => ({
  getPoolFundingSnapshot: vi.fn(),
}));

vi.mock("../modules/commitment-pooling/data-pool-funding", () => ({
  getPoolFundingSnapshot: mocks.getPoolFundingSnapshot,
}));

describe("usePoolFunding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPoolFundingSnapshot.mockResolvedValue({
      safe: GARDEN,
      balance: { value: 25n, readAt: 2_000 },
      ledgerReadAt: 1_999,
      available: 20n,
      fundingUnavailableReasons: [],
    });
  });

  it("uses the pool key, a 30-second visible refresh, and no background polling", async () => {
    const queryClient = createTestQueryClient();
    const { result } = renderHookWithProviders(
      () => usePoolFunding({ chainId: 42161, garden: GARDEN }),
      { queryClient }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(
      queryClient.getQueryData(commitmentPoolingKeys.poolFunding(42161, GARDEN))
    ).toMatchObject({
      available: 20n,
    });
    const query = queryClient.getQueryCache().find({
      queryKey: commitmentPoolingKeys.poolFunding(42161, GARDEN),
    });
    const options = query?.options as {
      refetchInterval?: unknown;
      refetchIntervalInBackground?: unknown;
    };
    expect(options.refetchInterval).toBe(30_000);
    expect(options.refetchIntervalInBackground).toBe(false);
    expect(result.current.lastReadAt).toBe(2_000);
    expect(result.current.ledgerReadAt).toBe(1_999);
  });

  it("refetches all hybrid inputs through one manual refresh", async () => {
    const { result } = renderHookWithProviders(() =>
      usePoolFunding({ chainId: 42161, garden: GARDEN })
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await result.current.refetch();
    expect(mocks.getPoolFundingSnapshot).toHaveBeenCalledTimes(2);
  });

  it("retains the last successful balance as stale when a later RPC read fails", async () => {
    mocks.getPoolFundingSnapshot
      .mockResolvedValueOnce({
        safe: GARDEN,
        balance: { value: 25n, readAt: 2_000 },
        ledgerReadAt: 1_999,
        fundingUnavailableReasons: [],
      })
      .mockResolvedValueOnce({
        safe: GARDEN,
        balance: null,
        ledgerReadAt: 2_029,
        fundingUnavailableReasons: ["balance_unreadable"],
      });
    const { result } = renderHookWithProviders(() =>
      usePoolFunding({ chainId: 42161, garden: GARDEN })
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await result.current.refetch();
    await waitFor(() => expect(result.current.hasStaleBalance).toBe(true));
    expect(result.current.snapshot?.balance?.value).toBe(25n);
    expect(result.current.lastReadAt).toBe(2_000);
  });

  it("retains the last successful snapshot when a later header read rejects", async () => {
    mocks.getPoolFundingSnapshot
      .mockResolvedValueOnce({
        safe: GARDEN,
        balance: { value: 25n, readAt: 2_000 },
        ledgerReadAt: 1_999,
        available: 20n,
        fundingUnavailableReasons: [],
      })
      .mockRejectedValueOnce(new Error("header unavailable"));
    const { result } = renderHookWithProviders(() =>
      usePoolFunding({ chainId: 42161, garden: GARDEN })
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    await result.current.refetch();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.snapshot?.balance?.value).toBe(25n);
    expect(result.current.snapshot?.available).toBe(20n);
  });

  it("does not reuse a prior pool's placeholder or retained balance", async () => {
    let resolveOtherGarden: ((value: unknown) => void) | undefined;
    mocks.getPoolFundingSnapshot
      .mockResolvedValueOnce({
        safe: GARDEN,
        balance: { value: 25n, readAt: 2_000 },
        ledgerReadAt: 1_999,
        fundingUnavailableReasons: [],
      })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOtherGarden = resolve;
        })
      );
    const { result, rerender } = renderHookWithProviders(
      ({ garden }: { garden: typeof GARDEN | typeof OTHER_GARDEN }) =>
        usePoolFunding({ chainId: 42161, garden }),
      {
        initialProps: {
          garden: GARDEN as typeof GARDEN | typeof OTHER_GARDEN,
        },
      }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    rerender({ garden: OTHER_GARDEN });
    expect(result.current.snapshot).toBeNull();

    resolveOtherGarden?.({
      safe: OTHER_GARDEN,
      balance: null,
      ledgerReadAt: 2_029,
      fundingUnavailableReasons: ["balance_unreadable"],
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasStaleBalance).toBe(false);
    expect(result.current.snapshot?.balance).toBeNull();
  });
});
