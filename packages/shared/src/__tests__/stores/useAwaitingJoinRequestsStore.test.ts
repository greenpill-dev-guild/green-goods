/**
 * Awaiting join requests store tests: the join requests this device sent that still wait for a
 * steward, one record per chain and account, saved under its own key with nothing but garden ids
 * and expiries, brought back after a reload, and dropped once answered, settled or expired.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../../modules/app/logger";
import {
  AWAITING_JOIN_REQUESTS_STORAGE_KEY,
  awaitingJoinRequestScope,
  useAwaitingJoinRequestsStore,
} from "../../stores/useAwaitingJoinRequestsStore";

const NOW = Date.UTC(2026, 9, 25, 12);
const DAY = 86_400_000;
const ALICE = "0xA11CE00000000000000000000000000000000001";
const ALICE_SCOPE = "42161:0xa11ce00000000000000000000000000000000001";
const BOB_SCOPE = "42161:0xb0b0000000000000000000000000000000000002";
const GARDEN_A = "0xA000000000000000000000000000000000000001";
const GARDEN_B = "0xB000000000000000000000000000000000000002";
const A = GARDEN_A.toLowerCase();
const B = GARDEN_B.toLowerCase();

/** What the service says about a pending request that expires in `days` from `NOW`. */
const pending = (days: number) => ({
  state: "pending" as const,
  expiresAt: new Date(NOW + days * DAY).toISOString(),
});

function storedKeys(): string[] {
  return Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index) ?? "");
}

function saveRecords(requestsByScope: unknown) {
  localStorage.setItem(
    AWAITING_JOIN_REQUESTS_STORAGE_KEY,
    JSON.stringify({ state: { requestsByScope }, version: 0 })
  );
}

beforeEach(() => {
  localStorage.clear();
  useAwaitingJoinRequestsStore.setState({ requestsByScope: {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("stores/useAwaitingJoinRequestsStore", () => {
  it("keeps a request under its chain and account, by lowercase garden id, apart from another's", () => {
    expect(awaitingJoinRequestScope(42161, ALICE)).toBe(ALICE_SCOPE);
    expect(awaitingJoinRequestScope(42161, null)).toBeNull();
    const { noteRequest } = useAwaitingJoinRequestsStore.getState();

    noteRequest(ALICE_SCOPE, GARDEN_A, pending(30), NOW);
    noteRequest(BOB_SCOPE, GARDEN_A, pending(10), NOW);
    noteRequest(ALICE_SCOPE, GARDEN_B, pending(20), NOW);

    expect(useAwaitingJoinRequestsStore.getState().requestsByScope).toEqual({
      [ALICE_SCOPE]: { [A]: { expiresAt: NOW + 30 * DAY }, [B]: { expiresAt: NOW + 20 * DAY } },
      [BOB_SCOPE]: { [A]: { expiresAt: NOW + 10 * DAY } },
    });
  });

  it("forgets a request once the service answers it, finds none, or the roster settles it", () => {
    const { noteRequest, forgetRequests } = useAwaitingJoinRequestsStore.getState();
    noteRequest(ALICE_SCOPE, GARDEN_A, pending(30), NOW);
    noteRequest(ALICE_SCOPE, GARDEN_B, pending(30), NOW);
    noteRequest(BOB_SCOPE, GARDEN_A, pending(30), NOW);

    // A steward welcomed one; a check found the other gone.
    noteRequest(ALICE_SCOPE, GARDEN_A, { ...pending(30), state: "welcomed" }, NOW);
    noteRequest(ALICE_SCOPE, GARDEN_B, null, NOW);
    expect(useAwaitingJoinRequestsStore.getState().requestsByScope).toEqual({
      [BOB_SCOPE]: { [A]: { expiresAt: NOW + 30 * DAY } },
    });

    // The roster lists the account, or the member withdrew: only this scope forgets.
    noteRequest(ALICE_SCOPE, GARDEN_A, pending(30), NOW);
    forgetRequests(ALICE_SCOPE, [GARDEN_A, GARDEN_B]);
    forgetRequests(BOB_SCOPE, [GARDEN_B]);
    expect(useAwaitingJoinRequestsStore.getState().requestsByScope).toEqual({
      [BOB_SCOPE]: { [A]: { expiresAt: NOW + 30 * DAY } },
    });
  });

  it("drops a request once it has expired, on the next note and after a reload", async () => {
    const { noteRequest } = useAwaitingJoinRequestsStore.getState();
    noteRequest(ALICE_SCOPE, GARDEN_A, pending(1), NOW);

    noteRequest(BOB_SCOPE, GARDEN_B, pending(30), NOW + 2 * DAY);
    // A request the service still calls pending past its own expiry is nothing to keep.
    noteRequest(BOB_SCOPE, GARDEN_A, pending(-1), NOW);
    expect(useAwaitingJoinRequestsStore.getState().requestsByScope).toEqual({
      [BOB_SCOPE]: { [B]: { expiresAt: NOW + 30 * DAY } },
    });

    saveRecords({
      [ALICE_SCOPE]: { [A]: { expiresAt: Date.now() - 1 }, [B]: { expiresAt: Date.now() + DAY } },
    });
    await useAwaitingJoinRequestsStore.persist.rehydrate();
    expect(
      Object.keys(useAwaitingJoinRequestsStore.getState().requestsByScope[ALICE_SCOPE])
    ).toEqual([B]);
  });

  it("saves only garden ids and expiries, under its own key", () => {
    useAwaitingJoinRequestsStore.getState().noteRequest(ALICE_SCOPE, GARDEN_A, pending(30), NOW);

    const saved = JSON.parse(localStorage.getItem(AWAITING_JOIN_REQUESTS_STORAGE_KEY) ?? "null");
    expect(saved?.state).toEqual({
      requestsByScope: { [ALICE_SCOPE]: { [A]: { expiresAt: NOW + 30 * DAY } } },
    });
    expect(storedKeys()).toEqual([AWAITING_JOIN_REQUESTS_STORAGE_KEY]);
  });

  it("brings the saved requests back after a reload and drops malformed ones", async () => {
    const fresh = Date.now() + DAY;
    saveRecords({
      [ALICE_SCOPE]: { [GARDEN_A]: { expiresAt: fresh }, [B]: { expiresAt: "soon" }, 7: null },
      [BOB_SCOPE]: "not a map",
      "1:0xc": { [B]: { expiresAt: fresh } },
    });

    await useAwaitingJoinRequestsStore.persist.rehydrate();

    expect(useAwaitingJoinRequestsStore.getState().requestsByScope).toEqual({
      [ALICE_SCOPE]: { [A]: { expiresAt: fresh } },
      "1:0xc": { [B]: { expiresAt: fresh } },
    });

    saveRecords("not a map");
    await useAwaitingJoinRequestsStore.persist.rehydrate();
    expect(useAwaitingJoinRequestsStore.getState().requestsByScope).toEqual({});
  });

  it("keeps the note for this session when storage refuses the write, and says so", () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      },
      removeItem: () => {},
    });

    expect(() =>
      useAwaitingJoinRequestsStore.getState().noteRequest(ALICE_SCOPE, GARDEN_A, pending(30), NOW)
    ).not.toThrow();
    expect(useAwaitingJoinRequestsStore.getState().requestsByScope).toEqual({
      [ALICE_SCOPE]: { [A]: { expiresAt: NOW + 30 * DAY } },
    });
    expect(warn).toHaveBeenCalledWith(
      "Could not save the join requests awaiting review",
      expect.objectContaining({ source: "useAwaitingJoinRequestsStore" })
    );
  });
});
