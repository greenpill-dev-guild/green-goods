/**
 * Garden notification tests: the events the bell lists for an account in one garden, read
 * from the garden's work list, its pool's promises and the take-up requests waiting there
 * (DL-130), and which of them are new on this device.
 */

import { describe, expect, it } from "vitest";
import {
  deriveGardenNotifications,
  type GardenNotificationSources,
  gardenNotificationsScope,
  isNotificationNew,
  markNotificationsSeen,
  NEW_NOTIFICATION_WINDOW_SECONDS,
} from "../../../modules/garden/notifications";
import type { CommitmentReadModel } from "../../../modules/commitment-pooling/types-core";
import type { Address, Work } from "../../../types/domain";
import {
  claimFixture,
  commitmentFixture,
  poolClaimRowFixture,
} from "../../test-utils/commitment-pooling-fixtures";
import { createMockWork } from "../../test-utils/mock-factories";

const ALICE = "0xa11ce00000000000000000000000000000000001" as Address;
const BOB = "0xb0b0000000000000000000000000000000000002" as Address;
const CAROL = "0x3333333333333333333333333333333333333333" as Address;
const NOW = 1_800_000_000;
const HOUR = 3_600;
const DAY = 86_400;

function work(id: string, gardener: Address, status: Work["status"], extra: Partial<Work> = {}) {
  return createMockWork({ id, gardenerAddress: gardener, status, createdAt: NOW - DAY, ...extra });
}

function promise(commitmentId: bigint, overrides: Partial<CommitmentReadModel>) {
  return commitmentFixture({ commitmentId, ...overrides });
}

/** Someone asks to take up an approval-gated ask of Bob's. */
function takeUpRequest(
  commitmentId: bigint,
  claimant: Address,
  claim: Parameters<typeof claimFixture>[0] = {}
) {
  return poolClaimRowFixture({
    commitment: promise(commitmentId, {
      direction: "REQUEST",
      creator: BOB,
      leadProvider: null,
      claimMode: "APPROVAL_GATED",
      onchainState: "REQUESTED",
      acceptanceAt: null,
    }),
    claim: claimFixture({ commitmentId, claimant, requestedAt: NOW - 4 * HOUR, ...claim }),
  });
}

function sources(overrides: Partial<GardenNotificationSources> = {}): GardenNotificationSources {
  return {
    account: ALICE,
    canReviewWork: false,
    canDecideTakeUps: false,
    works: [],
    commitments: [],
    takeUpRequests: [],
    ...overrides,
  };
}

const summary = (events: ReturnType<typeof deriveGardenNotifications>) =>
  events.map(({ kind, id, at }) => ({ kind, id, at }));

describe("deriveGardenNotifications", () => {
  it("tells a member their work was approved, or rejected with the review's feedback", () => {
    const approved = work("0xw1", ALICE, "approved", { reviewedAt: NOW - HOUR });
    const rejected = work("0xw2", ALICE, "rejected", {
      reviewedAt: NOW - 2 * HOUR,
      reviewFeedback: "The photo is too dark to see the beds.",
    });
    // A decision only this device knows has no review time yet; it waits for the index.
    const localOnly = work("0xw3", ALICE, "approved");
    const waiting = work("0xw4", ALICE, "pending");
    const bobsApproved = work("0xw5", BOB, "approved", { reviewedAt: NOW - HOUR });

    const events = deriveGardenNotifications(
      sources({
        account: ALICE.toUpperCase(),
        works: [rejected, localOnly, waiting, approved, bobsApproved],
      })
    );

    expect(summary(events)).toEqual([
      { kind: "workApproved", id: `review:0xw1:${NOW - HOUR}`, at: NOW - HOUR },
      { kind: "workRejected", id: `review:0xw2:${NOW - 2 * HOUR}`, at: NOW - 2 * HOUR },
    ]);
    expect(events[1]).toMatchObject({
      work: { reviewFeedback: "The photo is too dark to see the beds." },
    });
  });

  it("tells a member a promise of theirs was taken up, when it was", () => {
    const offerTaken = promise(11n, {
      direction: "OFFER",
      creator: ALICE,
      leadProvider: ALICE,
      counterparty: BOB,
      acceptanceAt: NOW - DAY,
    });
    const askKept = promise(12n, {
      direction: "REQUEST",
      creator: ALICE,
      leadProvider: BOB,
      counterparty: BOB,
      onchainState: "FULFILLED",
      acceptanceAt: NOW - 3 * DAY,
    });
    const notTakenYet = promise(13n, {
      direction: "REQUEST",
      creator: ALICE,
      leadProvider: null,
      onchainState: "REQUESTED",
      acceptanceAt: null,
    });
    // Alice took up Bob's offer: that is Bob's promise taken up, not hers.
    const bobsOffer = promise(14n, {
      creator: BOB,
      leadProvider: BOB,
      counterparty: ALICE,
      acceptanceAt: NOW - HOUR,
    });

    const events = deriveGardenNotifications(
      sources({ commitments: [notTakenYet, bobsOffer, askKept, offerTaken] })
    );

    expect(summary(events)).toEqual([
      { kind: "promiseTakenUp", id: `takenUp:${offerTaken.id}:${NOW - DAY}`, at: NOW - DAY },
      { kind: "promiseTakenUp", id: `takenUp:${askKept.id}:${NOW - 3 * DAY}`, at: NOW - 3 * DAY },
    ]);
  });

  it.each([
    ["neither act", false, false, []],
    ["only reviewing work", true, false, ["workSubmitted"]],
    ["only deciding take-ups", false, true, ["takeUpRequested"]],
    ["both acts", true, true, ["workSubmitted", "takeUpRequested"]],
  ])("lists only the steward events the account can act on: %s", (_label, canReviewWork, canDecideTakeUps, kinds) => {
    const events = deriveGardenNotifications(
      sources({
        canReviewWork,
        canDecideTakeUps,
        works: [work("0xw6", BOB, "pending", { createdAt: NOW - 3 * HOUR })],
        takeUpRequests: [takeUpRequest(21n, CAROL)],
      })
    );

    expect(events.map(({ kind }) => kind)).toEqual(kinds);
  });

  it("never tells a steward of their own submission or their own take-up request", () => {
    const events = deriveGardenNotifications(
      sources({
        canReviewWork: true,
        canDecideTakeUps: true,
        works: [work("0xw7", ALICE, "pending")],
        takeUpRequests: [
          takeUpRequest(22n, ALICE),
          takeUpRequest(23n, BOB, { requestedBy: ALICE }),
        ],
      })
    );

    expect(events).toEqual([]);
  });

  it("lists a submission or a take-up request only while it still waits", () => {
    const events = deriveGardenNotifications(
      sources({
        canReviewWork: true,
        canDecideTakeUps: true,
        works: [
          work("0xw8", BOB, "approved", { reviewedAt: NOW - HOUR }),
          work("0xw9", BOB, "rejected", { reviewedAt: NOW - HOUR }),
        ],
        takeUpRequests: [
          takeUpRequest(24n, CAROL, { state: "ACCEPTED" }),
          takeUpRequest(25n, CAROL, { state: "DECLINED" }),
          takeUpRequest(26n, CAROL, { state: "SUPERSEDED" }),
        ],
      })
    );

    expect(events).toEqual([]);
  });

  it("counts match the sources they derive from", () => {
    const waitingFromOthers = [1, 2, 3].map((n) =>
      work(`0xs${n}`, n === 3 ? CAROL : BOB, "pending", { createdAt: NOW - n * HOUR })
    );
    const ownWaiting = [1, 2].map((n) => work(`0xo${n}`, ALICE, "pending"));
    const ownApproved = [1, 2].map((n) =>
      work(`0xa${n}`, ALICE, "approved", { reviewedAt: NOW - n * DAY })
    );
    const ownRejected = [1, 2].map((n) =>
      work(`0xr${n}`, ALICE, "rejected", { reviewedAt: NOW - n * DAY - HOUR })
    );
    const othersDecided = [work("0xd1", BOB, "approved", { reviewedAt: NOW - HOUR })];
    const ownTaken = [31n, 32n, 33n].map((id, index) =>
      promise(id, { creator: ALICE, counterparty: BOB, acceptanceAt: NOW - index * HOUR })
    );
    const ownOpen = [promise(34n, { creator: ALICE, onchainState: "OFFERED", acceptanceAt: null })];
    const othersTaken = [promise(35n, { creator: BOB, acceptanceAt: NOW - HOUR })];
    const waitingRequests = [41n, 42n, 43n, 44n].map((id) => takeUpRequest(id, CAROL));
    const settledRequests = [takeUpRequest(45n, CAROL, { state: "DECLINED" })];

    const events = deriveGardenNotifications(
      sources({
        canReviewWork: true,
        canDecideTakeUps: true,
        works: [
          ...waitingFromOthers,
          ...ownWaiting,
          ...ownApproved,
          ...ownRejected,
          ...othersDecided,
        ],
        commitments: [...ownTaken, ...ownOpen, ...othersTaken],
        takeUpRequests: [...waitingRequests, ...settledRequests],
      })
    );
    const count = (kind: string) => events.filter((event) => event.kind === kind).length;

    expect(count("workSubmitted")).toBe(waitingFromOthers.length);
    expect(count("workApproved")).toBe(ownApproved.length);
    expect(count("workRejected")).toBe(ownRejected.length);
    expect(count("promiseTakenUp")).toBe(ownTaken.length);
    expect(count("takeUpRequested")).toBe(waitingRequests.length);
    expect(events).toHaveLength(14);
  });

  it("lists events newest first, with ids that hold from one read to the next", () => {
    const input = sources({
      canReviewWork: true,
      works: [
        work("0xe1", BOB, "pending", { createdAt: NOW - 2 * HOUR }),
        work("0xe2", ALICE, "approved", { reviewedAt: NOW - HOUR }),
        work("0xe3", BOB, "pending", { createdAt: NOW - 2 * HOUR }),
      ],
    });

    const first = deriveGardenNotifications(input);
    const again = deriveGardenNotifications({ ...input, works: [...input.works].reverse() });

    expect(first.map(({ id }) => id)).toEqual([
      `review:0xe2:${NOW - HOUR}`,
      "submission:0xe1",
      "submission:0xe3",
    ]);
    expect(again.map(({ id }) => id)).toEqual(first.map(({ id }) => id));
  });
});

describe("seen state", () => {
  it("counts the last week's events as new on a device that has never marked them seen", () => {
    expect(isNotificationNew({ id: "a", at: NOW - HOUR }, undefined, NOW)).toBe(true);
    expect(
      isNotificationNew({ id: "b", at: NOW - NEW_NOTIFICATION_WINDOW_SECONDS + 60 }, undefined, NOW)
    ).toBe(true);
    expect(
      isNotificationNew({ id: "c", at: NOW - NEW_NOTIFICATION_WINDOW_SECONDS }, undefined, NOW)
    ).toBe(false);
  });

  it("keeps what it was shown seen, and anything it was not shown new, a late arrival too", () => {
    const shown = [
      { id: "a", at: NOW - HOUR },
      { id: "b", at: NOW - DAY },
    ];
    const record = markNotificationsSeen(undefined, shown, NOW);

    expect(shown.map((event) => isNotificationNew(event, record, NOW))).toEqual([false, false]);
    expect(isNotificationNew({ id: "c", at: NOW + 60 }, record, NOW + 120)).toBe(true);
    // Indexed after the mark, though it happened before the newest event shown.
    expect(isNotificationNew({ id: "d", at: NOW - 2 * HOUR }, record, NOW + 120)).toBe(true);
  });

  it("forgets marks once they leave the week, when they count as seen anyway", () => {
    const first = markNotificationsSeen(undefined, [{ id: "a", at: NOW - DAY }], NOW);
    const later = NOW + 10 * DAY;
    const second = markNotificationsSeen(first, [{ id: "e", at: later - HOUR }], later);

    expect(Object.keys(second.seen)).toEqual(["e"]);
    expect(isNotificationNew({ id: "a", at: NOW - DAY }, second, later)).toBe(false);
    expect(isNotificationNew({ id: "f", at: later - 8 * DAY }, second, later)).toBe(false);
    expect(isNotificationNew({ id: "g", at: later - 6 * DAY }, second, later)).toBe(true);
  });

  it("never counts an event older than a week as new, however old the record is", () => {
    const record = markNotificationsSeen(undefined, [{ id: "a", at: NOW - DAY }], NOW);
    const later = NOW + 10 * DAY;

    // Never shown, and after the record's own cutoff, but more than a week old by now.
    expect(isNotificationNew({ id: "h", at: NOW + DAY }, record, later)).toBe(false);
    expect(isNotificationNew({ id: "i", at: later - DAY }, record, later)).toBe(true);
  });

  it("keeps one record per chain, account and garden", () => {
    expect(gardenNotificationsScope(42161, "0xAbC1", "0xDeF2")).toBe("42161:0xabc1:0xdef2");
    expect(gardenNotificationsScope(11155111, "0xabc1", "0xdef2")).toBe("11155111:0xabc1:0xdef2");
    expect(gardenNotificationsScope(42161, null, "0xdef2")).toBeNull();
    expect(gardenNotificationsScope(42161, "0xabc1", undefined)).toBeNull();
  });
});
