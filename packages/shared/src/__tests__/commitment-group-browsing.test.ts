/**
 * Browsing and taking up grouped promises (PRD-1029): which copy one press
 * takes, D5's unasked copy in a reviewed group, the bar's holds, the pool's
 * at-once limit, and how the Promises tab folds a set into one row.
 */

import { describe, expect, it } from "vitest";

import { groupCommitmentsForDisplay } from "../modules/commitment-pooling/display-groups";
import {
  findDisplayGroup,
  isAtTakeUpLimit,
  pickCopyToTakeUp,
  selectGroupTakeUpBar,
  selectPoolListEntries,
} from "../modules/commitment-pooling/group-browsing";
import type { CommitmentMetadataV1 } from "../modules/commitment-pooling/metadata";
import type { CommitmentReadModel } from "../modules/commitment-pooling/types-core";
import type { Address } from "../types/domain";
import { commitmentFixture } from "./test-utils/commitment-pooling-fixtures";

const STEWARD = "0x1111111111111111111111111111111111111111" as Address;
const LINA = "0x2222222222222222222222222222222222222222" as Address;
const OMAR = "0x3333333333333333333333333333333333333333" as Address;

/** A copy of the steward's set of requests, open unless told otherwise. */
const copy = (id: number, overrides: Partial<CommitmentReadModel> = {}) =>
  commitmentFixture({
    commitmentId: BigInt(id),
    direction: "REQUEST",
    onchainState: "REQUESTED",
    derivedState: "REQUESTED",
    creator: STEWARD,
    leadProvider: null,
    metadataCID: "cid-set",
    ...overrides,
  });

const metadata = new Map<string, CommitmentMetadataV1>([
  ["cid-set", { version: 1, title: "Water survey", displayGroup: { version: 1, id: "set-1" } }],
]);

const NOBODY_ASKED = new Set<string>();

describe("group browsing", () => {
  it("takes the oldest copy nobody holds, passing over taken, ended, skipped and own copies", () => {
    const copies = [
      copy(14),
      copy(11, { onchainState: "ACCEPTED", derivedState: "ACTIVE", leadProvider: OMAR }),
      copy(12, { onchainState: "CANCELLED", derivedState: "CANCELLED" }),
      copy(13),
      copy(10, { creator: LINA }),
      // Published open on chain but past its deadline: it reads as lapsed.
      copy(9, { derivedState: "EXPIRED" }),
    ];

    expect(pickCopyToTakeUp(copies, { viewer: LINA, askedFor: NOBODY_ASKED })?.commitmentId).toBe(
      13n
    );
    expect(
      pickCopyToTakeUp(copies, { viewer: LINA, askedFor: NOBODY_ASKED, skip: new Set(["13"]) })
        ?.commitmentId
    ).toBe(14n);
    expect(
      pickCopyToTakeUp(copies, {
        viewer: LINA,
        askedFor: NOBODY_ASKED,
        skip: new Set(["13", "14"]),
      })
    ).toBeNull();
  });

  it("asks for a copy nobody has asked for yet in a reviewed group (D5), and never an open one's", () => {
    const reviewed = [11, 12, 13].map((id) => copy(id, { claimMode: "APPROVAL_GATED" }));
    const asked = new Set(["11", "12"]);

    expect(pickCopyToTakeUp(reviewed, { viewer: LINA, askedFor: asked })?.commitmentId).toBe(13n);
    expect(
      pickCopyToTakeUp(reviewed, { viewer: LINA, askedFor: new Set(["11", "12", "13"]) })
    ).toBeNull();
    // An ask means nothing on an open copy: nobody reviews it, so it stays choosable.
    const open = [11, 12].map((id) => copy(id));
    expect(pickCopyToTakeUp(open, { viewer: LINA, askedFor: asked })?.commitmentId).toBe(11n);
  });

  it.each([
    [{ approvalGated: false, holdsOne: false, hasChoice: true, atLimit: false }, "takeUp", null],
    [
      { approvalGated: false, holdsOne: true, hasChoice: true, atLimit: false },
      "takeUpAnother",
      null,
    ],
    [{ approvalGated: true, holdsOne: true, hasChoice: true, atLimit: false }, "askToTakeUp", null],
    [{ approvalGated: false, holdsOne: false, hasChoice: false, atLimit: false }, "takeUp", "none"],
    // Availability that can't be read is unknown, never none.
    [
      { approvalGated: false, holdsOne: false, hasChoice: null, atLimit: false },
      "takeUp",
      "unknown",
    ],
    [
      { approvalGated: false, holdsOne: true, hasChoice: null, atLimit: true },
      "takeUpAnother",
      "limit",
    ],
  ] as const)("offers %o as %s, held by %s", (input, act, hold) => {
    expect(selectGroupTakeUpBar(input)).toEqual({ act, hold });
  });

  it("holds a request at the pool's at-once limit, but never an offer or an unread count", () => {
    const exposures = [{ provider: LINA, openCommitmentCount: 2n }];
    const at = (overrides: Partial<Parameters<typeof isAtTakeUpLimit>[0]>) =>
      isAtTakeUpLimit({
        direction: "REQUEST",
        cap: 3n,
        exposures,
        viewer: LINA,
        queued: 0,
        ...overrides,
      });

    expect(at({})).toBe(false);
    // A take-up still on this phone counts once it lands.
    expect(at({ queued: 1 })).toBe(true);
    expect(at({ cap: 2n })).toBe(true);
    expect(at({ cap: 2n, direction: "OFFER" })).toBe(false);
    expect(at({ cap: 2n, exposures: null })).toBe(false);
  });

  it("folds a set into one row where its first copy stood, counting copies the filters leave out", () => {
    // The set names the reader to confirm every copy, which gives them none to hold.
    const copies = [
      copy(21),
      copy(22, { onchainState: "ACCEPTED", derivedState: "ACTIVE", leadProvider: LINA }),
      copy(23),
      copy(24, { onchainState: "FULFILLED", derivedState: "FULFILLED", leadProvider: OMAR }),
    ].map((record) => ({ ...record, confirmers: [LINA] }));
    const plain = commitmentFixture({ commitmentId: 30n, metadataCID: "cid-unreadable" });
    const all = [plain, ...copies];
    // Status: live, so the kept copy is not among the rows.
    const rows = all
      .filter((record) => record.derivedState !== "FULFILLED")
      .map((commitment) => ({ commitment }));

    const entries = selectPoolListEntries({
      rows,
      grouped: groupCommitmentsForDisplay({ commitments: all, metadataByCID: metadata }),
      viewer: LINA,
    });

    expect(
      entries.map((entry) =>
        entry.kind === "single" ? entry.row.commitment.commitmentId : entry.group.displayGroupId
      )
    ).toEqual([30n, "set-1", 22n]);
    const group = entries[1];
    expect(group?.kind === "group" && group.group.counts).toMatchObject({
      published: 4,
      available: 2,
      inProgress: 1,
      kept: 1,
    });
  });

  it("finds a route's group by its id, and by its key or a copy when one id splits by terms", () => {
    const entries = groupCommitmentsForDisplay({
      commitments: [copy(41), copy(42), copy(43, { dueDate: 99n }), copy(44, { dueDate: 99n })],
      metadataByCID: metadata,
    });
    const [first, second] = entries;

    expect(findDisplayGroup(entries, "set-1")).toBe(first);
    expect(
      findDisplayGroup(entries, "set-1", { key: second?.kind === "group" ? second.key : null })
    ).toBe(second);
    // A link carries one copy's id, which still finds its own group after a reload.
    expect(findDisplayGroup(entries, "set-1", { copyId: "44" })).toBe(second);
    expect(findDisplayGroup(entries, "set-2")).toBeNull();
  });
});
