import path from "node:path";
import { describe, expect, it } from "vitest";

import { parseArgs } from "./qa-state-pull";

const repoRoot = path.join(import.meta.dirname, "..", "..");

describe("qa:pull output boundary", () => {
  it("keeps the default output in the repo's gitignored tmp directory", () => {
    expect(parseArgs(["--slug", "2026-09-02"]).outDir).toBe(
      path.join(repoRoot, "tmp", "qa-session", "2026-09-02"),
    );
  });

  it("accepts a custom destination under tmp", () => {
    expect(parseArgs(["--out", "tmp/qa-session/rehearsal"]).outDir).toBe(
      path.join(repoRoot, "tmp", "qa-session", "rehearsal"),
    );
  });

  it("refuses tracked or external destinations", () => {
    expect(() => parseArgs(["--out", "docs/qa-run"])).toThrow(/must stay under.*tmp/i);
    expect(() => parseArgs(["--out", path.join(repoRoot, "packages", "qa", "results")])).toThrow(
      /must stay under.*tmp/i,
    );
  });
});
