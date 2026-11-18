import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { load } from "js-yaml";

const root = resolve(import.meta.dirname, "../..");
const action = load(readFileSync(join(root, ".github/actions/setup-playwright/action.yml"), "utf8"));
const install = action.runs.steps.find((step) => step.name === "Install Playwright Chromium and system dependencies");
const stage = action.runs.steps.find((step) => step.name === "Stage system packages for the cache");
// GitHub runs `shell: bash` steps with these flags.
const GITHUB_BASH = ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c"];
// The ~21 MB package cache normally restores in seconds; @actions/cache bounds each 4 MB block itself.
const CACHE_RESTORE_ALLOWANCE_SECONDS = 60;
const AZURE_MIRROR = "http://azure.archive.ubuntu.com/ubuntu/";
const AWS_MIRROR = "http://us-east-2.ec2.archive.ubuntu.com/ubuntu/";

function runInstall(failures = 0, { mirror = AZURE_MIRROR, cachedPackages = [] } = {}) {
  const fixture = mkdtempSync(join(tmpdir(), "playwright setup-"));
  const bin = join(fixture, "bin");
  mkdirSync(bin);
  const cli = join(fixture, "pinned-cli.mjs");
  const log = join(fixture, "calls.jsonl");
  const mirrors = join(fixture, "apt-mirrors.txt");
  writeFileSync(mirrors, `${mirror}\tpriority:1\nhttp://security.ubuntu.com/ubuntu/\tpriority:2\n`);
  const packageCache = join(fixture, "package-cache");
  const archives = join(fixture, "archives");
  mkdirSync(packageCache);
  mkdirSync(archives);
  for (const name of cachedPackages) writeFileSync(join(packageCache, name), name);
  writeFileSync(cli, `
import {appendFileSync,existsSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
const command=process.argv[2];
const state=process.env.TEST_ATTEMPT_FILE;
const attempt=command==='install-deps'?(existsSync(state)?Number(readFileSync(state,'utf8')):0)+1:1;
if(command==='install-deps')writeFileSync(state,String(attempt));
appendFileSync(process.env.TEST_CALL_LOG,JSON.stringify({command,attempt,privileged:process.env.TEST_PRIVILEGED==='1',timeoutOwner:process.env.TEST_TIMEOUT_OWNER,argv:process.argv.slice(2),mirrors:readFileSync(process.env.TEST_MIRRORS,'utf8'),archives:readdirSync(process.env.APT_ARCHIVES).sort()})+'\\n');
if(command==='install-deps'&&process.env.TEST_TIMEOUT_OWNER!=='root')process.exit(77);
process.exit(command==='install-deps'&&attempt<=Number(process.env.TEST_DEP_FAILURES)?124:0);
`);
  const scripts = {
    node: '#!/bin/sh\nif [ "$1" = "-p" ]; then printf "%s\\n" "$TEST_PINNED_CLI"; else exec "$TEST_REAL_NODE" "$@"; fi\n',
    sudo: '#!/bin/sh\nexport TEST_PRIVILEGED=1\nif [ "$1" = sed ] && [ "$2" = -i ]; then\n  sed "$3" "$4" "$5" > "$5.tmp" && mv "$5.tmp" "$5"\nelse\n  exec "$@"\nfi\n',
    timeout: '#!/bin/sh\nprintf "%s\\n" "${TEST_PRIVILEGED:-0}:$1:$2" >> "$TEST_BUDGET_LOG"\nif [ "${TEST_PRIVILEGED:-0}" = 1 ]; then export TEST_TIMEOUT_OWNER=root; else export TEST_TIMEOUT_OWNER=user; fi\nshift 2\nexec "$@"\n',
    bunx: '#!/bin/sh\nshift\nexec "$TEST_REAL_NODE" "$TEST_PINNED_CLI" "$@"\n',
    dpkg: '#!/bin/sh\nprintf \'{"command":"dpkg","privileged":%s,"argv":"%s"}\\n\' "$([ "${TEST_PRIVILEGED:-0}" = 1 ] && echo true || echo false)" "$*" >> "$TEST_CALL_LOG"\n',
  };
  for (const [name, source] of Object.entries(scripts)) {
    writeFileSync(join(bin, name), source);
    chmodSync(join(bin, name), 0o755);
  }
  try {
    const result = spawnSync("bash", [...GITHUB_BASH, install.run.replace("/etc/apt/apt-mirrors.txt", '"$TEST_MIRRORS"')], {
      cwd: fixture,
      encoding: "utf8",
      env: {
        ...process.env, ...Object.fromEntries(Object.entries(install.env).map(([k,v]) => [k,String(v)])),
        PATH: `${bin}:${process.env.PATH}`, RETRY_BACKOFF: "0",
        TEST_PINNED_CLI: cli, TEST_REAL_NODE: process.execPath,
        TEST_MIRRORS: mirrors, PACKAGE_CACHE: packageCache, APT_ARCHIVES: archives,
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
  assert.equal(result.calls[1].mirrors, result.calls[0].mirrors);
});

test("a timed-out dependency attempt repairs dpkg and leaves either cloud's regional mirror within the same privilege boundary", () => {
  for (const mirror of [AZURE_MIRROR, AWS_MIRROR]) {
    const result = runInstall(1, { mirror });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.calls.map(c => c.command), ["install-deps", "dpkg", "install-deps", "install"]);
    assert.ok([0, 2].every(i => result.calls[i].privileged && result.calls[i].timeoutOwner === "root"));
    assert.ok(result.calls[0].mirrors.startsWith(mirror));
    assert.equal(result.calls[2].mirrors, "https://archive.ubuntu.com/ubuntu/\tpriority:1\nhttp://security.ubuntu.com/ubuntu/\tpriority:2\n");
    assert.deepEqual(result.calls[1], { command: "dpkg", privileged: true, argv: "--configure -a" });
    assert.ok(result.budgets.includes(`1:--kill-after=${install.env.REPAIR_KILL_GRACE}:${install.env.REPAIR_TIMEOUT}`));
    assert.match(result.stdout, /attempt 1 failed or timed out/);
    assert.ok(result.stdout.includes(`instead of ${mirror.replace(/\/ubuntu\/$/, "")}`));
  }
});

test("cached packages reach apt's archive before the first dependency attempt", () => {
  const result = runInstall(0, { cachedPackages: ["fonts-unifont.deb", "xfonts-utils.deb"] });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.calls[0].archives, ["fonts-unifont.deb", "xfonts-utils.deb"]);
  assert.match(result.stdout, /Seeded apt with 2 cached packages/);
  assert.deepEqual(runInstall().calls[0].archives, []);
});

test("exhausted dependency setup stops before browser download with infrastructure guidance", () => {
  const result = runInstall(2);
  assert.equal(result.status, 1);
  assert.deepEqual(result.calls.map(c => c.command), ["install-deps", "dpkg", "install-deps"]);
  assert.match(result.stdout, /Playwright environment setup/);
  assert.match(result.stdout, /2 bounded attempts; browser tests have not started/);
});

test("timeout and retry budgets remain inside every caller's action deadline", () => {
  const seconds = value => Number(String(value).replace(/s$/, ""));
  const attempts = Number(install.env.MAX_ATTEMPTS);
  const repairBound = (attempts - 1) * (seconds(install.env.REPAIR_TIMEOUT) + seconds(install.env.REPAIR_KILL_GRACE));
  const worstCase = CACHE_RESTORE_ALLOWANCE_SECONDS + repairBound + 2 * (attempts * (seconds(install.env.ATTEMPT_TIMEOUT) + seconds(install.env.KILL_GRACE)) + (attempts - 1) * seconds(install.env.RETRY_BACKOFF));
  let callers = 0;
  for (const file of ["design.yml", "admin.yml", "client.yml"]) {
    const workflow = load(readFileSync(join(root, ".github/workflows", file), "utf8"));
    for (const job of Object.values(workflow.jobs)) {
      for (const step of job.steps ?? []) {
        if (step.uses !== "./.github/actions/setup-playwright") continue;
        callers++;
        assert.ok(worstCase < step["timeout-minutes"] * 60, `${file} installer budget exceeds caller deadline`);
      }
    }
  }
  assert.equal(callers, 3);
});

test("the package cache keeps only installed versions and is skipped when there are none", () => {
  const fixture = mkdtempSync(join(tmpdir(), "playwright stage-"));
  try {
    const bin = join(fixture, "bin");
    const archives = join(fixture, "archives");
    const packageCache = join(fixture, "package-cache");
    mkdirSync(bin);
    mkdirSync(archives);
    mkdirSync(packageCache);
    writeFileSync(join(packageCache, "restored-from-older-key.deb"), "");
    const installed = "fonts-unifont\t1:15.1.01-1build1\tall\nxfonts-utils\t1:7.7+6build3\tamd64\n";
    writeFileSync(join(bin, "dpkg-query"), `#!/bin/sh\nprintf '${installed}' | awk -F'\\t' '{print $1"_"$2"_"$3".deb"}'\n`);
    chmodSync(join(bin, "dpkg-query"), 0o755);
    const stageWith = (debs) => {
      for (const name of readdirSync(archives)) rmSync(join(archives, name));
      for (const name of debs) writeFileSync(join(archives, name), name);
      return spawnSync("bash", [...GITHUB_BASH, stage.run], {
        cwd: fixture, encoding: "utf8",
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, PACKAGE_CACHE: packageCache, APT_ARCHIVES: archives },
      });
    };
    const staged = stageWith(["fonts-unifont_1%3a15.1.01-1build1_all.deb", "fonts-unifont_1%3a15.0.0-1_all.deb", "xfonts-utils_1%3a7.7+6build3_amd64.deb"]);
    assert.equal(staged.status, 0, staged.stderr);
    assert.deepEqual(readdirSync(packageCache).sort(), ["fonts-unifont_1%3a15.1.01-1build1_all.deb", "xfonts-utils_1%3a7.7+6build3_amd64.deb"]);
    const empty = stageWith(["fonts-unifont_1%3a15.0.0-1_all.deb"]);
    assert.equal(empty.status, 0, empty.stderr);
    assert.throws(() => readdirSync(packageCache), /ENOENT/);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
  assert.equal(stage["continue-on-error"], true);
});

test("Storybook produces and retains its own PWA audit even when a check fails", () => {
  const workflow = load(readFileSync(join(root, ".github/workflows/design.yml"), "utf8"));
  const steps = workflow.jobs.storybook.steps;
  const generation = steps.findIndex(step => step.run === "node scripts/design/md-generate.mjs --check");
  const probe = steps.findIndex(step => step.id === "pwa_audit_file");
  const upload = steps.findIndex(step => step.with?.name === "client-pwa-token-audit");
  const tokenCheck = steps.findIndex(step => step.run === "bun run check --only design-tokens");
  assert.ok(generation >= 0 && probe > generation && upload > probe && tokenCheck > upload);
  assert.match(steps[probe].if, /always\(\)/);
  assert.match(steps[probe].if, /!cancelled\(\)/);
  assert.match(steps[upload].if, /always\(\)/);
  assert.match(steps[upload].if, /!cancelled\(\)/);
  assert.match(steps[upload].if, /steps\.pwa_audit_file\.outputs\.present == 'true'/);
  assert.equal(steps[upload].with.path, "output/design/client-pwa-token-audit.md");
  assert.equal(steps[upload].with["if-no-files-found"], "error");
  assert.equal(steps.find(step => step.with?.name === "storybook-static").with.path, "packages/shared/storybook-static");
  const fixture = mkdtempSync(join(tmpdir(), "pwa-audit-probe-"));
  try {
    for (const present of [false, true]) {
      if (present) {
        mkdirSync(join(fixture, "output/design"), { recursive: true });
        writeFileSync(join(fixture, "output/design/client-pwa-token-audit.md"), "audit");
      }
      const output = join(fixture, String(present));
      writeFileSync(output, "");
      const result = spawnSync("bash", ["-e", "-c", steps[probe].run], {
        cwd: fixture, encoding: "utf8", env: { ...process.env, GITHUB_OUTPUT: output },
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(readFileSync(output, "utf8"), present ? "present=true\n" : "");
    }
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});
