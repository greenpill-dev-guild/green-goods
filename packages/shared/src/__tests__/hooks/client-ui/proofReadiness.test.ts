import { describe, expect, it } from "vitest";

import { selectProofReadiness } from "../../../hooks/client-ui/commitment/proofReadiness";

describe("selectProofReadiness", () => {
  it.each([
    ["media", true, false, false, 0, "processing"],
    ["media", false, true, false, 0, "recording"],
    ["media", false, false, true, 0, null],
    ["details", false, false, false, 1, "nothing"],
    ["details", false, false, true, 0, "credit"],
    ["details", false, false, true, 1, "invalid-link"],
    ["details", false, false, true, 1, null],
    ["review", true, true, false, 0, null],
  ] as const)("%s resolves processing=%s recording=%s content=%s credit=%s to %s", (beat, isProcessing, isRecording, hasAnything, creditedCount, reason) => {
    expect(
      selectProofReadiness({
        beat,
        isProcessing,
        isRecording,
        hasAnything,
        creditedCount,
        links: reason === "invalid-link" ? ["not a link"] : ["https://example.org"],
      })
    ).toEqual({ canAdvance: reason === null, reason });
  });
});
