import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReport,
  checkResultFromOutput,
  checksForScope,
  collectGitContext,
  parseArgs,
  scopes,
} from "./drift-check.mjs";

const fixedNow = () => new Date("2026-05-12T00:00:00.000Z");
const cleanGit = { available: true, dirty: false, entries: [] };

test("warn-only docs audit output becomes a finding", () => {
  const report = buildReport({
    scope: "docs",
    git: cleanGit,
    now: fixedNow,
    run: (check) =>
      checkResultFromOutput(check, {
        exitCode: 0,
        stdout: [
          "docs-audit: 2 warning(s).",
          "- docs/docs/example.mdx: Missing required frontmatter field: source_of_truth",
          "docs-audit: CI mode is warn-only; exiting with code 0.",
        ].join("\n"),
      }),
  });

  assert.equal(report.ok, false);
  assert.equal(report.checks[0].status, "warn");
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0].status, "warn");
  assert.equal(report.findings[0].title, "Docs audit drift detected");
  assert.equal(report.findings[0].recommended_route, "audit-then-ship");
});

test("passing checks produce no findings", () => {
  const report = buildReport({
    scope: "guidance",
    git: cleanGit,
    now: fixedNow,
    run: (check) => checkResultFromOutput(check, { exitCode: 0, stdout: "ok" }),
  });

  assert.equal(report.ok, true);
  assert.equal(report.checks.length, 3);
  assert.deepEqual(report.findings, []);
});

test("failed check becomes a routed finding", () => {
  const [check] = checksForScope("cleanup");
  const result = checkResultFromOutput(check, {
    exitCode: 1,
    stderr: "source file exceeds frozen limit",
  });

  assert.equal(result.status, "fail");
  assert.equal(result.route, "clean --dry-run");
});

test("warning patterns inspect full output, not just the displayed tail", () => {
  const report = buildReport({
    scope: "cleanup",
    git: cleanGit,
    now: fixedNow,
    run: (check) => {
      if (check.id !== "react-patterns") {
        return checkResultFromOutput(check, { exitCode: 0, stdout: "ok" });
      }

      return checkResultFromOutput(check, {
        exitCode: 0,
        stdout: [
          "check-react-patterns: 64 new warning(s):",
          ...Array.from({ length: 24 }, (_, index) => `tail line ${index}`),
        ].join("\n"),
      });
    },
  });

  assert.equal(report.ok, false);
  assert.equal(report.checks[1].status, "warn");
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0].title, "React pattern lint drift detected");
  assert.equal(report.findings[0].recommended_route, "clean --dry-run");
  assert.doesNotMatch(report.findings[0].output_tail, /64 new warning/);
});

test("dirty git context is included in reports", () => {
  const git = collectGitContext({
    env: {
      DRIFT_CHECK_FAKE_GIT_STATUS: " M packages/client/src/App.tsx\n?? tmp.txt",
    },
  });

  assert.equal(git.available, true);
  assert.equal(git.dirty, true);
  assert.deepEqual(git.entries, [" M packages/client/src/App.tsx", "?? tmp.txt"]);
});

test("cleanup is a supported scope", () => {
  const parsed = parseArgs(["--scope", "cleanup", "--json"]);

  assert.deepEqual(parsed, { scope: "cleanup", json: true });
  assert.equal(scopes.cleanup.length, 2);
});
