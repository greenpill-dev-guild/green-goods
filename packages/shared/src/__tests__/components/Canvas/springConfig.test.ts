import { describe, it, expect } from "vitest";
import {
  CHOREOGRAPHY_STAGGER_MS,
  DISMISS_VELOCITY_THRESHOLD,
} from "../../../components/Canvas/springConfig";

// The react-spring `SPRING_CONFIGS` token map was removed when the canvas sheets
// moved to CSS transitions (see useCanvasSheetCssMotion in CanvasSheetInternals).
// What survives here are the two tuning constants for the drag-dismiss gesture
// and the choreography stagger.
describe("canvas sheet motion constants", () => {
  it("uses a positive drag-dismiss velocity threshold", () => {
    expect(DISMISS_VELOCITY_THRESHOLD).toBeGreaterThan(0);
  });

  it("uses a positive choreography stagger", () => {
    expect(CHOREOGRAPHY_STAGGER_MS).toBeGreaterThan(0);
  });
});
