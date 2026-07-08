import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Hub workbench grid CSS", () => {
  it("uses flexible full-width tracks instead of capped card columns", () => {
    const css = readFileSync(resolve(__dirname, "../../index.css"), "utf-8");
    const gridRule = css.match(/\.hub-workbench-grid\s*{[^}]*}/s)?.[0] ?? "";

    expect(gridRule).toContain("width: 100%");
    expect(gridRule).toContain(
      "grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr))"
    );
    expect(gridRule).toContain("justify-content: stretch");
    expect(gridRule).not.toContain("22rem");
  });
});
