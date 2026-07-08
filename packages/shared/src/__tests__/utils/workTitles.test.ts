import { describe, expect, it } from "vitest";
import {
  resolveWorkSubmissionTitle,
  stripGeneratedWorkTitleTimestamp,
} from "../../utils/work/workTitles";

describe("work title utilities", () => {
  it("strips generated ISO timestamp suffixes when they match the action title", () => {
    expect(
      stripGeneratedWorkTitleTimestamp(
        "Community Cleanup - 2026-07-08T12:34:00.000Z",
        "Community Cleanup"
      )
    ).toBe("Community Cleanup");
  });

  it("preserves titles with ISO-like suffixes when they do not match the action title", () => {
    expect(
      stripGeneratedWorkTitleTimestamp(
        "Inspection window - 2026-07-08T12:34:00.000Z",
        "Community Cleanup"
      )
    ).toBe("Inspection window - 2026-07-08T12:34:00.000Z");
  });

  it("uses draft title first, then action title, without appending timestamps", () => {
    expect(
      resolveWorkSubmissionTitle({
        draftTitle: "Planted shade trees",
        actionTitle: "Tree planting",
        actionUID: 12,
      })
    ).toBe("Planted shade trees");

    expect(resolveWorkSubmissionTitle({ actionTitle: "Tree planting", actionUID: 12 })).toBe(
      "Tree planting"
    );

    expect(resolveWorkSubmissionTitle({ actionUID: 12 })).toBe("Action 12");
  });

  it("cleans older queued generated titles before replaying them", () => {
    expect(
      resolveWorkSubmissionTitle({
        draftTitle: "Tree planting - 2026-07-08T12:34:00.000Z",
        actionTitle: "Tree planting",
        actionUID: 12,
      })
    ).toBe("Tree planting");
  });
});
