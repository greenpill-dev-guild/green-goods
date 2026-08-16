import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
const workflowsDir = join(root, ".github/workflows");

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function workflowSources() {
  return readdirSync(workflowsDir)
    .filter((file) => file.endsWith(".yml") && file !== "ci-gate.yml")
    .sort()
    .map((file) => [file, read(`.github/workflows/${file}`)]);
}

test("shared JS setup pins the toolchain and caches only Bun downloads", () => {
  const action = read(".github/actions/setup-js/action.yml");

  assert.match(action, /node-version:\s*["']22\.22\.1["']/);
  assert.match(action, /bun-version:\s*["']1\.3\.14["']/);
  assert.match(action, /uses:\s*actions\/setup-node@[0-9a-f]{40}/);
  assert.match(action, /uses:\s*oven-sh\/setup-bun@[0-9a-f]{40}/);
  assert.match(action, /uses:\s*actions\/cache@[0-9a-f]{40}/);
  assert.match(action, /~\/.bun\/install\/cache/);
  assert.match(action, /hashFiles\('bun\.lock'\)/);
  assert.match(action, /bun install --frozen-lockfile/);
  const cachedPaths = [...action.matchAll(/^\s*path:\s*(.+)$/gm)].map(
    (match) => match[1],
  );
  assert.deepEqual(cachedPaths, ["~/.bun/install/cache"]);
});

test("dependency-installing workflow jobs use shared JS setup", () => {
  for (const [file, source] of workflowSources()) {
    assert.doesNotMatch(
      source,
      /run:\s*bun install --frozen-lockfile/,
      `${file} must not duplicate dependency setup`,
    );
  }

  const expectedUsers = [
    "admin.yml",
    "agent.yml",
    "client.yml",
    "contracts-nightly.yml",
    "contracts.yml",
    "design.yml",
    "docs.yml",
    "indexer.yml",
    "shared.yml",
    "supply-chain-guardrails.yml",
  ];
  for (const file of expectedUsers) {
    const source = read(`.github/workflows/${file}`);
    assert.match(
      source,
      /uses:\s*\.\/\.github\/actions\/setup-js/,
      `${file} must use the shared setup action`,
    );
    if (!file.includes("nightly")) {
      assert.match(
        source,
        /\.github\/actions\/setup-js\/action\.yml/,
        `${file} must rerun when the shared action changes`,
      );
    }
  }
});

test("workflow parity is an early durable Supply Chain guard", () => {
  const source = read(".github/workflows/supply-chain-guardrails.yml");
  const callerIndex = source.indexOf("name: Run workflow performance parity tests");
  const formatIndex = source.indexOf("name: Check repository formatting");

  assert.ok(callerIndex >= 0 && callerIndex < formatIndex);
  assert.match(
    source.slice(callerIndex, callerIndex + 180),
    /node --test scripts\/quality\/workflow-performance-parity\.test\.mjs/,
  );
  assert.equal(source.match(/- "\.mise\.toml"/g)?.length, 2);
});

test("every direct Node and Bun setup uses the exact repository versions", () => {
  for (const [file, source] of workflowSources()) {
    for (const match of source.matchAll(/node-version:\s*["']?([^\s"']+)/g)) {
      assert.equal(match[1], "22.22.1", `${file} has a drifting Node pin`);
    }
    for (const match of source.matchAll(/bun-version:\s*["']?([^\s"']+)/g)) {
      assert.equal(match[1], "1.3.14", `${file} has a drifting Bun pin`);
    }
  }
});

test("raw Solidity source does not fan out to mocked consumer workflows", () => {
  for (const file of ["admin.yml", "client.yml", "indexer.yml"]) {
    const source = read(`.github/workflows/${file}`);
    assert.doesNotMatch(source, /packages\/contracts\/src\/\*\*/);
    assert.match(source, /packages\/contracts\/abis\/\*\*/);
    assert.match(source, /packages\/contracts\/deployments\/\*\*/);
  }
});

test("Shared outer routing matches the internal shared-impact detector", () => {
  const source = read(".github/workflows/shared.yml");
  const outer = source.slice(0, source.indexOf("permissions:"));

  for (const required of [
    "package.json",
    "bun.lock",
    "biome.json",
    ".env.schema",
    ".github/actions/setup-js/action.yml",
    ".github/workflows/shared.yml",
    "scripts/quality/check-source-structure.js",
    "packages/shared/**",
    "packages/contracts/abis/**",
    "packages/contracts/deployments/**",
  ]) {
    assert.equal(
      outer.match(new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))
        ?.length,
      2,
      `Shared push and pull_request routing must include ${required}`,
    );
  }

  for (const forbidden of [
    ".github/workflows/**",
    "scripts/**/*.ts",
    "packages/**/*.ts",
    "packages/**/package.json",
  ]) {
    assert.ok(!outer.includes(forbidden), `Shared outer routing is too broad: ${forbidden}`);
  }
  assert.match(source, /schedule:\s*\n\s*- cron:/);
  assert.match(source, /id:\s*filter/);
});

test("CI coverage drops HTML generation without weakening local reports or thresholds", () => {
  const configs = {
    "packages/admin/vitest.config.ts": [70, 70, 70, 70],
    "packages/agent/vitest.config.ts": [10, 20, 20, 20],
    "packages/client/vitest.config.ts": [75, 80, 80, 80],
    "packages/shared/vitest.config.ts": [70, 70, 70, 70],
  };

  for (const [file, thresholds] of Object.entries(configs)) {
    const source = read(file);
    assert.match(source, /process\.env\.CI/);
    assert.match(source, /\["text", "json"\]/);
    assert.match(source, /\["text", "json", "html"\]|\["text", "html", "json"\]/);
    const actualThresholds = [
      ...source.matchAll(
        /(?:branches|functions|lines|statements):\s*(\d+)(?:,|\n)/g,
      ),
    ].map((match) => Number(match[1]));
    assert.deepEqual(actualThresholds, thresholds, `${file} thresholds drifted`);
  }

  const c8 = JSON.parse(read("packages/indexer/.c8rc.json"));
  assert.deepEqual(c8.reporter, ["text", "json", "html"]);
  assert.deepEqual(
    [c8.branches, c8.functions, c8.lines, c8.statements],
    [50, 50, 50, 50],
  );
  assert.match(
    read("packages/indexer/package.json"),
    /"test:coverage:ci":\s*"c8 --reporter text --reporter json bun run mocha"/,
  );
  assert.match(
    read(".github/workflows/indexer.yml"),
    /run:\s*bun run test:coverage:ci/,
  );
});

test("contracts realism remains equivalent without unrelated tool setup", () => {
  const source = read(".github/workflows/contracts.yml");
  const realism = source.slice(
    source.indexOf("  realism-audit:"),
    source.indexOf("  fork-readiness-core:"),
  );

  assert.doesNotMatch(
    realism,
    /Install Foundry|setup-bun|bun install|submodules:\s*recursive/,
  );
  assert.match(realism, /node-version:\s*["']22\.22\.1["']/);
  assert.match(realism, /bash scripts\/contracts\/validate-test-realism-tooling\.sh/);
  assert.match(realism, /bash scripts\/contracts\/check-test-realism\.sh/);
});

test("repository formatting runs once, early in the broad guardrail", () => {
  for (const file of ["admin.yml", "agent.yml", "client.yml", "shared.yml"]) {
    assert.doesNotMatch(
      read(`.github/workflows/${file}`),
      /bun run format:check/,
      `${file} must not duplicate repository formatting`,
    );
  }

  const guardrails = read(".github/workflows/supply-chain-guardrails.yml");
  const formatIndex = guardrails.indexOf("name: Check repository formatting");
  const guidanceIndex = guardrails.indexOf("name: Check Codex guidance parity");
  assert.ok(formatIndex >= 0 && formatIndex < guidanceIndex);
  assert.match(
    guardrails.slice(formatIndex, formatIndex + 120),
    /bun run format:check/,
  );
});
