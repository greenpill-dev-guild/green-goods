/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  warn: vi.fn(),
  getJsonByHash: vi.fn(),
}));

vi.mock("../../../modules/data/graphql-client", () => ({
  greenGoodsIndexer: { query: (...args: unknown[]) => mocks.query(...args) },
}));
vi.mock("../../../modules/app/logger", () => ({
  logger: { warn: (...args: unknown[]) => mocks.warn(...args) },
}));
vi.mock("../../../modules/commitment-pooling/document-store", () => ({
  commitmentDocumentStore: {
    readJson: (...args: unknown[]) => mocks.getJsonByHash(...args),
  },
}));
vi.mock("../../../config/blockchain", () => ({ DEFAULT_CHAIN_ID: 42161 }));

import { usePublicGardenPool } from "../../../hooks/public/usePublicGardenPool";
import { getPublicGardenPool } from "../../../modules/commitment-pooling/data-public-pools";
import type { Address } from "../../../types/domain";

const GARDEN = "0x1111111111111111111111111111111111111111" as Address;
const OTHER_GARDEN = "0x2222222222222222222222222222222222222222" as Address;
const POOL = {
  id: "42161-7",
  chainId: 42161,
  poolId: "7",
  state: "OPEN",
  commitmentsOffered: "8",
  commitmentsAccepted: "7",
  commitmentsFulfilled: "6",
  commitmentsCancelled: "1",
  commitmentsExpired: "0",
  commitmentsDisputed: "0",
  commitmentsDue: "7",
  openCommitmentCount: "1",
  distinctProviderCount: "4",
};

function cycle(cycleId: number, cycleType: string, state: string, endTime: number) {
  return {
    id: `42161-${cycleId}`,
    chainId: 42161,
    cycleId: String(cycleId),
    poolId: "7",
    cycleType,
    state,
    startTime: String(endTime - 10),
    endTime: String(endTime),
    metadataCID: `ipfs://cycle-${cycleId}`,
    commitmentsAccepted: "4",
    commitmentsReadyForConfirmation: "1",
    commitmentsFulfilled: "3",
    commitmentsCancelled: "0",
    commitmentsExpired: "0",
    commitmentsDisputed: "0",
    commitmentsDue: "4",
    openCommitmentCount: state === "OPEN" ? "1" : "0",
  };
}

const POOL_SUMMARY = {
  id: "42161-POOL-7-hours",
  chainId: 42161,
  scope: "POOL",
  scopeId: "7",
  poolId: "7",
  cycleId: null,
  unitLabel: "hours",
  unitLabelHash: "0x01",
  expectedUnits: "10",
  approvedUnits: "8",
  fulfilledUnits: "6",
  openUnits: "2",
  updatedAt: 100,
};

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function objectKeys(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(objectKeys);
  return Object.entries(value).flatMap(([key, child]) => [key, ...objectKeys(child)]);
}

function containsAddressValue(value: unknown): boolean {
  if (typeof value === "string") return /^0x[0-9a-f]{40}$/i.test(value);
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(containsAddressValue);
}

function forbiddenPublicFieldKeys(value: unknown): string[] {
  return objectKeys(value).filter((key) =>
    /^(provider|garden|gardenId|account|address|wallet|token|recipient|source)$|Addresses?$/.test(
      key
    )
  );
}

describe("public commitment pool reader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getJsonByHash.mockImplementation(async (cid: string) => ({
      version: 1,
      name: `Name for ${cid.replace("ipfs://", "")}`,
    }));
    mocks.query.mockImplementation(async (_query, _variables, operation) => {
      if (operation === "getPublicGardenPool") return { data: { CommitmentPool: [POOL] } };
      return {
        data: {
          CommitmentCycle: [
            cycle(10, "SEASON", "OPEN", 50),
            cycle(11, "CAMPAIGN", "OPEN", 55),
            cycle(12, "SEASON", "RECONCILED", 30),
            cycle(13, "CAMPAIGN", "COMPOSTED", 40),
            cycle(14, "CAMPAIGN", "CANCELLED", 60),
          ],
          CommitmentUnitSummary: [
            POOL_SUMMARY,
            {
              ...POOL_SUMMARY,
              id: "42161-CYCLE-10-hours",
              scope: "CYCLE",
              scopeId: "10",
              cycleId: "10",
            },
            {
              ...POOL_SUMMARY,
              id: "42161-CYCLE-14-hours",
              scope: "CYCLE",
              scopeId: "14",
              cycleId: "14",
            },
          ],
        },
      };
    });
  });

  it("returns only public aggregates and never selects provider exposure", async () => {
    const result = await getPublicGardenPool(42161, GARDEN);
    const documents = mocks.query.mock.calls.map(([document]) => document).join("\n");

    expect(documents).not.toContain("CommitmentProviderExposure");
    expect(forbiddenPublicFieldKeys(result)).toEqual([]);
    expect(
      forbiddenPublicFieldKeys({
        wallet: "redacted",
        token: "USDC",
        recipient: "private",
        source: "internal",
      })
    ).toEqual(["wallet", "token", "recipient", "source"]);
    expect(containsAddressValue(result)).toBe(false);
    expect(result?.openSeason?.cycleId).toBe(10n);
    expect(result?.openSeason?.name).toBe("Name for cycle-10");
    expect(result?.openSeason).not.toHaveProperty("metadataCID");
    expect(result?.openCampaigns.map((entry) => entry.cycleId)).toEqual([11n]);
    expect(result?.finishedCycles.map((entry) => entry.cycleId)).toEqual([13n, 12n]);
    expect(result?.cycleUnitSummaries.map((entry) => entry.cycleId)).toEqual([10n]);
    expect(result?.pool.distinctProviderCount).toBe(4n);
  });

  it("limits cycle metadata reads while preserving finished-cycle order", async () => {
    const indexedCycles = Array.from({ length: 10 }, (_, index) =>
      cycle(10 + index, "SEASON", "RECONCILED", 100 + index)
    );
    mocks.query.mockImplementation(async (_query, _variables, operation) => {
      if (operation === "getPublicGardenPool") return { data: { CommitmentPool: [POOL] } };
      return { data: { CommitmentCycle: indexedCycles, CommitmentUnitSummary: [] } };
    });
    let activeReads = 0;
    let maxActiveReads = 0;
    mocks.getJsonByHash.mockImplementation(async (cid: string) => {
      activeReads += 1;
      maxActiveReads = Math.max(maxActiveReads, activeReads);
      await new Promise((resolve) => setTimeout(resolve, 5));
      activeReads -= 1;
      return { version: 1, name: `Name for ${cid.replace("ipfs://", "")}` };
    });

    const result = await getPublicGardenPool(42161, GARDEN);

    expect(maxActiveReads).toBeLessThanOrEqual(4);
    expect(result?.finishedCycles.map((entry) => entry.cycleId)).toEqual([
      19n,
      18n,
      17n,
      16n,
      15n,
      14n,
      13n,
      12n,
      11n,
      10n,
    ]);
  });
});

describe("usePublicGardenPool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.mockImplementation(async (_query, _variables, operation) => {
      if (operation === "getPublicGardenPool") return { data: { CommitmentPool: [POOL] } };
      return { data: { CommitmentCycle: [], CommitmentUnitSummary: [] } };
    });
  });

  it("resolves metadata only for the requested history window and reports the total", async () => {
    const open = cycle(40, "SEASON", "OPEN", 200);
    const finished = Array.from({ length: 30 }, (_, index) =>
      cycle(10 + index, "SEASON", "RECONCILED", 100 + index)
    );
    mocks.query.mockImplementation(async (_query, _variables, operation) => {
      if (operation === "getPublicGardenPool") return { data: { CommitmentPool: [POOL] } };
      return { data: { CommitmentCycle: [open, ...finished], CommitmentUnitSummary: [] } };
    });

    const firstPage = await getPublicGardenPool(42161, GARDEN, { historyLimit: 12 });
    // Open cycles always resolve; only the newest twelve finished ones do.
    expect(mocks.getJsonByHash).toHaveBeenCalledTimes(13);
    expect(firstPage?.openSeason?.cycleId).toBe(40n);
    expect(firstPage?.finishedCycles).toHaveLength(12);
    expect(firstPage?.finishedCycles[0]?.cycleId).toBe(39n);
    expect(firstPage?.finishedCycles[11]?.cycleId).toBe(28n);
    expect(firstPage?.finishedCycleTotal).toBe(30);

    mocks.getJsonByHash.mockClear();
    const widened = await getPublicGardenPool(42161, GARDEN, { historyLimit: 24 });
    expect(mocks.getJsonByHash).toHaveBeenCalledTimes(25);
    expect(widened?.finishedCycles).toHaveLength(24);
    expect(widened?.finishedCycleTotal).toBe(30);

    // The default window is the public page size, so a caller that passes
    // nothing still never resolves an unbounded history.
    mocks.getJsonByHash.mockClear();
    const defaulted = await getPublicGardenPool(42161, GARDEN);
    expect(defaulted?.finishedCycles).toHaveLength(12);
  });

  it("distinguishes an empty garden from an unavailable indexer read", async () => {
    mocks.query.mockResolvedValueOnce({ data: { CommitmentPool: [] } });
    const emptyClient = createQueryClient();
    const empty = renderHook(() => usePublicGardenPool(GARDEN), {
      wrapper: createWrapper(emptyClient),
    });
    await waitFor(() => expect(empty.result.current.isSuccess).toBe(true));
    expect(empty.result.current.data).toMatchObject({
      pool: null,
      partialData: false,
      unavailableSources: { commitmentPool: false },
    });

    mocks.query.mockResolvedValueOnce({ error: new Error("hosted indexer unavailable") });
    const unavailableClient = createQueryClient();
    const unavailable = renderHook(() => usePublicGardenPool(GARDEN), {
      wrapper: createWrapper(unavailableClient),
    });
    await waitFor(() => expect(unavailable.result.current.isSuccess).toBe(true));
    expect(unavailable.result.current.data).toMatchObject({
      pool: null,
      partialData: true,
      unavailableSources: { commitmentPool: true },
    });
    expect(mocks.warn).toHaveBeenCalledOnce();
  });

  it("keeps the last successful record when a background refresh fails", async () => {
    const queryClient = createQueryClient();
    const hook = renderHook(() => usePublicGardenPool(GARDEN), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(hook.result.current.data?.pool?.commitmentsFulfilled).toBe(6n);

    // The indexer goes away for the refresh only. The page already holds a
    // real record, so the refresh rejects and Query keeps that record rather
    // than swapping it for the unavailable shape.
    mocks.query.mockResolvedValue({ error: new Error("transient indexer failure") });
    await hook.result.current.refetch();
    await waitFor(() => expect(hook.result.current.isError).toBe(true));
    expect(hook.result.current.data?.pool?.commitmentsFulfilled).toBe(6n);
    expect(hook.result.current.data?.unavailableSources.commitmentPool).toBe(false);
  });

  it("reports a commitment-bundled certificate only when the indexer returns one", async () => {
    const withLinkage = await getPublicGardenPool(42161, GARDEN);
    // Default mock answers the linkage operation with no `Hypercert` rows.
    expect(withLinkage?.hasCommitmentCertificates).toBe(false);
    const documents = mocks.query.mock.calls.map(([document]) => document).join("\n");
    expect(documents).toContain("bundleKind: { _eq: COMMITMENT }");
    expect(documents).toContain("limit: 1");

    mocks.query.mockImplementation(async (_query, _variables, operation) => {
      if (operation === "getPublicGardenPool") return { data: { CommitmentPool: [POOL] } };
      if (operation === "getPublicGardenCommitmentCertificates") {
        return { data: { Hypercert: [{ id: "42161-7" }] } };
      }
      return { data: { CommitmentCycle: [], CommitmentUnitSummary: [] } };
    });
    const linked = await getPublicGardenPool(42161, GARDEN);
    expect(linked?.hasCommitmentCertificates).toBe(true);
    expect(containsAddressValue(linked)).toBe(false);

    // A failed linkage read cannot prove an anchor: it answers "no" and the
    // pool record stays publishable.
    mocks.query.mockImplementation(async (_query, _variables, operation) => {
      if (operation === "getPublicGardenPool") return { data: { CommitmentPool: [POOL] } };
      if (operation === "getPublicGardenCommitmentCertificates") {
        return { error: new Error("bundleKind not in hosted schema") };
      }
      return { data: { CommitmentCycle: [], CommitmentUnitSummary: [] } };
    });
    const unproven = await getPublicGardenPool(42161, GARDEN);
    expect(unproven?.pool.commitmentsFulfilled).toBe(6n);
    expect(unproven?.hasCommitmentCertificates).toBe(false);
  });

  it("reports an unavailable cycle name without discarding indexed cycle data", async () => {
    mocks.query.mockImplementation(async (_query, _variables, operation) => {
      if (operation === "getPublicGardenPool") return { data: { CommitmentPool: [POOL] } };
      return {
        data: {
          CommitmentCycle: [cycle(10, "SEASON", "OPEN", 50)],
          CommitmentUnitSummary: [],
        },
      };
    });
    mocks.getJsonByHash.mockRejectedValue(new Error("IPFS unavailable"));

    const queryClient = createQueryClient();
    const result = renderHook(() => usePublicGardenPool(GARDEN), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(result.result.current.isSuccess).toBe(true));

    expect(result.result.current.data).toMatchObject({
      openSeason: { cycleId: 10n, name: null, nameUnavailable: true },
      partialData: true,
      unavailableSources: { commitmentPool: false, cycleMetadata: true },
    });
  });

  it("keeps the current window on screen while a wider one loads for the same garden", async () => {
    const finished = Array.from({ length: 20 }, (_, index) =>
      cycle(10 + index, "SEASON", "RECONCILED", 100 + index)
    );
    mocks.query.mockImplementation(async (_query, _variables, operation) => {
      if (operation === "getPublicGardenPool") return { data: { CommitmentPool: [POOL] } };
      return { data: { CommitmentCycle: finished, CommitmentUnitSummary: [] } };
    });
    const queryClient = createQueryClient();
    const { result, rerender } = renderHook(
      ({ historyLimit }) => usePublicGardenPool(GARDEN, { historyLimit }),
      { initialProps: { historyLimit: 12 }, wrapper: createWrapper(queryClient) }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.finishedCycles).toHaveLength(12);

    rerender({ historyLimit: 24 });
    // The re-keyed query shows the twelve it already has rather than a
    // skeleton, and says so through isPlaceholderData.
    expect(result.current.data?.finishedCycles).toHaveLength(12);
    expect(result.current.isPlaceholderData).toBe(true);
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
    expect(result.current.data?.finishedCycles).toHaveLength(20);
    expect(result.current.data?.finishedCycleTotal).toBe(20);
  });

  it("never carries a previous garden's data across a query-key switch", async () => {
    let resolveOtherGarden: (value: { data: { CommitmentPool: never[] } }) => void = () => {};
    const otherGardenResult = new Promise<{ data: { CommitmentPool: never[] } }>((resolve) => {
      resolveOtherGarden = resolve;
    });

    mocks.query.mockImplementation(async (_query, variables, operation) => {
      if (
        operation === "getPublicGardenPool" &&
        (variables as { garden?: string }).garden === OTHER_GARDEN.toLowerCase()
      ) {
        return otherGardenResult;
      }
      if (operation === "getPublicGardenPool") return { data: { CommitmentPool: [POOL] } };
      return { data: { CommitmentCycle: [], CommitmentUnitSummary: [] } };
    });

    const queryClient = createQueryClient();
    const { result, rerender } = renderHook(
      ({ gardenAddress }) => usePublicGardenPool(gardenAddress),
      {
        initialProps: { gardenAddress: GARDEN },
        wrapper: createWrapper(queryClient),
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pool?.poolId).toBe(7n);

    rerender({ gardenAddress: OTHER_GARDEN });

    expect(result.current.data).toBeUndefined();
    resolveOtherGarden({ data: { CommitmentPool: [] } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pool).toBeNull();
  });
});
