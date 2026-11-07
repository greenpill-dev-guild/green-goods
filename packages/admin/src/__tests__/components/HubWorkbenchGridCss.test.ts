import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Hub workbench grid CSS", () => {
  it("uses flexible full-width tracks that keep column width for sparse results", () => {
    const css = readFileSync(resolve(__dirname, "../../styles/admin-layout.css"), "utf-8");
    const gridRule = css.match(/\.hub-workbench-grid\s*{[^}]*}/s)?.[0] ?? "";

    expect(gridRule).toContain("width: 100%");
    // auto-FILL keeps empty tracks, so one search result renders at a normal
    // card width instead of stretching across the whole grid (auto-fit would
    // collapse the empty tracks and hand the lone card the full row).
    expect(gridRule).toContain(
      "grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr))"
    );
    expect(gridRule).toContain("justify-content: stretch");
    expect(gridRule).not.toContain("22rem");
  });

  it("gives the work queue's wide cards their own column rule, at most two to a row at every desktop width", () => {
    const css = readFileSync(resolve(__dirname, "../../styles/admin-layout.css"), "utf-8");
    const wideRule =
      css.match(/\.hub-workbench-grid\[data-card-layout="wide"\]\s*{[^}]*}/s)?.[0] ?? "";

    // DL-135 keeps two tracks even on large displays and for sparse results.
    expect(wideRule).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
  });
});
