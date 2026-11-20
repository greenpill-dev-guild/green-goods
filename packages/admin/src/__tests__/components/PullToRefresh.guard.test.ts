/**
 * Guard: the browser's pull-to-refresh reaches the Hub, and never through an open dialog
 * (PRD-1534). Chrome runs the gesture when a pull past the top of a scroller chains to the
 * root, and turns it off for a root whose vertical overflow is hidden. So, as in the App,
 * the root is neither overflow-hidden nor contains vertical overscroll; #root clips the
 * shell instead, and the main scroller lets a pull chain. An open dialog or sheet marks the
 * body as scroll-locked, and that state turns the gesture off.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");
const css = source("index.css");
const rootRule = css.match(/html,\s*body\s*\{([^}]*)\}/)?.[1] ?? "";
const shellRule = css.match(/#root\s*\{([^}]*)\}/)?.[1] ?? "";

describe("Hub pull-to-refresh", () => {
  it("leaves the root unlocked, so a pull can reach the browser's gesture", () => {
    expect(rootRule).not.toMatch(/overflow(-y)?:\s*hidden/);
    expect(rootRule).not.toMatch(/overscroll-behavior(-y)?:/);
    expect(rootRule).toContain("overscroll-behavior-x: none");
  });

  it("clips the shell in #root, so the document itself never scrolls", () => {
    expect(shellRule).toContain("height: 100%");
    expect(shellRule).toContain("overflow: clip");
    // A stray absolutely positioned element is clipped too, not left to grow the page.
    expect(shellRule).toContain("position: relative");
  });

  it("lets a pull past the top of the main scroller chain to the root", () => {
    expect(source("components/Layout/CanvasLayout.tsx")).toContain('overscrollBehaviorY: "auto"');
  });

  it("turns the gesture off while a dialog holds the scroll lock", () => {
    expect(css).toMatch(/body\[data-scroll-locked\]\s*\{\s*overscroll-behavior-y: none;/);
  });
});
