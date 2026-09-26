import { describe, expect, it } from "vitest";
import {
  isPlaceholderWorkTitle,
  resolveKnownWorkTitle,
  resolveWorkSubmissionTitle,
  stripGeneratedWorkTitleTimestamp,
  toWorkDisplayTitle,
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

  it("recognises the titles the app made up when it could not find the action", () => {
    expect(isPlaceholderWorkTitle("Unknown Action", 12)).toBe(true);
    expect(isPlaceholderWorkTitle(" Action 12 ", 12)).toBe(true);
    expect(isPlaceholderWorkTitle("Action 12", 13)).toBe(false);
    expect(isPlaceholderWorkTitle("Tree planting", 12)).toBe(false);
  });

  it("keeps only a real title, so a placeholder is never stored or sent as one", () => {
    expect(resolveKnownWorkTitle({ draftTitle: "Unknown Action", actionUID: 12 })).toBeUndefined();
    expect(resolveKnownWorkTitle({ draftTitle: "Action 12", actionUID: 12 })).toBeUndefined();
    expect(
      resolveKnownWorkTitle({
        draftTitle: "Action 12",
        actionTitle: "Tree planting",
        actionUID: 12,
      })
    ).toBe("Tree planting");
    expect(resolveKnownWorkTitle({ actionTitle: "Unknown Action", actionUID: 12 })).toBeUndefined();
    expect(
      resolveWorkSubmissionTitle({
        draftTitle: "Unknown Action",
        actionTitle: "Unknown Action",
        actionUID: 12,
      })
    ).toBe("Action 12");
  });

  it.each([
    ["one stamp", "Planting Event - 2026-03-19T23:56:54.981Z", "Planting Event"],
    [
      "two stamps",
      "Maintenance Activity - 2026-03-19T23:56:54.981Z - 2026-03-19T23:56:55.093Z",
      "Maintenance Activity",
    ],
    ["en dashes", "Maintenance Activity – 2026-03-21T04:55:23.886Z", "Maintenance Activity"],
    ["no stamp", "Planted shade trees", "Planted shade trees"],
    ["only stamps", " - 2026-03-19T23:56:54.981Z - 2026-03-19T23:56:55.093Z", "Untitled Work"],
    ["its own dash", "Pre-planting survey - north plot", "Pre-planting survey - north plot"],
    ["a placeholder", "Unknown Action - 2026-03-19T23:56:54.981Z", "Untitled Work"],
    ["a generated action name", "Action 12", "Untitled Work"],
  ])("displays a title with %s", (_case, title, expected) => {
    expect(toWorkDisplayTitle(title, "Untitled Work")).toBe(expected);
  });

  it("reads a title with a long run of spaces in one pass", () => {
    const title = `Survey${" ".repeat(50_000)}- north plot`;
    const started = performance.now();
    expect(toWorkDisplayTitle(title, "Untitled Work")).toBe(title);
    // A backtracking pattern takes seconds here; the word scan takes a few milliseconds.
    expect(performance.now() - started).toBeLessThan(250);
  });
});
