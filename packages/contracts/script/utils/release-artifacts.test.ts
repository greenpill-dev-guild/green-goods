import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { mergeReleaseArtifact, recoverReleaseArtifact, simulateReleaseArtifactMerge } from "./release-artifacts";

const directories: string[] = [];

function fixture(canonical: Record<string, unknown>, side: Record<string, unknown>) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "release-artifact-test-"));
  directories.push(directory);
  const canonicalPath = path.join(directory, "42161-latest.json");
  const sidePath = path.join(directory, "42161-release.json");
  fs.writeFileSync(canonicalPath, `${JSON.stringify(canonical, null, 2)}\n`);
  fs.writeFileSync(sidePath, `${JSON.stringify(side, null, 2)}\n`);
  return { canonicalPath, sidePath, ownedKeys: ["settlementModule", "settlementModuleImpl"] as const };
}

afterEach(() => {
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("release artifact transaction boundary", () => {
  it("preserves every historical key on the first atomic promotion", () => {
    const files = fixture(
      { actionRegistry: "0xold", nested: { history: [1, 2, 3] }, settlementModule: null },
      { settlementModule: "0x1111", settlementModuleImpl: "0x2222" },
    );
    const result = mergeReleaseArtifact(files);
    expect(result.changed).toBe(true);
    expect(result.merged).toMatchObject({
      actionRegistry: "0xold",
      nested: { history: [1, 2, 3] },
      settlementModule: "0x1111",
      settlementModuleImpl: "0x2222",
    });
    expect(fs.existsSync(files.sidePath)).toBe(false);
  });

  it("accepts an exact replay and still consumes the stale side file", () => {
    const files = fixture(
      { history: true, settlementModule: "0x1111", settlementModuleImpl: "0x2222" },
      { settlementModule: "0x1111", settlementModuleImpl: "0x2222" },
    );
    expect(mergeReleaseArtifact(files).changed).toBe(false);
    expect(fs.existsSync(files.sidePath)).toBe(false);
  });

  it("rejects partial, conflicting, and unowned side artifacts", () => {
    const partial = fixture({ history: true }, { settlementModule: "0x1111" });
    expect(() => mergeReleaseArtifact(partial)).toThrow(/missing required owned key: settlementModuleImpl/);

    const conflict = fixture(
      { settlementModule: "0xaaaa", settlementModuleImpl: "0x2222" },
      { settlementModule: "0xbbbb", settlementModuleImpl: "0x2222" },
    );
    expect(() => mergeReleaseArtifact(conflict)).toThrow(/Conflicting canonical release key settlementModule/);

    const unowned = fixture(
      { history: true },
      { settlementModule: "0x1111", settlementModuleImpl: "0x2222", actionRegistry: "0xevil" },
    );
    expect(() => mergeReleaseArtifact(unowned)).toThrow(/unowned keys: actionRegistry/);
  });

  it("leaves the old canonical artifact readable when interrupted before rename", () => {
    const files = fixture({ history: "survives" }, { settlementModule: "0x1111", settlementModuleImpl: "0x2222" });
    expect(() =>
      mergeReleaseArtifact({
        ...files,
        beforeRename: () => {
          throw new Error("simulated local disk failure");
        },
      }),
    ).toThrow(/simulated local disk failure/);
    expect(JSON.parse(fs.readFileSync(files.canonicalPath, "utf8"))).toEqual({ history: "survives" });
    expect(fs.existsSync(files.sidePath)).toBe(true);
  });

  it("runs dry-run through the same merge without mutating either canonical or side artifact", () => {
    const files = fixture({ history: "canonical" }, { settlementModule: "0x1111", settlementModuleImpl: "0x2222" });
    const canonicalBefore = fs.readFileSync(files.canonicalPath, "utf8");
    const sideBefore = fs.readFileSync(files.sidePath, "utf8");
    const result = simulateReleaseArtifactMerge(files);
    expect(result.merged.settlementModule).toBe("0x1111");
    expect(fs.readFileSync(files.canonicalPath, "utf8")).toBe(canonicalBefore);
    expect(fs.readFileSync(files.sidePath, "utf8")).toBe(sideBefore);
  });

  it("recovers on-chain success after a failed local write through the normal promotion path", () => {
    const files = fixture({ history: "canonical" }, { settlementModule: "stale", settlementModuleImpl: "stale" });
    fs.unlinkSync(files.sidePath);
    const result = recoverReleaseArtifact(files, {
      settlementModule: "0x1111",
      settlementModuleImpl: "0x2222",
    });
    expect(result.changed).toBe(true);
    expect(result.merged.history).toBe("canonical");
    expect(fs.existsSync(files.sidePath)).toBe(false);
  });

  it("adds owned nested schema paths without replacing sibling schema history", () => {
    const files = fixture(
      { schemas: { assessmentSchemaUID: "0xold", description: "history" } },
      { schemas: { assessmentV3SchemaUID: "0xnew" } },
    );
    const result = mergeReleaseArtifact({
      canonicalPath: files.canonicalPath,
      sidePath: files.sidePath,
      ownedKeys: ["schemas.assessmentV3SchemaUID"],
    });
    expect(result.merged.schemas).toEqual({
      assessmentSchemaUID: "0xold",
      assessmentV3SchemaUID: "0xnew",
      description: "history",
    });
  });
});
