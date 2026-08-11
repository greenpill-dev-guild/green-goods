import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  addedLineNumbersFromDiff,
  findUntaggedFenceOpenings,
  parseNameStatus,
  scanDeletedSurfaceReferences,
} from "./check-guidance-links.mjs";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "check-guidance-links.mjs");

test("finds an untagged opening fence but accepts a tagged fence", () => {
  assert.deepEqual(findUntaggedFenceOpenings("```\ndiagram\n```", "guide.md"), [
    "guide.md:1: fenced code block is missing a language tag",
  ]);
  assert.deepEqual(findUntaggedFenceOpenings("```text\ndiagram\n```", "guide.md"), []);
});

test("checks only changed fence openings", () => {
  const text = ["```", "legacy", "```", "```", "changed", "```"].join("\n");
  assert.deepEqual(findUntaggedFenceOpenings(text, "guide.md", new Set([4])), [
    "guide.md:4: fenced code block is missing a language tag",
  ]);
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

test("allows explicit retirement notices", () => {
  const failures = scanDeletedSurfaceReferences(
    [{ path: "docs/guide.mdx", text: "The `/status` command was retired." }],
    [".claude/skills/status/SKILL.md"],
  );
  assert.deepEqual(failures, []);
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

test("rejects unknown CLI arguments", () => {
  const result = spawnSync(process.execPath, [script, "--unknown"], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown argument/);
});
