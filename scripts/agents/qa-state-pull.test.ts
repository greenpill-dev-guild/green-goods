import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const blob = { get: vi.fn(), list: vi.fn() };

import {
  assertPrivateOutputPath,
  existingArtifacts,
  parseArgs,
  parseShard,
  PULL_IN_PROGRESS_ARTIFACT,
  readShard,
  readShards,
  runPull,
  SESSION_ARTIFACTS,
  verifyPrivateArtifactSet,
  writePrivateArtifactSetAtomically,
  writePrivateFileAtomically,
} from "./qa-state-pull";
import { parseArgs as parseReportArgs, runReport } from "./qa-report";
import type { Catalog, CatalogCase } from "./qa-workbook-build";

/** Shards live at their owner address. */
const PATH = "qa/entries/0x2aa64e6d80390f5c017f0313cb908051be2fd35e.json";
const OTHER_PATH = "qa/entries/0x22682c3d3848294ff9bcbf3f0ddf48a605446b56.json";

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

  it("refuses a symlinked directory that escapes the physical tmp boundary", () => {
    mkdirSync(path.join(repoRoot, "tmp"), { recursive: true });
    const fixtureRoot = mkdtempSync(path.join(repoRoot, "tmp", "qa-pull-boundary-"));
    const outside = mkdtempSync(path.join(repoRoot, "tmp", "qa-pull-outside-"));
    const privateSessionRoot = path.join(fixtureRoot, "tmp", "qa-session");
    mkdirSync(privateSessionRoot, { recursive: true });
    const linkedOutput = path.join(privateSessionRoot, "linked");
    symlinkSync(outside, linkedOutput);

    try {
      expect(() => assertPrivateOutputPath(fixtureRoot, linkedOutput)).toThrow(/must resolve under.*tmp/i);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("refuses a symlinked top-level tmp directory even when it stays inside the repository", () => {
    mkdirSync(path.join(repoRoot, "tmp"), { recursive: true });
    const fixtureRoot = mkdtempSync(path.join(repoRoot, "tmp", "qa-pull-private-root-"));
    const trackedDirectory = path.join(fixtureRoot, "docs");
    const privateRoot = path.join(fixtureRoot, "tmp");
    mkdirSync(trackedDirectory, { recursive: true });
    symlinkSync(trackedDirectory, privateRoot);

    try {
      expect(() =>
        assertPrivateOutputPath(fixtureRoot, path.join(privateRoot, "qa-session", "run")),
      ).toThrow(/must resolve under.*tmp/i);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("replaces an artifact symlink without overwriting its target", () => {
    mkdirSync(path.join(repoRoot, "tmp"), { recursive: true });
    const fixtureRoot = mkdtempSync(path.join(repoRoot, "tmp", "qa-pull-atomic-"));
    const outDir = path.join(fixtureRoot, "tmp", "qa-session", "run");
    const canary = path.join(fixtureRoot, "canary.txt");
    const artifact = path.join(outDir, "results.csv");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(canary, "keep me");
    symlinkSync(canary, artifact);

    try {
      assertPrivateOutputPath(fixtureRoot, outDir);
      writePrivateFileAtomically(artifact, "replacement");
      expect(readFileSync(canary, "utf8")).toBe("keep me");
      expect(lstatSync(artifact).isSymbolicLink()).toBe(false);
      expect(readFileSync(artifact, "utf8")).toBe("replacement");
      expect(lstatSync(artifact).mode & 0o777).toBe(0o600);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
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

  it.each([false, true])("reports the active marker recovery path with force=%s", async (force) => {
    mkdirSync(path.join(repoRoot, "tmp"), { recursive: true });
    const destination = mkdtempSync(path.join(repoRoot, "tmp", "qa-pull-marker-"));
    writeFileSync(path.join(destination, PULL_IN_PROGRESS_ARTIFACT), "another-operation\n");

    try {
      await expect(runPull(
        { slug: "2026-09-02", outDir: destination, force },
        {
          repoRoot,
          token: "unused",
          loadCatalog: vi.fn(),
          readShards: vi.fn(),
        },
      )).rejects.toThrow(/confirm no qa:pull or qa:report process.*remove the marker/i);
    } finally {
      rmSync(destination, { recursive: true, force: true });
    }
  });
});

describe("qa:pull artifact-set commit", () => {
  const artifacts = {
    "results.csv": "Test ID,Result,Severity,Notes\nPUB-001,Pass,,\n",
    "qa-state.json": '{"slug":"2026-09-02","entries":{}}\n',
  };

  it("writes a verifiable generation and removes its in-progress marker", () => {
    mkdirSync(path.join(repoRoot, "tmp"), { recursive: true });
    const outDir = mkdtempSync(path.join(repoRoot, "tmp", "qa-pull-set-"));

    try {
      writePrivateArtifactSetAtomically(outDir, artifacts);
      expect(lstatSync(path.join(outDir, "results.csv")).mode & 0o777).toBe(0o600);
      expect(lstatSync(path.join(outDir, "qa-state.json")).mode & 0o777).toBe(0o600);
      expect(() => verifyPrivateArtifactSet(outDir, artifacts)).not.toThrow();
      expect(() => lstatSync(path.join(outDir, PULL_IN_PROGRESS_ARTIFACT))).toThrow();
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it("locks before the Blob snapshot so a report cannot publish from the generation being replaced", async () => {
    mkdirSync(path.join(repoRoot, "tmp"), { recursive: true });
    const outDir = mkdtempSync(path.join(repoRoot, "tmp", "qa-pull-snapshot-lock-"));
    const testCase: CatalogCase = {
      id: "PUB-001",
      tab: "Public Website",
      platform: "Desktop Browser",
      priority: "P0",
      kind: "journey",
      area: "Home",
      scenario: "Open the public home page",
      preconditions: [],
      steps: ["Open /"],
      expected: "The page is usable",
      evidence: "Screenshot",
      role: "none",
      status: "active",
      source: "qa-state-pull-test",
    };
    const catalog: Catalog = {
      version: 3,
      tabs: ["Public Website"],
      kinds: [{ id: "journey", label: "Journey", verifies: "An end-to-end journey" }],
      statuses: [],
      cases: [testCase],
    };
    writeFileSync(path.join(outDir, "results.csv"), "Test ID,Result,Severity,Notes\nPUB-001,Fail,,old\n");
    writeFileSync(path.join(outDir, "qa-state.json"), JSON.stringify({
      slug: "2026-09-02",
      pulledAt: "2026-09-02T19:40:00.000Z",
      entries: { "PUB-001": { Tester: { s: "fail", n: "old", at: "2026-09-02T18:00:00.000Z" } } },
    }));
    let reportError: unknown;

    try {
      await runPull(
        { slug: "2026-09-02", outDir, force: true },
        {
          repoRoot,
          token: "test-token",
          loadCatalog: async () => catalog,
          async readShards() {
            try {
              await runReport(
                parseReportArgs(["--slug", "2026-09-02", "--out", path.relative(repoRoot, outDir)]),
                { catalog, repoRoot },
              );
            } catch (error) {
              reportError = error;
            }
            return [{
              address: "0x2aa64e6d80390f5c017f0313cb908051be2fd35e",
              person: "Tester",
              updatedAt: "2026-09-02T20:00:00.000Z",
              entries: {
                "PUB-001": { s: "pass", n: "new", at: "2026-09-02T20:00:00.000Z" },
              },
            }];
          },
          now: () => new Date("2026-09-02T20:00:00.000Z"),
        },
      );

      expect(reportError).toBeInstanceOf(Error);
      expect((reportError as Error).message).toMatch(/already locked/i);
      expect(existsSync(path.join(outDir, "report.md"))).toBe(false);
      expect(readFileSync(path.join(outDir, "qa-state.json"), "utf8")).toContain('"s": "pass"');
      expect(existsSync(path.join(outDir, PULL_IN_PROGRESS_ARTIFACT))).toBe(false);

      const written = await runReport(
        parseReportArgs(["--slug", "2026-09-02", "--out", path.relative(repoRoot, outDir)]),
        { catalog, repoRoot },
      );
      const report = readFileSync(written.report, "utf8");
      expect(report).toContain("- P0: 1/1 — 1 pass");
      expect(report).not.toContain("1 fail");
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it("rejects an overlapping writer before it can replace the first generation", () => {
    mkdirSync(path.join(repoRoot, "tmp"), { recursive: true });
    const outDir = mkdtempSync(path.join(repoRoot, "tmp", "qa-pull-set-"));
    const otherArtifacts = {
      "results.csv": "other results\n",
      "qa-state.json": '{"slug":"other","entries":{}}\n',
    };
    let overlapError: unknown;
    let overlapAttempted = false;

    try {
      writePrivateArtifactSetAtomically(outDir, artifacts, {
        write(target, content) {
          writePrivateFileAtomically(target, content);
          if (overlapAttempted || !target.endsWith(".staged")) return;
          overlapAttempted = true;
          try {
            writePrivateArtifactSetAtomically(outDir, otherArtifacts);
          } catch (error) {
            overlapError = error;
          }
        },
        move: renameSync,
        remove: unlinkSync,
        exists: existsSync,
      });

      expect(overlapAttempted).toBe(true);
      expect(overlapError).toBeInstanceOf(Error);
      expect((overlapError as Error).message).toMatch(/already locked/i);
      expect(readFileSync(path.join(outDir, "results.csv"), "utf8")).toBe(artifacts["results.csv"]);
      expect(readFileSync(path.join(outDir, "qa-state.json"), "utf8")).toBe(artifacts["qa-state.json"]);
      expect(existsSync(path.join(outDir, PULL_IN_PROGRESS_ARTIFACT))).toBe(false);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it("rechecks overwrite protection after a delayed lock acquisition", () => {
    mkdirSync(path.join(repoRoot, "tmp"), { recursive: true });
    const outDir = mkdtempSync(path.join(repoRoot, "tmp", "qa-pull-set-"));
    const fasterArtifacts = {
      "results.csv": "faster results\n",
      "qa-state.json": '{"slug":"faster","entries":{}}\n',
    };

    try {
      expect(() =>
        writePrivateArtifactSetAtomically(
          outDir,
          artifacts,
          {
            write: writePrivateFileAtomically,
            move: renameSync,
            remove: unlinkSync,
            exists: existsSync,
            acquire(target, content) {
              writePrivateArtifactSetAtomically(outDir, fasterArtifacts);
              writeFileSync(target, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
            },
          },
          false,
        ),
      ).toThrow(/refusing to overwrite/i);
      expect(readFileSync(path.join(outDir, "results.csv"), "utf8")).toBe(
        fasterArtifacts["results.csv"],
      );
      expect(readFileSync(path.join(outDir, "qa-state.json"), "utf8")).toBe(
        fasterArtifacts["qa-state.json"],
      );
      expect(existsSync(path.join(outDir, PULL_IN_PROGRESS_ARTIFACT))).toBe(false);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it("leaves a marker in place when it no longer owns that marker", () => {
    mkdirSync(path.join(repoRoot, "tmp"), { recursive: true });
    const outDir = mkdtempSync(path.join(repoRoot, "tmp", "qa-pull-set-"));
    const markerPath = path.join(outDir, PULL_IN_PROGRESS_ARTIFACT);
    let markerRemovalAttempted = false;

    try {
      expect(() =>
        writePrivateArtifactSetAtomically(outDir, artifacts, {
          write: writePrivateFileAtomically,
          move: renameSync,
          remove(target) {
            if (target === markerPath) markerRemovalAttempted = true;
            unlinkSync(target);
          },
          exists: existsSync,
          read(target) {
            return target === markerPath ? "another-generation\n" : readFileSync(target, "utf8");
          },
        }),
      ).toThrow(/lock ownership changed/i);
      expect(markerRemovalAttempted).toBe(false);
      expect(existsSync(markerPath)).toBe(true);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it("restores the previous generation when the second artifact cannot be committed", () => {
    mkdirSync(path.join(repoRoot, "tmp"), { recursive: true });
    const outDir = mkdtempSync(path.join(repoRoot, "tmp", "qa-pull-set-"));
    const previous = {
      "results.csv": "previous results\n",
      "qa-state.json": "previous state\n",
    };
    for (const [name, content] of Object.entries(previous)) {
      writeFileSync(path.join(outDir, name), content);
    }

    try {
      expect(() =>
        writePrivateArtifactSetAtomically(outDir, artifacts, {
          write: writePrivateFileAtomically,
          move(source, target) {
            if (path.basename(target) === "qa-state.json" && source.endsWith(".staged")) {
              throw new Error("simulated failure");
            }
            renameSync(source, target);
          },
          remove: unlinkSync,
          exists: existsSync,
        }, true),
      ).toThrow(/previous artifacts were restored/i);
      expect(readFileSync(path.join(outDir, "results.csv"), "utf8")).toBe(previous["results.csv"]);
      expect(readFileSync(path.join(outDir, "qa-state.json"), "utf8")).toBe(previous["qa-state.json"]);
      expect(existsSync(path.join(outDir, PULL_IN_PROGRESS_ARTIFACT))).toBe(false);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it("rejects an artifact changed while a report snapshot is being read", () => {
    mkdirSync(path.join(repoRoot, "tmp"), { recursive: true });
    const outDir = mkdtempSync(path.join(repoRoot, "tmp", "qa-pull-set-"));

    try {
      writePrivateArtifactSetAtomically(outDir, artifacts);
      expect(() =>
        verifyPrivateArtifactSet(outDir, artifacts, {
          exists: existsSync,
          read(target) {
            return path.basename(target) === "results.csv"
              ? "different\n"
              : readFileSync(target, "utf8");
          },
        }),
      ).toThrow(/changed while.*snapshot/i);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});

describe("qa:pull shard validation", () => {
  const good = JSON.stringify({
    address: "0x2aa64e6d80390f5c017f0313cb908051be2fd35e",
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
    expect(() => parseShard(PATH, '{"person":"Afo","entries":{}}')).toThrow(/owner address/i);
    expect(() => parseShard(PATH, '{"address":"0x2aa64e6d80390f5c017f0313cb908051be2fd35e","person":"Afo","updatedAt":"2026-08-30T10:00:00.000Z","entries":[]}')).toThrow(/no entries object/i);
  });

  it("refuses a shard filed under the wrong owner", () => {
    // The path names the owner. A shard claiming a different address is not
    // what its path says it is, whatever display name it carries.
    expect(() => parseShard(PATH, '{"address":"0x22682c3d3848294ff9bcbf3f0ddf48a605446b56","person":"Gui","updatedAt":"2026-08-30T10:00:00.000Z","entries":{}}')).toThrow(/owner as/);
  });

  it("accepts a shard whose display name changed, since the name is not the key", () => {
    expect(parseShard(PATH, '{"address":"0x2aa64e6d80390f5c017f0313cb908051be2fd35e","person":"Afo the second","updatedAt":"2026-08-30T10:00:00.000Z","entries":{}}').person).toBe(
      "Afo the second",
    );
  });

  it("refuses an entry that is not a verdict and a note", () => {
    expect(() => parseShard(PATH, '{"address":"0x2aa64e6d80390f5c017f0313cb908051be2fd35e","person":"Afo","updatedAt":"2026-08-30T10:00:00.000Z","entries":{"PUB-014":null}}')).toThrow(
      /PUB-014 is malformed/,
    );
    expect(() => parseShard(PATH, '{"address":"0x2aa64e6d80390f5c017f0313cb908051be2fd35e","person":"Afo","updatedAt":"2026-08-30T10:00:00.000Z","entries":{"PUB-014":{"s":"fail"}}}')).toThrow(
      /PUB-014 is malformed/,
    );
  });
});

describe("qa:pull store enumeration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("follows every Blob listing page", async () => {
    blob.list
      .mockResolvedValueOnce({ blobs: [{ pathname: PATH }], hasMore: true, cursor: "next" })
      .mockResolvedValueOnce({ blobs: [{ pathname: OTHER_PATH }], hasMore: false });
    blob.get.mockImplementation(async (pathname: string) => {
      const address = pathname === PATH
        ? "0x2aa64e6d80390f5c017f0313cb908051be2fd35e"
        : "0x22682c3d3848294ff9bcbf3f0ddf48a605446b56";
      const body = JSON.stringify({
        address,
        person: pathname === PATH ? "Afo" : "Gui",
        updatedAt: "2026-08-30T10:00:00.000Z",
        entries: {},
      });
      return { statusCode: 200, stream: new Response(body).body };
    });

    await expect(readShards("token", blob)).resolves.toHaveLength(2);
    expect(blob.list).toHaveBeenNthCalledWith(1, { prefix: "qa/entries/", token: "token" });
    expect(blob.list).toHaveBeenNthCalledWith(2, {
      prefix: "qa/entries/",
      token: "token",
      cursor: "next",
    });
  });

  it("does not treat a failed Blob read as an absent shard", async () => {
    blob.get.mockResolvedValue({ statusCode: 503, stream: null });
    await expect(readShard(PATH, "token", blob)).rejects.toThrow(/unexpected status 503/);
  });
});
