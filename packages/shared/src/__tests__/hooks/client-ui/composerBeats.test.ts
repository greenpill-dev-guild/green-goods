import { describe, expect, it } from "vitest";

import {
  COMPOSER_BEATS,
  selectBeatValidity,
  selectClosedActionUIDs,
  selectUncheckedActionUIDs,
} from "../../../hooks/client-ui/commitment/composerBeats";
import { COMMITMENT_COMPOSER_DEFAULTS } from "../../../hooks/commitment-pooling/useCommitmentComposerForm";
import type { CommitmentComposerValues } from "../../../hooks/commitment-pooling/useCommitmentComposerForm";
import { createMockAction } from "../../test-utils/mock-factories";

const valid = {
  ...COMMITMENT_COMPOSER_DEFAULTS,
  title: "Repair the tool shed",
  unitLabel: "hours",
  kind: "SERVICE" as const,
};

describe("selectBeatValidity", () => {
  it("declares the four composer beats in journey order", () => {
    expect(COMPOSER_BEATS).toEqual(["what", "howMuch", "details", "review"]);
  });

  it.each([
    ["what", { title: "" }, false, "title"],
    // Copied in from an older commitment: typing stops at the limit.
    ["what", { title: "t".repeat(61) }, false, "titleTooLong"],
    ["what", {}, true, null],
    ["howMuch", { unitLabel: "" }, false, "unit"],
    ["howMuch", { unitLabel: "u".repeat(25) }, false, "unitTooLong"],
    ["howMuch", { targetUnits: 0 }, false, "count"],
    ["howMuch", { dueInDays: 0 }, false, null],
    [
      "howMuch",
      { dueInDays: 0, kind: "GARDEN_WORK", requirements: [{ actionUID: "4", requiredCount: 1 }] },
      false,
      null,
    ],
    ["howMuch", { kind: "GARDEN_WORK", requirements: [] }, false, "action"],
    [
      "howMuch",
      { kind: "GARDEN_WORK", requirements: [{ actionUID: "4", requiredCount: 0 }] },
      false,
      "rowCount",
    ],
    [
      "howMuch",
      { kind: "GARDEN_WORK", requirements: [{ actionUID: "4", requiredCount: 1 }] },
      true,
      null,
    ],
    ["details", { links: ["not a link"] }, false, null],
    ["details", { note: "n".repeat(281) }, false, "noteTooLong"],
    ["details", { links: ["https://example.org"] }, true, null],
    ["review", { title: "" }, true, null],
  ] as const)("gates %s with %o", (beat, overrides, canAdvance, reason) => {
    expect(
      selectBeatValidity(beat, { ...valid, ...overrides } as CommitmentComposerValues)
    ).toEqual({ canAdvance, reason });
  });

  it("stops the beat that chose an action and placement, not the others, once it closes", () => {
    const values = {
      ...valid,
      kind: "GARDEN_WORK",
      requirements: [{ actionUID: "4", requiredCount: 1 }],
    } as CommitmentComposerValues;
    const closed = { canAdvance: false, reason: "closedAction" };

    expect(selectBeatValidity("howMuch", values, ["4"])).toEqual(closed);
    expect(selectBeatValidity("review", values, ["4"])).toEqual(closed);
    expect(selectBeatValidity("details", values, ["4"])).toEqual({
      canAdvance: true,
      reason: null,
    });
  });

  it("holds the same beats while a chosen action's window isn't known, saying a closed one first", () => {
    const values = {
      ...valid,
      kind: "GARDEN_WORK",
      requirements: ["4", "7"].map((actionUID) => ({ actionUID, requiredCount: 1 })),
    } as CommitmentComposerValues;
    const unchecked = { canAdvance: false, reason: "uncheckedAction" };

    expect(selectBeatValidity("howMuch", values, [], ["7"])).toEqual(unchecked);
    expect(selectBeatValidity("review", values, [], ["7"])).toEqual(unchecked);
    expect(selectBeatValidity("details", values, [], ["7"])).toEqual({
      canAdvance: true,
      reason: null,
    });
    // Only removing a closed one helps, so it is said before one still being checked.
    expect(selectBeatValidity("howMuch", values, ["4"], ["7"])).toEqual({
      canAdvance: false,
      reason: "closedAction",
    });
  });
});

describe("selectClosedActionUIDs", () => {
  it("lists the chosen garden-work actions whose window has ended, in the order chosen", () => {
    const now = Date.now();
    const actions = [
      createMockAction({ id: "42161-4", endTime: now - 1 }),
      createMockAction({ id: "42161-5", endTime: now - 1 }),
      createMockAction({ id: "42161-6" }),
    ];
    const values = {
      ...valid,
      kind: "GARDEN_WORK",
      // 7 is not in the loaded list, so nothing says it has closed.
      requirements: ["5", "6", "4", "7"].map((actionUID) => ({ actionUID, requiredCount: 1 })),
    } as CommitmentComposerValues;

    expect(selectClosedActionUIDs(values, actions, 42161, now)).toEqual(["5", "4"]);
    expect(selectClosedActionUIDs({ ...values, kind: "SERVICE" }, actions, 42161, now)).toEqual([]);
    // What the list doesn't hold isn't known to be open either.
    expect(selectUncheckedActionUIDs(values, actions, 42161)).toEqual(["7"]);
    expect(selectUncheckedActionUIDs({ ...values, kind: "SERVICE" }, actions, 42161)).toEqual([]);
  });
});
