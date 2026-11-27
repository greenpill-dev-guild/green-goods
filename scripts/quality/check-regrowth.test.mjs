import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { fixtureGitEnvironment } from "../lib/dev-shared.js";
import {
  addedLines,
  isPackageSource,
  judge,
  markdownProblem,
  movedWithHub,
  newFileProblem,
  regrownComments,
} from "./check-regrowth.mjs";

test("new markdown is allowed in its homes, guidance folders and conventional names only", () => {
  for (const file of [
    ".plans/active/hub/brief.md",
    ".plans/active/hub/settlement-spec.md",
    ".plans/active/hub/handoffs/codex-contracts.md",
    ".plans/active/hub/handoffs/ui-handoff.md",
    "docs/docs/builders/quality/index.mdx",
    "docs/docs/community/gardener-guide/report-in-chat.mdx",
    "docs/releases/2.1.0/release-notes.md",
    "docs/routines/health-watch.md",
    "docs/README.md",
    "packages/agent/README.md",
    "packages/client/DESIGN.md",
    ".claude/skills/review/SKILL.md",
    ".claude/context/testing.md",
    ".claude/skills/qa-triage/references/unattended-report.md",
    ".claude/skills/audit/report-template.md",
    ".claude/skills/audit/templates/findings.md",
    ".github/ISSUE_TEMPLATE/bug-report.md",
    ".github/PULL_REQUEST_TEMPLATE/security-audit.md",
    ".plans/active/hub/settlement-plan.md",
    "scripts/quality/check.mjs",
  ]) {
    assert.equal(markdownProblem(file), null, file);
  }
  for (const file of [
    "packages/shared/AUDIT_REPORT.md",
    "packages/contracts/docs/conviction-sync-launch.md",
    "packages/indexer/notes.md",
    ".claude/context/audit-2026-11-21.md",
    "scripts/handoff.md",
    "SUMMARY.md",
    ".plans/active/hub/findings-2026-11-21.md",
    ".plans/active/hub/reports/closeout.md",
    ".plans/active/hub/handoffs/2026-11-23-ui-handoff.md",
    ".plans/active/hub/handoffs/reports/ui.md",
    ".claude/skills/audit/reports/audit-2026-11-23.md",
    ".claude/skills/audit/reports/latest.md",
    ".agents/skills/review/review-2026-11-23.md",
    ".claude/skills/audit/audit-summary.md",
    ".plans/active/hub/closeout.md",
    ".plans/active/hub/verification.md",
    ".plans/active/hub/results.md",
    ".plans/backlog/hub/design-review.md",
    ".plans/backlog/hub/audit.md",
    "docs/routines/2026-11-21-run-notes.md",
    "docs/plans/roadmap.md",
    "docs/handover.md",
    "docs/guide.md",
    "docs/architecture/README.md",
    "docs/releases/next/overview.md",
    "docs/releases/v2.1.0/overview.md",
    ".plans/active/hub/operations/2026-11-27-run.md",
  ]) {
    assert.ok(markdownProblem(file), file);
  }
});

test("a plan hub takes no new prototype code, and its pictures and data stay allowed", () => {
  for (const file of [
    ".plans/active/hub/hifi/screens.ts",
    ".plans/active/hub/artifacts/prototype.html",
    ".plans/ideas/hub/demo.mjs",
    ".plans/active/hub/prototype.sol",
    ".plans/active/hub/demo.sh",
    ".plans/backlog/hub/model.py",
    ".plans/active/hub/reports/results.json",
    ".plans/active/hub/reports/capture.png",
    ".plans/active/hub/operations/reports/out.json",
    ".plans/active/hub/handoffs/setup.mjs",
    ".plans/active/hub/backfill.ts",
    ".plans/active/hub/backfill.sql",
    ".plans/active/hub/prototype.go",
    ".plans/ideas/hub/model.ipynb",
  ]) {
    assert.ok(newFileProblem(file), file);
  }
  // A one-shot operation's script lives in its hub's operations/ folder (AGENTS.md).
  for (const file of [
    ".plans/active/hub/status.json",
    ".plans/active/hub/artifacts/capture-375.png",
    "scripts/harness/plan-hub.mjs",
    ".plans/active/hub/operations/backfill-pools.ts",
    ".plans/backlog/hub/operations/steward-hat-relabel/relabel.ts",
    ".plans/active/hub/operations/run.sh",
    ".plans/active/hub/operations/backfill.sql",
    ".plans/active/hub/operations/steward-hat-relabel/README.md",
  ]) {
    assert.equal(newFileProblem(file), null, file);
  }
});

test("package source excludes tests, stories, mocks, declarations and generated files", () => {
  assert.ok(isPackageSource("packages/shared/src/modules/work/submit.ts"));
  assert.ok(isPackageSource("packages/contracts/src/Garden.sol"));
  for (const file of [
    "packages/shared/src/__tests__/a.test.ts",
    "packages/shared/src/components/Button.stories.tsx",
    "packages/shared/src/__mocks__/wagmi.ts",
    "packages/shared/src/types/indexer.d.ts",
    "packages/contracts/script/deploy.ts",
    "scripts/quality/check.mjs",
  ]) {
    assert.ok(!isPackageSource(file), file);
  }
});

test("added lines come from each hunk's new-file range", () => {
  const diff = "@@ -3,0 +4,2 @@\n+a\n+b\n@@ -10 +12 @@\n-x\n+y\n@@ -20,3 +23,0 @@\n-p\n";
  assert.deepEqual([...addedLines(diff)], [4, 5, 12]);
});

test("only purge-shaped comments on added lines count, and a comment whose place carries meaning stays", () => {
  const code = [
    "// ===== Setup =====",
    "const a = 1;",
    "// Submit batch transaction",
    "const b = 2; // explains b",
    "// Safari drops the event when the tab is hidden, so poll instead.",
    "const c = gql(/* GraphQL */ `query Q { a }`);",
  ].join("\n");
  const all = regrownComments(code, "packages/shared/src/x.ts", "all").map((comment) => comment.line);
  assert.deepEqual(all, [1, 3]);
  assert.deepEqual(
    regrownComments(code, "packages/shared/src/x.ts", new Set([3, 4, 5, 6])).map((comment) => comment.line),
    [3],
  );
});

test("the check judges a change against its merge base, uncommitted and untracked work included", (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "regrowth-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = fixtureGitEnvironment();
  const git = (...args) => execFileSync("git", ["-C", root, ...args], { env, encoding: "utf8" });
  const write = (file, text) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  };
  git("init", "-q", "-b", "develop");
  write("packages/shared/src/old.ts", "// ===== Old banner =====\nexport const a = 1;\n");
  write("packages/indexer/legacy-notes.md", "old\n");
  git("add", ".");
  git("commit", "-q", "-m", "base");
  const base = git("rev-parse", "HEAD").trim();

  assert.deepEqual(judge(root, base).problems, []);

  write("packages/shared/src/old.ts", "// ===== Old banner =====\nexport const a = 1;\n// Submit batch transaction\nconst b = 2;\nexport { b };\n");
  write("packages/shared/src/new.ts", "// ----- Section -----\nexport const c = 3;\n");
  write("packages/shared/REVIEW_FINDINGS.md", "findings\n");
  // Hub files that are not markdown are judged too: code outside operations/, data under reports/.
  write(".plans/active/code-hub/demo.ts", "export const demo = 1;\n");
  write(".plans/active/code-hub/reports/out.json", "{}\n");
  write(".plans/active/code-hub/operations/backfill.ts", "export const run = 1;\n");
  write("packages/indexer/legacy-notes.md", "edited, not added\n");
  const { problems } = judge(root, base);
  assert.equal(problems.length, 5, problems.join("\n"));
  assert.ok(problems.some((problem) => problem.startsWith(".plans/active/code-hub/demo.ts: is code in a plan hub")));
  assert.ok(problems.some((problem) => problem.startsWith(".plans/active/code-hub/reports/out.json: reads as a report")));

  // A move and a re-indent add no comment: the moved file is judged against its source, and
  // whitespace is ignored.
  git("add", ".");
  git("commit", "-q", "-m", "change");
  const changed = git("rev-parse", "HEAD").trim();
  git("mv", "packages/shared/src/old.ts", "packages/shared/src/moved.ts");
  write(
    "packages/shared/src/moved.ts",
    "if (true) {\n  // ===== Old banner =====\n}\nexport const a = 1;\n// Submit batch transaction\nconst b = 2;\nexport { b };\n",
  );
  assert.deepEqual(judge(root, changed).problems, []);

  // Moving markdown into a place it may not be is an addition there; moving it within one is not.
  git("mv", "packages/indexer/legacy-notes.md", "packages/indexer/kept-notes.md");
  assert.deepEqual(judge(root, changed).problems, []);
  mkdirSync(path.join(root, ".plans/active/hub"), { recursive: true });
  write(".plans/active/hub/sketch.md", "plan\n");
  write(".plans/backlog/staged/reports/2026-10-01-proof.md", "old report\n");
  write(".plans/backlog/staged/flow-audit.md", "old audit\n");
  write(".plans/backlog/other/reports/proof.md", "another hub's old report\n");
  write(".plans/backlog/staged/vendor-notes.md", "old notes\n");
  git("add", ".");
  git("commit", "-q", "-m", "plan note");
  const planned = git("rev-parse", "HEAD").trim();
  git("mv", ".plans/active/hub/sketch.md", "packages/shared/sketch.md");
  assert.equal(judge(root, planned).problems.length, 1);
  // A hub that changes stage carries its old reports with it.
  git("mv", ".plans/backlog/staged", ".plans/active/staged");
  assert.equal(judge(root, planned).problems.length, 1);
  // An old hub report that leaves `.plans/` is judged where it lands.
  git("mv", ".plans/active/staged/flow-audit.md", "packages/shared/flow-audit.md");
  mkdirSync(path.join(root, "docs"), { recursive: true });
  git("mv", ".plans/active/staged/vendor-notes.md", "docs/vendor-notes.md");
  const moved = judge(root, planned).problems;
  assert.equal(moved.length, 3, moved.join("\n"));
  assert.ok(moved.some((problem) => problem.startsWith("packages/shared/flow-audit.md: reads as a report")));
  assert.ok(moved.some((problem) => problem.startsWith("docs/vendor-notes.md: reads as a report")));
  // So is one that moves to another hub: only its own hub changing stage carries it.
  git("mv", ".plans/backlog/other/reports/proof.md", ".plans/active/staged/reports/proof.md");
  const crossed = judge(root, planned).problems;
  assert.equal(crossed.length, 4, crossed.join("\n"));
  assert.ok(crossed.some((problem) => problem.startsWith(".plans/active/staged/reports/proof.md: reads as a report")));
  assert.equal(movedWithHub(".plans/backlog/hub/reports/a.md", ".plans/active/hub/reports/a.md"), true);
  assert.equal(movedWithHub(".plans/backlog/hub/reports/a.md", ".plans/active/hub/a.md"), false);
  assert.equal(movedWithHub(".plans/backlog/hub/reports/a.md", ".plans/backlog/other/reports/a.md"), false);
  // A file that was already where it may not be is still judged when it moves into a hub.
  git("mv", "packages/indexer/kept-notes.md", ".plans/active/staged/reports/kept-notes.md");
  const inbound = judge(root, planned).problems;
  assert.equal(inbound.length, 5, inbound.join("\n"));
  assert.ok(inbound.some((problem) => problem.startsWith(".plans/active/staged/reports/kept-notes.md: reads as a report")));
  assert.ok(problems.some((problem) => problem.startsWith("packages/shared/src/old.ts:3: new label comment")));
  assert.ok(problems.some((problem) => problem.startsWith("packages/shared/src/new.ts:1: new banner comment")));
  assert.ok(problems.some((problem) => problem.startsWith("packages/shared/REVIEW_FINDINGS.md: reads as a report")));
});

test("re-indenting old comments, as wrapping code in a function does, adds none", (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "regrowth-indent-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = fixtureGitEnvironment();
  const git = (...args) => execFileSync("git", ["-C", root, ...args], { env, encoding: "utf8" });
  const file = path.join(root, "packages/shared/src/flow.ts");
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, "const a = 1;\n// Submit batch transaction\nconst b = a + 1;\nconsole.log(b);\n");
  git("init", "-q", "-b", "develop");
  git("add", ".");
  git("commit", "-q", "-m", "base");
  const base = git("rev-parse", "HEAD").trim();
  writeFileSync(file, "function run() {\n  const a = 1;\n  // Submit batch transaction\n  const b = a + 1;\n  return b;\n}\nrun();\n");
  assert.deepEqual(judge(root, base).problems, []);
  writeFileSync(file, "function run() {\n  const a = 1;\n  // Submit batch transaction\n  const b = a + 1;\n  // Return the result\n  return b;\n}\nrun();\n");
  assert.equal(judge(root, base).problems.length, 1);
});
