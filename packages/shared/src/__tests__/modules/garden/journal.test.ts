/**
 * Home journal tests: which works Recent Activity and the Highlights carousel show, which
 * seasons and campaigns lead the carousel, which promises Take Part offers, and the one state
 * each section reads in, so loading, a failure and "nothing saved offline" are never mistaken
 * for "nothing here" (DL-127, decisions 23, 27 and 32).
 */

import { describe, expect, it } from "vitest";
import type { CommitmentMetadataV1 } from "../../../modules/commitment-pooling/metadata";
import type {
  CommitmentCycleRecord,
  CommitmentReadModel,
} from "../../../modules/commitment-pooling/types-core";
import {
  cycleDaysLeft,
  featuredWork,
  type GardenWorkRead,
  JOURNAL_PREVIEW_COUNT,
  type JournalQueryRead,
  openAsk,
  openCycles,
  type PoolSectionRead,
  poolSectionState,
  recentActivityState,
  takePartEntries,
  takePartPromises,
} from "../../../modules/garden/journal";
import type { Address, Work } from "../../../types/domain";
import { cycleFixture, commitmentFixture } from "../../test-utils/commitment-pooling-fixtures";

const READER = "0xa11ce00000000000000000000000000000000001" as Address;
const NEIGHBOUR = "0xb0b0000000000000000000000000000000000002" as Address;
const DAY_MS = 86_400_000;
const NOW_MS = Date.UTC(2026, 9, 25, 12);

function work(id: string, createdAt: number, overrides: Partial<Work> = {}): Work {
  return {
    id,
    title: `Work ${id}`,
    actionUID: 1,
    gardenerAddress: NEIGHBOUR,
    gardenAddress: "0x5000000000000000000000000000000000000001",
    feedback: "",
    metadata: "bafy-work",
    media: [`https://example.test/${id}.jpg`],
    createdAt,
    status: "pending",
    ...overrides,
  };
}

/** A read of the garden's work, live and answered, unless told otherwise. */
function workRead(works: Work[], overrides: Partial<GardenWorkRead> = {}): GardenWorkRead {
  return {
    works,
    availability: works.length > 0 ? "available" : "empty",
    isError: false,
    isPaused: false,
    ...overrides,
  };
}

const uploading = work("job-1", 900, { status: "uploading", media: [] });
const pending = work("0x04", 800, { status: "pending" });
const approved = work("0x03", 700, { status: "approved", media: [] });
const rejected = work("0x02", 600, { status: "rejected" });
const older = work("0x01", 500, { status: "approved" });

describe("Recent Activity", () => {
  it("shows the garden's three newest works and leaves the member's unsent uploads to Continue", () => {
    const state = recentActivityState(workRead([older, uploading, rejected, pending, approved]));

    expect(state).toEqual({
      status: "ready",
      items: [pending, approved, rejected],
      savedAt: null,
    });
    expect(JOURNAL_PREVIEW_COUNT).toBe(3);
  });

  it("says when an offline copy was saved, and only then", () => {
    const savedAt = NOW_MS - DAY_MS;
    const state = recentActivityState(
      workRead([pending], { isPaused: true, lastSuccessfulRefresh: savedAt })
    );

    expect(state).toEqual({ status: "ready", items: [pending], savedAt });
  });

  it.each<[string, string, GardenWorkRead]>([
    ["the read has not answered yet", "loading", workRead([], { availability: "unavailable" })],
    [
      "a failed read with nothing to show",
      "error",
      workRead([], { availability: "unavailable", isError: true }),
    ],
    ["a garden with no work", "empty", workRead([])],
    // The member's own upload is not the garden's activity: Continue shows it.
    [
      "the member's unsent upload alone",
      "empty",
      workRead([uploading], { availability: "available" }),
    ],
    [
      "offline with nothing saved",
      "offline",
      workRead([uploading], { availability: "partial", isPaused: true }),
    ],
    ["offline with a saved read of an empty garden", "empty", workRead([], { isPaused: true })],
  ])("reads %s as %s", (_case, status, read) => {
    expect(recentActivityState(read).status).toBe(status);
  });

  it("features the newest of the garden's works that has a photo", () => {
    expect(featuredWork([uploading, approved, rejected, pending])).toBe(pending);
    expect(featuredWork([approved, uploading])).toBeNull();
  });
});

function cycle(overrides: Partial<CommitmentCycleRecord>): CommitmentCycleRecord {
  return cycleFixture({ state: "OPEN", endTime: null, ...overrides });
}

describe("Highlights' seasons and campaigns", () => {
  it("keeps the open cycles, the season first, in the Pool tab's order otherwise", () => {
    const campaignB = cycle({ id: "c-9", cycleId: 9n, cycleType: "CAMPAIGN" });
    const campaignA = cycle({ id: "c-8", cycleId: 8n, cycleType: "CAMPAIGN" });
    const season = cycle({ id: "c-7", cycleId: 7n, cycleType: "SEASON" });
    const seeded = cycle({ id: "c-6", cycleId: 6n, cycleType: "CAMPAIGN", state: "SEEDED" });
    const ended = cycle({ id: "c-5", cycleId: 5n, state: "RECONCILED" });
    const cancelled = cycle({ id: "c-4", cycleId: 4n, cycleType: "CAMPAIGN", state: "CANCELLED" });

    const open = openCycles([campaignB, seeded, campaignA, ended, season, cancelled], NOW_MS);

    expect(open.map(({ cycle }) => cycle.id)).toEqual(["c-7", "c-9", "c-8"]);
  });

  it("counts the days left to a cycle's end, the last part of a day as one", () => {
    const seconds = (ms: number) => BigInt(Math.floor(ms / 1000));

    expect(cycleDaysLeft(seconds(NOW_MS + 104 * DAY_MS), NOW_MS)).toBe(104);
    expect(cycleDaysLeft(seconds(NOW_MS + 40.2 * DAY_MS), NOW_MS)).toBe(41);
    expect(cycleDaysLeft(seconds(NOW_MS + 2 * 3_600_000), NOW_MS)).toBe(1);
    // No end date, or an end already passed while the cycle is still open, says no count.
    expect(cycleDaysLeft(null, NOW_MS)).toBeNull();
    expect(cycleDaysLeft(seconds(NOW_MS), NOW_MS)).toBeNull();
    expect(cycleDaysLeft(seconds(NOW_MS - DAY_MS), NOW_MS)).toBeNull();

    const [open] = openCycles([cycle({ endTime: seconds(NOW_MS + 3 * DAY_MS) })], NOW_MS);
    expect(open?.daysLeft).toBe(3);
  });
});

const answered: JournalQueryRead = { hasData: true, isError: false, dataUpdatedAt: NOW_MS };
const unanswered: JournalQueryRead = { hasData: false, isError: false, dataUpdatedAt: 0 };
const failed: JournalQueryRead = { hasData: false, isError: true, dataUpdatedAt: 0 };

function poolRead(overrides: Partial<PoolSectionRead<string>> = {}): PoolSectionRead<string> {
  return {
    available: true,
    isOnline: true,
    pools: { ...answered, hasPool: true },
    list: answered,
    items: ["open"],
    ...overrides,
  };
}

describe("a section read from the garden's pool", () => {
  it.each<[string, string, Partial<PoolSectionRead<string>>]>([
    ["a chain where promises do not run", "unavailable", { available: false }],
    [
      "a pool lookup that has not answered",
      "loading",
      { pools: { ...unanswered, hasPool: false } },
    ],
    ["a failed pool lookup", "error", { pools: { ...failed, hasPool: false } }],
    ["a garden with no pool", "empty", { pools: { ...answered, hasPool: false } }],
    ["a list that has not answered", "loading", { list: unanswered }],
    ["a failed list", "error", { list: failed }],
    // Offline with nothing saved is a wait, even when the last try failed.
    ["offline with nothing saved", "offline", { isOnline: false, list: failed }],
    [
      "offline before the pool lookup was saved",
      "offline",
      { isOnline: false, pools: { ...unanswered, hasPool: false } },
    ],
    ["a pool with nothing open", "empty", { items: [] }],
  ])("reads %s as %s", (_case, status, overrides) => {
    expect(poolSectionState(poolRead(overrides)).status).toBe(status);
  });

  it("shows what it has, and says when an offline copy was read", () => {
    expect(poolSectionState(poolRead())).toEqual({
      status: "ready",
      items: ["open"],
      savedAt: null,
    });
    expect(
      poolSectionState(poolRead({ isOnline: false, list: { ...answered, dataUpdatedAt: 42 } }))
    ).toEqual({ status: "ready", items: ["open"], savedAt: 42 });
  });
});

function promise(id: number, overrides: Partial<CommitmentReadModel> = {}): CommitmentReadModel {
  return commitmentFixture({
    id: `42161-${id}`,
    commitmentId: BigInt(id),
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

const NO_METADATA = new Map<string, CommitmentMetadataV1>();

describe("Take Part", () => {
  it("offers the promises open to take up that the reader did not make", () => {
    const openOffer = promise(9);
    const openAsk = promise(8, {
      direction: "REQUEST",
      onchainState: "REQUESTED",
      derivedState: "REQUESTED",
    });
    const readersOwn = promise(7, { creator: READER, leadProvider: READER });
    const takenUp = promise(6, {
      onchainState: "ACCEPTED",
      derivedState: "ACTIVE",
      counterparty: READER,
    });
    // Published open on chain but past its deadline: it reads as lapsed.
    const lapsed = promise(5, { derivedState: "EXPIRED" });
    const kept = promise(4, { onchainState: "FULFILLED", derivedState: "FULFILLED" });

    const offered = takePartPromises(
      [openOffer, openAsk, readersOwn, takenUp, lapsed, kept],
      READER
    );

    expect(offered.map((item) => item.commitmentId)).toEqual([9n, 8n]);
    // Signed out, nothing is anyone's own, so every open promise is listed.
    expect(takePartPromises([openOffer, readersOwn], null)).toHaveLength(2);
  });

  it("folds copies of one set into one row, as the Pool tab does", () => {
    const metadata = new Map<string, CommitmentMetadataV1>([
      ["cid-set", { version: 1, title: "Water survey", displayGroup: { version: 1, id: "set-1" } }],
    ]);
    const copy = (id: number) =>
      promise(id, {
        direction: "REQUEST",
        onchainState: "REQUESTED",
        derivedState: "REQUESTED",
        metadataCID: "cid-set",
      });

    const entries = takePartEntries({
      commitments: [promise(30), copy(29), copy(28), promise(27), promise(26), promise(25)],
      metadataByCID: metadata,
      viewer: READER,
      poolOpen: true,
    });

    expect(
      entries.map((entry) =>
        entry.kind === "single" ? entry.row.commitment.commitmentId : entry.group.displayGroupId
      )
    ).toEqual([30n, "set-1", 27n, 26n, 25n]);
    const [first] = entries;
    expect(first?.kind === "single" && first.row).toMatchObject({
      seat: "bystander",
      needsYou: false,
    });
  });

  it("picks the newest ask for the carousel, or none", () => {
    const entries = takePartEntries({
      commitments: [
        promise(12),
        promise(11, { direction: "REQUEST", onchainState: "REQUESTED", derivedState: "REQUESTED" }),
        promise(10, { direction: "REQUEST", onchainState: "REQUESTED", derivedState: "REQUESTED" }),
      ],
      metadataByCID: NO_METADATA,
      viewer: READER,
      poolOpen: true,
    });

    const ask = openAsk(entries);
    expect(ask?.kind === "single" && ask.row.commitment.commitmentId).toBe(11n);
    expect(openAsk(entries.slice(0, 1))).toBeNull();
  });

  it("stands a group for its first copy the reader could take up", () => {
    const metadata = new Map<string, CommitmentMetadataV1>([
      ["cid-set", { version: 1, title: "Water survey", displayGroup: { version: 1, id: "set-1" } }],
    ]);
    const copy = (id: number, state: "REQUESTED" | "FULFILLED") =>
      promise(id, {
        direction: "REQUEST",
        onchainState: state,
        derivedState: state,
        metadataCID: "cid-set",
      });

    // The newer copy was kept; the older one is still asked for.
    const entries = takePartEntries({
      commitments: [copy(41, "FULFILLED"), copy(40, "REQUESTED")],
      metadataByCID: metadata,
      viewer: READER,
      poolOpen: true,
    });

    expect(entries.map((entry) => [entry.kind, entry.copy?.commitmentId])).toEqual([
      ["group", 40n],
    ]);
    expect(openAsk(entries)?.copy.commitmentId).toBe(40n);
  });

  it("takes nothing up while the pool is not open, as the promise page's take-up gate reads it", () => {
    const entries = takePartEntries({
      commitments: [
        promise(9),
        promise(8, { direction: "REQUEST", onchainState: "REQUESTED", derivedState: "REQUESTED" }),
      ],
      metadataByCID: NO_METADATA,
      viewer: READER,
      poolOpen: false,
    });

    expect(entries).toEqual([]);
  });
});
