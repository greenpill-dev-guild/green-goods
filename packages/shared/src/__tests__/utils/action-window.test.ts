import { describe, expect, it } from "vitest";

import { hasActionEnded, isActionOpen, msUntilActionWindowChange } from "../../utils/action/window";

const NOW = 1_800_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** A window placed relative to NOW, in milliseconds. */
const span = (fromMs: number, toMs: number) => ({ startTime: NOW + fromMs, endTime: NOW + toMs });

describe("action windows", () => {
  it("takes Work at both ends of the window and ends the moment after", () => {
    expect(isActionOpen(span(0, 1_000), NOW)).toBe(true);
    expect(isActionOpen(span(-1_000, 0), NOW)).toBe(true);
    expect(isActionOpen(span(1, 1_000), NOW)).toBe(false);
    expect(hasActionEnded(span(-1_000, 0), NOW)).toBe(false);
    expect(hasActionEnded(span(-1_000, 0), NOW + 1)).toBe(true);
  });

  it.each([
    ["waits for the next window to open", [span(5_000, 9_000)], 5_000],
    ["waits for the moment after an open window ends", [span(-5_000, 3_000)], 3_001],
    [
      "waits for the nearest change among several",
      [span(5_000, 9_000), span(-5_000, 3_000)],
      3_001,
    ],
    ["has nothing to wait for once every window has ended", [span(-9_000, -5_000)], null],
    ["caps a far change at the longest timer delay", [span(-5_000, 60 * DAY_MS)], 2_147_483_647],
  ])("%s", (_case, actions, delay) => {
    expect(msUntilActionWindowChange(actions, NOW)).toBe(delay);
  });
});
