/**
 * GardenPool Tests — the garden's pool tab.
 *
 * Most of these pin what a pool says when it is NOT open. Collapsing paused,
 * closed and composted into one "unavailable" would hide the consequence that
 * differs between them: whether anything resumes, and whether a steward can
 * bring it back.
 *
 * @vitest-environment happy-dom
 */

import userEvent from "@testing-library/user-event";
import { type ReactElement, useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "@green-goods/shared/types/domain";
import {
  type CommitmentDerivedState,
  type CommitmentPoolRecord,
  commitmentNeedsSeat,
  isSettledCommitmentState,
  selectCommitmentSeat,
} from "@green-goods/shared/commitment-pooling";
import { groupCommitmentsForDisplay } from "@green-goods/shared/modules/commitment-pooling/display-groups";
import { renderWithProviders, screen } from "../test-utils";

/** The tab navigates into commitment detail, so it needs a router around it. */
const render = (ui: ReactElement) => renderWithProviders(<MemoryRouter>{ui}</MemoryRouter>);
const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const VIEWER = "0x1111111111111111111111111111111111111111" as Address;
const OTHER = "0x2222222222222222222222222222222222222222" as Address;

const mockUseCommitments = vi.fn();
const mockUseCommitmentCycles = vi.fn();
const mockUseCommitmentCycleNames = vi.fn();
const mockUseOffline = vi.fn();
const mockUseHasRole = vi.fn();
const mockUseQueueState = vi.fn();
const mockUseReason = vi.fn();
const mockFlush = vi.fn();
const mockRetryAndSend = vi.fn();
const mockDiscardJob = vi.fn();
const mockUseGardenPoolController = vi.fn();
const mockUsePoolCharter = vi.fn();

const AVAILABLE = { status: "available", capability: {} } as const;
const UNAVAILABLE = { status: "unavailable", reason: "not-integrated", capability: {} } as const;

function pool(overrides: Partial<CommitmentPoolRecord> = {}): CommitmentPoolRecord {
  return {
    id: "42161-7",
    chainId: 42161,
    poolId: 7n,
    registrationSeen: true,
    garden: null,
    gardenId: null,
    poolType: "GARDEN",
    state: "OPEN",
    charterCID: null,
    pauseReasonCID: null,
    pauseReasonBlockNumber: null,
    openSeasonCycleId: null,
    openSeasonCycleEntityId: null,
    openCampaignIds: [],
    openCampaignEntityIds: [],
    providerOpenCommitmentCap: 0n,
    liveCommitmentCount: 0n,
    nonTerminalCycleCount: 0n,
    commitmentsOffered: 0n,
    commitmentsRequested: 0n,
    commitmentsAccepted: 0n,
    commitmentsReadyForConfirmation: 0n,
    commitmentsDue: 12n,
    commitmentsFulfilled: 9n,
    commitmentsCancelled: 0n,
    commitmentsExpired: 0n,
    commitmentsDisputed: 0n,
    workLinkedCount: 0n,
    workApprovedCount: 0n,
    openCommitmentCount: 0n,
    distinctProviderCount: 0n,
    createdAt: null,
    updatedAt: 0,
    ...overrides,
  };
}

function commitment(overrides: Record<string, unknown> = {}) {
  return {
    id: "42161-9",
    chainId: 42161,
    commitmentId: 9n,
    creationSeen: true,
    onchainState: "ACCEPTED",
    derivedState: "ACTIVE" as CommitmentDerivedState,
    state: "ACCEPTED",
    approvedUnits: 0n,
    evidenceCount: 0,
    cycleId: null,
    declaredUnitValue: null,
    declaredValueBasis: null,
    targetUnits: 3n,
    poolId: 7n,
    unitLabel: "hours",
    creator: OTHER,
    leadProvider: OTHER,
    counterparty: null,
    direction: "OFFER",
    confirmers: [],
    contributorCount: 1,
    contributorsFrozen: false,
    ...overrides,
  };
}

function commitmentsResult(overrides: Record<string, unknown> = {}) {
  return {
    commitments: [],
    availability: AVAILABLE,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

function useGardenPoolControllerMock(targetPool: CommitmentPoolRecord) {
  const [selectedCycleId, setSelectedCycleId] = useState<bigint | null>(null);
  const [direction, setDirection] = useState<"all" | "OFFER" | "REQUEST">("all");
  const [liveness, setLiveness] = useState<"live" | "settled" | "all">("live");
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const { cycles } = mockUseCommitmentCycles();
  const queue = mockUseQueueState();
  const commitments = mockUseCommitments();
  const role = mockUseHasRole();
  const stewardsPool = role.hasRole;
  const ownsPool = role.hasRole;
  const ownCreations = queue.pendingCreates.filter(
    (entry: { poolId: string }) => entry.poolId === targetPool.poolId.toString()
  );
  const shownCreations =
    liveness === "settled"
      ? []
      : ownCreations.filter(
          (entry: { direction: string }) => direction === "all" || entry.direction === direction
        );
  const inDirection = commitments.commitments.filter(
    (entry: ReturnType<typeof commitment>) => direction === "all" || entry.direction === direction
  );
  const settledInDirection = inDirection.filter((entry: ReturnType<typeof commitment>) =>
    isSettledCommitmentState(entry.derivedState)
  );
  const rows = (
    liveness === "all"
      ? inDirection
      : liveness === "settled"
        ? settledInDirection
        : inDirection.filter(
            (entry: ReturnType<typeof commitment>) => !isSettledCommitmentState(entry.derivedState)
          )
  ).map((entry: ReturnType<typeof commitment>) => {
    const seat = selectCommitmentSeat({
      commitment: entry as never,
      contributors: [],
      viewer: VIEWER,
    });
    return {
      commitment: entry,
      seat,
      needsYou: commitmentNeedsSeat({ commitment: entry as never, seat }),
    };
  });
  const poolState = targetPool.state ?? "UNKNOWN";
  const runBusy = async (jobId: string, action: () => Promise<unknown>) => {
    setBusyJobId(jobId);
    try {
      await action();
    } finally {
      setBusyJobId(null);
      queue.refresh();
    }
  };

  return {
    chainId: 42161,
    isOnline: mockUseOffline().isOnline,
    cycles,
    selectedCycleId,
    setSelectedCycleId,
    direction,
    setDirection,
    liveness,
    setLiveness,
    settledCount: settledInDirection.length,
    busyJobId,
    ownCreations,
    shownCreations,
    rows,
    titleOf: () => null,
    commitments,
    poolState,
    isParticipating: !["NOT_READY", "READY", "CLOSED", "COMPOSTED"].includes(poolState),
    canCreate:
      poolState === "OPEN" && (targetPool.poolType !== "PROTOCOL" || stewardsPool || ownsPool),
    stewardsPool: stewardsPool || ownsPool ? true : role.isLoading ? null : false,
    acts: {
      flush: mockFlush,
      retry: (jobId: string) => runBusy(jobId, () => mockRetryAndSend(jobId)),
      discard: (jobId: string) => runBusy(jobId, () => mockDiscardJob(jobId)),
    },
  };
}

vi.mock("@green-goods/shared/hooks/app/useOnlineStatus", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useOnlineStatus: () => mockUseOffline().isOnline,
  };
});

vi.mock(
  "@green-goods/shared/hooks/client-ui/pool/useGardenPoolController",
  async (importOriginal) => {
    return {
      ...(await importOriginal()),
      useGardenPoolController: (...args: unknown[]) => mockUseGardenPoolController(...args),
    };
  }
);

// The list's folding is proven in Shared (group-browsing); here each row stays
// its own entry unless a case hands the tab a group.
const mockUsePoolPromiseEntries = vi.fn();
vi.mock("@green-goods/shared/hooks/client-ui/pool/usePromiseGroups", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@green-goods/shared/hooks/client-ui/pool/usePromiseGroups")
  >()),
  usePoolPromiseEntries: (input: unknown) => mockUsePoolPromiseEntries(input),
}));

vi.mock("@green-goods/shared/commitment-pooling", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/commitment-pooling")>()),
  useCommitments: () => mockUseCommitments(),
  useCommitmentCycles: () => mockUseCommitmentCycles(),
  useCommitmentCycleNames: () => mockUseCommitmentCycleNames(),
  useCommitmentQueueState: () => mockUseQueueState(),
  useCommitmentReason: (cid: string | null) => mockUseReason(cid),
  usePoolCharter: (cid: string | null) => mockUsePoolCharter(cid),
}));

const { GardenPool } = await import("../../views/Home/Garden/Pool");

describe("GardenPool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOffline.mockReturnValue({ isOnline: true });
    mockUseHasRole.mockReturnValue({ hasRole: false, isLoading: false });
    mockUseCommitmentCycles.mockReturnValue({ cycles: [] });
    mockUseCommitmentCycleNames.mockReturnValue({ byCycleId: new Map(), isLoading: false });
    mockUseQueueState.mockReturnValue({
      pendingCommitmentIds: new Set<string>(),
      failedCount: 0,
      failedCommitmentIds: new Set<string>(),
      hasPendingCreate: false,
      pendingCreates: [],
      isUnavailable: false,
      refresh: vi.fn(),
    });
    mockUseReason.mockReturnValue({ reason: null, isLoading: false, isUnavailable: false });
    mockUsePoolCharter.mockReturnValue({ charter: null, isLoading: false, isUnavailable: false });
    mockRetryAndSend.mockResolvedValue(undefined);
    mockDiscardJob.mockResolvedValue(undefined);
    mockFlush.mockResolvedValue(undefined);
    mockUseCommitments.mockReturnValue(commitmentsResult());
    mockUseGardenPoolController.mockImplementation(useGardenPoolControllerMock);
    mockUsePoolPromiseEntries.mockImplementation(({ rows }: { rows: unknown[] }) =>
      rows.map((row) => ({ kind: "single", row }))
    );
  });

  it("folds a set's copies into one group row that counts them and opens the group", async () => {
    const user = userEvent.setup();
    const states = [
      ...Array(4).fill(["REQUESTED", "REQUESTED"]),
      ...Array(3).fill(["ACCEPTED", "ACTIVE"]),
      ...Array(3).fill(["FULFILLED", "FULFILLED"]),
    ] as Array<[string, CommitmentDerivedState]>;
    const copies = states.map(([onchainState, derivedState], index) =>
      commitment({
        id: `42161-${index + 20}`,
        commitmentId: BigInt(index + 20),
        direction: "REQUEST",
        onchainState,
        derivedState,
        metadataCID: "set-cid",
      })
    );
    const [group] = groupCommitmentsForDisplay({
      commitments: copies as never,
      metadataByCID: new Map([
        [
          "set-cid",
          { version: 1, title: "Water the orchard", displayGroup: { version: 1, id: "set-1" } },
        ],
      ]),
    });
    mockUseCommitments.mockReturnValue(commitmentsResult({ commitments: copies }));
    mockUsePoolPromiseEntries.mockReturnValue([{ kind: "group", group }]);

    render(<GardenPool pool={pool()} />);

    const row = screen.getByRole("button", { name: /A group of 10 separate promises/ });
    expect(row).toHaveTextContent("4 available · 3 in progress · 3 kept");
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
    await user.click(row);
    expect(mockNavigate).toHaveBeenCalledWith("commitments/group/set-1", {
      state: { groupKey: group?.kind === "group" ? group.key : undefined },
    });
  });

  const creation = (overrides: Record<string, unknown> = {}) => ({
    jobId: "job-1",
    chainId: 42161,
    poolId: "7",
    direction: "OFFER",
    title: "Prune the north beds",
    unitLabel: "hours",
    targetUnits: "6",
    waitingForMembership: false,
    failed: false,
    /** Nothing was broadcast, so throwing this one away is safe. */
    discardable: true,
    createdAt: 1_700_000_000_000,
    ...overrides,
  });

  it("draws a commitment still on this phone at the top of the pool, as waiting to send", () => {
    mockUseQueueState.mockReturnValue({
      pendingCommitmentIds: new Set<string>(),
      failedCount: 0,
      failedCommitmentIds: new Set<string>(),
      hasPendingCreate: true,
      pendingCreates: [creation()],
      isUnavailable: false,
      refresh: vi.fn(),
    });
    mockUseCommitments.mockReturnValue(commitmentsResult({ commitments: [commitment()] }));

    render(<GardenPool pool={pool()} />);

    expect(screen.getByText("Prune the north beds")).toBeInTheDocument();
    expect(screen.getByText("Waiting to send")).toBeInTheDocument();
    // The phone's own row counts: an otherwise empty pool is not empty.
    expect(screen.queryByText("No promises yet")).not.toBeInTheDocument();
  });

  it("counts a promise still on this phone with the rest, and keeps it out of Settled", async () => {
    const user = userEvent.setup();
    mockUseQueueState.mockReturnValue({
      pendingCommitmentIds: new Set<string>(),
      failedCount: 0,
      failedCommitmentIds: new Set<string>(),
      hasPendingCreate: true,
      pendingCreates: [creation()],
      isUnavailable: false,
      refresh: vi.fn(),
    });

    render(<GardenPool pool={pool()} />);
    expect(screen.getByText("1 live")).toBeInTheDocument();

    // It is no settled promise, so Settled neither lists nor counts it.
    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "settled");
    expect(screen.queryByText("Prune the north beds")).not.toBeInTheDocument();
    expect(screen.getByText("0 settled")).toBeInTheDocument();
  });

  it("says a creation waiting for the member's hat spends no tries", () => {
    mockUseQueueState.mockReturnValue({
      pendingCommitmentIds: new Set<string>(),
      failedCount: 0,
      failedCommitmentIds: new Set<string>(),
      hasPendingCreate: true,
      pendingCreates: [creation({ waitingForMembership: true })],
      isUnavailable: false,
      refresh: vi.fn(),
    });

    render(<GardenPool pool={pool()} />);

    expect(screen.getByText("Waiting for your membership")).toBeInTheDocument();
    expect(screen.getByText(/spends no tries/i)).toBeInTheDocument();
  });

  it("offers retry and discard on a creation that gave up, and only then", async () => {
    const user = userEvent.setup();
    mockUseQueueState.mockReturnValue({
      pendingCommitmentIds: new Set<string>(),
      failedCount: 1,
      failedCommitmentIds: new Set<string>(),
      hasPendingCreate: false,
      pendingCreates: [creation({ failed: true })],
      isUnavailable: false,
      refresh: vi.fn(),
    });

    render(<GardenPool pool={pool()} />);

    expect(screen.getByText("Didn't send")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try Again" }));
    expect(mockRetryAndSend).toHaveBeenCalledWith("job-1");
    expect(mockFlush).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(mockDiscardJob).toHaveBeenCalledWith("job-1");
  });

  it("withholds discard from a creation whose transaction was already sent", async () => {
    // The record is the only local trace of a broadcast commitment. Deleting it
    // would file a second one, so only Try again is offered.
    mockUseQueueState.mockReturnValue({
      pendingCommitmentIds: new Set<string>(),
      failedCount: 1,
      failedCommitmentIds: new Set<string>(),
      hasPendingCreate: false,
      pendingCreates: [creation({ failed: true, discardable: false })],
      isUnavailable: false,
      refresh: vi.fn(),
    });

    render(<GardenPool pool={pool()} />);

    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
  });

  it("leaves another pool's creation where it belongs", () => {
    mockUseQueueState.mockReturnValue({
      pendingCommitmentIds: new Set<string>(),
      failedCount: 0,
      failedCommitmentIds: new Set<string>(),
      hasPendingCreate: true,
      pendingCreates: [creation({ poolId: "99" })],
      isUnavailable: false,
      refresh: vi.fn(),
    });

    render(<GardenPool pool={pool()} />);

    expect(screen.queryByText("Prune the north beds")).not.toBeInTheDocument();
  });

  it("reads out why a pool is paused, from the stewards' own words", () => {
    mockUseReason.mockReturnValue({
      reason: { version: 1, reason: "Flooding on the lower terraces" },
      isLoading: false,
      isUnavailable: false,
    });
    mockUseCommitments.mockReturnValue(commitmentsResult({ commitments: [commitment()] }));

    render(<GardenPool pool={pool({ state: "PAUSED", pauseReasonCID: "bafy-pause" })} />);

    expect(mockUseReason).toHaveBeenCalledWith("bafy-pause");
    expect(screen.getByText("Why: Flooding on the lower terraces")).toBeInTheDocument();
  });

  it("lists what a pool still needs for its stewards, and where they finish it", () => {
    mockUseHasRole.mockReturnValue({ hasRole: true, isLoading: false });
    render(
      <GardenPool
        pool={pool({
          state: "NOT_READY",
          charterCID: "bafy-charter",
          providerOpenCommitmentCap: 0n,
        })}
      />
    );

    const list = screen.getByRole("list", { name: "What this pool still needs" });
    const rows = list.querySelectorAll("li");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute("data-done", "true");
    expect(rows[1]).toHaveAttribute("data-done", "false");
    expect(screen.getByText("What this pool is for")).toBeInTheDocument();
    expect(screen.getByText("How many promises one person can hold at once")).toBeInTheDocument();
    expect(screen.getByText(/steward dashboard/i)).toBeInTheDocument();
  });

  it("says only what is true for anyone while the steward read is still out", () => {
    mockUseHasRole.mockReturnValue({ hasRole: false, isLoading: true });
    render(<GardenPool pool={pool({ state: "NOT_READY", charterCID: "bafy-charter" })} />);

    expect(screen.queryByText("Your steward is setting this pool up.")).toBeNull();
    expect(screen.queryByRole("list", { name: "What this pool still needs" })).toBeNull();
    expect(screen.getByText(/when its stewards set one up/i)).toBeInTheDocument();
  });

  it("tells a member only that their steward is setting the pool up", () => {
    render(<GardenPool pool={pool({ state: "NOT_READY", charterCID: "bafy-charter" })} />);

    expect(screen.getByText("Your steward is setting this pool up.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "What this pool still needs" })).toBeNull();
  });

  it("says why a pool is paused even when it holds nothing yet", () => {
    mockUseReason.mockReturnValue({
      reason: { version: 1, reason: "Flooding on the lower terraces" },
      isLoading: false,
      isUnavailable: false,
    });

    render(<GardenPool pool={pool({ state: "PAUSED", pauseReasonCID: "bafy-pause" })} />);

    expect(screen.getByText(/paused this pool/i)).toBeInTheDocument();
    expect(screen.getByText("Why: Flooding on the lower terraces")).toBeInTheDocument();
    expect(screen.getByText("No promises yet")).toBeInTheDocument();
  });

  it("says a paused pool resumes and loses nothing, above a still-readable list", () => {
    mockUseCommitments.mockReturnValue(commitmentsResult({ commitments: [commitment()] }));

    render(<GardenPool pool={pool({ state: "PAUSED" })} />);

    expect(screen.getByText(/paused this pool/i)).toBeInTheDocument();
    expect(screen.getByText("3 hours")).toBeInTheDocument();
  });

  it("keeps a closed pool's history on screen instead of an empty surface", () => {
    render(<GardenPool pool={pool({ state: "CLOSED" })} />);

    expect(screen.getByText("This pool has closed")).toBeInTheDocument();
    expect(screen.getByText("What this pool grew")).toBeInTheDocument();
    expect(screen.getByText("12 promises made · 9 kept")).toBeInTheDocument();
  });

  it("says a composted pool can be reopened, which a closed one does not", () => {
    render(<GardenPool pool={pool({ state: "COMPOSTED" })} />);

    expect(screen.getByText(/may reopen it/i)).toBeInTheDocument();
  });

  it("tells a member a set-up pool is not open yet rather than showing an empty list", () => {
    render(<GardenPool pool={pool({ state: "READY" })} />);

    expect(screen.getByText("The pool is set up")).toBeInTheDocument();
    expect(screen.queryByText("No promises yet")).not.toBeInTheDocument();
  });

  it("does not claim a pool is empty when it cannot read it at all", () => {
    mockUseCommitments.mockReturnValue(commitmentsResult({ availability: UNAVAILABLE }));

    render(<GardenPool pool={pool()} />);

    expect(screen.getByText("Promises are not ready here yet")).toBeInTheDocument();
    expect(screen.queryByText("No promises yet")).not.toBeInTheDocument();
  });

  it("says offline rather than empty when the device cannot reach anything", () => {
    mockUseOffline.mockReturnValue({ isOnline: false });

    render(<GardenPool pool={pool()} />);

    expect(screen.getByText("You are offline")).toBeInTheDocument();
  });

  it("names a reader's own relationship to a commitment in someone else's garden", () => {
    // Their own offer, not yet taken up: nothing waits on them, so the row's one
    // qualifier says how they are involved.
    mockUseCommitments.mockReturnValue(
      commitmentsResult({
        commitments: [
          commitment({
            creator: VIEWER,
            leadProvider: VIEWER,
            derivedState: "OFFERED",
            onchainState: "OFFERED",
            state: "OFFERED",
          }),
        ],
      })
    );

    render(<GardenPool pool={pool()} />);

    expect(screen.getByText("You offered this")).toBeInTheDocument();
  });

  it("leaves a stranger's commitment unclaimed by the reader", () => {
    mockUseCommitments.mockReturnValue(commitmentsResult({ commitments: [commitment()] }));

    render(<GardenPool pool={pool()} />);

    expect(screen.getByText("3 hours")).toBeInTheDocument();
    expect(screen.queryByText("You offered this")).not.toBeInTheDocument();
    expect(screen.queryByText("You are helping with this")).not.toBeInTheDocument();
  });

  it("tells seasons and campaigns apart by word and glyph, not colour", () => {
    mockUseCommitmentCycles.mockReturnValue({
      cycles: [
        {
          id: "42161-1",
          cycleId: 1n,
          cycleType: "SEASON",
          state: "OPEN",
          commitmentsFulfilled: 6n,
          commitmentsDue: 16n,
        },
        {
          id: "42161-2",
          cycleId: 2n,
          cycleType: "CAMPAIGN",
          state: "OPEN",
          commitmentsFulfilled: 8n,
          commitmentsDue: 8n,
        },
      ],
    });
    mockUseCommitments.mockReturnValue(commitmentsResult({ commitments: [commitment()] }));

    render(<GardenPool pool={pool()} />);

    // Each card says its kind in words beside its glyph; unnamed, the kind names the card too.
    expect(screen.getAllByText("Season").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Campaign").length).toBeGreaterThan(0);
    expect(screen.getByText("6 of 16 kept")).toBeInTheDocument();
    expect(screen.getByText("8 of 8 kept")).toBeInTheDocument();
  });

  it("names a season and says when it runs, when the record carries both", () => {
    mockUseCommitmentCycles.mockReturnValue({
      cycles: [
        {
          id: "42161-1",
          cycleId: 1n,
          cycleType: "SEASON",
          state: "OPEN",
          startTime: 1_772_366_400n, // 2026-03-01T12:00:00Z, noon so every zone reads the same day
          endTime: 1_780_228_800n, // 2026-05-31T12:00:00Z
          metadataCID: "bafy-season",
          commitmentsFulfilled: 6n,
          commitmentsDue: 16n,
        },
      ],
    });
    mockUseCommitmentCycleNames.mockReturnValue({
      byCycleId: new Map([["1", { status: "resolved", name: "Spring planting" }]]),
      isLoading: false,
    });
    mockUseCommitments.mockReturnValue(commitmentsResult({ commitments: [commitment()] }));

    render(<GardenPool pool={pool()} />);

    expect(screen.getByText("Spring planting")).toBeInTheDocument();
    // The card keeps its dates short, beside its own count; the details sheet has the year.
    expect(screen.getByText("Mar 1 – May 31 · 6 of 16 kept")).toBeInTheDocument();
  });

  it("filters by direction without inventing a total across kinds", async () => {
    const user = userEvent.setup();
    mockUseCommitments.mockReturnValue(
      commitmentsResult({
        commitments: [
          commitment(),
          commitment({ id: "42161-10", direction: "REQUEST", unitLabel: "rides" }),
        ],
      })
    );

    render(<GardenPool pool={pool()} />);
    expect(screen.getByText("3 rides")).toBeInTheDocument();
    expect(screen.getByText("2 live")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Kind" }), "REQUEST");

    expect(screen.getByText("3 rides")).toBeInTheDocument();
    expect(screen.queryByText("3 hours")).not.toBeInTheDocument();
    // The count counts what is shown, never a total across kinds.
    expect(screen.getByText("1 live")).toBeInTheDocument();
  });

  it("keeps Settled one Status choice away, whatever the kind", async () => {
    const user = userEvent.setup();
    mockUseCommitments.mockReturnValue(
      commitmentsResult({
        commitments: [
          commitment({ id: "42161-10", direction: "REQUEST", unitLabel: "rides" }),
          commitment({
            id: "42161-11",
            commitmentId: 11n,
            derivedState: "FULFILLED",
            onchainState: "FULFILLED",
            state: "FULFILLED",
            direction: "OFFER",
            unitLabel: "meals",
          }),
        ],
      })
    );

    render(<GardenPool pool={pool()} />);
    const status = screen.getByRole("combobox", { name: "Status" });
    await user.selectOptions(status, "settled");
    expect(screen.getByText("3 meals")).toBeInTheDocument();
    expect(screen.getByText("1 settled")).toBeInTheDocument();

    // No settled requests: the choice stays, and says so rather than disappearing.
    await user.selectOptions(screen.getByRole("combobox", { name: "Kind" }), "REQUEST");
    expect(status).toHaveValue("settled");
    expect(screen.getByText("0 settled")).toBeInTheDocument();

    await user.selectOptions(status, "all");
    expect(screen.getByText("3 rides")).toBeInTheDocument();
  });

  it("marks a row that is waiting on the reader, and only that row", () => {
    mockUseCommitments.mockReturnValue(
      commitmentsResult({
        commitments: [
          // Ready, and the reader is the one who has to confirm it.
          commitment({ derivedState: "READY_FOR_CONFIRMATION", counterparty: VIEWER }),
          // The reader's own untaken offer: withdrawing is their option, not a duty.
          commitment({
            id: "42161-10",
            commitmentId: 10n,
            derivedState: "OFFERED",
            creator: VIEWER,
            leadProvider: null,
            unitLabel: "rides",
          }),
          // Somebody else's, in progress: nothing waits on a bystander.
          commitment({ id: "42161-11", commitmentId: 11n, unitLabel: "seedlings" }),
        ],
      })
    );

    render(<GardenPool pool={pool()} />);

    const rows = screen.getAllByRole("button", { name: /hours|rides|seedlings/ });
    expect(rows.map((row) => row.getAttribute("data-needs-you"))).toEqual([
      "true",
      "false",
      "false",
    ]);
    expect(screen.getAllByText("Needs you")).toHaveLength(1);
  });

  it("opens the Offer or Request sheet from the +, each card fixing its direction by route", async () => {
    const user = userEvent.setup();
    mockUseCommitments.mockReturnValue(commitmentsResult({ commitments: [commitment()] }));

    render(<GardenPool pool={pool()} />);

    // Closed: one entry, no doors, and no form.
    expect(screen.queryByRole("button", { name: /^Offer Something/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Offer or Request" }));
    expect(await screen.findByRole("button", { name: /^Request Something/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "How Promises Work" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Offer Something/ }));
    expect(mockNavigate).toHaveBeenCalledWith("commitments/new?direction=offer");
  });

  it("offers the protocol pool's doors to its stewards only", () => {
    // The contract refuses any other creator on the protocol pool
    // (CreationChecksLib.resolveCreator), so a member's door would queue an
    // act that can only revert. The garden pool keeps its doors for everyone.
    mockUseCommitments.mockReturnValue(commitmentsResult({ commitments: [commitment()] }));
    const protocol = pool({ poolType: "PROTOCOL", garden: OTHER });

    const { unmount } = render(<GardenPool pool={protocol} />);
    expect(screen.queryByRole("button", { name: "Offer or Request" })).not.toBeInTheDocument();
    unmount();

    mockUseHasRole.mockReturnValue({ hasRole: true, isLoading: false });
    render(<GardenPool pool={protocol} />);
    expect(screen.getByRole("button", { name: "Offer or Request" })).toBeInTheDocument();
  });

  it("closes the doors without starting anything", async () => {
    const user = userEvent.setup();
    mockUseCommitments.mockReturnValue(commitmentsResult({ commitments: [commitment()] }));

    render(<GardenPool pool={pool()} />);
    await user.click(screen.getByRole("button", { name: "Offer or Request" }));
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("button", { name: "Offer" })).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("keeps the same + on an empty pool, with no buttons of its own in the view", async () => {
    const user = userEvent.setup();

    render(<GardenPool pool={pool()} />);

    expect(screen.getByText("No promises yet")).toBeInTheDocument();
    expect(screen.getByText("0 live")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Make a request" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Offer or Request" }));
    await user.click(await screen.findByRole("button", { name: /^Request Something/ }));
    expect(mockNavigate).toHaveBeenCalledWith("commitments/new?direction=request");
  });

  it("draws no creation entry while the pool is paused", () => {
    mockUseCommitments.mockReturnValue(commitmentsResult({ commitments: [commitment()] }));

    render(<GardenPool pool={pool({ state: "PAUSED" })} />);

    expect(screen.queryByRole("button", { name: "Offer or Request" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Offer support" })).not.toBeInTheDocument();
  });

  it("draws one season as a full-width card, and two or more as a rail", () => {
    const season = {
      id: "42161-1",
      cycleId: 1n,
      cycleType: "SEASON",
      state: "OPEN",
      commitmentsFulfilled: 6n,
      commitmentsDue: 16n,
    };
    mockUseCommitments.mockReturnValue(commitmentsResult({ commitments: [commitment()] }));
    mockUseCommitmentCycles.mockReturnValue({ cycles: [season] });
    const { unmount } = render(<GardenPool pool={pool()} />);
    expect(screen.queryByRole("group", { name: "Seasons and campaigns" })).toBeNull();
    expect(screen.getByRole("button", { name: "Show promises in Season" })).toHaveClass("w-full");
    unmount();

    mockUseCommitmentCycles.mockReturnValue({
      cycles: [season, { ...season, id: "42161-2", cycleId: 2n, cycleType: "CAMPAIGN" }],
    });
    render(<GardenPool pool={pool()} />);
    expect(screen.getByRole("group", { name: "Seasons and campaigns" })).toBeInTheDocument();
  });

  it("opens the pool's own agreement from the ⓘ beside the count, and the general words only without one", async () => {
    const user = userEvent.setup();
    const season = {
      id: "42161-1",
      cycleId: 1n,
      cycleType: "SEASON",
      state: "OPEN",
      commitmentsFulfilled: 6n,
      commitmentsDue: 16n,
    };
    mockUseCommitments.mockReturnValue(commitmentsResult({ commitments: [commitment()] }));
    mockUseCommitmentCycles.mockReturnValue({ cycles: [season] });
    mockUsePoolCharter.mockReturnValue({
      charter: { version: 1, purpose: "Tools and rides shared across the valley." },
      isLoading: false,
      isUnavailable: false,
    });
    const { unmount } = render(<GardenPool pool={pool({ charterCID: "bafy-charter" })} />);
    // The general sentence no longer sits under the seasons on every pool.
    expect(screen.queryByText(/offer help and ask for it/i)).toBeNull();
    await user.click(screen.getByRole("button", { name: "What this pool is for" }));
    expect(
      await screen.findByText("Tools and rides shared across the valley.")
    ).toBeInTheDocument();
    expect(mockUsePoolCharter).toHaveBeenCalledWith("bafy-charter");
    unmount();

    mockUsePoolCharter.mockReturnValue({ charter: null, isLoading: false, isUnavailable: false });
    render(<GardenPool pool={pool()} />);
    await user.click(screen.getByRole("button", { name: "What this pool is for" }));
    expect(await screen.findByText(/offer help and ask for it/i)).toBeInTheDocument();
  });

  it("says the agreement is on its way, and keeps it reachable before the first commitment", async () => {
    const user = userEvent.setup();
    const season = {
      id: "42161-1",
      cycleId: 1n,
      cycleType: "SEASON",
      state: "OPEN",
      commitmentsFulfilled: 0n,
      commitmentsDue: 0n,
    };
    // No commitments yet: the empty state still carries the season and its agreement.
    mockUseCommitments.mockReturnValue(commitmentsResult({ commitments: [] }));
    mockUseCommitmentCycles.mockReturnValue({ cycles: [season] });
    mockUsePoolCharter.mockReturnValue({ charter: null, isLoading: true, isUnavailable: false });
    render(<GardenPool pool={pool({ charterCID: "bafy-charter" })} />);

    await user.click(screen.getByRole("button", { name: "What this pool is for" }));
    expect(await screen.findByText("Reading this pool's agreement…")).toBeInTheDocument();
  });

  it("edges each row by its direction, and sets its marker at label size", () => {
    mockUseCommitments.mockReturnValue(
      commitmentsResult({
        commitments: [
          commitment({ derivedState: "READY_FOR_CONFIRMATION", counterparty: VIEWER }),
          commitment({
            id: "42161-12",
            commitmentId: 12n,
            direction: "REQUEST",
            unitLabel: "rides",
          }),
        ],
      })
    );

    render(<GardenPool pool={pool()} />);

    const [offer, request] = screen.getAllByRole("button", { name: /hours|rides/ });
    expect(offer).toHaveClass("border-s-[3px]", "border-s-primary");
    expect(request).toHaveClass("border-s-[3px]", "border-s-information-base");
    const marker = screen.getByText("Needs you");
    expect(marker).toHaveClass("text-xs");
    expect(marker).not.toHaveClass("uppercase");
  });

  it("keeps the pool's agreement behind the ⓘ beside the count, not on the page", () => {
    mockUseCommitments.mockReturnValue(commitmentsResult({ commitments: [commitment()] }));

    render(<GardenPool pool={pool()} />);

    expect(screen.queryByText(/offer help and ask for it/i)).toBeNull();
    expect(screen.getByText("1 live")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "What this pool is for" })).toBeInTheDocument();
  });

  it("holds the list's place while loading, with no ⓘ to slide as the count arrives", () => {
    mockUseCommitments.mockReturnValue(commitmentsResult({ isLoading: true }));

    render(<GardenPool pool={pool()} />);

    expect(screen.getByText(/Gathering…/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "What this pool is for" })).toBeNull();
    expect(document.querySelectorAll("[data-skeleton=commitment-row]")).toHaveLength(4);
  });

  it("says a failed read lost nothing, in place of the list, and tries again", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockUseCommitments.mockReturnValue(commitmentsResult({ isError: true, refetch }));

    render(<GardenPool pool={pool()} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load promises");
    expect(alert).toHaveTextContent("Nothing has been lost.");
    await user.click(screen.getByRole("button", { name: "Try Again" }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
