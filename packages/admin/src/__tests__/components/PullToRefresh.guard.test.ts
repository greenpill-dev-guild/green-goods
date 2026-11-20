/**
 * Guard: the browser's pull-to-refresh reaches the Hub, and never through an open dialog
 * (PRD-1534). Chrome runs the gesture when a pull past the top of a scroller chains to the
 * root, so neither the root nor the main scroller may contain vertical overscroll; an open
 * dialog or sheet marks the body as scroll-locked, and that state turns the gesture off.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");

describe("Hub pull-to-refresh", () => {
  it("lets vertical overscroll chain from the main scroller to the root", () => {
    const css = source("index.css");
    const rootRule = css.match(/html,\s*body\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(rootRule).toContain("overflow: hidden");
    expect(rootRule).not.toMatch(/overscroll-behavior(-y)?:/);
    expect(source("components/Layout/CanvasLayout.tsx")).toContain('overscrollBehaviorY: "auto"');
  });

  it("turns the gesture off while a dialog holds the scroll lock", () => {
    expect(source("index.css")).toMatch(
      /body\[data-scroll-locked\]\s*\{\s*overscroll-behavior-y: none;/
    );
  });
});
