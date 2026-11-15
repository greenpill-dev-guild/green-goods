/**
 * useActiveGarden tests: the store, the membership owner and the resolver together. One garden
 * selects itself and is remembered, a remembered garden opens while the list loads, only the
 * account's own gardens can be switched to, an account switch never borrows another account's
 * choice, and nothing but the choice is written.
 */

import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CHAIN_ID } from "../../../config/default-chain";
import { useActiveGarden } from "../../../hooks/garden/useActiveGarden";
import { activeGardenScope } from "../../../modules/garden/active-garden";
import {
  ACTIVE_GARDEN_STORAGE_KEY,
  useActiveGardenStore,
} from "../../../stores/useActiveGardenStore";
import { useWorkFlowStore } from "../../../stores/useWorkFlowStore";
import type { Address, Garden } from "../../../types/domain";
import { createMockGarden } from "../../test-utils/mock-factories";
import { createTestQueryClient } from "../../test-utils/query-client";

const { getGardens, signedIn } = vi.hoisted(() => ({
  getGardens: vi.fn<() => Promise<Garden[]>>(),
  signedIn: { account: null as string | null },
}));

// The indexer read and the signed-in account are the edges; the rest runs for real.
vi.mock("../../../modules/data/greengoods", () => ({
  getGardens,
  getActions: vi.fn(),
  getGardeners: vi.fn(),
}));
vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => signedIn.account,
}));

const ALICE = "0xa11ce00000000000000000000000000000000001";
const BOB = "0xb0b0000000000000000000000000000000000002";
const ALICE_SCOPE = activeGardenScope(DEFAULT_CHAIN_ID, ALICE) as string;

function garden(suffix: string, gardeners: string[]): Garden {
  return createMockGarden({
    id: `0x60000000000000000000000000000000000000${suffix}`,
    gardeners: gardeners as Address[],
    stewards: [],
  });
}

const shared = garden("01", [ALICE, BOB]);
const alicesOwn = garden("02", [ALICE]);
const bobsOwn = garden("03", [BOB]);
/** Alice's own garden as a list read before she was added to it, or one that lags behind. */
const alicesOwnWithoutHer = { ...alicesOwn, gardeners: [] };

let client: QueryClient;

function renderActiveGarden() {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return renderHook(() => useActiveGarden(), { wrapper });
}

/** Everything this device keeps in local storage, except the active garden's own record. */
function otherStoredRecords(): Record<string, string | null> {
  return Object.fromEntries(
    Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index) ?? "")
      .filter((key) => key !== ACTIVE_GARDEN_STORAGE_KEY)
      .map((key) => [key, localStorage.getItem(key)])
  );
}

beforeEach(() => {
  client = createTestQueryClient();
  localStorage.clear();
  useActiveGardenStore.setState({ gardenIdsByScope: {}, seenGardenIdsByScope: {} });
  useWorkFlowStore.getState().reset();
  getGardens.mockReset();
  signedIn.account = ALICE;
});

afterEach(() => {
  client.clear();
  localStorage.clear();
});

describe("useActiveGarden", () => {
  it("selects the account's one garden and remembers it", async () => {
    getGardens.mockResolvedValue([alicesOwn, bobsOwn]);

    const { result } = renderActiveGarden();

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.gardenId).toBe(alicesOwn.id);
    expect(result.current.garden).toEqual(alicesOwn);
    expect(useActiveGardenStore.getState().gardenIdsByScope).toEqual({
      [ALICE_SCOPE]: alicesOwn.id,
    });
  });

  it("opens the remembered garden while the list loads, then confirms it", async () => {
    useActiveGardenStore.getState().rememberGarden(ALICE_SCOPE, shared.id);
    let answer: (gardens: Garden[]) => void = () => {};
    getGardens.mockReturnValue(new Promise((resolve) => (answer = resolve)));

    const { result } = renderActiveGarden();

    expect(result.current).toMatchObject({ status: "loading", gardenId: shared.id });
    // Until the gardens are known, a scoped list shows the remembered garden's items only.
    expect(result.current.inScope([shared.id])).toBe(true);
    expect(result.current.inScope([bobsOwn.id])).toBe(false);
    await act(async () => answer([shared, alicesOwn]));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.gardenId).toBe(shared.id);
  });

  it("scopes lists to the active garden, keeping what no garden of the account's can show", async () => {
    getGardens.mockResolvedValue([shared, alicesOwn, bobsOwn]);

    const { result } = renderActiveGarden();
    await waitFor(() => expect(result.current.status).toBe("choose"));
    // No garden chosen yet: nothing is hidden.
    expect(result.current.inScope([alicesOwn.id])).toBe(true);

    act(() => result.current.selectGarden(shared.id));
    expect(result.current.inScope([shared.id])).toBe(true);
    // The chip can switch to Alice's own garden, so its items wait there.
    expect(result.current.inScope([alicesOwn.id])).toBe(false);
    // Bob's garden has no place on Alice's chip, so nothing of it is stranded.
    expect(result.current.inScope([bobsOwn.id])).toBe(true);
    expect(result.current.inScope([null])).toBe(true);
  });

  it("switches only to one of the account's own gardens", async () => {
    getGardens.mockResolvedValue([shared, alicesOwn, bobsOwn]);

    const { result } = renderActiveGarden();
    await waitFor(() => expect(result.current.status).toBe("choose"));

    act(() => result.current.selectGarden(alicesOwn.id.toUpperCase().replace("0X", "0x")));
    expect(result.current).toMatchObject({ status: "ready", gardenId: alicesOwn.id });

    // Bob's garden is only a visit for Alice: picking it changes nothing.
    act(() => result.current.selectGarden(bobsOwn.id));
    expect(result.current).toMatchObject({ status: "ready", gardenId: alicesOwn.id });
  });

  it("never opens another account's remembered garden after an account switch", async () => {
    useActiveGardenStore.getState().rememberGarden(ALICE_SCOPE, shared.id);
    getGardens.mockResolvedValue([shared, alicesOwn, bobsOwn]);

    const { result, rerender } = renderActiveGarden();
    await waitFor(() => expect(result.current.gardenId).toBe(shared.id));

    signedIn.account = BOB;
    rerender();
    expect(result.current).toMatchObject({ status: "choose", gardenId: null });

    signedIn.account = ALICE;
    rerender();
    expect(result.current).toMatchObject({ status: "ready", gardenId: shared.id });
  });

  // PRD-1492: a steward added to a second garden chose it, and a later launch opened the community
  // garden again. A list that came back holding one garden selected it and replaced the
  // remembered choice, so the next full list no longer brought that choice back.
  it("keeps the remembered garden through a list that comes back holding only another", async () => {
    useActiveGardenStore.getState().rememberGarden(ALICE_SCOPE, alicesOwn.id);
    getGardens
      .mockResolvedValueOnce([shared, alicesOwnWithoutHer])
      .mockResolvedValue([shared, alicesOwn]);

    const { result } = renderActiveGarden();

    // Only the shared garden is hers in that list, so Home opens there, and her choice stays.
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.gardenId).toBe(shared.id);
    expect(useActiveGardenStore.getState().gardenIdsByScope[ALICE_SCOPE]).toBe(alicesOwn.id);

    await act(async () => {
      await client.refetchQueries();
    });
    await waitFor(() => expect(result.current.gardenId).toBe(alicesOwn.id));
  });

  it("names the gardens the account was added to since this device last read them", async () => {
    getGardens
      .mockResolvedValueOnce([shared, alicesOwnWithoutHer])
      .mockResolvedValue([shared, alicesOwn]);

    const { result, unmount } = renderActiveGarden();

    // The first list a device reads for an account records what it holds and announces nothing.
    await waitFor(() => expect(result.current.gardenId).toBe(shared.id));
    expect(result.current.addedGardens).toEqual([]);

    await act(async () => {
      await client.refetchQueries();
    });
    await waitFor(() =>
      expect(result.current.addedGardens.map(({ id }) => id)).toEqual([alicesOwn.id])
    );
    // Being added moves nothing: Home stays in the garden she chose until she switches.
    expect(result.current.gardenId).toBe(shared.id);

    act(() => result.current.acknowledgeAddedGardens([alicesOwn.id]));
    expect(result.current.addedGardens).toEqual([]);
    // Reopening the app does not announce it again.
    unmount();
    const reopened = renderActiveGarden();
    await waitFor(() => expect(reopened.result.current.status).toBe("ready"));
    expect(reopened.result.current.addedGardens).toEqual([]);
  });

  it("writes only its own choice: no draft, queued job or promise link changes", async () => {
    // A submission in progress for another garden: its garden and promise link are its own.
    useWorkFlowStore.getState().setGardenAddress(bobsOwn.id as Address);
    const flowBefore = useWorkFlowStore.getState();
    const storedBefore = otherStoredRecords();
    getGardens.mockResolvedValue([shared, alicesOwn]);

    const { result } = renderActiveGarden();
    await waitFor(() => expect(result.current.status).toBe("choose"));
    act(() => result.current.selectGarden(shared.id));

    expect(result.current.gardenId).toBe(shared.id);
    expect(useWorkFlowStore.getState()).toBe(flowBefore);
    expect(otherStoredRecords()).toEqual(storedBefore);
  });
});
