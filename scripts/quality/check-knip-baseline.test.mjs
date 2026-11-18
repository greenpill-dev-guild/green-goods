import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { fixtureGitEnvironment } from "../lib/dev-shared.js";
import {
  BASELINE_PATH,
  baseContext,
  formatBaseline,
  judge,
  parseBaseline,
  parseKnipReport,
  renamesSince,
  shrinkBaseline,
} from "./check-knip-baseline.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CARD = "packages/client/src/components/Card.tsx";
const BADGE = "packages/client/src/components/Badge.tsx";

test("knip's JSON report becomes findings by kind and file, after any lines configuration files printed", () => {
  const report = {
    issues: [
      {
        file: CARD,
        owners: [{ name: "@team" }],
        exports: [{ name: "b", line: 9 }, { name: "a", line: 3 }],
        types: [],
        duplicates: [[{ name: "Card", line: 4 }, { name: "default", line: 20 }]],
      },
      { file: "packages/client/package.json", dependencies: [{ name: "left-pad", line: 12 }] },
    ],
  };
  const { findings, places } = parseKnipReport(`[vite-watch] checkout=/x\n${JSON.stringify(report)}\n`);
  assert.deepEqual(findings, {
    dependencies: { "packages/client/package.json": ["left-pad"] },
    duplicates: { [CARD]: ["Card = default"] },
    exports: { [CARD]: ["a", "b"] },
  });
  assert.equal(places.get(JSON.stringify(["exports", CARD, "b"])), 9);
  assert.throws(() => parseKnipReport("[vite-watch] only noise\n"), /no JSON report/);
  // A kind the check does not hold fails rather than going ungated.
  assert.throws(() => parseKnipReport(JSON.stringify({ issues: [{ file: CARD, cycles: [{ name: "a" }] }] })), /cycles, which this check does not hold/);
});

test("a finding the baseline does not name fails, even when another in the same file is gone", () => {
  const baseline = { exports: { [CARD]: ["a"] } };
  const findings = { exports: { [CARD]: ["b"] } };
  const result = judge({ findings, baseline, places: new Map([[JSON.stringify(["exports", CARD, "b"]), 7]]) });
  assert.equal(result.ok, false);
  assert.deepEqual(result.lines, [
    `new finding in ${CARD}:7: exports b`,
    "findings that moved with a file git did not see as a rename count as new; keep the move a rename, or remove the dead code",
    `stale baseline for ${CARD}: exports a is gone; record it with \`node scripts/quality/check-knip-baseline.mjs --baseline-shrink\``,
  ]);
  assert.equal(judge({ findings: baseline, baseline }).ok, true);
});

test("a gone finding fails wherever it is, since an import in one file clears a finding in another, and the baseline may not outgrow the base", () => {
  const baseline = { exports: { [CARD]: ["a"] }, files: { [BADGE]: [BADGE] } };
  const findings = { files: { [BADGE]: [BADGE] } };
  assert.deepEqual(judge({ findings, baseline }).lines, [
    `stale baseline for ${CARD}: exports a is gone; record it with \`node scripts/quality/check-knip-baseline.mjs --baseline-shrink\``,
  ]);
  const grown = judge({ findings: baseline, baseline, previous: { exports: { [CARD]: ["a"] } } });
  assert.deepEqual(grown.lines, [`baseline grew for ${BADGE}: files ${BADGE} is not in the base branch's copy`]);
});

test("a renamed file keeps its findings until the shrink moves them, and the shrink refuses new ones", () => {
  const baseline = { exports: { [CARD]: ["a", "b"] } };
  const renames = new Map([[BADGE, CARD]]);
  const findings = { exports: { [BADGE]: ["a"] } };
  const before = judge({ findings, baseline, renames });
  assert.equal(before.lines.some((line) => line.startsWith("new finding")), false);
  assert.equal(before.ok, false, "the old path's entries are stale until recorded");
  const next = shrinkBaseline(baseline, findings, renames);
  assert.deepEqual(next, { exports: { [BADGE]: ["a"] } });
  assert.equal(judge({ findings, baseline: next, previous: baseline, renames }).ok, true);
  assert.throws(() => shrinkBaseline(baseline, { exports: { [CARD]: ["c"] } }), /refusing to shrink/);
});

test("a change's renames come from git, and the base's baseline from its base", () => {
  const root = mkdtempSync(path.join(tmpdir(), "gg-knip-changes-"));
  try {
    const env = fixtureGitEnvironment();
    const git = (...args) => execFileSync("git", args, { cwd: root, env, encoding: "utf8" }).trim();
    const write = (file, text) => {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      writeFileSync(path.join(root, file), text);
    };
    git("init", "-q");
    write(CARD, "export const a = 1;\n");
    write("packages/client/src/Same.ts", "export {};\n");
    write(BASELINE_PATH, formatBaseline({ exports: { [CARD]: ["a"] } }));
    git("add", "--", "packages", "scripts");
    git("commit", "-q", "-m", "base");
    const base = git("rev-parse", "HEAD");
    git("mv", CARD, BADGE);
    write("packages/client/src/New.ts", "export {};\n");
    assert.deepEqual([...renamesSince(root, base)], [[BADGE, CARD]]);
    const context = baseContext(["--base", base], { root });
    assert.deepEqual([...context.renames], [[BADGE, CARD]]);
    assert.deepEqual(context.previous, { exports: { [CARD]: ["a"] } });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the baseline file is a version 1 document of named findings, as the repository's is", () => {
  const findings = parseBaseline(readFileSync(path.join(repoRoot, BASELINE_PATH), "utf8"));
  assert.ok(Object.keys(findings).length > 0);
  assert.equal(readFileSync(path.join(repoRoot, BASELINE_PATH), "utf8"), formatBaseline(findings));
  assert.throws(() => parseBaseline(JSON.stringify({ version: 1, findings: { owners: {} } })), /not a kind of knip finding/);
  assert.throws(() => parseBaseline(JSON.stringify({ version: 1, findings: { exports: { [CARD]: [] } } })), /not a list of names/);
  assert.throws(() => parseBaseline(JSON.stringify({ version: 2, findings: {} })), /not a version 1 baseline/);
});
