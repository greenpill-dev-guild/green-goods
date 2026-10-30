/**
 * useMyGardens tests: the account's gardens read from the gardens list, with loaded, error and
 * stale flags that keep "could not read" apart from "none", an open join counted until the
 * roster shows it, and a join request waiting for a steward counted for nothing and forgotten
 * once the roster lists the account.
 */

import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CHAIN_ID } from "../../../config/default-chain";
import { gardensKeys } from "../../../config/query-keys/garden";
import { gardenJoinRequestKeys } from "../../../config/query-keys/garden-join-requests";
import { useMyGardens } from "../../../hooks/garden/useMyGardens";
import {
  awaitingJoinRequestScope,
  useAwaitingJoinRequestsStore,
} from "../../../stores/useAwaitingJoinRequestsStore";
import type { Garden } from "../../../types/domain";
import { createMockGarden } from "../../test-utils/mock-factories";
import { createTestQueryClient } from "../../test-utils/query-client";

const { getGardens } = vi.hoisted(() => ({ getGardens: vi.fn<() => Promise<Garden[]>>() }));

// The indexer read is the edge; the list hook, its cache and the membership rules run for real.
vi.mock("../../../modules/data/greengoods", () => ({
  getGardens,
  getActions: vi.fn(),
  getGardeners: vi.fn(),
}));

const PENDING_JOINS_KEY = "greengoods:pending-joins";
const ACCOUNT = "0xa11ce00000000000000000000000000000000001";
const OTHER = "0xb0b0000000000000000000000000000000000002";

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
});

afterEach(() => {
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

  // The device keeps a sent join request so Awaiting review survives a relaunch; a roster that
  // lists the account means a steward answered it, in this scope only.
  it("forgets a join request once the roster lists the account", async () => {
    const scope = awaitingJoinRequestScope(DEFAULT_CHAIN_ID, ACCOUNT)!;
    const otherScope = awaitingJoinRequestScope(DEFAULT_CHAIN_ID, OTHER)!;
    const waiting = {
      state: "pending" as const,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    };
    const { noteRequest } = useAwaitingJoinRequestsStore.getState();
    noteRequest(scope, stewarded.id, waiting, Date.now());
    noteRequest(scope, requested.id, waiting, Date.now());
    noteRequest(otherScope, stewarded.id, waiting, Date.now());
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
