/**
 * useGardenJournal tests: Home's Highlights and Take Part read the garden's own pool the way
 * the garden page and its Pool tab do, so their seasons and promises are the Pool tab's, and
 * a chain without promises reads nothing at all (DL-127, decision 32). Submit Work's one-tap
 * asks (`useTakeUpChoices`) read the same pool through the same take-up rules.
 *
 * @vitest-environment happy-dom
 */

import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTakeUpChoices } from "../../../hooks/commitment-pooling/useTakeUpChoices";
import { useGardenOpenCycles, useGardenOpenPromises } from "../../../hooks/garden/useGardenJournal";
import type {
  CommitmentCycleRecord,
  CommitmentReadModel,
} from "../../../modules/commitment-pooling/types-core";
import type { CommitmentPoolDetail } from "../../../modules/commitment-pooling/types-relations";
import { jobQueueEventBus } from "../../../modules/job-queue/event-bus";
import type { Address } from "../../../types/domain";
import type { Job } from "../../../types/job-queue";
import {
  availableCapability,
  claimFixture,
  commitmentFixture,
  cycleFixture,
  poolFixture,
} from "../../test-utils/commitment-pooling-fixtures";
import { renderHookWithProviders } from "../../test-utils/render-helpers";

const READER = "0xa11ce00000000000000000000000000000000001" as Address;
const NEIGHBOUR = "0xb0b0000000000000000000000000000000000002" as Address;
const GARDEN = "0x5000000000000000000000000000000000000001";

const mocks = vi.hoisted(() => ({
  capability: null as unknown,
  getCommitmentPools: vi.fn(),
  getCommitmentCycles: vi.fn(),
  getCommitments: vi.fn(),
  getPoolClaimRequests: vi.fn(),
  getCommitmentPoolDetail: vi.fn(),
  getJobs: vi.fn(),
}));

// The ontology's chain maturity, the indexer reads and the phone's queue are the edges; the
// pooling hooks, their cache keys and the journal's rules run for real.
vi.mock("../../../ontology/query", () => ({
  getOntologyChainMaturity: () => mocks.capability,
}));

vi.mock("../../../modules/commitment-pooling/data", () => ({
  getCommitmentPools: mocks.getCommitmentPools,
  getCommitmentCycles: mocks.getCommitmentCycles,
  getCommitments: mocks.getCommitments,
  getPoolClaimRequests: mocks.getPoolClaimRequests,
  getCommitmentPoolDetail: mocks.getCommitmentPoolDetail,
}));

vi.mock("../../../modules/job-queue/default-instance", () => ({
  jobQueue: { getJobs: mocks.getJobs },
}));

vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => READER,
}));

const gardenPool = poolFixture({ poolId: 7n, garden: GARDEN as Address });

function promise(id: number, overrides: Partial<CommitmentReadModel> = {}): CommitmentReadModel {
  return commitmentFixture({
    id: `42161-${id}`,
    commitmentId: BigInt(id),
    poolId: 7n,
    // Outside any season: a promise that falls due with its cycle sets cycleId itself, with
    // that cycle read.
    cycleId: null,
    direction: "OFFER",
    onchainState: "OFFERED",
    derivedState: "OFFERED",
    creator: NEIGHBOUR,
    leadProvider: NEIGHBOUR,
    counterparty: null,
    metadataCID: null,
    ...overrides,
  });
}

describe("useGardenJournal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.capability = availableCapability;
    mocks.getCommitmentPools.mockResolvedValue([gardenPool]);
    mocks.getCommitmentCycles.mockResolvedValue([]);
    mocks.getCommitments.mockResolvedValue([]);
    mocks.getPoolClaimRequests.mockResolvedValue([]);
    mocks.getJobs.mockResolvedValue([]);
  });

  it("reads the open seasons and campaigns from the garden's own pool, the season first", async () => {
    mocks.getCommitmentCycles.mockResolvedValue([
      cycleFixture({ id: "c-9", cycleId: 9n, cycleType: "CAMPAIGN", poolId: 7n }),
      cycleFixture({ id: "c-8", cycleId: 8n, cycleType: "CAMPAIGN", state: "RECONCILED" }),
      cycleFixture({ id: "c-7", cycleId: 7n, cycleType: "SEASON", poolId: 7n }),
    ]);

    const { result } = renderHookWithProviders(() => useGardenOpenCycles(GARDEN));

    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    const { state } = result.current;
    expect(state.status === "ready" && state.items.map((item) => item.cycle.id)).toEqual([
      "c-7",
      "c-9",
    ]);
    expect(mocks.getCommitmentPools).toHaveBeenCalledWith(42161, GARDEN);
    expect(mocks.getCommitmentCycles).toHaveBeenCalledWith(
      expect.objectContaining({ chainId: 42161, poolId: 7n })
    );
  });

  it("finds no season in a garden without a pool, and reads no cycles for it", async () => {
    mocks.getCommitmentPools.mockResolvedValue([]);

    const { result } = renderHookWithProviders(() => useGardenOpenCycles(GARDEN));

    await waitFor(() => expect(result.current.state.status).toBe("empty"));
    expect(mocks.getCommitmentCycles).not.toHaveBeenCalled();
  });

  it("says a failed cycles read failed, so no season shows as read", async () => {
    mocks.getCommitmentCycles.mockRejectedValueOnce(new Error("indexer down"));

    const { result } = renderHookWithProviders(() => useGardenOpenCycles(GARDEN));

    await waitFor(() => expect(result.current.state.status).toBe("error"));
  });

  // Home keeps the journal mounted under the pages it opens, so a count read before a day
  // boundary would stand after it (Codex on #1333).
  it("reads the clock again when the section is shown again, so days left pass a day boundary", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-10-26T12:00:00Z"));
      const endsAt = new Date("2026-10-28T06:00:00Z");
      mocks.getCommitmentCycles.mockResolvedValue([
        cycleFixture({
          id: "c-7",
          cycleId: 7n,
          cycleType: "SEASON",
          poolId: 7n,
          state: "OPEN",
          endTime: BigInt(Math.floor(endsAt.getTime() / 1000)),
        }),
      ]);
      const { result, rerender } = renderHookWithProviders(
        ({ shown }: { shown: boolean }) => useGardenOpenCycles(GARDEN, { shown }),
        { initialProps: { shown: true } }
      );
      const daysLeft = () =>
        result.current.state.status === "ready" ? result.current.state.items[0]?.daysLeft : null;
      await waitFor(() => expect(result.current.state.status).toBe("ready"));
      expect(daysLeft()).toBe(2);

      // A page opened under Home, held through the day boundary, then Home shown again.
      rerender({ shown: false });
      vi.setSystemTime(new Date("2026-10-27T12:00:00Z"));
      rerender({ shown: false });
      expect(daysLeft()).toBe(2);
      rerender({ shown: true });
      expect(daysLeft()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("previews three open promises and keeps the newest ask for the carousel past them", async () => {
    mocks.getCommitments.mockResolvedValue([
      promise(14),
      promise(13, { creator: READER, leadProvider: READER }),
      promise(12),
      promise(11),
      promise(10),
      promise(9, { direction: "REQUEST", onchainState: "REQUESTED", derivedState: "REQUESTED" }),
    ]);

    const { result } = renderHookWithProviders(() => useGardenOpenPromises(GARDEN));

    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    const { state, ask } = result.current;
    expect(
      state.status === "ready" &&
        state.items.map((entry) => entry.kind === "single" && entry.row.commitment.commitmentId)
    ).toEqual([14n, 12n, 11n]);
    expect(ask?.kind === "single" && ask.row.commitment.commitmentId).toBe(9n);
    expect(mocks.getCommitments).toHaveBeenCalledWith(
      expect.objectContaining({ chainId: 42161, poolId: 7n })
    );
  });

  it("lists no promise while the garden's pool is paused", async () => {
    mocks.getCommitmentPools.mockResolvedValue([{ ...gardenPool, state: "PAUSED" }]);
    mocks.getCommitments.mockResolvedValue([
      promise(9, { direction: "REQUEST", onchainState: "REQUESTED", derivedState: "REQUESTED" }),
    ]);

    const { result } = renderHookWithProviders(() => useGardenOpenPromises(GARDEN));

    await waitFor(() => expect(result.current.state.status).toBe("empty"));
    expect(result.current.ask).toBeNull();
  });

  it("reads nothing where promises do not run, and says so rather than none", async () => {
    mocks.capability = { ...availableCapability, availability: "unavailable" };

    const cycles = renderHookWithProviders(() => useGardenOpenCycles(GARDEN));
    const promises = renderHookWithProviders(() => useGardenOpenPromises(GARDEN));

    expect(cycles.result.current.state.status).toBe("unavailable");
    expect(promises.result.current.state.status).toBe("unavailable");
    expect(promises.result.current.ask).toBeNull();
    expect(mocks.getCommitmentPools).not.toHaveBeenCalled();
  });

  describe("the reader's own take-ups, for Take Part and the carousel alike", () => {
    const ask = (id: number, claimMode: "OPEN" | "APPROVAL_GATED") =>
      promise(id, {
        direction: "REQUEST",
        onchainState: "REQUESTED",
        derivedState: "REQUESTED",
        claimMode,
      });
    const takeUpOnThisPhone = (id: bigint, failed = false): Job =>
      ({
        id: `claim-${id}`,
        kind: "claim",
        payload: { commitmentId: id, kind: 1, gardenContext: GARDEN, gardenAddress: GARDEN },
        userAddress: READER,
        chainId: 42161,
        createdAt: 1,
        attempts: failed ? 5 : 0,
        ...(failed ? { lastError: "Max retries (5) exceeded" } : {}),
        synced: false,
      }) as Job;
    const ids = (result: { current: ReturnType<typeof useGardenOpenPromises> }) => {
      const { state, ask: carousel } = result.current;
      return {
        takePart:
          state.status === "ready" ? state.items.map((entry) => entry.copy.commitmentId) : [],
        highlights: carousel?.copy.commitmentId ?? null,
      };
    };

    it("leaves out an ask the reader asked for and one they are taking up from this phone", async () => {
      mocks.getCommitments.mockResolvedValue([
        ask(12, "APPROVAL_GATED"),
        ask(11, "OPEN"),
        ask(10, "OPEN"),
      ]);
      mocks.getPoolClaimRequests.mockResolvedValue([
        {
          claim: claimFixture({ commitmentId: 12n, claimant: READER }),
          commitment: ask(12, "APPROVAL_GATED"),
        },
      ]);
      mocks.getJobs.mockResolvedValue([takeUpOnThisPhone(11n)]);

      const { result } = renderHookWithProviders(() => useGardenOpenPromises(GARDEN));

      await waitFor(() => expect(ids(result)).toEqual({ takePart: [10n], highlights: 10n }));
      expect(mocks.getPoolClaimRequests).toHaveBeenCalledWith(
        expect.objectContaining({ chainId: 42161, poolId: 7n, state: "PENDING" })
      );
    });

    it("lists an ask again once the take-up that failed on this phone is discarded", async () => {
      mocks.getCommitments.mockResolvedValue([ask(11, "OPEN")]);
      mocks.getJobs.mockResolvedValue([takeUpOnThisPhone(11n, true)]);

      const { result } = renderHookWithProviders(() => useGardenOpenPromises(GARDEN));

      await waitFor(() => expect(result.current.state.status).toBe("empty"));
      mocks.getJobs.mockResolvedValue([]);
      act(() =>
        jobQueueEventBus.emit("job:failed", {
          jobId: "claim-11",
          job: takeUpOnThisPhone(11n, true),
          error: "discarded",
        })
      );
      await waitFor(() => expect(ids(result)).toEqual({ takePart: [11n], highlights: 11n }));
    });

    it("waits for the reader's requests, and lists by the garden's rule when they cannot be read", async () => {
      mocks.getCommitments.mockResolvedValue([ask(12, "APPROVAL_GATED")]);
      let failRequests: (error: Error) => void = () => undefined;
      mocks.getPoolClaimRequests.mockReturnValue(
        new Promise((_resolve, reject) => {
          failRequests = reject;
        })
      );

      const { result } = renderHookWithProviders(() => useGardenOpenPromises(GARDEN));

      await waitFor(() => expect(mocks.getPoolClaimRequests).toHaveBeenCalled());
      expect(result.current.state.status).toBe("loading");
      act(() => failRequests(new Error("indexer down")));
      // The promise's own page still shows a pending request, so a failed read hides nothing.
      await waitFor(() => expect(ids(result)).toEqual({ takePart: [12n], highlights: 12n }));
    });

    it("waits for the end of an undated ask's cycle, and leaves the ask out once it has passed", async () => {
      const now = BigInt(Math.floor(Date.now() / 1000));
      mocks.getCommitments.mockResolvedValue([
        { ...ask(12, "OPEN"), cycleId: 5n },
        { ...ask(11, "OPEN"), cycleId: 6n },
      ]);
      let readCycles: (cycles: CommitmentCycleRecord[]) => void = () => undefined;
      mocks.getCommitmentCycles.mockReturnValue(
        new Promise((resolve) => {
          readCycles = resolve;
        })
      );

      const { result } = renderHookWithProviders(() => useGardenOpenPromises(GARDEN));

      await waitFor(() => expect(mocks.getCommitmentCycles).toHaveBeenCalled());
      // Without due dates of their own they fall due when their cycles end, not yet read.
      expect(result.current.state.status).toBe("loading");
      act(() =>
        readCycles([
          cycleFixture({ cycleId: 5n, poolId: 7n, endTime: now - 60n }),
          cycleFixture({ cycleId: 6n, poolId: 7n, endTime: now + 86_400n }),
        ])
      );
      await waitFor(() => expect(ids(result)).toEqual({ takePart: [11n], highlights: 11n }));
    });

    it("waits for the take-ups on this phone, and lists nothing it cannot check against them", async () => {
      mocks.getCommitments.mockResolvedValue([ask(11, "OPEN")]);
      let failQueue: (error: Error) => void = () => undefined;
      mocks.getJobs.mockReturnValue(
        new Promise((_resolve, reject) => {
          failQueue = reject;
        })
      );

      const { result } = renderHookWithProviders(() => useGardenOpenPromises(GARDEN));

      await waitFor(() => expect(mocks.getPoolClaimRequests).toHaveBeenCalled());
      await waitFor(() => expect(mocks.getJobs).toHaveBeenCalled());
      expect(result.current.state.status).toBe("loading");
      // Read as empty, the queue would offer again a take-up already on this phone.
      act(() => failQueue(new Error("IndexedDB unavailable")));
      await waitFor(() => expect(result.current.state.status).toBe("error"));
      expect(result.current.ask).toBeNull();
    });
  });

  describe("Submit Work's one-tap asks, read the same way (decision 18)", () => {
    const openAsk = promise(9, {
      direction: "REQUEST",
      onchainState: "REQUESTED",
      derivedState: "REQUESTED",
      claimMode: "OPEN",
      claimType: "INDIVIDUAL",
      requirements: [{ actionUID: 5n, requiredCount: 2 }],
    });
    /** The pool allows two open promises at once per person; the reader holds `open` of them. */
    const readerHolds = (open: bigint): CommitmentPoolDetail => ({
      pool: { ...gardenPool, providerOpenCommitmentCap: 2n },
      unitSummaries: [],
      providerExposures: [
        { provider: READER, openCommitmentCount: open },
      ] as CommitmentPoolDetail["providerExposures"],
    });
    const choices = () =>
      renderHookWithProviders(() =>
        useTakeUpChoices({
          chainId: 42161,
          account: READER,
          workGarden: GARDEN as Address,
          returnGarden: GARDEN as Address,
        })
      );

    beforeEach(() => {
      mocks.getCommitments.mockResolvedValue([openAsk]);
      mocks.getCommitmentPoolDetail.mockResolvedValue(readerHolds(0n));
    });

    it("offers the ask's requirement for the action, to take up before the work", async () => {
      const { result } = choices();

      await waitFor(() =>
        expect(result.current.choices).toEqual([
          expect.objectContaining({ commitmentId: 9n, actionUID: 5, takesUp: true }),
        ])
      );
    });

    it("offers none to a reader who holds as many promises as the pool allows at once", async () => {
      mocks.getCommitmentPoolDetail.mockResolvedValue(readerHolds(2n));
      const { result } = choices();

      await waitFor(() => expect(mocks.getCommitmentPoolDetail).toHaveBeenCalled());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      // The registry would refuse the take-up, and the work composed for it would go nowhere.
      expect(result.current.choices).toEqual([]);
      expect(result.current.asks).toEqual([]);
    });

    it("offers none once the season of an ask without a due date has ended", async () => {
      // The ask carries no due date of its own, so it falls due when its season ends.
      mocks.getCommitments.mockResolvedValue([{ ...openAsk, cycleId: 7n }]);
      mocks.getCommitmentCycles.mockResolvedValue([
        cycleFixture({
          cycleId: 7n,
          poolId: 7n,
          endTime: BigInt(Math.floor(Date.now() / 1000)) - 60n,
        }),
      ]);
      const { result } = choices();

      await waitFor(() => expect(mocks.getCommitmentCycles).toHaveBeenCalled());
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.choices).toEqual([]);
      expect(result.current.asks).toEqual([]);
    });

    it("offers none while the take-ups on this phone cannot be read", async () => {
      mocks.getJobs.mockRejectedValue(new Error("IndexedDB unavailable"));
      const { result } = choices();

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.choices).toEqual([]);
      expect(result.current.asks).toEqual([]);
    });
  });
});
