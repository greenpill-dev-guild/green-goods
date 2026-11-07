/**
 * useGardenNotifications tests: the bell's read model for the signed-in account in one garden.
 * The account's roles come from the membership owner, the steward events from the predicates
 * that gate each act on the phone, and the seen marks from this device's store. The garden's
 * reads are the edges; the derivation, the permissions and the store run for real.
 */

import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CHAIN_ID } from "../../../config/default-chain";
import { useGardenNotifications } from "../../../hooks/garden/useGardenNotifications";
import { NEW_NOTIFICATION_WINDOW_SECONDS } from "../../../modules/garden/notifications";
import type {
  CommitmentPoolRecord,
  CommitmentReadModel,
  PoolClaimRequestRow,
} from "../../../modules/commitment-pooling/types-core";
import {
  GARDEN_NOTIFICATIONS_SEEN_STORAGE_KEY,
  useGardenNotificationsSeenStore,
} from "../../../stores/useGardenNotificationsSeenStore";
import type { Address, Garden, Work } from "../../../types/domain";
import type { EASWorkListRow } from "../../../types/eas-responses";
import {
  claimFixture,
  commitmentFixture,
  poolClaimRowFixture,
  poolFixture,
} from "../../test-utils/commitment-pooling-fixtures";
import { createMockGarden, createMockWork } from "../../test-utils/mock-factories";
import { createTestQueryClient } from "../../test-utils/query-client";

type ReadCall = { input: Record<string, unknown>; options: { enabled?: boolean } };

const reads = vi.hoisted(() => ({
  account: null as string | null,
  gardens: [] as Garden[],
  works: [] as Work[],
  worksFailed: false,
  worksPartial: false,
  activity: { rows: [] as EASWorkListRow[], complete: true },
  /** Accounts the chain's steward read answers yes for, as the claim panel reads it. */
  chainStewards: [] as string[],
  pools: [] as CommitmentPoolRecord[],
  commitments: [] as CommitmentReadModel[],
  takeUps: [] as PoolClaimRequestRow[],
  commitmentReads: [] as ReadCall[],
  takeUpReads: [] as ReadCall[],
  /** What the count grant's read answers; undefined while this browser holds no grant. */
  joinRequestsWaiting: undefined as number | undefined,
  /** Whether this browser holds a count grant for the garden. */
  joinRequestsHasGrant: true,
  joinRequestsFailed: false,
  /** Whether the count grant's read is running. */
  joinRequestsFetching: false,
  joinRequestReads: [] as Array<{ enabled?: boolean; kind?: string }>,
  /** The sources a refresh read again, in the order it asked. */
  readAgain: [] as string[],
}));

vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => reads.account,
}));
vi.mock("../../../modules/data/greengoods", () => ({
  getGardens: () => Promise.resolve(reads.gardens),
  getActions: vi.fn(),
  getGardeners: vi.fn(),
}));
// The garden's page of works, as the garden screen reads it.
vi.mock("../../../hooks/work/useWorks", () => ({
  useWorks: (gardenId: string) => ({
    works: reads.works.filter((work) => work.gardenAddress === gardenId),
    isLoading: false,
    isError: reads.worksFailed,
    refreshWarning: reads.worksPartial,
    hasUnknownStatuses: false,
    refetch: () => reads.readAgain.push("works"),
  }),
}));
// The week's activity, however far back each work began.
vi.mock("../../../modules/work/work-list", () => ({
  readGardenActivity: () => Promise.resolve(reads.activity),
}));
vi.mock("../../../hooks/roles/useHasRole", () => ({
  useHasRole: (_garden: string, user: string | undefined, role: string) => ({
    hasRole: role === "steward" && reads.chainStewards.includes(String(user).toLowerCase()),
    isLoading: false,
    error: null,
  }),
}));
vi.mock("../../../hooks/commitment-pooling/useCommitmentPooling", () => ({
  useCommitmentPools: (input: { garden?: string }) => ({
    pools: reads.pools.filter((pool) => pool.garden === input.garden),
    isLoading: false,
    isError: false,
    isEnabled: true,
    refetch: async () => reads.readAgain.push("pools"),
  }),
  // A disabled query still answers from the cache. A read with no pool id has the same key as a
  // chain-wide one, so these answer whatever was cached, enabled or not.
  useCommitments: (input: Record<string, unknown>, options: { enabled?: boolean } = {}) => {
    reads.commitmentReads.push({ input, options });
    return {
      data: reads.commitments,
      commitments: reads.commitments,
      isLoading: false,
      isError: false,
      isEnabled: options.enabled !== false,
      refetch: async () => reads.readAgain.push("commitments"),
    };
  },
}));
// How many join requests wait, read with this browser's count grant; it reads nothing disabled.
vi.mock("../../../hooks/garden/useJoinRequestCount", () => ({
  useJoinRequestCount: (_gardenId: string, options: { enabled?: boolean; kind?: string } = {}) => {
    reads.joinRequestReads.push(options);
    const enabled = options.enabled !== false;
    return {
      waiting: enabled ? reads.joinRequestsWaiting : undefined,
      hasGrant: reads.joinRequestsHasGrant,
      isLoading: false,
      isError: enabled && reads.joinRequestsFailed,
      isFetching: enabled && reads.joinRequestsFetching,
      refetch: () => {
        if (enabled) reads.readAgain.push("joinRequests");
      },
    };
  },
}));
vi.mock("../../../hooks/commitment-pooling/usePoolClaimRequests", () => ({
  usePoolClaimRequests: (input: Record<string, unknown>, options: { enabled?: boolean } = {}) => {
    reads.takeUpReads.push({ input, options });
    return {
      data: reads.takeUps,
      rows: reads.takeUps,
      isLoading: false,
      isError: false,
      isEnabled: options.enabled !== false,
      refetch: async () => reads.readAgain.push("takeUps"),
    };
  },
}));

const ALICE = "0xa11ce00000000000000000000000000000000001" as Address;
const BOB = "0xb0b0000000000000000000000000000000000002" as Address;
const CAROL = "0x3333333333333333333333333333333333333333" as Address;
const GARDEN = "0x6000000000000000000000000000000000000001" as Address;
const OTHER_GARDEN = "0x6000000000000000000000000000000000000002" as Address;
const HOUR = 3_600;
/** The steward events in the order a seeded garden lists them, waiting join requests newest. */
const STEWARD_KINDS = ["joinRequested", "workSubmitted", "takeUpRequested"];

let client: QueryClient;
let now: number;

function renderNotifications(gardenId: string = GARDEN) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return renderHook(({ id }) => useGardenNotifications(id), {
    wrapper,
    initialProps: { id: gardenId },
  });
}

/** The garden's reads: Alice's approved work, Bob's submission, her promise taken up, Carol's ask. */
function seedGarden(roles: Partial<Garden>) {
  reads.gardens = [createMockGarden({ id: GARDEN, gardeners: [BOB], stewards: [], ...roles })];
  // The chain's inclusive steward read agrees with the roster unless a case says otherwise.
  reads.chainStewards = [...(roles.stewards ?? []), ...(roles.owners ?? [])].map((who) =>
    who.toLowerCase()
  );
  reads.works = [
    createMockWork({
      id: "0xw1",
      gardenerAddress: ALICE,
      gardenAddress: GARDEN,
      status: "approved",
      createdAt: now - 30 * HOUR,
      reviewedAt: now - HOUR,
    }),
    createMockWork({
      id: "0xw2",
      gardenerAddress: BOB,
      gardenAddress: GARDEN,
      status: "pending",
      createdAt: now - 2 * HOUR,
    }),
  ];
  reads.pools = [poolFixture({ poolId: 101n, garden: GARDEN })];
  reads.commitments = [
    commitmentFixture({
      commitmentId: 11n,
      creator: ALICE,
      leadProvider: ALICE,
      counterparty: BOB,
      acceptanceAt: now - 3 * HOUR,
    }),
  ];
  reads.takeUps = [
    poolClaimRowFixture({
      commitment: commitmentFixture({
        commitmentId: 21n,
        direction: "REQUEST",
        creator: BOB,
        leadProvider: null,
        claimMode: "APPROVAL_GATED",
        onchainState: "REQUESTED",
      }),
      claim: claimFixture({ commitmentId: 21n, claimant: CAROL, requestedAt: now - 4 * HOUR }),
    }),
  ];
}

const latest = (calls: ReadCall[]) => calls.at(-1);

beforeEach(() => {
  client = createTestQueryClient();
  now = Math.floor(Date.now() / 1000);
  localStorage.clear();
  useGardenNotificationsSeenStore.setState({ seenByScope: {}, joinRequestsByScope: {} });
  reads.account = ALICE;
  reads.joinRequestsWaiting = undefined;
  reads.joinRequestsHasGrant = true;
  reads.joinRequestsFailed = false;
  reads.joinRequestsFetching = false;
  reads.joinRequestReads = [];
  reads.worksFailed = false;
  reads.worksPartial = false;
  reads.activity = { rows: [], complete: true };
  reads.commitmentReads = [];
  reads.takeUpReads = [];
  reads.readAgain = [];
});

afterEach(() => {
  client.clear();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("useGardenNotifications", () => {
  it("lists a steward's events from the garden's work, promises and take-up requests", async () => {
    seedGarden({ stewards: [ALICE] });
    // Cached beside this garden's promises: one of Alice's in another garden's pool.
    reads.commitments.push(
      commitmentFixture({
        commitmentId: 12n,
        poolId: 202n,
        creator: ALICE,
        counterparty: BOB,
        acceptanceAt: now - HOUR,
      })
    );

    const { result } = renderNotifications();

    await waitFor(() => expect(result.current.notifications).toHaveLength(4));
    expect(result.current.notifications.map(({ kind, isNew }) => ({ kind, isNew }))).toEqual([
      { kind: "workApproved", isNew: true },
      { kind: "workSubmitted", isNew: true },
      { kind: "promiseTakenUp", isNew: true },
      { kind: "takeUpRequested", isNew: true },
    ]);
    expect(result.current.newCount).toBe(4);
    // The promise read is the account's own, the Promises launcher's read, so it never grows
    // with the pool's history and Home pays for it once.
    expect(latest(reads.commitmentReads)).toEqual({
      input: { chainId: DEFAULT_CHAIN_ID, account: ALICE },
      options: { enabled: true },
    });
    expect(latest(reads.takeUpReads)).toEqual({
      input: { chainId: DEFAULT_CHAIN_ID, poolId: 101n, state: "PENDING" },
      options: { enabled: true },
    });
  });

  it.each([
    ["a gardener", { gardeners: [ALICE, BOB] }, false],
    ["an evaluator", { evaluators: [ALICE] }, false],
    ["an owner who is not a steward", { owners: [ALICE] }, true],
  ])("gives steward events to %s only through the acts' own predicates", async (_who, roles, steward) => {
    seedGarden(roles);
    reads.joinRequestsWaiting = 2;

    const { result } = renderNotifications();

    // Until the garden list answers, the account's roles are unknown and the list incomplete.
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(latest(reads.takeUpReads)?.options.enabled).toBe(steward);
    // Gardeners answers requests to join, its only kind, for the work page's stewards and owners.
    expect(reads.joinRequestReads.at(-1)).toEqual({ enabled: steward, kind: "garden_membership" });
    await waitFor(() =>
      expect(
        result.current.notifications
          .map(({ kind }) => kind)
          .filter((kind) => STEWARD_KINDS.includes(kind))
      ).toEqual(steward ? STEWARD_KINDS : [])
    );
    const kinds = result.current.notifications.map(({ kind }) => kind);
    expect(kinds).toEqual(expect.arrayContaining(["workApproved", "promiseTakenUp"]));
  });

  it("reads again only the sources that are on: with no pool known, no promise or take-up read (DL-168)", async () => {
    seedGarden({ stewards: [ALICE] });
    reads.pools = [];
    const { result, rerender } = renderNotifications();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.refresh());
    // Without a pool id the take-up read would cover every request on the chain.
    expect(reads.readAgain).toEqual(["works", "joinRequests", "pools"]);
    // Refresh shows progress until the last source answers, the join-request count included.
    reads.joinRequestsFetching = true;
    rerender({ id: GARDEN });
    expect(result.current.isFetching).toBe(true);

    reads.readAgain = [];
    reads.pools = [poolFixture({ garden: GARDEN })];
    const pooled = renderNotifications();
    await waitFor(() => expect(pooled.result.current.isLoading).toBe(false));
    act(() => pooled.result.current.refresh());
    expect(reads.readAgain).toEqual(["works", "joinRequests", "pools", "commitments", "takeUps"]);
  });

  it("lists no promises until it knows the garden's pool, whatever the cache holds", async () => {
    seedGarden({ stewards: [ALICE] });
    // The pool's read is unknown; the cache still answers with Alice's promise taken up.
    reads.pools = [];

    const { result } = renderNotifications();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notifications.map(({ kind }) => kind)).toEqual([
      "workApproved",
      "workSubmitted",
    ]);
    expect(reads.commitmentReads.every(({ options }) => options.enabled === false)).toBe(true);
    expect(reads.takeUpReads.every(({ options }) => options.enabled === false)).toBe(true);
  });

  it("clears the listed events on this device: they leave the list, count seen and stay cleared (DL-133)", async () => {
    seedGarden({ stewards: [ALICE], gardeners: [BOB] });
    reads.works.push(
      createMockWork({
        id: "0xw4",
        gardenerAddress: BOB,
        gardenAddress: GARDEN,
        status: "rejected",
        createdAt: now - 20 * HOUR,
        reviewedAt: now - 5 * HOUR,
      })
    );
    const { result } = renderNotifications();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.newCount).toBe(4));
    const listed = result.current.notifications.map(({ id }) => id);

    act(() => result.current.clearAll());

    expect(result.current.notifications).toEqual([]);
    expect(result.current.newCount).toBe(0);
    const record =
      useGardenNotificationsSeenStore.getState().seenByScope[
        `${DEFAULT_CHAIN_ID}:${ALICE}:${GARDEN}`
      ];
    expect(Object.keys(record?.cleared ?? {}).sort()).toEqual([...listed].sort());
    // Seen marks still trim with the week; the cleared marks stay with the record.
    expect(record?.seenThrough).toBeGreaterThan(0);
  });

  it("marks events seen on this device for one account and garden, and writes nothing else", async () => {
    seedGarden({ stewards: [ALICE], gardeners: [BOB] });
    reads.gardens.push(createMockGarden({ id: OTHER_GARDEN, stewards: [ALICE], gardeners: [BOB] }));
    reads.works.push(
      createMockWork({
        id: "0xw3",
        gardenerAddress: BOB,
        gardenAddress: OTHER_GARDEN,
        status: "pending",
        createdAt: now - HOUR,
      }),
      createMockWork({
        id: "0xw4",
        gardenerAddress: BOB,
        gardenAddress: GARDEN,
        status: "rejected",
        createdAt: now - 20 * HOUR,
        reviewedAt: now - 5 * HOUR,
      })
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { result, rerender } = renderNotifications();
    await waitFor(() => expect(result.current.newCount).toBe(4));

    // The sheet marks only the rows its open tab shows; the rest stay new (DL-133).
    act(() => result.current.markSeen(result.current.notifications.slice(0, 2)));
    expect(result.current.newCount).toBe(2);
    act(() => result.current.markSeen(result.current.notifications));

    expect(result.current.newCount).toBe(0);
    expect(result.current.notifications.every(({ isNew }) => !isNew)).toBe(true);
    expect(Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))).toEqual([
      GARDEN_NOTIFICATIONS_SEEN_STORAGE_KEY,
    ]);
    expect(Object.keys(useGardenNotificationsSeenStore.getState().seenByScope)).toEqual([
      `${DEFAULT_CHAIN_ID}:${ALICE}:${GARDEN}`,
    ]);
    // A browser without a count grant reads no join requests, so it keeps no record of them.
    expect(useGardenNotificationsSeenStore.getState().joinRequestsByScope).toEqual({});

    rerender({ id: OTHER_GARDEN });
    await waitFor(() => expect(result.current.newCount).toBe(1));

    reads.account = BOB;
    rerender({ id: GARDEN });
    await waitFor(() =>
      expect(result.current.notifications.map(({ kind, isNew }) => ({ kind, isNew }))).toEqual([
        { kind: "workRejected", isNew: true },
      ])
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("lists waiting join requests as one event, new with each rise and not when one is answered, and keeps no record without them", async () => {
    seedGarden({ stewards: [ALICE] });
    const clock = vi.spyOn(Date, "now").mockReturnValue(now * 1000);
    reads.joinRequestsWaiting = 2;
    const { result, rerender } = renderNotifications();
    const joinEvent = () =>
      result.current.notifications.find(({ kind }) => kind === "joinRequested");

    await waitFor(() => expect(joinEvent()).toMatchObject({ waiting: 2, at: now, isNew: true }));
    act(() => result.current.markSeen(result.current.notifications));
    expect(result.current.newCount).toBe(0);

    // An answer brings nobody new: the event keeps its id, and stays seen.
    reads.joinRequestsWaiting = 1;
    clock.mockReturnValue((now + HOUR) * 1000);
    rerender({ id: GARDEN });
    await waitFor(() => expect(joinEvent()).toMatchObject({ waiting: 1, at: now, isNew: false }));

    // Someone asked since: a new event, new on this device.
    reads.joinRequestsWaiting = 3;
    clock.mockReturnValue((now + 2 * HOUR) * 1000);
    rerender({ id: GARDEN });
    await waitFor(() =>
      expect(joinEvent()).toMatchObject({ waiting: 3, at: now + 2 * HOUR, isNew: true })
    );
    expect(result.current.newCount).toBe(1);

    // The queue emptied: no event, and the device keeps no record of it.
    reads.joinRequestsWaiting = 0;
    rerender({ id: GARDEN });
    await waitFor(() => expect(joinEvent()).toBeUndefined());
    expect(useGardenNotificationsSeenStore.getState().joinRequestsByScope).toEqual({});

    // Nor once its grant is gone (it lapsed, or the session ended), since nothing reads it again.
    reads.joinRequestsWaiting = 2;
    rerender({ id: GARDEN });
    await waitFor(() => expect(joinEvent()).toMatchObject({ waiting: 2 }));
    reads.joinRequestsWaiting = undefined;
    reads.joinRequestsHasGrant = false;
    rerender({ id: GARDEN });
    await waitFor(() =>
      expect(useGardenNotificationsSeenStore.getState().joinRequestsByScope).toEqual({})
    );
    expect(joinEvent()).toBeUndefined();

    // A count read that failed may hide join requests, so the list says it may be missing events.
    reads.joinRequestsFailed = true;
    rerender({ id: GARDEN });
    expect(result.current.isError).toBe(true);
  });

  it("says when a read failed and keeps listing what the others found", async () => {
    seedGarden({ stewards: [ALICE] });
    reads.worksFailed = true;

    const { result } = renderNotifications();

    await waitFor(() => expect(result.current.isError).toBe(true));
    await waitFor(() =>
      expect(result.current.notifications.map(({ kind }) => kind)).toContain("promiseTakenUp")
    );
  });

  it("lists the week's events in a garden with more works than its page holds", async () => {
    seedGarden({ stewards: [ALICE] });
    reads.takeUps = [];
    reads.commitments = [];
    // The page: Bob's 50 newest submissions.
    reads.works = Array.from({ length: 50 }, (_, index) =>
      createMockWork({
        id: `0xpage${index}`,
        gardenerAddress: BOB,
        gardenAddress: GARDEN,
        status: "pending",
        createdAt: now - (index + 1) * 60,
      })
    );
    // The week: the same 50, ten earlier submissions past the page, and Alice's work from
    // three months ago, rejected an hour ago.
    const row = (id: string, gardener: Address, createdAt: number) => ({
      ...createMockWork({ id, gardenerAddress: gardener, gardenAddress: GARDEN, createdAt }),
      approval: null,
    });
    reads.activity = {
      complete: true,
      rows: [
        ...reads.works.map((work) => row(work.id, BOB, work.createdAt)),
        ...Array.from({ length: 10 }, (_, index) =>
          row(`0xearlier${index}`, BOB, now - 48 * HOUR - index)
        ),
        {
          ...row("0xold", ALICE, now - 90 * 24 * HOUR),
          approval: {
            id: "0xdecision",
            workUID: "0xold",
            approved: false,
            feedback: "The photo misses the new bed.",
            createdAt: now - HOUR,
            stewardAddress: BOB,
            gardenerAddress: GARDEN,
            actionUID: 1,
            confidence: 0,
            verificationMethod: 0,
            reviewNotesCID: "",
          },
        },
      ],
    };

    const { result } = renderNotifications();

    await waitFor(() => expect(result.current.notifications).toHaveLength(61));
    const count = (kind: string) =>
      result.current.notifications.filter((event) => event.kind === kind).length;
    expect(count("workSubmitted")).toBe(60);
    expect(result.current.notifications.find(({ kind }) => kind === "workRejected")).toMatchObject({
      id: `review:0xold:${now - HOUR}`,
      work: { reviewFeedback: "The photo misses the new bed." },
    });
  });

  it.each([
    ["granted on chain before the roster shows it", { gardeners: [ALICE, BOB] }, [ALICE], true],
    ["revoked on chain while the roster still shows it", { stewards: [ALICE] }, [], false],
  ])("follows the claim panel's chain read for take-up requests: %s", async (_case, roles, chainStewards, decides) => {
    seedGarden(roles);
    reads.chainStewards = chainStewards.map((who) => who.toLowerCase());

    const { result } = renderNotifications();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(latest(reads.takeUpReads)?.options.enabled).toBe(decides);
    expect(result.current.notifications.some(({ kind }) => kind === "takeUpRequested")).toBe(
      decides
    );
  });

  it("says when the work it read may be incomplete", async () => {
    seedGarden({ stewards: [ALICE] });
    const { result, rerender } = renderNotifications();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isIncomplete).toBe(false);

    // Some decisions on the page could not be read.
    reads.worksPartial = true;
    rerender({ id: GARDEN });
    expect(result.current.isIncomplete).toBe(true);

    // The week ran past its limit.
    reads.worksPartial = false;
    reads.activity = { rows: [], complete: false };
    await act(() => client.invalidateQueries());
    await waitFor(() => expect(result.current.isIncomplete).toBe(true));
  });

  it("marks the week incomplete when an off-page work's decisions disagree, and lists no submission for it", async () => {
    seedGarden({ stewards: [ALICE] });
    // Two decisions in one timestamp bucket disagree, so the week's read lists the work with no
    // decision at all: it is not known to be pending.
    const { status: _status, ...split } = createMockWork({
      id: "0xsplit",
      gardenerAddress: BOB,
      gardenAddress: GARDEN,
      createdAt: now - 40 * HOUR,
    });
    reads.activity = { complete: true, rows: [split] };

    const { result } = renderNotifications();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.isIncomplete).toBe(true));
    expect(result.current.notifications.map(({ id }) => id)).not.toContain("submission:0xsplit");
    // The page's own submission still counts.
    expect(result.current.notifications.map(({ id }) => id)).toContain("submission:0xw2");
  });

  describe("newness while the app stays mounted", () => {
    const WEEK = NEW_NOTIFICATION_WINDOW_SECONDS;

    /** Alice's only event: her work, approved at `reviewedAt`. */
    function seedOneApproval(reviewedAt: number) {
      seedGarden({ gardeners: [ALICE, BOB] });
      reads.takeUps = [];
      reads.commitments = [];
      reads.works = [
        createMockWork({
          id: "0xold",
          gardenerAddress: ALICE,
          gardenAddress: GARDEN,
          status: "approved",
          createdAt: now - 10 * 24 * HOUR,
          reviewedAt,
        }),
      ];
    }

    it("recomputes what is new when the sheet opens, so a badge never outlives its event's week", async () => {
      // Approved a week ago less a minute: new for one more minute.
      seedOneApproval(now - WEEK + 60);
      const { result } = renderNotifications();
      await waitFor(() => expect(result.current.newCount).toBe(1));

      // Two minutes pass with the app open; nothing re-renders the hook.
      vi.spyOn(Date, "now").mockReturnValue((now + 120) * 1000);
      act(() => result.current.markSeen(result.current.notifications));

      expect(result.current.newCount).toBe(0);
      expect(result.current.notifications.map(({ isNew }) => isNew)).toEqual([false]);
      // The week, not a mark, retired it: nothing listed was new to record.
      expect(useGardenNotificationsSeenStore.getState().seenByScope).toEqual({});
    });

    it("recomputes what is new when the page becomes visible again", async () => {
      seedOneApproval(now - WEEK + 60);
      const { result } = renderNotifications();
      await waitFor(() => expect(result.current.newCount).toBe(1));

      vi.spyOn(Date, "now").mockReturnValue((now + 120) * 1000);
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });

      expect(result.current.newCount).toBe(0);
    });

    it("retires a badge by itself at the week's end", async () => {
      // Leaves the week one second from now.
      seedOneApproval(now - WEEK + 1);
      const { result } = renderNotifications();
      await waitFor(() => expect(result.current.newCount).toBe(1));

      await waitFor(() => expect(result.current.newCount).toBe(0), { timeout: 6_000 });
      expect(result.current.notifications).toHaveLength(1);
    });
  });
});
