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
  pools: [] as CommitmentPoolRecord[],
  commitments: [] as CommitmentReadModel[],
  takeUps: [] as PoolClaimRequestRow[],
  commitmentReads: [] as ReadCall[],
  takeUpReads: [] as ReadCall[],
}));

vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => reads.account,
}));
vi.mock("../../../modules/data/greengoods", () => ({
  getGardens: () => Promise.resolve(reads.gardens),
  getActions: vi.fn(),
  getGardeners: vi.fn(),
}));
vi.mock("../../../hooks/work/useWorks", () => ({
  useWorks: (gardenId: string) => ({
    works: reads.works.filter((work) => work.gardenAddress === gardenId),
    isLoading: false,
    isError: reads.worksFailed,
  }),
}));
vi.mock("../../../hooks/commitment-pooling/useCommitmentPooling", () => ({
  useCommitmentPools: (input: { garden?: string }) => ({
    pools: reads.pools.filter((pool) => pool.garden === input.garden),
    isLoading: false,
    isError: false,
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
    };
  },
}));
vi.mock("../../../hooks/commitment-pooling/usePoolClaimRequests", () => ({
  usePoolClaimRequests: (input: Record<string, unknown>, options: { enabled?: boolean } = {}) => {
    reads.takeUpReads.push({ input, options });
    return { data: reads.takeUps, rows: reads.takeUps, isLoading: false, isError: false };
  },
}));

const ALICE = "0xa11ce00000000000000000000000000000000001" as Address;
const BOB = "0xb0b0000000000000000000000000000000000002" as Address;
const CAROL = "0x3333333333333333333333333333333333333333" as Address;
const GARDEN = "0x6000000000000000000000000000000000000001" as Address;
const OTHER_GARDEN = "0x6000000000000000000000000000000000000002" as Address;
const HOUR = 3_600;
const STEWARD_KINDS = ["workSubmitted", "takeUpRequested"];

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
  useGardenNotificationsSeenStore.setState({ seenByScope: {} });
  reads.account = ALICE;
  reads.worksFailed = false;
  reads.commitmentReads = [];
  reads.takeUpReads = [];
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
    expect(latest(reads.commitmentReads)).toEqual({
      input: { chainId: DEFAULT_CHAIN_ID, poolId: 101n },
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

    const { result } = renderNotifications();

    // Until the garden list answers, the account's roles are unknown and the list incomplete.
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(latest(reads.takeUpReads)?.options.enabled).toBe(steward);
    const kinds = result.current.notifications.map(({ kind }) => kind);
    expect(kinds.filter((kind) => STEWARD_KINDS.includes(kind))).toEqual(
      steward ? STEWARD_KINDS : []
    );
    expect(kinds).toEqual(expect.arrayContaining(["workApproved", "promiseTakenUp"]));
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

    act(() => result.current.markAllSeen());

    expect(result.current.newCount).toBe(0);
    expect(result.current.notifications.every(({ isNew }) => !isNew)).toBe(true);
    expect(Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))).toEqual([
      GARDEN_NOTIFICATIONS_SEEN_STORAGE_KEY,
    ]);
    expect(Object.keys(useGardenNotificationsSeenStore.getState().seenByScope)).toEqual([
      `${DEFAULT_CHAIN_ID}:${ALICE}:${GARDEN}`,
    ]);

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

  it("says when a read failed and keeps listing what the others found", async () => {
    seedGarden({ stewards: [ALICE] });
    reads.worksFailed = true;

    const { result } = renderNotifications();

    await waitFor(() => expect(result.current.isError).toBe(true));
    await waitFor(() =>
      expect(result.current.notifications.map(({ kind }) => kind)).toContain("promiseTakenUp")
    );
  });
});
