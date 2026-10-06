import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { load } from "js-yaml";

const root = resolve(import.meta.dirname, "../..");
const action = load(readFileSync(join(root, ".github/actions/setup-playwright/action.yml"), "utf8"));
const install = action.runs.steps.find((step) => step.name === "Install Playwright Chromium and system dependencies");

function runInstall(failures = 0) {
  const fixture = mkdtempSync(join(tmpdir(), "playwright setup-"));
  const bin = join(fixture, "bin");
  mkdirSync(bin);
  const cli = join(fixture, "pinned-cli.mjs");
  const log = join(fixture, "calls.jsonl");
  writeFileSync(cli, `
import {appendFileSync,existsSync,readFileSync,writeFileSync} from 'node:fs';
const command=process.argv[2];
const state=process.env.TEST_ATTEMPT_FILE;
const attempt=command==='install-deps'?(existsSync(state)?Number(readFileSync(state,'utf8')):0)+1:1;
if(command==='install-deps')writeFileSync(state,String(attempt));
appendFileSync(process.env.TEST_CALL_LOG,JSON.stringify({command,attempt,privileged:process.env.TEST_PRIVILEGED==='1',timeoutOwner:process.env.TEST_TIMEOUT_OWNER,argv:process.argv.slice(2)})+'\\n');
if(command==='install-deps'&&process.env.TEST_TIMEOUT_OWNER!=='root')process.exit(77);
process.exit(command==='install-deps'&&attempt<=Number(process.env.TEST_DEP_FAILURES)?124:0);
`);
  const scripts = {
    node: '#!/bin/sh\nif [ "$1" = "-p" ]; then printf "%s\\n" "$TEST_PINNED_CLI"; else exec "$TEST_REAL_NODE" "$@"; fi\n',
    sudo: '#!/bin/sh\nexport TEST_PRIVILEGED=1\nexec "$@"\n',
    timeout: '#!/bin/sh\nprintf "%s\\n" "${TEST_PRIVILEGED:-0}:$1:$2" >> "$TEST_BUDGET_LOG"\nif [ "${TEST_PRIVILEGED:-0}" = 1 ]; then export TEST_TIMEOUT_OWNER=root; else export TEST_TIMEOUT_OWNER=user; fi\nshift 2\nexec "$@"\n',
    bunx: '#!/bin/sh\nshift\nexec "$TEST_REAL_NODE" "$TEST_PINNED_CLI" "$@"\n',
  };
  for (const [name, source] of Object.entries(scripts)) {
    writeFileSync(join(bin, name), source);
    chmodSync(join(bin, name), 0o755);
  }
  try {
    const result = spawnSync("bash", ["-e", "-c", install.run], {
      cwd: fixture,
      encoding: "utf8",
      env: {
        ...process.env, ...Object.fromEntries(Object.entries(install.env).map(([k,v]) => [k,String(v)])),
        PATH: `${bin}:${process.env.PATH}`, RETRY_BACKOFF: "0",
        TEST_PINNED_CLI: cli, TEST_REAL_NODE: process.execPath,
        TEST_ATTEMPT_FILE: join(fixture, "attempt"), TEST_CALL_LOG: log,
        TEST_BUDGET_LOG: join(fixture, "budgets"), TEST_DEP_FAILURES: String(failures),
      },
    });
    return { ...result, calls: readFileSync(log, "utf8").trim().split("\n").map(JSON.parse),
      budgets: readFileSync(join(fixture, "budgets"), "utf8").trim().split("\n") };
  } finally { rmSync(fixture, { recursive: true, force: true }); }
}

test("system dependency timeout owns privilege; browser download stays unprivileged", () => {
  const result = runInstall();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.calls.map(c => [c.command, c.privileged, c.timeoutOwner]), [
    ["install-deps", true, "root"], ["install", false, "user"],
  ]);
  assert.deepEqual(result.budgets, ["1:--kill-after=30s:150s", "0:--kill-after=30s:150s"]);
  assert.deepEqual(result.calls.map(c => c.argv), [["install-deps", "chromium"], ["install", "chromium"]]);
});

test("a timed-out dependency attempt retries within the same privilege boundary", () => {
  const result = runInstall(1);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.calls.map(c => c.command), ["install-deps", "install-deps", "install"]);
  assert.ok(result.calls.slice(0, 2).every(c => c.privileged && c.timeoutOwner === "root"));
  assert.match(result.stdout, /attempt 1 failed or timed out/);
});

test("exhausted dependency setup stops before browser download with infrastructure guidance", () => {
  const result = runInstall(2);
  assert.equal(result.status, 1);
  assert.deepEqual(result.calls.map(c => c.command), ["install-deps", "install-deps"]);
  assert.match(result.stdout, /Playwright environment setup/);
  assert.match(result.stdout, /2 bounded attempts; browser tests have not started/);
});

test("timeout and retry budgets remain inside every caller's action deadline", () => {
  const seconds = value => Number(String(value).replace(/s$/, ""));
  const attempts = Number(install.env.MAX_ATTEMPTS);
  const worstCase = 2 * (attempts * (seconds(install.env.ATTEMPT_TIMEOUT) + seconds(install.env.KILL_GRACE)) + (attempts - 1) * seconds(install.env.RETRY_BACKOFF));
  for (const file of ["design.yml", "admin.yml", "client.yml"]) {
    const workflow = load(readFileSync(join(root, ".github/workflows", file), "utf8"));
    for (const job of Object.values(workflow.jobs)) {
      for (const step of job.steps ?? []) {
        if (step.uses !== "./.github/actions/setup-playwright") continue;
        assert.ok(worstCase < step["timeout-minutes"] * 60, `${file} installer budget exceeds caller deadline`);
      }
    }
  }
});

test("Storybook produces and retains its own PWA audit even when a check fails", () => {
  const workflow = load(readFileSync(join(root, ".github/workflows/design.yml"), "utf8"));
  const steps = workflow.jobs.storybook.steps;
  const generation = steps.findIndex(step => step.run === "node scripts/design/md-generate.mjs --check");
  const upload = steps.findIndex(step => step.with?.name === "client-pwa-token-audit");
  const tokenCheck = steps.findIndex(step => step.run === "bun run check --only design-tokens");
  assert.ok(generation >= 0 && upload > generation && tokenCheck > upload);
  assert.match(steps[upload].if, /always\(\)/);
  assert.match(steps[upload].if, /!cancelled\(\)/);
  assert.match(steps[upload].if, /hashFiles\('output\/design\/client-pwa-token-audit.md'\)/);
  assert.equal(steps[upload].with.path, "output/design/client-pwa-token-audit.md");
  assert.equal(steps[upload].with["if-no-files-found"], "error");
  assert.equal(steps.find(step => step.with?.name === "storybook-static").with.path, "packages/shared/storybook-static");
});
