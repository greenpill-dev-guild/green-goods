/** @vitest-environment happy-dom */

import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCommitmentsInbox } from "../hooks/commitment-pooling/useCommitmentsInbox";
import { renderHookWithProviders } from "./test-utils/render-helpers";

const VIEWER = "0x1111111111111111111111111111111111111111" as const;
const OTHER = "0x2222222222222222222222222222222222222222" as const;
const GARDEN_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const GARDEN_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;

const EMPTY_QUEUE = {
  failedCount: 0,
  failedCommitmentIds: new Set<string>(),
  hasPendingCreate: false,
  pendingCreates: [] as Array<{ jobId: string; poolId: string; failed: boolean }>,
  isUnavailable: false,
};

const mocks = vi.hoisted(() => ({
  capability: {
    deployment: "deployed",
    activation: "active",
    integration: "integrated",
    availability: "available",
    evidence: [],
    verified_at: "2026-08-16",
  } as unknown,
  getCommitments: vi.fn(),
  getCommitmentPools: vi.fn(),
  queue: {} as Record<string, unknown>,
}));

vi.mock("../ontology/query", () => ({
  getOntologyChainMaturity: () => mocks.capability,
}));

vi.mock("../modules/commitment-pooling/data", () => ({
  getCommitments: mocks.getCommitments,
  getCommitmentPools: mocks.getCommitmentPools,
}));

vi.mock("../hooks/commitment-pooling/useCommitmentQueueState", () => ({
  useCommitmentQueueState: () => mocks.queue,
}));

/** Whether a list scoped to garden A shows something naming these gardens. */
const inGardenA = (gardens: readonly (string | null | undefined)[]) =>
  gardens.some((garden) => garden?.toLowerCase() === GARDEN_A);

const ids = (rows: { commitment: { id: string } }[]) => rows.map((row) => row.commitment.id);

function commitment(overrides: Record<string, unknown> = {}) {
  return {
    id: "42161-9",
    chainId: 42161,
    commitmentId: 9n,
    creationSeen: true,
    onchainState: "ACCEPTED",
    derivedState: "ACTIVE",
    state: "ACCEPTED",
    approvedUnits: 0n,
    evidenceCount: 0,
    cycleId: null,
    declaredUnitValue: null,
    declaredValueBasis: null,
    targetUnits: 1n,
    creator: VIEWER,
    leadProvider: VIEWER,
    counterparty: OTHER,
    direction: "OFFER",
    confirmers: [],
    contributorCount: 1,
    contributorsFrozen: false,
    ...overrides,
  };
}

async function inboxFor(
  rows: ReturnType<typeof commitment>[],
  scope: { inScope?: typeof inGardenA } = {}
) {
  mocks.getCommitments.mockResolvedValue(rows);
  const { result } = renderHookWithProviders(() =>
    useCommitmentsInbox({ chainId: 42161, viewer: VIEWER, ...scope })
  );
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  return result;
}

describe("useCommitmentsInbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queue = { ...EMPTY_QUEUE };
    mocks.getCommitmentPools.mockResolvedValue([
      { id: "42161-7", poolId: 7n, garden: GARDEN_A },
      { id: "42161-8", poolId: 8n, garden: GARDEN_B },
    ]);
  });

  it("scoped to a garden, lists and counts only the promises that involve it", async () => {
    const result = await inboxFor(
      [
        // In garden A's pool.
        commitment({ id: "42161-9", commitmentId: 9n, poolId: 7n }),
        // In garden B's pool, nothing to do with A.
        commitment({ id: "42161-10", commitmentId: 10n, poolId: 8n }),
        // In B's pool, worked from A.
        commitment({ id: "42161-11", commitmentId: 11n, poolId: 8n, providerGarden: GARDEN_A }),
        // In B's pool, paid for by A, and kept.
        commitment({
          id: "42161-12",
          commitmentId: 12n,
          poolId: 8n,
          payerGarden: GARDEN_A,
          derivedState: "FULFILLED",
        }),
      ],
      { inScope: inGardenA }
    );

    expect(ids(result.current.live)).toEqual(["42161-11", "42161-9"]);
    expect(ids(result.current.settled)).toEqual(["42161-12"]);
    // Both of A's live promises wait on this provider; B's own does not count here.
    expect(result.current.liveActCount).toBe(2);
    expect(result.current.totalActCount).toBe(2);
  });

  it("scoped to a garden, says only what waits to send there and what no row can name", async () => {
    mocks.queue = {
      ...EMPTY_QUEUE,
      // Two failed creations and one failed series, none of them with a promise yet.
      failedCount: 3,
      hasPendingCreate: true,
      pendingCreates: [
        { jobId: "waiting-in-b", poolId: "8", failed: false },
        { jobId: "failed-in-a", poolId: "7", failed: true },
        { jobId: "failed-in-b", poolId: "8", failed: true },
      ],
    };

    const result = await inboxFor([], { inScope: inGardenA });

    // The promise waiting to send belongs to garden B.
    expect(result.current.hasPendingCreate).toBe(false);
    // A's failed creation, and the series failure no garden can be read from.
    expect(result.current.unlistedFailureCount).toBe(2);
  });

  it("splits by tense, so a kept commitment leaves the live list entirely", async () => {
    const result = await inboxFor([
      commitment(),
      commitment({ id: "42161-10", commitmentId: 10n, derivedState: "FULFILLED" }),
      commitment({ id: "42161-11", commitmentId: 11n, derivedState: "EXPIRED" }),
      commitment({ id: "42161-12", commitmentId: 12n, derivedState: "DISPUTED" }),
    ]);

    expect(result.current.live.map((row) => row.commitment.id)).toEqual(["42161-9", "42161-12"]);
    expect(result.current.settled.map((row) => row.commitment.id)).toEqual([
      "42161-11",
      "42161-10",
    ]);
  });

  it("counts what needs an act, never what is merely present", async () => {
    const result = await inboxFor([
      // Waiting on this provider to get on with it.
      commitment(),
      // Waiting on somebody else to confirm, so it needs nothing from them.
      commitment({ id: "42161-10", commitmentId: 10n, derivedState: "READY_FOR_CONFIRMATION" }),
      commitment({ id: "42161-11", commitmentId: 11n, derivedState: "FULFILLED" }),
    ]);

    expect(result.current.live).toHaveLength(2);
    expect(result.current.liveActCount).toBe(1);
    expect(result.current.settledActCount).toBe(0);
    expect(result.current.totalActCount).toBe(1);
  });

  it("keeps the header count equal to the tabs' sum", async () => {
    const result = await inboxFor([
      commitment(),
      commitment({ id: "42161-10", commitmentId: 10n }),
    ]);

    expect(result.current.totalActCount).toBe(
      result.current.liveActCount + result.current.settledActCount
    );
  });

  it("asks the confirmer to act only when it is actually their turn", async () => {
    const asConfirmer = {
      creator: OTHER,
      leadProvider: OTHER,
      counterparty: VIEWER,
      direction: "OFFER",
    };

    const result = await inboxFor([
      commitment({ ...asConfirmer, derivedState: "READY_FOR_CONFIRMATION" }),
      commitment({ ...asConfirmer, id: "42161-10", commitmentId: 10n, derivedState: "ACTIVE" }),
    ]);

    const ready = result.current.live.find((row) => row.commitment.id === "42161-9");
    const active = result.current.live.find((row) => row.commitment.id === "42161-10");
    expect(ready?.seat).toBe("confirmer");
    expect(ready?.needsYou).toBe(true);
    expect(active?.needsYou).toBe(false);
    expect(result.current.liveActCount).toBe(1);
  });

  it("puts what needs you at the top of its list", async () => {
    const result = await inboxFor([
      commitment({ id: "42161-20", commitmentId: 20n, derivedState: "READY_FOR_CONFIRMATION" }),
      commitment({ id: "42161-9", commitmentId: 9n, derivedState: "ACTIVE" }),
    ]);

    expect(result.current.live[0]?.commitment.id).toBe("42161-9");
    expect(result.current.live[0]?.needsYou).toBe(true);
  });

  it("reads a row it only matched through the team as a contributor, not a stranger", async () => {
    // The account query returns a commitment when the reader is a party OR on
    // its team, so a row naming neither of their addresses is one they joined.
    const result = await inboxFor([
      commitment({ creator: OTHER, leadProvider: OTHER, counterparty: null, contributorCount: 3 }),
    ]);

    expect(result.current.live[0]?.seat).toBe("contributor");
  });

  it("reads nothing at all when nobody is signed in", async () => {
    // An absent account does not narrow the query, it removes the filter, so a
    // signed-out reader would otherwise be handed every commitment on the chain.
    mocks.getCommitments.mockResolvedValue([commitment()]);
    const { result } = renderHookWithProviders(() =>
      useCommitmentsInbox({ chainId: 42161, viewer: undefined })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mocks.getCommitments).not.toHaveBeenCalled();
    expect(result.current.live).toEqual([]);
    expect(result.current.settled).toEqual([]);
    expect(result.current.totalActCount).toBe(0);
  });
});
