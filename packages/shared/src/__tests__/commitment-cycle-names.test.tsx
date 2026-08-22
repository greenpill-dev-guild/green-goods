/** @vitest-environment jsdom */

/**
 * useCommitmentCycleNames — the words behind a cycle's metadata CID.
 *
 * A season is named by its stewards, and the record carries only a CID. The
 * hook resolves each distinct CID once, keyed by the cycle it belongs to, and
 * tells a missing name apart from an unreachable one so the rail never prints
 * an absence as a failure.
 */

import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderHookWithProviders } from "./test-utils";

const mocks = vi.hoisted(() => ({ resolveCycleMetadataName: vi.fn() }));

vi.mock("../modules/commitment-pooling/cycle-metadata", () => ({
  resolveCycleMetadataName: mocks.resolveCycleMetadataName,
}));

const { useCommitmentCycleNames } = await import(
  "../hooks/commitment-pooling/useCommitmentCycleNames"
);

const cycle = (cycleId: bigint, metadataCID: string | null) => ({ cycleId, metadataCID });

describe("useCommitmentCycleNames", () => {
  beforeEach(() => {
    mocks.resolveCycleMetadataName.mockReset();
  });

  it("resolves each cycle's name by its own id", async () => {
    mocks.resolveCycleMetadataName.mockImplementation(async (cid: string) =>
      cid === "bafy-spring"
        ? { status: "resolved", name: "Spring planting" }
        : { status: "resolved", name: "Harvest push" }
    );
    const { result } = renderHookWithProviders(() =>
      useCommitmentCycleNames([cycle(1n, "bafy-spring"), cycle(2n, "bafy-harvest")])
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.byCycleId.get("1")).toEqual({
      status: "resolved",
      name: "Spring planting",
    });
    expect(result.current.byCycleId.get("2")).toEqual({
      status: "resolved",
      name: "Harvest push",
    });
  });

  it("spends no request on a cycle with nothing to resolve, and says so", async () => {
    const { result } = renderHookWithProviders(() => useCommitmentCycleNames([cycle(3n, null)]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mocks.resolveCycleMetadataName).not.toHaveBeenCalled();
    expect(result.current.byCycleId.get("3")).toEqual({ status: "missing", name: null });
  });

  it("reads one CID once when two cycles share it", async () => {
    mocks.resolveCycleMetadataName.mockResolvedValue({ status: "resolved", name: "Shared" });
    const { result } = renderHookWithProviders(() =>
      useCommitmentCycleNames([cycle(4n, "bafy-same"), cycle(5n, "bafy-same")])
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mocks.resolveCycleMetadataName).toHaveBeenCalledTimes(1);
    expect(result.current.byCycleId.get("5")?.name).toBe("Shared");
  });

  it("keeps an unreachable name distinct from a missing one", async () => {
    mocks.resolveCycleMetadataName.mockResolvedValue({ status: "unavailable", name: null });
    const { result } = renderHookWithProviders(() =>
      useCommitmentCycleNames([cycle(6n, "bafy-gone")])
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.byCycleId.get("6")).toEqual({ status: "unavailable", name: null });
  });
});
