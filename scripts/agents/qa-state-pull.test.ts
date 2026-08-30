import path from "node:path";
import { describe, expect, it } from "vitest";

import { existingArtifacts, parseArgs, parseShard, SESSION_ARTIFACTS } from "./qa-state-pull";

/** Shards live at their owner address. */
const PATH = "qa/entries/0x2aa64e6d80390f5c017f0313cb908051be2fd35e.json";

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

describe("qa:pull shard validation", () => {
  const good = JSON.stringify({
    person: "Afo",
    updatedAt: "2026-08-30T10:00:00.000Z",
    entries: { "PUB-014": { s: "fail", n: "approve never fired", at: "2026-08-30T10:00:00.000Z" } },
  });

  it("accepts a well-formed shard", () => {
    expect(parseShard(PATH, good).entries["PUB-014"].s).toBe("fail");
  });

  it("fails the pull rather than dropping a tester whose shard is malformed", () => {
    // mergeShards skips a shape it does not recognise, which is right for a
    // merge and wrong for ingestion: silently skipping here writes a
    // complete-LOOKING run sheet with somebody's whole session missing.
    expect(() => parseShard(PATH, "not json")).toThrow(/not valid JSON/i);
    expect(() => parseShard(PATH, "null")).toThrow(/not an object/i);
    expect(() => parseShard(PATH, "[]")).toThrow(/not an object/i);
    expect(() => parseShard(PATH, '{"person":"Afo"}')).toThrow(/no entries object/i);
    expect(() => parseShard(PATH, '{"address":"0x2aa64e6d80390f5c017f0313cb908051be2fd35e","entries":[]}')).toThrow(/no entries object/i);
  });

  it("refuses a shard filed under the wrong owner", () => {
    // The path names the owner. A shard claiming a different address is not
    // what its path says it is, whatever display name it carries.
    expect(() => parseShard(PATH, '{"address":"0x22682c3d3848294ff9bcbf3f0ddf48a605446b56","entries":{}}')).toThrow(/owner as/);
  });

  it("accepts a shard whose display name changed, since the name is not the key", () => {
    expect(parseShard(PATH, '{"address":"0x2aa64e6d80390f5c017f0313cb908051be2fd35e","person":"Afo the second","entries":{}}').person).toBe(
      "Afo the second",
    );
  });

  it("refuses an entry that is not a verdict and a note", () => {
    expect(() => parseShard(PATH, '{"address":"0x2aa64e6d80390f5c017f0313cb908051be2fd35e","entries":{"PUB-014":null}}')).toThrow(
      /PUB-014 is malformed/,
    );
    expect(() => parseShard(PATH, '{"address":"0x2aa64e6d80390f5c017f0313cb908051be2fd35e","entries":{"PUB-014":{"s":"fail"}}}')).toThrow(
      /PUB-014 is malformed/,
    );
  });
});
