import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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
  const directory = mkdtempSync(path.join(tmpdir(), "gg qa-dispatch-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const run = path.join(directory, "tmp/qa-triage/build-sync");
  const bin = path.join(directory, "bin");
  const scratchRoot = path.join(directory, "scratch");
  for (const folder of [run, bin, scratchRoot, path.join(directory, ".claude/scripts")]) mkdirSync(folder, { recursive: true });
  writeFileSync(path.join(directory, "source.md"), "The admin queue stays Pending after approval.\n");
  symlinkSync(path.join(directory, "source.md"), path.join(run, "notes.md"));
  if (!missingSchema) writeFileSync(path.join(run, "schema.json"), '{"type":"object"}\n');
  const reference = readFileSync(new URL("../../.claude/skills/qa-triage/codex-prompt.md", import.meta.url), "utf8");
  const prompt = reference.match(/```markdown\n([\s\S]*?)\n```/)[1]
    .replaceAll("{notes_path}", "qa-notes.md")
    .replaceAll("{meeting_title}", "Build Sync")
    .replaceAll("{meeting_date}", "2026-10-24");
  writeFileSync(path.join(run, "codex-prompt.md"), prompt);
  writeFileSync(path.join(directory, ".env"), "PRIVATE_SERVICE_TOKEN=fixture-only\n");
  const output = { items: [{ one_line: "First extraction" }] };
  const outcomePath = path.join(directory, "child-outcome.json");
  const setOutcome = (outcome) => writeFileSync(outcomePath, JSON.stringify(outcome));
  setOutcome({ exitCode });
  const codex = path.join(bin, "codex");
  writeFileSync(codex, `#!${process.execPath}
import fs from "node:fs";
const args = process.argv.slice(2);
const outcome = JSON.parse(fs.readFileSync(${JSON.stringify(outcomePath)}, "utf8"));
const inputs = fs.readdirSync(args[args.indexOf("-C") + 1]).sort();
fs.writeFileSync(${JSON.stringify(path.join(directory, "invocation.json"))}, JSON.stringify({args, environment: process.env, inputs}));
if (!outcome.exitCode || outcome.partial) fs.writeFileSync(args[args.indexOf("-o") + 1], ${JSON.stringify(JSON.stringify(output))});
if (outcome.exitCode) process.exit(outcome.exitCode);
`);
  chmodSync(codex, 0o755);
  const git = path.join(bin, "git");
  writeFileSync(git, `#!/bin/sh\nprintf 'called' >> '${path.join(directory, "git-called")}'\nexit 93\n`);
  chmodSync(git, 0o755);
  const resolver = path.join(directory, ".claude/scripts/resolve-codex-binary.sh");
  writeFileSync(resolver, '#!/bin/sh\nprintf "%s\\n" "$CODEX"\n');
  chmodSync(resolver, 0o755);
  const recipes = [...reference.matchAll(/```bash\n([\s\S]*?)\n```/g)].map((match) => match[1].replaceAll("<slug>", "build-sync"));
  const executeRecipe = (recipe) => spawnSync("/bin/bash", ["-c", `set -euo pipefail\n${recipe}`], {
    cwd: directory,
    env: { ...process.env, CODEX: codex, CODEX_HOME: path.join(directory, "codex-home"), PATH: `${bin}:${process.env.PATH}`, TMPDIR: scratchRoot, PRIVATE_SERVICE_TOKEN: "fixture-only" },
    encoding: "utf8",
  });
  const execute = () => executeRecipe(recipes[0]);
  const executeManual = () => {
    assert.ok(recipes[1], "manual fallback must have an executable preparation recipe");
    return executeRecipe(recipes[1]);
  };
  return { directory, run, execute, executeManual, setOutcome, output };
}

test("QA extraction recipe isolates copied inputs and excludes parent credentials without Git operations", (t) => {
  const fixture = qaExtractionFixture(t);
  const result = fixture.execute();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(path.join(fixture.directory, "git-called")), false);
  const { args, environment, inputs } = JSON.parse(readFileSync(path.join(fixture.directory, "invocation.json"), "utf8"));
  assert.equal(args[args.indexOf("-s") + 1], "read-only");
  assert.ok(args.includes("--skip-git-repo-check"));
  assert.ok(args.includes("--ephemeral"));
  assert.equal(environment.PRIVATE_SERVICE_TOKEN, undefined);
  assert.equal(environment.CODEX_HOME, path.join(fixture.directory, "codex-home"));
  const scratch = args[args.indexOf("-C") + 1];
  assert.notEqual(scratch, fixture.directory);
  assert.deepEqual(inputs, ["qa-notes.md", "qa-prompt.md", "schema.json"]);
  assert.equal(lstatSync(path.join(scratch, "qa-notes.md")).isSymbolicLink(), false);
  assert.match(readFileSync(path.join(scratch, "qa-notes.md"), "utf8"), /Pending after approval/);
  assert.equal(readFileSync(path.join(fixture.run, "codex-scratch-path.txt"), "utf8").trim(), scratch);
  assert.equal(readFileSync(path.join(fixture.run, "codex-success-path.txt"), "utf8").trim(), scratch);
  assert.deepEqual(JSON.parse(readFileSync(path.join(fixture.run, "codex-result.md"), "utf8")), fixture.output);
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

test("failed QA redispatch withdraws the prior result and preserves its attempt evidence", (t) => {
  for (const failure of ["child", "resolver", "input"]) {
    const fixture = qaExtractionFixture(t);
    assert.equal(fixture.execute().status, 0);
    const first = readFileSync(path.join(fixture.run, "codex-scratch-path.txt"), "utf8").trim();
    const original = readFileSync(path.join(fixture.run, "codex-result.md"), "utf8");
    if (failure === "child") fixture.setOutcome({ exitCode: 42 });
    if (failure === "resolver") writeFileSync(path.join(fixture.directory, ".claude/scripts/resolve-codex-binary.sh"), "#!/bin/sh\nexit 7\n");
    if (failure === "input") rmSync(path.join(fixture.run, "schema.json"));
    assert.notEqual(fixture.execute().status, 0, failure);
    const second = readFileSync(path.join(fixture.run, "codex-scratch-path.txt"), "utf8").trim();
    assert.notEqual(first, second);
    assert.equal(existsSync(path.join(fixture.run, "codex-result.md")), false, failure);
    assert.equal(existsSync(path.join(fixture.run, "codex-success-path.txt")), false, failure);
    assert.equal(readFileSync(path.join(second, "previous-result.md"), "utf8"), original);
    assert.equal(readFileSync(path.join(second, "previous-scratch-path.txt"), "utf8").trim(), first);
    assert.equal(existsSync(path.join(second, "completed")), false);
  }
});

test("scratch allocation failure withdraws the prior success without destroying its evidence", (t) => {
  const fixture = qaExtractionFixture(t);
  assert.equal(fixture.execute().status, 0);
  const original = readFileSync(path.join(fixture.run, "codex-result.md"), "utf8");
  const mktemp = path.join(fixture.directory, "bin/mktemp");
  writeFileSync(mktemp, "#!/bin/sh\nexit 8\n");
  chmodSync(mktemp, 0o755);
  assert.equal(fixture.execute().status, 8);
  assert.equal(existsSync(path.join(fixture.run, "codex-success-path.txt")), false);
  assert.equal(readFileSync(path.join(fixture.run, "codex-result.md"), "utf8"), original);
});

test("a failing QA child cannot publish even a parseable partial result", (t) => {
  const fixture = qaExtractionFixture(t);
  fixture.setOutcome({ exitCode: 42, partial: true });
  assert.equal(fixture.execute().status, 42);
  const scratch = readFileSync(path.join(fixture.run, "codex-scratch-path.txt"), "utf8").trim();
  assert.equal(existsSync(path.join(fixture.run, "codex-result.md")), false);
  assert.equal(existsSync(path.join(fixture.run, "codex-success-path.txt")), false);
  assert.ok(existsSync(path.join(scratch, "codex-result.md")));
  assert.equal(existsSync(path.join(scratch, "completed")), false);
  fixture.setOutcome({ exitCode: 0 });
  assert.equal(fixture.execute().status, 0);
  const recovered = readFileSync(path.join(fixture.run, "codex-scratch-path.txt"), "utf8").trim();
  assert.ok(existsSync(path.join(recovered, "completed")));
  assert.deepEqual(JSON.parse(readFileSync(path.join(fixture.run, "codex-result.md"), "utf8")), fixture.output);
});

test("manual QA fallback resolves notes and schema from an unrelated working directory", (t) => {
  const fixture = qaExtractionFixture(t);
  const result = fixture.executeManual();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(path.join(fixture.directory, "invocation.json")), false);
  const manual = readFileSync(path.join(fixture.run, "manual-prompt.md"), "utf8");
  const notes = manual.match(/^Read the notes at: (.+)$/m)[1];
  const schema = manual.match(/fill the JSON schema at `([^`]+)`/)[1];
  assert.ok(path.isAbsolute(notes));
  assert.ok(path.isAbsolute(schema));
  assert.match(readFileSync(path.resolve(fixture.directory, "elsewhere", notes), "utf8"), /Pending after approval/);
  assert.deepEqual(JSON.parse(readFileSync(path.resolve(fixture.directory, "elsewhere", schema), "utf8")), { type: "object" });
  assert.equal(manual.includes("qa-notes.md"), false);
});

test("manual QA fallback stops instead of emitting a prompt with a missing input", (t) => {
  for (const missingSchema of [true, false]) {
    const fixture = qaExtractionFixture(t, { missingSchema });
    if (!missingSchema) {
      assert.equal(fixture.executeManual().status, 0);
      rmSync(path.join(fixture.run, "schema.json"));
    }
    assert.notEqual(fixture.executeManual().status, 0);
    assert.equal(existsSync(path.join(fixture.run, "manual-prompt.md")), false);
    assert.equal(existsSync(path.join(fixture.directory, "invocation.json")), false);
  }
});
