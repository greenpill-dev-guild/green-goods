/**
 * useMyGardens tests: the account's gardens read from the gardens list, with loaded, error and
 * stale flags that keep "could not read" apart from "none", an open join counted until the
 * roster shows it, a join request waiting for a steward counted for nothing and forgotten once
 * the roster lists the account, and a request the chain shows welcomed counted until then.
 */

import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CHAIN_ID } from "../../../config/default-chain";
import { gardensKeys } from "../../../config/query-keys/garden";
import { gardenJoinRequestKeys } from "../../../config/query-keys/garden-join-requests";
import { roleKeys } from "../../../config/query-keys/identity";
import { useMyGardens } from "../../../hooks/garden/useMyGardens";
import { markOwnJoinEntry } from "../../../modules/garden/pending-joins";
import {
  awaitingJoinRequestScope,
  useAwaitingJoinRequestsStore,
} from "../../../stores/useAwaitingJoinRequestsStore";
import type { Garden } from "../../../types/domain";
import { createMockGarden } from "../../test-utils/mock-factories";
import { createTestQueryClient } from "../../test-utils/query-client";

const { getGardens, readGardenRole } = vi.hoisted(() => ({
  getGardens: vi.fn<() => Promise<Garden[]>>(),
  readGardenRole:
    vi.fn<(garden: string, account: string, role: string, chainId: number) => Promise<boolean>>(),
}));

// The indexer read is the edge; the list hook, its cache and the membership rules run for real.
vi.mock("../../../modules/data/greengoods", () => ({
  getGardens,
  getActions: vi.fn(),
  getGardeners: vi.fn(),
}));

// The chain is the other edge: whether the account holds a role, read with no signature.
vi.mock("../../../utils/blockchain/garden-role-reads", () => ({ readGardenRole }));

const PENDING_JOINS_KEY = "greengoods:pending-joins";
const ACCOUNT = "0xa11ce00000000000000000000000000000000001";
const OTHER = "0xb0b0000000000000000000000000000000000002";
/** What the join request service says of a request a steward has not answered yet. */
const WAITING = {
  state: "pending" as const,
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
};

function garden(suffix: string, overrides: Partial<Garden>): Garden {
  return createMockGarden({
    id: `0x50000000000000000000000000000000000000${suffix}`,
    gardeners: [],
    stewards: [],
    ...overrides,
  });
}

const stewarded = garden("01", { stewards: [ACCOUNT] });
const evaluated = garden("02", { evaluators: [ACCOUNT] });
const visited = garden("03", { gardeners: [OTHER], stewards: [OTHER] });
const openJoined = garden("04", { openJoining: true, stewards: [OTHER] });
const requested = garden("05", { openJoining: false, stewards: [OTHER] });

let client: QueryClient;

function renderMyGardens(account: string | null = ACCOUNT, chainId = DEFAULT_CHAIN_ID) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return renderHook(({ account, chainId }) => useMyGardens(account, chainId), {
    wrapper,
    initialProps: { account, chainId },
  });
}

function savePendingJoins(records: Record<string, { address: string; timestamp: number }>) {
  localStorage.setItem(PENDING_JOINS_KEY, JSON.stringify(records));
}

beforeEach(() => {
  client = createTestQueryClient();
  localStorage.clear();
  useAwaitingJoinRequestsStore.setState({ requestsByScope: {} });
  getGardens.mockReset();
  readGardenRole.mockReset();
  readGardenRole.mockResolvedValue(false);
});

afterEach(() => {
  vi.useRealTimers();
  client.clear();
  localStorage.clear();
});

describe("useMyGardens", () => {
  it("returns the account's gardens and roles once the list is read", async () => {
    getGardens.mockResolvedValue([stewarded, visited, evaluated]);

    const { result } = renderMyGardens();

    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.gardens).toEqual([
      { garden: stewarded, membership: { roles: ["steward"], pendingJoin: false } },
      { garden: evaluated, membership: { roles: ["evaluator"], pendingJoin: false } },
    ]);
    expect(result.current).toMatchObject({ isError: false, isStale: false });
  });

  it("counts a fresh open join this device sent, and nothing for a join request", async () => {
    savePendingJoins({
      [openJoined.id]: { address: ACCOUNT, timestamp: Date.now() },
      // Past the 15-minute limit: the roster never caught up, so the join counts for nothing.
      [visited.id]: { address: ACCOUNT, timestamp: Date.now() - 16 * 60_000 },
    });
    // A request on an approval-gated garden waits for a steward and grants nothing.
    client.setQueryData(
      gardenJoinRequestKeys.self(DEFAULT_CHAIN_ID, requested.id, ACCOUNT, "passkey"),
      {
        request: {
          id: "request-1",
          kind: "garden_membership",
          state: "pending",
          revision: 1,
          requestedVia: "garden_detail",
          requestedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
          canAskAgain: false,
        },
        hasCheckedStatus: true,
        outcomeUnknown: false,
      }
    );
    getGardens.mockResolvedValue([openJoined, visited, requested]);

    const { result } = renderMyGardens();

    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.gardens).toEqual([
      { garden: openJoined, membership: { roles: [], pendingJoin: true } },
    ]);
  });

  // The join never reaches the indexer and the screen stays open: only the clock moves.
  it("stops counting an open join the moment its limit passes, with nothing else happening", () => {
    vi.useFakeTimers();
    client.setQueryData(gardensKeys.byChain(DEFAULT_CHAIN_ID), [openJoined]);
    savePendingJoins({ [openJoined.id]: { address: ACCOUNT, timestamp: Date.now() } });

    const { result } = renderMyGardens();
    expect(result.current.gardens).toEqual([
      { garden: openJoined, membership: { roles: [], pendingJoin: true } },
    ]);

    // Every reader still counts the join at the limit itself; it lapses a millisecond later.
    act(() => vi.advanceTimersByTime(15 * 60_000));
    expect(result.current.gardens).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.gardens).toEqual([]);
    expect(getGardens).not.toHaveBeenCalled();
  });

  it("forgets an open join once the roster lists the account", async () => {
    savePendingJoins({ [stewarded.id]: { address: ACCOUNT, timestamp: Date.now() } });
    getGardens.mockResolvedValue([stewarded]);

    const { result } = renderMyGardens();

    await waitFor(() => expect(localStorage.getItem(PENDING_JOINS_KEY)).toBe("{}"));
    expect(result.current.gardens[0]?.membership).toEqual({
      roles: ["steward"],
      pendingJoin: false,
    });
  });

  // The indexer is behind the chain for a while after a join: the join writes the account into the
  // list it holds (useJoinGarden), and the next read drops it again.
  it("keeps an open join standing in until a read of the roster lists the account", async () => {
    getGardens.mockResolvedValue([openJoined]);
    const { result } = renderMyGardens();
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    const key = gardensKeys.byChain(DEFAULT_CHAIN_ID);
    const listed: Garden = { ...openJoined, gardeners: [ACCOUNT] };
    savePendingJoins({ [openJoined.id]: { address: ACCOUNT, timestamp: Date.now() } });
    client.setQueryData(key, [markOwnJoinEntry(listed, ACCOUNT)]);
    await waitFor(() => expect(result.current.gardens[0]?.membership.roles).toEqual(["gardener"]));
    // A later write to the list, such as a steward's approval elsewhere, is no read of this roster.
    await act(async () => {
      client.setQueryData<Garden[]>(key, (gardens) => gardens?.map((garden) => ({ ...garden })));
    });
    expect(localStorage.getItem(PENDING_JOINS_KEY)).toContain(openJoined.id);

    await act(() => client.invalidateQueries({ queryKey: key }));
    await waitFor(() =>
      expect(result.current.gardens[0]?.membership).toEqual({ roles: [], pendingJoin: true })
    );

    getGardens.mockResolvedValue([listed]);
    await act(() => client.invalidateQueries({ queryKey: key }));
    await waitFor(() => expect(localStorage.getItem(PENDING_JOINS_KEY)).toBe("{}"));
    expect(result.current.gardens[0]?.membership).toEqual({
      roles: ["gardener"],
      pendingJoin: false,
    });
  });

  // The device keeps a sent join request so Awaiting review survives a relaunch; a roster that
  // lists the account means a steward answered it, in this scope only.
  it("forgets a join request once the roster lists the account", async () => {
    const scope = awaitingJoinRequestScope(DEFAULT_CHAIN_ID, ACCOUNT)!;
    const otherScope = awaitingJoinRequestScope(DEFAULT_CHAIN_ID, OTHER)!;
    const { noteRequest } = useAwaitingJoinRequestsStore.getState();
    noteRequest(scope, stewarded.id, WAITING, Date.now());
    noteRequest(scope, requested.id, WAITING, Date.now());
    noteRequest(otherScope, stewarded.id, WAITING, Date.now());
    getGardens.mockResolvedValue([stewarded, requested]);

    const { result } = renderMyGardens();

    await waitFor(() =>
      expect(Object.keys(useAwaitingJoinRequestsStore.getState().requestsByScope[scope])).toEqual([
        requested.id.toLowerCase(),
      ])
    );
    expect(
      Object.keys(useAwaitingJoinRequestsStore.getState().requestsByScope[otherScope])
    ).toEqual([stewarded.id.toLowerCase()]);
    expect(result.current.gardens.map(({ garden }) => garden.id)).toEqual([stewarded.id]);
  });

  // A steward's welcome is on chain at once and in the roster only once the indexer catches up
  // (PRD-1209). Where this device asked to join, the chain's answer stands in until then.
  it("counts a garden the chain says welcomed the account, until the roster lists it", async () => {
    const scope = awaitingJoinRequestScope(DEFAULT_CHAIN_ID, ACCOUNT)!;
    useAwaitingJoinRequestsStore.getState().noteRequest(scope, requested.id, WAITING, Date.now());
    readGardenRole.mockResolvedValue(true);
    getGardens.mockResolvedValue([visited, requested]);

    const { result } = renderMyGardens();

    await waitFor(() =>
      expect(result.current.gardens).toEqual([
        { garden: requested, membership: { roles: [], pendingJoin: true } },
      ])
    );
    // Only the garden this device asked to join is read, for the role a welcome grants.
    expect(readGardenRole).toHaveBeenCalledOnce();
    expect(readGardenRole).toHaveBeenCalledWith(
      requested.id,
      ACCOUNT,
      "gardener",
      DEFAULT_CHAIN_ID
    );
    expect(useAwaitingJoinRequestsStore.getState().requestsByScope[scope]).toBeUndefined();

    getGardens.mockResolvedValue([visited, { ...requested, gardeners: [ACCOUNT] }]);
    await act(() => client.invalidateQueries({ queryKey: gardensKeys.byChain(DEFAULT_CHAIN_ID) }));
    await waitFor(() => expect(localStorage.getItem(PENDING_JOINS_KEY)).toBe("{}"));
    expect(result.current.gardens[0]?.membership).toEqual({
      roles: ["gardener"],
      pendingJoin: false,
    });
  });

  // A yes kept from an earlier session counts for nothing: the account may have left the garden
  // or been removed since.
  it.each([
    ["the chain says no", () => readGardenRole.mockResolvedValue(false)],
    ["the chain cannot be read", () => readGardenRole.mockRejectedValue(new Error("RPC down"))],
    [
      "only an earlier session's answer says yes",
      () =>
        client.setQueryData(roleKeys.hasRole(requested.id, ACCOUNT, "gardener"), true, {
          updatedAt: Date.now() - 10 * 60_000,
        }),
    ],
  ])("keeps a request waiting when %s", async (_case, arrange) => {
    const scope = awaitingJoinRequestScope(DEFAULT_CHAIN_ID, ACCOUNT)!;
    useAwaitingJoinRequestsStore.getState().noteRequest(scope, requested.id, WAITING, Date.now());
    arrange();
    // The list is in hand from the first render, so a kept answer is seen before the chain is asked.
    client.setQueryData(gardensKeys.byChain(DEFAULT_CHAIN_ID), [requested]);

    const { result } = renderMyGardens();

    await waitFor(() => expect(readGardenRole).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(
        client.getQueryState(roleKeys.hasRole(requested.id, ACCOUNT, "gardener"))?.fetchStatus
      ).toBe("idle")
    );
    expect(result.current.gardens).toEqual([]);
    expect(Object.keys(useAwaitingJoinRequestsStore.getState().requestsByScope[scope])).toEqual([
      requested.id.toLowerCase(),
    ]);
    expect(localStorage.getItem(PENDING_JOINS_KEY)).toBeNull();
  });

  it("keeps the last good list, flagged stale, when a refresh fails", async () => {
    client.setQueryData(gardensKeys.byChain(DEFAULT_CHAIN_ID), [stewarded], {
      updatedAt: Date.now() - 10 * 60_000,
    });
    getGardens.mockRejectedValue(new Error("indexer unavailable"));

    const { result } = renderMyGardens();

    expect(result.current).toMatchObject({ isLoaded: true, isStale: true });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isStale).toBe(true);
    expect(result.current.gardens.map(({ garden }) => garden.id)).toEqual([stewarded.id]);
  });

  it("reports a failed read with nothing cached as an error, not as no gardens", async () => {
    getGardens.mockRejectedValue(new Error("indexer unavailable"));

    const { result } = renderMyGardens();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current).toMatchObject({ gardens: [], isLoaded: false, isStale: false });
  });

  it("knows nothing while the first read is in flight", () => {
    getGardens.mockReturnValue(new Promise(() => {}));

    const { result } = renderMyGardens();

    expect(result.current).toMatchObject({
      gardens: [],
      isLoaded: false,
      isError: false,
      isStale: false,
    });
  });

  it("follows an account switch on the same list", async () => {
    getGardens.mockResolvedValue([stewarded, visited]);

    const { result, rerender } = renderMyGardens();
    await waitFor(() => expect(result.current.gardens).toHaveLength(1));

    rerender({ account: OTHER, chainId: DEFAULT_CHAIN_ID });
    expect(result.current.gardens.map(({ garden }) => garden.id)).toEqual([visited.id]);

    rerender({ account: null, chainId: DEFAULT_CHAIN_ID });
    expect(result.current.gardens).toEqual([]);
  });

  it("never offers another chain's list while this chain's list loads", async () => {
    getGardens.mockResolvedValueOnce([stewarded]).mockReturnValue(new Promise(() => {}));

    const { result, rerender } = renderMyGardens();
    await waitFor(() => expect(result.current.gardens).toHaveLength(1));

    rerender({ account: ACCOUNT, chainId: DEFAULT_CHAIN_ID === 42161 ? 11155111 : 42161 });
    expect(result.current).toMatchObject({ gardens: [], isLoaded: false });
  });
});
