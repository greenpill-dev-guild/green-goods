import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { claudeCompatibilityFailures, extractDocumentedCommands, findNearDuplicatePolicyBlocks } from "./check-codex-docs.js";

test("detects a near-verbatim policy copied between agent guides", () => {
  const rootGuide = `
## Validation

Before validation, render the repository-owned plan. Execute the selected checks instead of
inventing a broader command set. A missing selector never authorizes omitting a required critical
override, and an unavailable environment capability must remain blocked rather than passing.
`;
  const claudeGuide = `
## Validation routing

Before validation render the repository owned plan, then execute its selected checks rather than
inventing a broader command set. A missing selector never authorizes omission of a required critical
override. An unavailable environment capability remains blocked, never passing.
`;

  const duplicates = findNearDuplicatePolicyBlocks(rootGuide, claudeGuide);

  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].leftLine, 4);
  assert.equal(duplicates[0].rightLine, 4);
  assert.ok(duplicates[0].similarity >= 0.8);
});

test("ignores short shared labels and genuinely different guidance", () => {
  const rootGuide = `
## Validation

Use Bun wrappers.

Run targeted behavior tests while editing. Escalate only when a shared public contract changes.
`;
  const claudeGuide = `
## Commands

Use Bun wrappers.

Claude may dispatch Codex through the checked-in resolver when a plan explicitly assigns a Codex lane.
`;

  assert.deepEqual(findNearDuplicatePolicyBlocks(rootGuide, claudeGuide), []);
});

test("reports each duplicated policy block once", () => {
  const sharedPolicy = `
Every passing receipt is reusable only while its source inputs, command, policy, toolchain,
environment profile, and validated paths still match. Never reuse a failure, and stop dependent
work after the first deterministic failure unless the rendered plan marks checks independent.
`;

  const duplicates = findNearDuplicatePolicyBlocks(sharedPolicy, sharedPolicy);

  assert.equal(duplicates.length, 1);
});

test("supports native AGENTS-only discovery and explicit Claude compatibility imports", () => {
  assert.deepEqual(claudeCompatibilityFailures("# Shared rules", undefined), []);
  assert.deepEqual(claudeCompatibilityFailures("# Shared rules", "@AGENTS.md\n"), []);
  assert.equal(claudeCompatibilityFailures("# Shared rules", "Read [AGENTS.md](AGENTS.md).").length, 1);
});

test("extracts task-table commands including the final section without treating prose as commands", () => {
  const guide = `## Common Commands
| When | Command |
|---|---|
| Check | \`bun run check --plan -- --intent diagnose\` |
| Build | \`VITE_CHAIN_ID=11155111 bun run build\` |
| Context | \`a surface\` |
`;
  assert.deepEqual(extractDocumentedCommands(guide, "Common Commands"), [
    "bun run check --plan -- --intent diagnose",
    "VITE_CHAIN_ID=11155111 bun run build",
  ]);
  assert.deepEqual(extractDocumentedCommands(guide + "\n## Next\n`bun run other`", "Common Commands"),
    extractDocumentedCommands(guide, "Common Commands"));
});

function qaExtractionFixture(t, { exitCode = 0, missingSchema = false } = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), "gg-qa-dispatch-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const run = path.join(directory, "tmp/qa-triage/build-sync");
  const bin = path.join(directory, "bin");
  const scratchRoot = path.join(directory, "scratch");
  for (const folder of [run, bin, scratchRoot, path.join(directory, ".claude/scripts")]) mkdirSync(folder, { recursive: true });
  writeFileSync(path.join(directory, "source.md"), "The admin queue stays Pending after approval.\n");
  symlinkSync(path.join(directory, "source.md"), path.join(run, "notes.md"));
  if (!missingSchema) writeFileSync(path.join(run, "schema.json"), '{"type":"object"}\n');
  writeFileSync(path.join(run, "codex-prompt.md"), "Read qa-notes.md and extract the reported issues.");
  writeFileSync(path.join(directory, ".env"), "PRIVATE_SERVICE_TOKEN=fixture-only\n");
  const codex = path.join(bin, "codex");
  writeFileSync(codex, `#!${process.execPath}
import fs from "node:fs";
const args = process.argv.slice(2);
fs.writeFileSync(${JSON.stringify(path.join(directory, "invocation.json"))}, JSON.stringify({args, environment: process.env}));
if (${exitCode}) process.exit(${exitCode});
fs.writeFileSync(args[args.indexOf("-o") + 1], '{"items":[]}');
`);
  chmodSync(codex, 0o755);
  const git = path.join(bin, "git");
  writeFileSync(git, `#!/bin/sh\nprintf 'called' >> '${path.join(directory, "git-called")}'\nexit 93\n`);
  chmodSync(git, 0o755);
  const resolver = path.join(directory, ".claude/scripts/resolve-codex-binary.sh");
  writeFileSync(resolver, '#!/bin/sh\nprintf "%s\\n" "$CODEX"\n');
  chmodSync(resolver, 0o755);
  const reference = readFileSync(new URL("../../.claude/skills/qa-triage/codex-prompt.md", import.meta.url), "utf8");
  const recipe = reference.match(/```bash\n([\s\S]*?)\n```/)[1].replaceAll("<slug>", "build-sync");
  const execute = () => spawnSync("/bin/bash", ["-c", `set -euo pipefail\n${recipe}`], {
    cwd: directory,
    env: { ...process.env, CODEX: codex, CODEX_HOME: path.join(directory, "codex-home"), PATH: `${bin}:${process.env.PATH}`, TMPDIR: scratchRoot, PRIVATE_SERVICE_TOKEN: "fixture-only" },
    encoding: "utf8",
  });
  return { directory, run, execute };
}

test("QA extraction recipe isolates copied inputs and excludes parent credentials without Git operations", (t) => {
  const fixture = qaExtractionFixture(t);
  const result = fixture.execute();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(path.join(fixture.directory, "git-called")), false);
  const { args, environment } = JSON.parse(readFileSync(path.join(fixture.directory, "invocation.json"), "utf8"));
  assert.equal(args[args.indexOf("-s") + 1], "read-only");
  assert.ok(args.includes("--skip-git-repo-check"));
  assert.ok(args.includes("--ephemeral"));
  assert.equal(environment.PRIVATE_SERVICE_TOKEN, undefined);
  assert.equal(environment.CODEX_HOME, path.join(fixture.directory, "codex-home"));
  const scratch = args[args.indexOf("-C") + 1];
  assert.notEqual(scratch, fixture.directory);
  assert.deepEqual(readdirSync(scratch).sort(), ["qa-notes.md", "qa-prompt.md", "schema.json"]);
  assert.equal(lstatSync(path.join(scratch, "qa-notes.md")).isSymbolicLink(), false);
  assert.match(readFileSync(path.join(scratch, "qa-notes.md"), "utf8"), /Pending after approval/);
  assert.equal(readFileSync(path.join(fixture.run, "codex-scratch-path.txt"), "utf8").trim(), scratch);
  assert.deepEqual(JSON.parse(readFileSync(path.join(fixture.run, "codex-result.md"), "utf8")), { items: [] });
});

test("QA extraction gives repeated runs separate scratch directories", (t) => {
  const fixture = qaExtractionFixture(t);
  assert.equal(fixture.execute().status, 0);
  const first = readFileSync(path.join(fixture.run, "codex-scratch-path.txt"), "utf8").trim();
  assert.equal(fixture.execute().status, 0);
  const second = readFileSync(path.join(fixture.run, "codex-scratch-path.txt"), "utf8").trim();
  assert.notEqual(first, second);
  assert.ok(existsSync(path.join(first, "qa-notes.md")));
  assert.ok(existsSync(path.join(second, "qa-notes.md")));
});

test("QA extraction preserves scratch evidence when its child fails", (t) => {
  const fixture = qaExtractionFixture(t, { exitCode: 42 });
  assert.equal(fixture.execute().status, 42);
  const scratch = readFileSync(path.join(fixture.run, "codex-scratch-path.txt"), "utf8").trim();
  assert.ok(existsSync(path.join(scratch, "qa-notes.md")));
  assert.equal(existsSync(path.join(fixture.run, "codex-result.md")), false);
  assert.equal(existsSync(path.join(fixture.directory, "git-called")), false);
});

test("QA extraction stops before dispatch when a required input cannot be copied", (t) => {
  const fixture = qaExtractionFixture(t, { missingSchema: true });
  const result = fixture.execute();
  assert.notEqual(result.status, 0);
  assert.equal(existsSync(path.join(fixture.directory, "invocation.json")), false);
  assert.equal(existsSync(path.join(fixture.directory, "git-called")), false);
});
