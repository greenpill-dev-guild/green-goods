import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  immutableReportViolations,
  parseNameStatus,
} from "./check-immutable-plan-reports.mjs";

const script = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "check-immutable-plan-reports.mjs",
);

test("rejects edits, deletions, and renames of dated reports", () => {
  const entries = parseNameStatus(
    [
      "M\t.plans/active/example/reports/review-2026-08-10.md",
      "M\t.plans/active/example/reports/2026-08-11-audit.md",
      "D\t.plans/active/example/reports/audit-2026-08-09.md",
      "R100\t.plans/active/example/reports/input-2026-08-08.md\t.plans/active/example/reports/moved-2026-08-08.md",
    ].join("\n"),
  );
  assert.deepEqual(immutableReportViolations(entries), [
    "M: .plans/active/example/reports/review-2026-08-10.md",
    "M: .plans/active/example/reports/2026-08-11-audit.md",
    "D: .plans/active/example/reports/audit-2026-08-09.md",
    "R: .plans/active/example/reports/input-2026-08-08.md",
  ]);
});

test("allows new corrections and edits outside dated report paths", () => {
  const entries = parseNameStatus(
    [
      "A\t.plans/active/example/reports/correction-2026-08-11.md",
      "C100\t.plans/active/example/reports/audit-2026-08-09.md\t.plans/active/example/reports/audit-copy-2026-08-11.md",
      "M\t.plans/active/example/spec.md",
      "M\t.plans/active/example/reports/current-summary.md",
    ].join("\n"),
  );
  assert.deepEqual(immutableReportViolations(entries), []);
});

test("protects dated reports directly under .plans/reports", () => {
  const entries = parseNameStatus("M\t.plans/reports/root-audit-2026-08-09.md");
  assert.deepEqual(immutableReportViolations(entries), [
    "M: .plans/reports/root-audit-2026-08-09.md",
  ]);
});

test("protects dated reports in nested report directories", () => {
  const entries = parseNameStatus(
    "M\t.plans/active/example/reports/linear/update-2026-08-11.md",
  );
  assert.deepEqual(immutableReportViolations(entries), [
    "M: .plans/active/example/reports/linear/update-2026-08-11.md",
  ]);
});

test("rejects unknown CLI arguments", () => {
  const result = spawnSync(process.execPath, [script, "--unknown"], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown argument/);
});

test("rejects a base ref that does not resolve", () => {
  const result = spawnSync(process.execPath, [script, "--base", "refs/heads/not-a-real-base"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /base ref does not resolve/);
});
