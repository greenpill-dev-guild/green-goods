import { describe, expect, it } from "vitest";

import {
  COMPOSER_BEATS,
  selectBeatValidity,
} from "../../../hooks/client-ui/commitment/composerBeats";
import { COMMITMENT_COMPOSER_DEFAULTS } from "../../../hooks/commitment-pooling/useCommitmentComposerForm";
import type { CommitmentComposerValues } from "../../../hooks/commitment-pooling/useCommitmentComposerForm";

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
    ["what", {}, true, null],
    ["howMuch", { unitLabel: "" }, false, "unit"],
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
    ["details", { links: ["https://example.org"] }, true, null],
    ["review", { title: "" }, true, null],
  ] as const)("gates %s with %o", (beat, overrides, canAdvance, reason) => {
    expect(
      selectBeatValidity(beat, { ...valid, ...overrides } as CommitmentComposerValues)
    ).toEqual({ canAdvance, reason });
  });
});
