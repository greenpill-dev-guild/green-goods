import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  addedLineNumbersFromDiff,
  checkDecisionLogCitations,
  filterPresentPaths,
  findBrokenRootCodePaths,
  findStaleLockedDecisions,
  findUntaggedFenceOpenings,
  parseNameStatus,
  scanDeletedSurfaceReferences,
  scanPersistentRetiredReferences,
} from "./check-guidance-links.mjs";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "check-guidance-links.mjs");

test("finds an untagged opening fence but accepts a tagged fence", () => {
  assert.deepEqual(findUntaggedFenceOpenings("```\ndiagram\n```", "guide.md"), [
    "guide.md:1: fenced code block is missing a language tag",
  ]);
  assert.deepEqual(findUntaggedFenceOpenings("```text\ndiagram\n```", "guide.md"), []);
});

test("checks root-relative Markdown paths written as inline code", () => {
  const text = [
    "Read `docs/docs/reference/glossary.generated.mdx`.",
    "Do not read `docs/docs/missing.mdx`.",
  ].join("\n");
  assert.deepEqual(
    findBrokenRootCodePaths(text, ".claude/context/agent.md", (target) =>
      target.endsWith("glossary.generated.mdx")
    ),
    [".claude/context/agent.md: broken code path -> docs/docs/missing.mdx"]
  );
});

test("checks only changed fence openings", () => {
  const text = ["```", "legacy", "```", "```", "changed", "```"].join("\n");
  assert.deepEqual(findUntaggedFenceOpenings(text, "guide.md", new Set([4])), [
    "guide.md:4: fenced code block is missing a language tag",
  ]);
});

test("checks blockquoted fence openings", () => {
  const text = ["> ```", "> legacy", "> ```"].join("\n");
  assert.deepEqual(findUntaggedFenceOpenings(text, "guide.md", new Set([1])), [
    "guide.md:1: fenced code block is missing a language tag",
  ]);
});

test("grandfathers every fence in a pure rename", () => {
  const text = ["```", "legacy", "```"].join("\n");
  assert.deepEqual(findUntaggedFenceOpenings(text, "renamed.md", new Set()), []);
});

test("extracts added line numbers without counting Git markers", () => {
  const diff = [
    "+++ b/guide.md",
    "@@ -2,1 +2,2 @@",
    "+first",
    "\\ No newline at end of file",
    "+second",
  ].join("\n");
  assert.deepEqual([...addedLineNumbersFromDiff(diff).get("guide.md")], [2, 3]);
});

test("finds consumers of a deleted slash command", () => {
  const failures = scanDeletedSurfaceReferences(
    [{ path: "docs/guide.mdx", text: "Resume with `/status --resume`." }],
    [".claude/skills/status/SKILL.md"],
  );
  assert.equal(failures.length, 1);
  assert.match(failures[0], /deleted surface -> \/status/);
});

test("finds source consumers of a deleted slash command", () => {
  const failures = scanDeletedSurfaceReferences(
    [{ path: "scripts/agents/qa-sheet-append.ts", text: "// Resume with /qa-triage." }],
    [".claude/skills/qa-triage/SKILL.md"],
  );
  assert.equal(failures.length, 1);
  assert.match(failures[0], /deleted surface -> \/qa-triage/);
});

test("does not confuse status.json paths with the retired status command", () => {
  const failures = scanDeletedSurfaceReferences(
    [{ path: ".claude/skills/plan/SKILL.md", text: "Update .plans/active/example/status.json." }],
    [".claude/skills/status/SKILL.md"],
  );
  assert.deepEqual(failures, []);
});

test("finds deleted slash commands followed by prose punctuation", () => {
  const failures = scanDeletedSurfaceReferences(
    [{ path: "docs/guide.mdx", text: "Run /review: before merging." }],
    [".claude/skills/review/SKILL.md"],
  );
  assert.equal(failures.length, 1);
});

test("does not confuse retired Claude commands with agent product commands", () => {
  const failures = scanDeletedSurfaceReferences(
    [{ path: "packages/agent/README.md", text: "Send /status to the Telegram bot." }],
    [".claude/skills/status/SKILL.md"],
  );
  assert.deepEqual(failures, []);

  const retiredAgentPrompt = scanDeletedSurfaceReferences(
    [{ path: "packages/agent/src/prompt.ts", text: "// Ask the operator to run /review." }],
    [".claude/skills/review/SKILL.md"],
  );
  assert.equal(retiredAgentPrompt.length, 1);
});

test("filters tracked paths that no longer exist in the worktree", () => {
  assert.deepEqual(
    filterPresentPaths(["kept.md", "deleted.md", "kept.md"], (file) => file === "kept.md"),
    ["kept.md"],
  );
});

test("allows explicit retirement notices", () => {
  const failures = scanDeletedSurfaceReferences(
    [{ path: "docs/guide.mdx", text: "The `/status` command was retired." }],
    [".claude/skills/status/SKILL.md"],
  );
  assert.deepEqual(failures, []);
});

test("rejects negated retirement notices", () => {
  const failures = scanDeletedSurfaceReferences(
    [
      {
        path: "docs/guide.mdx",
        text: "The /review command has not been retired; keep using it.",
      },
    ],
    [".claude/skills/review/SKILL.md"],
  );
  assert.equal(failures.length, 1);
});

test("does not treat an unrelated move as a retirement notice", () => {
  const failures = scanDeletedSurfaceReferences(
    [{ path: "docs/guide.mdx", text: "Once the data has moved, run `/status`." }],
    [".claude/skills/status/SKILL.md"],
  );
  assert.equal(failures.length, 1);
});

test("finds source comments pointing at a deleted design guide", () => {
  const failures = scanDeletedSurfaceReferences(
    [{ path: "packages/admin/src/index.css", text: "/* Follow spatial.md for layers. */" }],
    [".claude/skills/design/spatial.md"],
  );
  assert.equal(failures.length, 1);
  assert.match(failures[0], /spatial\.md/);
});

test("finds consumers of a deleted context guide", () => {
  const failures = scanDeletedSurfaceReferences(
    [
      {
        path: "packages/shared/src/ontology/green-goods-ontology.json",
        text: '{"source":".claude/context/ontology.md"}',
      },
    ],
    [".claude/context/ontology.md"],
  );
  assert.equal(failures.length, 1);
  assert.match(failures[0], /ontology\.md/);
});

test("allows static regex retirement notices", () => {
  const failures = scanPersistentRetiredReferences(
    [{ path: "docs/guide.mdx", text: "The /principles command was retired." }],
  );
  assert.deepEqual(failures, []);
});

test("rejects negated static regex retirement notices", () => {
  const failures = scanPersistentRetiredReferences([
    {
      path: "docs/guide.mdx",
      text: "The /principles command was never removed; keep using it.",
    },
  ]);
  assert.equal(failures.length, 1);
});

test("does not confuse a colliding guide basename with an unrelated path", () => {
  const failures = scanDeletedSurfaceReferences(
    [{ path: "docs/guide.mdx", text: "See tests/ARCHITECTURE.md." }],
    [".claude/skills/design/ARCHITECTURE.md"],
    ["docs/guide.mdx", "tests/ARCHITECTURE.md"],
  );
  assert.deepEqual(failures, []);
});

test("finds a relative consumer when deleted guide basenames collide", () => {
  const failures = scanDeletedSurfaceReferences(
    [
      {
        path: ".claude/skills/design/SKILL.md",
        text: "Read [the architecture](./ARCHITECTURE.md).",
      },
    ],
    [".claude/skills/design/ARCHITECTURE.md"],
    [".claude/skills/design/SKILL.md", "tests/ARCHITECTURE.md"],
  );
  assert.equal(failures.length, 1);
});

test("parses deleted and renamed paths", () => {
  assert.deepEqual(
    parseNameStatus(
      "D\t.claude/skills/status/SKILL.md\nR100\t.claude/skills/design/spatial.md\t.claude/skills/design/surfaces.md\n",
    ),
    [
      { status: "D", path: ".claude/skills/status/SKILL.md" },
      {
        status: "R",
        oldPath: ".claude/skills/design/spatial.md",
        path: ".claude/skills/design/surfaces.md",
      },
    ],
  );
});

test("accepts DL citations present in the ledger and rejects unknown ones", () => {
  const ledger = "| DL-007 | 2026-08-16 | decision | rationale | codified | interaction-patterns.md |";
  const files = [
    {
      path: ".claude/skills/design/interaction-patterns.md",
      text: "steps follow DL-007\nrail split cites DL-099",
    },
  ];
  const failures = checkDecisionLogCitations(files, ledger);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /interaction-patterns\.md:2/);
  assert.match(failures[0], /DL-099/);
});

test("rejects duplicate ledger ids", () => {
  const ledger = [
    "| DL-007 | 2026-08-16 | a | b | codified | x |",
    "| DL-007 | 2026-08-28 | c | d | locked | — |",
  ].join("\n");
  const failures = checkDecisionLogCitations([], ledger);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /duplicate ledger id/);
  assert.match(failures[0], /DL-007/);
});

test("warns only on stale locked decision rows", () => {
  const ledger = [
    "| DL-009 | 2026-07-01 | old decision | why | locked | — |",
    "| DL-010 | 2026-07-01 | codified decision | why | codified | interaction-patterns.md |",
    "| DL-011 | 2026-08-27 | fresh decision | why | locked | — |",
  ].join("\n");
  const warnings = findStaleLockedDecisions(ledger, new Date("2026-08-28T00:00:00Z"), 30);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /DL-009 locked since 2026-07-01/);
});

test("rejects unknown CLI arguments", () => {
  const result = spawnSync(process.execPath, [script, "--unknown"], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown argument/);
});
