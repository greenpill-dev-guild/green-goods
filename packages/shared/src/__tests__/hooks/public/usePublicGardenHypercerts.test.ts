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
    await waitFor(() => expect(result.current.hypercerts).toHaveLength(1));
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
});
