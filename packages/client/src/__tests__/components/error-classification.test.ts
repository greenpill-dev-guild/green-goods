import { describe, expect, it } from "vitest";
import { classifyErrorMessage } from "../../components/Errors/errorClassification";

describe("error classification", () => {
  it("keeps a dynamic import failure in the offline recovery path when disconnected", () => {
    expect(classifyErrorMessage("Failed to fetch dynamically imported module", false)).toBe(
      "offline"
    );
  });

  it("treats the same dynamic import failure as a stale chunk while online", () => {
    expect(classifyErrorMessage("Failed to fetch dynamically imported module", true)).toBe("chunk");
  });

  it.each([
    ["Maximum update depth exceeded", "loop"],
    ["Network request failed", "network"],
    ["IndexedDB sync failed while offline", "offline"],
    ["Unexpected application failure", "unknown"],
  ] as const)("classifies %s as %s", (message, category) => {
    expect(classifyErrorMessage(message)).toBe(category);
  });
});
