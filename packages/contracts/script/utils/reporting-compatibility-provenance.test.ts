import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { reportingSourceDigest } from "./reporting-compatibility-provenance";

const roots: string[] = [];
const fixture = () => {
  const root = mkdtempSync(path.join(tmpdir(), "reporting-proof-"));
  roots.push(root);
  mkdirSync(path.join(root, "source"));
  writeFileSync(path.join(root, "source/a.ts"), "const a = 1;");
  writeFileSync(path.join(root, "source/b.ts"), "const b = 2;");
  return root;
};
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

describe("reporting fork source provenance", () => {
  it("identifies exact sorted public source inputs independently of caller order", () => {
    const root = fixture();
    const full = reportingSourceDigest(root, ["source"]);
    expect(full.sourceFiles).toEqual(["source/a.ts", "source/b.ts"]);
    expect(full).toEqual(reportingSourceDigest(root, ["source/b.ts", "source/a.ts"]));
  });
  it("changes when a relevant source changes even at the same Git commit", () => {
    const root = fixture(),
      before = reportingSourceDigest(root, ["source"]);
    writeFileSync(path.join(root, "source/a.ts"), "const a = 9;");
    expect(reportingSourceDigest(root, ["source"]).sourceDigest).not.toEqual(before.sourceDigest);
  });
  it("includes file identity, so identical bytes at another path produce different evidence", () => {
    const root = fixture();
    writeFileSync(path.join(root, "source/b.ts"), "const a = 1;");
    expect(reportingSourceDigest(root, ["source/a.ts"]).sourceDigest).not.toEqual(
      reportingSourceDigest(root, ["source/b.ts"]).sourceDigest,
    );
  });
  it("rejects empty, escaped, symlinked, and environment-file source inputs", () => {
    const root = fixture();
    writeFileSync(path.join(root, ".env"), "PRIVATE=fixture");
    symlinkSync(path.join(root, "source"), path.join(root, "linked"));
    for (const inputs of [[], ["../escape.ts"], ["linked"], ["linked/a.ts"], [".env"]])
      expect(() => reportingSourceDigest(root, inputs)).toThrow();
  });
});
