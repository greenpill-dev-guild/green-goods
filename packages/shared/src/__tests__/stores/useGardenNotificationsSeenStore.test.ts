/**
 * Garden notifications seen store tests: what this device has seen of each garden's events,
 * one record per chain, account and garden, saved under its own key, brought back after a
 * reload, with malformed saved records dropped.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../../modules/app/logger";
import {
  GARDEN_NOTIFICATIONS_SEEN_STORAGE_KEY,
  useGardenNotificationsSeenStore,
} from "../../stores/useGardenNotificationsSeenStore";

const NOW = 1_800_000_000;
const WEEK = 7 * 86_400;
const ALICE_IN_A =
  "42161:0xa11ce00000000000000000000000000000000001:0xa000000000000000000000000000000000000001";
const ALICE_IN_B =
  "42161:0xa11ce00000000000000000000000000000000001:0xb000000000000000000000000000000000000002";

function storedKeys(): string[] {
  return Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index) ?? "");
}

function saveRecords(seenByScope: unknown) {
  localStorage.setItem(
    GARDEN_NOTIFICATIONS_SEEN_STORAGE_KEY,
    JSON.stringify({ state: { seenByScope }, version: 0 })
  );
}

beforeEach(() => {
  localStorage.clear();
  useGardenNotificationsSeenStore.setState({ seenByScope: {} });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("stores/useGardenNotificationsSeenStore", () => {
  it("marks one garden's events seen without touching another garden's, and only once", () => {
    const shown = [{ id: "review:0xw1:1799990000", at: 1_799_990_000 }];
    useGardenNotificationsSeenStore.getState().markSeen(ALICE_IN_A, shown, NOW);
    const marked = useGardenNotificationsSeenStore.getState().seenByScope;

    expect(marked).toEqual({
      [ALICE_IN_A]: { seenThrough: NOW - WEEK, seen: { "review:0xw1:1799990000": 1_799_990_000 } },
    });

    // Nothing new to record, so nothing changes: a sheet that marks on every render settles.
    useGardenNotificationsSeenStore.getState().markSeen(ALICE_IN_A, shown, NOW + 60);
    expect(useGardenNotificationsSeenStore.getState().seenByScope).toBe(marked);
  });

  it("saves under its own key", () => {
    useGardenNotificationsSeenStore
      .getState()
      .markSeen(ALICE_IN_A, [{ id: "submission:0xw2", at: NOW - 60 }], NOW);

    const saved = JSON.parse(localStorage.getItem(GARDEN_NOTIFICATIONS_SEEN_STORAGE_KEY) ?? "null");
    expect(saved?.state).toEqual({
      seenByScope: {
        [ALICE_IN_A]: { seenThrough: NOW - WEEK, seen: { "submission:0xw2": NOW - 60 } },
      },
    });
    expect(storedKeys()).toEqual([GARDEN_NOTIFICATIONS_SEEN_STORAGE_KEY]);
  });

  it("brings saved records back after a reload and drops the malformed ones", async () => {
    const kept = { seenThrough: NOW - WEEK, seen: { "submission:0xw2": NOW - 60 } };
    saveRecords({
      [ALICE_IN_A]: kept,
      [ALICE_IN_B]: { seenThrough: "yesterday", seen: {} },
      "1:0xc:0xd": {
        seenThrough: NOW,
        seen: { "submission:0xw3": "soon", "submission:0xw4": NOW },
      },
      "1:0xe:0xf": "not a record",
    });

    await useGardenNotificationsSeenStore.persist.rehydrate();

    expect(useGardenNotificationsSeenStore.getState().seenByScope).toEqual({
      [ALICE_IN_A]: kept,
      "1:0xc:0xd": { seenThrough: NOW, seen: { "submission:0xw4": NOW } },
    });

    saveRecords("not a map");
    await useGardenNotificationsSeenStore.persist.rehydrate();
    expect(useGardenNotificationsSeenStore.getState().seenByScope).toEqual({});
  });

  it("keeps the marks for this session when storage refuses the write, and says so", () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      },
      removeItem: () => {},
    });

    expect(() =>
      useGardenNotificationsSeenStore
        .getState()
        .markSeen(ALICE_IN_A, [{ id: "submission:0xw2", at: NOW - 60 }], NOW)
    ).not.toThrow();
    expect(useGardenNotificationsSeenStore.getState().seenByScope[ALICE_IN_A]?.seen).toEqual({
      "submission:0xw2": NOW - 60,
    });
    expect(warn).toHaveBeenCalledWith(
      "Could not save which garden notifications were seen",
      expect.objectContaining({ source: "useGardenNotificationsSeenStore" })
    );
  });
});
