/** @vitest-environment happy-dom */
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hypercertsKeys } from "../../../config/query-keys/hypercert";
import { usePublicGardenHypercerts } from "../../../hooks/public/usePublicGardenHypercerts";
import type { HypercertRecord } from "../../../types/hypercerts";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

const mocks = vi.hoisted(() => ({ read: vi.fn(), hydrate: vi.fn() }));
vi.mock("../../../hooks/public/publicReportingRecords", () => ({
  getPublicGardenHypercerts: (...args: unknown[]) => mocks.read(...args),
}));
vi.mock("../../../modules/data/hypercerts-fetch", () => ({
  hydrateHypercertRecords: (...args: unknown[]) => mocks.hydrate(...args),
}));

const gardenId = "0xf401f34378384713222d1d21f63359cc4e8a858a";
const record: HypercertRecord = {
  id: "real",
  tokenId: 1n,
  gardenId,
  metadataUri: "ipfs://real",
  mintedAt: 1,
  mintedBy: "0x1234",
  txHash: "0x1234",
  totalUnits: 10n,
  claimedUnits: 0n,
  attestationCount: 1,
  status: "active",
  allowlistEntries: [],
};

describe("public garden certificates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.read.mockResolvedValue([record]);
    mocks.hydrate.mockResolvedValue({
      real: { title: "Community work", id: "qa", totalUnits: 999n },
    });
  });

  it("uses the public read even with a fresh operational cache and preserves indexed identity", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryDefaults(hypercertsKeys.list(gardenId, 42161), { gcTime: Infinity });
    queryClient.setQueryData(hypercertsKeys.list(gardenId, 42161), [{ ...record, id: "qa" }]);
    const { result } = renderHookWithQueryClient(
      () => usePublicGardenHypercerts({ gardenId, chainId: 42161 }),
      { queryClient }
    );
    await waitFor(() => expect(result.current.hypercerts[0]?.title).toBe("Community work"));
    expect(result.current.hypercerts[0]).toMatchObject({
      id: "real",
      totalUnits: 10n,
      title: "Community work",
    });
    expect(mocks.read).toHaveBeenCalledWith(gardenId, 42161);
    expect(queryClient.getQueryData(hypercertsKeys.list(gardenId, 42161))).toEqual([
      { ...record, id: "qa" },
    ]);
  });

  it("renders indexed certificates while metadata is stalled and enriches them when it arrives", async () => {
    let resolveMetadata!: (value: Record<string, Partial<HypercertRecord>>) => void;
    mocks.hydrate.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMetadata = resolve;
        })
    );
    const { result } = renderHookWithQueryClient(() =>
      usePublicGardenHypercerts({ gardenId, chainId: 42161 })
    );
    await waitFor(() => expect(mocks.hydrate).toHaveBeenCalledOnce());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hypercerts[0]).toMatchObject({ id: "real", totalUnits: 10n });
    resolveMetadata({ real: { title: "Arrived later", id: "qa", totalUnits: 999n } });
    await waitFor(() => expect(result.current.hypercerts[0]?.title).toBe("Arrived later"));
    expect(result.current.hypercerts[0]).toMatchObject({ id: "real", totalUnits: 10n });
  });

  it("retains indexed certificates when optional metadata fails", async () => {
    mocks.hydrate.mockRejectedValue(new Error("gateway offline"));
    const { result } = renderHookWithQueryClient(() =>
      usePublicGardenHypercerts({ gardenId, chainId: 42161 })
    );
    await waitFor(() => expect(mocks.hydrate).toHaveBeenCalledOnce());
    expect(result.current.hypercerts[0]?.id).toBe("real");
    expect(result.current.hasError).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it("withholds certificates on eligibility failure without falling back to operational data", async () => {
    mocks.read.mockRejectedValue(new Error("classification unavailable"));
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(hypercertsKeys.list(gardenId, 42161), [record]);
    const { result } = renderHookWithQueryClient(
      () => usePublicGardenHypercerts({ gardenId, chainId: 42161 }),
      { queryClient }
    );
    await waitFor(() => expect(result.current.hasError).toBe(true));
    expect(result.current.hypercerts).toEqual([]);
    expect(mocks.hydrate).not.toHaveBeenCalled();
  });

  it("does not read certificates without a garden", () => {
    renderHookWithQueryClient(() => usePublicGardenHypercerts({ chainId: 42161 }));
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("does not show the previous chain's certificates while the next chain loads", async () => {
    const { result, rerender } = renderHookWithQueryClient(
      ({ chainId }) => usePublicGardenHypercerts({ gardenId, chainId }),
      { initialProps: { chainId: 42161 } }
    );
    await waitFor(() => expect(result.current.hypercerts[0]?.id).toBe("real"));
    mocks.read.mockImplementation(() => new Promise(() => {}));
    rerender({ chainId: 11155111 });
    expect(result.current.hypercerts).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    expect(mocks.read).toHaveBeenLastCalledWith(gardenId, 11155111);
  });
});
