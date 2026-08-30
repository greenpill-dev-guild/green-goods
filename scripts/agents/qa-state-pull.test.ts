import path from "node:path";
import { describe, expect, it } from "vitest";

import { existingArtifacts, parseArgs, SESSION_ARTIFACTS } from "./qa-state-pull";

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

describe("qa:pull overwrite guard", () => {
  const outDir = path.join(repoRoot, "tmp", "qa-session", "2026-09-02");
  const present = (...names: string[]) => (target: string) => names.includes(path.basename(target));

  it("reports nothing to lose when the destination is empty", () => {
    expect(existingArtifacts(outDir, () => false)).toEqual([]);
  });

  it("names each artifact a rerun would replace", () => {
    // Severity, redactions and hand-added rows exist only in these files, so a
    // refresh landing on either of them is a silent loss, not an update.
    expect(existingArtifacts(outDir, present("results.csv"))).toEqual(["results.csv"]);
    expect(existingArtifacts(outDir, present(...SESSION_ARTIFACTS))).toEqual([...SESSION_ARTIFACTS]);
  });

  it("only replaces a pulled session when the operator says so", () => {
    expect(parseArgs(["--slug", "2026-09-02"]).force).toBe(false);
    expect(parseArgs(["--slug", "2026-09-02", "--force"]).force).toBe(true);
    expect(parseArgs(["--force", "--out", "tmp/qa-session/rehearsal"])).toMatchObject({
      force: true,
      outDir: path.join(repoRoot, "tmp", "qa-session", "rehearsal"),
    });
  });
});
