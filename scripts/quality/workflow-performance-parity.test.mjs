import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { resolvePackageCommand } from "../dev/package-commands.mjs";

import { classifySupplyChainChanges } from "./classify-supply-chain-changes.mjs";
import {
  addedQuerySetupFromDiff,
  hasQuerySetupAllowance,
  newQuerySetupFromSource,
} from "./check-test-query-setup.mjs";

const root = resolve(import.meta.dirname, "../..");
const workflowsDir = join(root, ".github/workflows");

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function workflowEventBlock(source, event) {
  const marker = `  ${event}:\n`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `missing ${event} workflow trigger`);
  const remainder = source.slice(start + marker.length);
  const nextSection = remainder.search(/^(?:  [a-z_]+|permissions):\n/m);
  return nextSection < 0 ? remainder : remainder.slice(0, nextSection);
}

function workflowSources() {
  return readdirSync(workflowsDir)
    .filter((file) => file.endsWith(".yml") && file !== "ci-gate.yml")
    .sort()
    .map((file) => [file, read(`.github/workflows/${file}`)]);
}

function sourceFiles(relativeDirectory) {
  const directory = join(root, relativeDirectory);
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = join(relativeDirectory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(relativePath)
      : /\.(?:ts|tsx)$/.test(entry.name)
        ? [relativePath]
        : [];
  });
}

function coverageGlobFloors(packageName) {
  const source = read(`packages/${packageName}/vitest.config.ts`);
  const entries = [...source.matchAll(/"(src\/[^\"]+)":\s*\{\s*branches:\s*(\d+),\s*functions:\s*(\d+),\s*lines:\s*(\d+),\s*statements:\s*(\d+),\s*\}/g)]
    .map(([, glob, ...values]) => [glob, values.map(Number)]);
  for (const [glob] of entries) {
    const path = `packages/${packageName}/${glob}`;
    if (glob.endsWith("/**")) {
      assert.ok(sourceFiles(path.slice(0, -3)).length > 0, `${glob} must match source files`);
    } else {
      assert.ok(existsSync(join(root, path)), `${glob} must match a source file`);
    }
  }
  return Object.fromEntries(entries);
}

function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

test("shared JS setup pins the toolchain and installs from the frozen lockfile", () => {
  const action = read(".github/actions/setup-js/action.yml");

  assert.match(action, /node-version:\s*["']22\.22\.1["']/);
  assert.match(action, /bun-version:\s*["']1\.4\.2["']/);
  assert.match(action, /uses:\s*actions\/setup-node@[0-9a-f]{40}/);
  assert.match(action, /uses:\s*oven-sh\/setup-bun@[0-9a-f]{40}/);
  assert.match(action, /bun install --frozen-lockfile/);
});

// Measured regression guard, not a style preference. Restoring the Bun download
// store cost more than the install it replaced and evicted the Foundry caches
// that do pay off, so the shared setup stays cacheless until new evidence says
// otherwise. See the rationale comment in the action itself.
test("shared JS setup does not restore a dependency cache without fresh evidence", () => {
  const action = read(".github/actions/setup-js/action.yml");

  assert.doesNotMatch(action, /uses:\s*actions\/cache@/);
  assert.doesNotMatch(action, /~\/\.bun\/install\/cache/);
  const cachedPaths = [...action.matchAll(/^\s*path:\s*(.+)$/gm)].map(
    (match) => match[1],
  );
  assert.deepEqual(cachedPaths, []);
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
    "coverage-nightly.yml",
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

test("workflow parity is an independently classified Supply Chain guard", () => {
  const source = read(".github/workflows/supply-chain-guardrails.yml");
  const parityJobIndex = source.indexOf("  parity:\n");
  const callerIndex = source.indexOf("name: Run workflow performance parity tests");

  assert.ok(parityJobIndex >= 0 && callerIndex > parityJobIndex);
  assert.match(source.slice(parityJobIndex, callerIndex), /if: needs\.changes\.outputs\.parity == 'true'/);
  assert.match(
    source.slice(callerIndex, callerIndex + 180),
    /node --test scripts\/quality\/workflow-performance-parity\.test\.mjs/,
  );
  assert.equal(source.match(/- "\.mise\.toml"/g)?.length, 2);
});

test("Supply Chain classifies format, guidance, audit, and parity work independently", () => {
  const source = read(".github/workflows/supply-chain-guardrails.yml");

  assert.match(source, /changes:\s*\n\s+name: Classify changes/);
  for (const output of ["format", "guidance", "supply", "parity"]) {
    assert.match(source, new RegExp(`${output}:\\s*\\$\\{\\{\\s*steps\\.classify\\.outputs\\.${output}`));
  }
  assert.match(source, /format:\s*\n\s+name: Repository formatting/);
  assert.match(source, /guidance:\s*\n\s+name: Guidance integrity/);
  assert.match(source, /audit:\s*\n\s+name: Supply-chain guardrails/);
  assert.match(source, /parity:\s*\n\s+name: Workflow performance parity/);
  assert.match(source, /if: needs\.changes\.outputs\.guidance == 'true'/);
  assert.match(source, /if: needs\.changes\.outputs\.supply == 'true'/);
  assert.match(source, /if: needs\.changes\.outputs\.parity == 'true'/);
  assert.match(source, /node scripts\/quality\/classify-supply-chain-changes\.mjs/);
});

test("Supply Chain classifier routes each change class without broad fallthrough", () => {
  assert.deepEqual(classifySupplyChainChanges(["packages/shared/src/utils/calendar-date.ts"]), {
    format: true,
    guidance: false,
    supply: false,
    parity: false,
  });
  assert.deepEqual(classifySupplyChainChanges([".claude/skills/ship/SKILL.md"]), {
    format: true,
    guidance: true,
    supply: false,
    parity: false,
  });
  assert.deepEqual(classifySupplyChainChanges(["bun.lock"]), {
    format: true,
    guidance: false,
    supply: true,
    parity: false,
  });
  assert.deepEqual(classifySupplyChainChanges([".github/workflows/design.yml"]), {
    format: true,
    guidance: false,
    supply: true,
    parity: true,
  });
  assert.deepEqual(classifySupplyChainChanges([], { workflowDispatch: true }), {
    format: true,
    guidance: true,
    supply: true,
    parity: true,
  });
  // Catalog and ledger edits reach the guidance job, where the cross-revision
  // Test ID guard runs; a data-only PR must not skip it.
  for (const dataPath of ["scripts/data/qa-test-catalog.json", "scripts/data/qa-test-id-ledger.json"]) {
    assert.deepEqual(classifySupplyChainChanges([dataPath]), {
      format: true,
      guidance: true,
      supply: false,
      parity: false,
    });
  }
});

test("local hooks keep commit light and reuse the focused push contract", () => {
  const preCommit = read(".husky/pre-commit");
  const prePush = read(".husky/pre-push");
  const settings = JSON.parse(read(".claude/settings.json"));
  const completionGate = read(".claude/scripts/task-completion-gate.sh");

  assert.match(preCommit, /bunx lint-staged/);
  assert.doesNotMatch(preCommit, /ci-local|bun run lint|bun run test|typecheck/);
  assert.match(
    prePush,
    /node scripts\/dev\/ci-local\.js --intent push --reuse-passing-receipts/,
  );
  assert.doesNotMatch(prePush, /verify:contracts|format:check|check:source-structure|agentic:check/);

  const preToolCommands = JSON.stringify(settings.hooks.PreToolUse ?? []);
  const postToolCommands = JSON.stringify(settings.hooks.PostToolUse ?? []);
  assert.doesNotMatch(preToolCommands, /bun run lint/);
  assert.doesNotMatch(postToolCommands, /@green-goods\/shared typecheck/);
  assert.doesNotMatch(completionGate, /bun run|ci-local\.js|typecheck/);
  assert.match(completionGate, /coordinator owns validation/);
});

test("every direct Node and Bun setup uses the exact repository versions", () => {
  for (const [file, source] of workflowSources()) {
    for (const match of source.matchAll(/node-version:\s*["']?([^\s"']+)/g)) {
      assert.equal(match[1], "22.22.1", `${file} has a drifting Node pin`);
    }
    for (const match of source.matchAll(/bun-version:\s*["']?([^\s"']+)/g)) {
      assert.equal(match[1], "1.4.2", `${file} has a drifting Bun pin`);
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

test("lockfile changes run package validation and Supply Chain Guardrails", () => {
  for (const file of [
    "admin.yml",
    "agent.yml",
    "client.yml",
    "contracts.yml",
    "docs.yml",
    "indexer.yml",
    "shared.yml",
  ]) {
    const source = read(`.github/workflows/${file}`);
    for (const event of ["push", "pull_request"]) {
      assert.equal(
        workflowEventBlock(source, event).match(/- "bun\.lock"/g)?.length,
        1,
        `${file}:${event} must include bun.lock exactly once`,
      );
    }
  }

  const design = read(".github/workflows/design.yml").split("permissions:", 1)[0];
  assert.ok(!design.includes('"bun.lock"'), "Design is not a package validation workflow");

  const supplyChain = read(".github/workflows/supply-chain-guardrails.yml");
  for (const event of ["push", "pull_request"]) {
    assert.equal(
      workflowEventBlock(supplyChain, event).match(/- "bun\.lock"/g)?.length,
      1,
      `${event} must include bun.lock exactly once`,
    );
  }
});

test("owning workflows enforce strict test and story typechecks", () => {
  for (const [file, packageName] of [
    ["shared.yml", "shared"],
    ["admin.yml", "admin"],
    ["client.yml", "client"],
  ]) {
    const source = read(`.github/workflows/${file}`);
    assert.match(
      source,
      new RegExp(`working-directory: packages/${packageName}\\n\\s+run: bun run typecheck --scope tests`),
      `${file} must typecheck ${packageName} tests and stories`,
    );
  }
});

test("client and admin production builds follow their full consumer project graphs", () => {
  for (const packageName of ["client", "admin"]) {
    const packageJson = JSON.parse(read(`packages/${packageName}/package.json`));
    const solution = JSON.parse(read(`packages/${packageName}/tsconfig.json`));
    const references = solution.references.map(({ path }) => path);

    // The client also builds its service worker, which needs the worker library.
    assert.deepEqual(
      references,
      packageName === "client"
        ? [
            "./tsconfig.app.json",
            "./tsconfig.node.json",
            "./tsconfig.sw.json",
            "./tsconfig.test.json",
          ]
        : ["./tsconfig.app.json", "./tsconfig.node.json", "./tsconfig.test.json"],
    );
    const full = resolvePackageCommand(packageName, "typecheck", ["--scope", "full"]);
    assert.equal(full.steps.length, 1);
    assert.deepEqual(full.steps[0].args.slice(1), ["tsc", "-b", packageName === "admin" ? "packages/admin/tsconfig.json" : "tsconfig.json"]);
    assert.equal(full.steps[0].cwd, packageName === "admin" ? root : join(root, "packages/client"));
    assert.match(packageJson.scripts.build, /tsc -b(?:\s|$)/);
    assert.doesNotMatch(packageJson.scripts.build, /tsc --noEmit/);
  }
});

test("consumer workflows exclude Shared tests and stories", () => {
  for (const file of ["admin.yml", "agent.yml", "client.yml"]) {
    const outer = read(`.github/workflows/${file}`).split("permissions:", 1)[0];
    for (const pattern of [
      "!packages/shared/**/__tests__/**",
      "!packages/shared/**/*.test.*",
      "!packages/shared/**/*.spec.*",
      "!packages/shared/**/*.stories.*",
      "!packages/shared/.storybook/**",
    ]) {
      const occurrences = outer.match(
        new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
      )?.length;
      assert.equal(occurrences, 2, `${file} must exclude ${pattern} for push and pull_request`);
    }
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
  assert.match(source, /"scripts\/dev\/package-commands\.mjs",/g);
});

test("Shared CI runs both plain-test shards and leaves nightly coverage unsharded", () => {
  const source = read(".github/workflows/shared.yml");
  const testJob = source.slice(source.indexOf("  test:"), source.indexOf("  lint-", source.indexOf("  test:")));
  assert.deepEqual([...testJob.matchAll(/- shard: ["']?(\d\/2)/g)].map((match) => match[1]), ["1/2", "2/2"]);
  assert.match(testJob, /name: Test \(\$\{\{ matrix\.shard \}\}\)/);
  assert.match(testJob, /run: bun run test --shard \$\{\{ matrix\.shard \}\}/);
  assert.doesNotMatch(testJob, /fail-fast:\s*true|coverage/);

  const nightly = read(".github/workflows/coverage-nightly.yml");
  assert.doesNotMatch(nightly, /--shard/);
});

test("test churn summary is informational in the existing Supply Chain workflow", () => {
  const source = read(".github/workflows/supply-chain-guardrails.yml");
  const changesJob = source.slice(source.indexOf("  changes:"), source.indexOf("\n  format:\n"));
  assert.match(changesJob, /name: Summarize test and source changes\n\s+if: github\.event_name == 'pull_request'\n\s+continue-on-error: true/);
  assert.match(changesJob, /node scripts\/quality\/summarize-test-churn\.mjs/);
  assert.match(source, /node --test scripts\/quality\/workflow-performance-parity\.test\.mjs scripts\/quality\/summarize-test-churn\.test\.mjs/);
});

test("CI coverage drops HTML generation without weakening local reports or thresholds", () => {
  const configs = {
    "packages/admin/vitest.config.ts": [47, 44, 53, 51],
    "packages/agent/vitest.config.ts": [10, 20, 20, 20],
    "packages/client/vitest.config.ts": [56, 62, 64, 63],
    "packages/shared/vitest.config.ts": [52, 59, 62, 61],
  };

  for (const [file, thresholds] of Object.entries(configs)) {
    const source = read(file);
    assert.match(source, /process\.env\.CI/);
    assert.match(source, /\["text", "json"\]/);
    assert.match(source, /\["text", "json", "html"\]|\["text", "html", "json"\]/);
    assert.doesNotMatch(source, /thresholds:\s*\{\s*global:/);
    const global = source.match(/thresholds:\s*\{\s*branches:\s*(\d+),\s*functions:\s*(\d+),\s*lines:\s*(\d+),\s*statements:\s*(\d+),/);
    assert.ok(global, `${file} must retain explicit global thresholds`);
    const actualThresholds = global.slice(1).map(Number);
    assert.deepEqual(actualThresholds, thresholds, `${file} thresholds drifted`);
  }

  const c8 = JSON.parse(read("packages/indexer/.c8rc.json"));
  assert.deepEqual(c8.reporter, ["text", "json", "html"]);
  assert.deepEqual(
    [c8.branches, c8.functions, c8.lines, c8.statements],
    [50, 50, 50, 50],
  );
  const indexerCoverage = resolvePackageCommand("indexer", "test", ["--scope", "handlers", "--coverage", "--reporter", "text", "--reporter", "json"]);
  assert.equal(indexerCoverage.steps.length, 1);
  const coverageArgs = indexerCoverage.steps[0].args;
  assert.deepEqual(coverageArgs.slice(1, 6), ["c8", "--reporter", "text", "--reporter", "json"]);
  assert.deepEqual(coverageArgs.slice(8), ["mocha", "--require", "tsx", "--timeout", "30000", "test/**/*.ts"]);
  assert.match(
    read(".github/workflows/indexer.yml"),
    /run:\s*bun run test --scope handlers --coverage --reporter text --reporter json/,
  );
});

test("Shared critical, Cookie Jar, and image-compression coverage globs preserve measured floors", () => {
  assert.deepEqual(coverageGlobFloors("shared"), {
    "src/modules/work/**": [80, 85, 87, 85],
    "src/modules/job-queue/**": [76, 82, 85, 82],
    "src/hooks/auth/**": [73, 76, 77, 75],
    "src/hooks/vault/**": [57, 66, 71, 69],
    "src/hooks/cookie-jar/useCookieJarDeposit.ts": [58, 74, 86, 86],
    "src/hooks/cookie-jar/useCampaignCookieJar.ts": [43, 33, 39, 38],
    "src/utils/work/image-compression.ts": [35, 67, 69, 68],
  });
});

test("Client critical coverage globs preserve measured aggregate floors", () => {
  assert.deepEqual(coverageGlobFloors("client"), {
    "src/views/Home/WalletSheet/**": [67, 60, 75, 74],
    "src/views/Profile/**": [78, 88, 86, 85],
  });
});

test("Admin critical coverage globs preserve measured aggregate floors", () => {
  assert.deepEqual(coverageGlobFloors("admin"), {
    "src/components/Vault/**": [59, 50, 65, 63],
    "src/views/Garden/Pool/**": [65, 68, 75, 73],
  });
});

test("consumer Vitest configs share the local resource-aware worker policy", () => {
  for (const file of [
    "packages/shared/vitest.config.ts",
    "packages/client/vitest.config.ts",
    "packages/admin/vitest.config.ts",
  ]) {
    const source = read(file);
    assert.match(
      source,
      /import \{ resolveVitestMaxWorkers \} from ["']\.\.\/\.\.\/scripts\/lib\/dev-shared\.js["'];/,
      `${file} must import the shared worker policy`,
    );
    assert.match(
      source,
      /maxWorkers:\s*resolveVitestMaxWorkers\(\{/,
      `${file} must resolve its local worker cap through the shared policy`,
    );
  }
});

test("consumer Vitest projects separate Node and DOM without project coverage", () => {
  for (const file of [
    "packages/shared/vitest.config.ts",
    "packages/client/vitest.config.ts",
    "packages/admin/vitest.config.ts",
  ]) {
    const source = read(file);
    assert.equal(source.match(/\bprojects\s*:/g)?.length, 1, `${file} must declare projects once`);
    assert.equal(
      source.match(/\bcoverage\s*:/g)?.length,
      1,
      `${file} must keep coverage only at the root`,
    );
    assert.equal(
      source.match(/extends:\s*true/g)?.length,
      2,
      `${file} projects must inherit the root config`,
    );
    assert.match(source, /name:\s*["']node["']/);
    assert.match(source, /name:\s*["']dom["']/);
  }
});

test("Admin, Client, and Shared keep the production import seams that protect isolated tests", () => {
  const sharedExports = JSON.parse(read("packages/shared/package.json")).exports;
  const declaredSharedImports = new Set(
    Object.keys(sharedExports).map((specifier) =>
      specifier === "."
        ? "@green-goods/shared"
        : `@green-goods/shared/${specifier.replace(/^\.\//, "")}`,
    ),
  );
  const publicContractsBarrelTarget = sharedExports["./public-contracts"];
  for (const [specifier, target] of Object.entries(sharedExports)) {
    if (specifier.startsWith("./public-contracts/")) {
      assert.ok(
        existsSync(join(root, "packages/shared", target)),
        `${specifier} must target an existing public-contracts leaf`,
      );
      assert.notEqual(
        target,
        publicContractsBarrelTarget,
        `${specifier} must target a real leaf instead of aliasing the public-contracts barrel`,
      );
    }
  }
  const broadConsumerBarrels =
    /@green-goods\/shared\/(?:components|config|constants|hooks|i18n|mocks|modules|profile-avatar|providers|public-contracts|stores|testing|types|utils|workflows)(?=["'])/;
  const exactSharedRoot =
    /(?:from\s+|import\s*\(|import\s+|vi\.(?:mock|importActual)\s*\()\s*["']@green-goods\/shared["']/;
  const sharedImportPattern =
    /(?:from\s+|import\s*\(\s*|import\s+|vi\.(?:mock|importActual)\s*\(\s*)["'](@green-goods\/shared(?:\/[^"']+)?)["']/g;
  const deepRelativeSharedSource =
    /(?:from\s+|import\s*\(|vi\.(?:mock|importActual)\s*\()\s*["'][^"']*shared\/src\//;

  for (const consumerDirectory of ["packages/admin/src", "packages/client/src"]) {
    for (const file of sourceFiles(consumerDirectory)) {
      const source = withoutComments(read(file));
      assert.doesNotMatch(source, exactSharedRoot, `${file} must import a declared Shared leaf`);
      assert.doesNotMatch(
        source,
        broadConsumerBarrels,
        `${file} must not restore a broad Shared barrel`,
      );
      for (const match of source.matchAll(sharedImportPattern)) {
        assert.ok(
          declaredSharedImports.has(match[1]),
          `${file} imports undeclared Shared specifier ${match[1]}`,
        );
      }
      assert.doesNotMatch(
        source,
        deepRelativeSharedSource,
        `${file} must not bypass Shared package exports with a deep-relative import`,
      );
    }
  }

  const internalBarrels =
    /from\s+["'][^"']*\/(?:config(?:\/query-keys)?|modules(?:\/data\/ipfs|\/job-queue|\/marketplace)?|public-contracts(?:\/saved-offers)?|utils(?:\/blockchain\/abis)?)["']/;
  for (const file of sourceFiles("packages/shared/src")) {
    if (
      file.includes("/__tests__/") ||
      file.includes("/__mocks__/") ||
      /\.(?:test|spec|stories)\.(?:ts|tsx)$/.test(file) ||
      file.endsWith("/index.ts")
    ) {
      continue;
    }

    const source = withoutComments(read(file));
    assert.doesNotMatch(source, exactSharedRoot, `${file} must not self-import the package root`);
    assert.doesNotMatch(
      source,
      /from\s+["'][^"']*config\/query-keys\/registry["']/,
      `${file} must import domain query-key leaves`,
    );
    assert.doesNotMatch(
      source,
      internalBarrels,
      `${file} must import an internal leaf instead of a high-fanout barrel`,
    );
    assert.doesNotMatch(
      source,
      /DEFAULT_CHAIN_ID[^\n]*from\s+["'][^"']*config\/blockchain["']/,
      `${file} must import DEFAULT_CHAIN_ID from config/default-chain`,
    );
  }
});

test("test quality Check 5 enforces direct-tested seams", () => {
  const source = read("scripts/quality/check-test-quality.sh");
  assert.match(source, /Check 5: Direct-tested seam integrity/);
  assert.match(source, /scripts\/quality\/check-direct-tested-seams\.mjs/);
  assert.match(source, /Check 6: Diff-aware query setup/);
  assert.match(source, /scripts\/quality\/check-test-query-setup\.mjs/);
});

test("test quality only flags added local query setup in package tests", () => {
  const diff = [
    "+++ b/packages/shared/src/__tests__/example.test.ts",
    "@@ -4,1 +4,3 @@",
    "-const old = true;",
    "+const old = true;",
    "+function createWrapper(client) {}",
    "+const queryClient = new QueryClient();",
    "+++ b/packages/shared/src/query.ts",
    "@@ -0,0 +1 @@",
    "+new QueryClient();",
  ].join("\n");
  assert.deepEqual(addedQuerySetupFromDiff(diff), [
    { file: "packages/shared/src/__tests__/example.test.ts", line: 5 },
    { file: "packages/shared/src/__tests__/example.test.ts", line: 6 },
  ]);
});

test("test quality allows nearby reasoned query setup in new files", () => {
  const file = "packages/client/src/__tests__/example.test.tsx";
  const source = [
    "// TEST-QUALITY: allow-local-query-setup - custom retry is the subject",
    "const client = new QueryClient();",
    "function createWrapper() {}",
  ].join("\n");
  assert.deepEqual(newQuerySetupFromSource(source, file), [
    { file, line: 2 },
    { file, line: 3 },
  ]);
  assert.equal(hasQuerySetupAllowance(source, 2), true);
  assert.equal(hasQuerySetupAllowance(source, 3), true);
  assert.equal(hasQuerySetupAllowance("const client = new QueryClient();", 1), false);
  assert.deepEqual(newQuerySetupFromSource(source, "packages/agent/src/example.test.ts"), []);
});

test("Client CI keeps staged modules isolated", () => {
  const source = read(".github/workflows/client.yml");
  for (const event of ["push", "pull_request"]) {
    const trigger = workflowEventBlock(source, event);
    assert.match(trigger, /scripts\/quality\/check-staged-modules\.mjs/);
    assert.match(trigger, /scripts\/quality\/check-staged-modules\.test\.mjs/);
  }
  assert.match(source, /name: Check staged client modules\n\s+run: bun run check --only staged-modules/);
});

test("PR Test jobs run plain tests; thresholds are enforced nightly and on main", () => {
  for (const file of ["shared.yml", "client.yml", "admin.yml"]) {
    const source = read(`.github/workflows/${file}`);
    const testJob = source.slice(
      source.indexOf("  test:"),
      source.indexOf("  lint-", source.indexOf("  test:")),
    );

    assert.match(testJob, /run:\s*bun run test(?:\s|$)/, `${file} Test must stay plain`);
    assert.doesNotMatch(testJob, /coverage/, `${file} Test must not collect coverage`);
  }

  const source = read(".github/workflows/coverage-nightly.yml");
  assert.match(source, /schedule:\s*\n\s*- cron:/);
  assert.match(workflowEventBlock(source, "push"), /branches:\s*\[main\]/);
  assert.match(source, /workflow_dispatch:\s*\{\}/);
  assert.match(source, /fail-fast:\s*false/);
  const selections = [...source.matchAll(/package:\s*(\w+)\s*\n\s*args:\s*([^\n]+)/g)]
    .map(([, pkg, args]) => [pkg, args.trim().split(/\s+/)]);
  assert.deepEqual(selections, [["shared", ["--scope", "all-configured", "--coverage"]], ["client", ["--coverage"]], ["admin", ["--coverage"]]]);
  for (const [pkg, args] of selections) {
    const plan = resolvePackageCommand(pkg, "test", args);
    assert.equal(plan.steps.length, 1);
    assert.ok(plan.steps[0].args.includes("--coverage"));
    assert.ok(!plan.steps[0].args.includes("--exclude"), `${pkg} nightly coverage must retain all configured tests`);
    assert.equal(plan.steps[0].cwd, join(root, "packages", pkg));
  }
  assert.match(source, /uses:\s*\.\/\.github\/actions\/setup-js/);
  assert.match(source, /run:\s*bun run test \$\{\{ matrix\.args \}\}/);
  assert.match(source, /CI:\s*true/);
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
      /bun run format --check/,
      `${file} must not duplicate repository formatting`,
    );
  }

  const guardrails = read(".github/workflows/supply-chain-guardrails.yml");
  const formatIndex = guardrails.indexOf("name: Check repository formatting");
  const guidanceIndex = guardrails.indexOf("name: Check Codex guidance parity");
  assert.ok(formatIndex >= 0 && formatIndex < guidanceIndex);
  assert.match(
    guardrails.slice(formatIndex, formatIndex + 120),
    /bun run format --check/,
  );
});

test("contract fork CI selects the same shards through the argument-based runner", () => {
  const source = read(".github/workflows/contracts.yml");
  const core = source.slice(source.indexOf("  fork-readiness-core:"), source.indexOf("  fork-readiness-arbitrum:"));
  assert.deepEqual([...core.matchAll(/- shard: ([\w-]+)/g)].map((match) => match[1]), ["sepolia", "ethereum"]);
  assert.match(core, /working-directory: packages\/contracts\s+run: bun run test:shard run \$\{\{ matrix\.shard \}\}/);
  const sequential = source.slice(source.indexOf("  fork-readiness-arbitrum:"));
  assert.deepEqual([...sequential.matchAll(/bun run test:shard run ([\w-]+)/g)].map((match) => match[1]), [
    "arbitrum", "gardens", "octant", "settlement-lane",
  ]);
  assert.doesNotMatch(source, /test:fork:[\w:-]+/);
});

function aggregateFixture(command, failingPackage) {
  const fixture = mkdtempSync(join(tmpdir(), "gg-aggregate-selection-"));
  const log = join(fixture, "calls");
  const rootScripts = JSON.parse(read("package.json")).scripts;
  writeFileSync(log, "");
  for (const relative of ["scripts/dev/test.js", "scripts/lib/command-runner.mjs"]) {
    mkdirSync(join(fixture, relative, ".."), { recursive: true });
    writeFileSync(join(fixture, relative), read(relative));
  }
  mkdirSync(join(fixture, "bin"));
  writeFileSync(join(fixture, "bin/bun"), `#!/bin/sh
if [ "$1" = "--bun" ] && [ "$2" = "x" ] && [ "$3" = "vitest" ]; then
  echo tools >> "$CALL_LOG"
else
  PATH="$AGGREGATE_PATH" exec bun "$@"
fi
`, { mode: 0o755 });
  writeFileSync(join(fixture, "package.json"), JSON.stringify({
    private: true,
    type: "module",
    workspaces: ["packages/*", "docs"],
    scripts: { test: rootScripts.test, build: rootScripts.build, "test:agent-tools": 'echo tools >> "$CALL_LOG"' },
  }));
  for (const name of ["contracts", "shared", "indexer", "client", "admin", "agent", "docs"]) {
    const directory = join(fixture, name === "docs" ? "docs" : `packages/${name}`);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "package.json"), JSON.stringify({
      name: `@green-goods/${name}`,
      scripts: Object.fromEntries(["test", "build"].map((script) => [script,
        `echo ${name} >> "$CALL_LOG"${failingPackage === name ? " && exit 23" : ""}`,
      ])),
    }));
  }
  try {
    if (command === "test") assert.equal(rootScripts.test, "node scripts/dev/test.js");
    const result = spawnSync(command === "test" ? "node" : "bun", command === "test" ? ["scripts/dev/test.js"] : ["--no-env-file", "run", command], {
      cwd: fixture, encoding: "utf8", timeout: 10_000,
      env: { ...process.env, CALL_LOG: log, AGGREGATE_PATH: process.env.PATH, PATH: `${join(fixture, "bin")}:${process.env.PATH}` },
    });
    return { ...result, calls: readFileSync(log, "utf8").trim().split("\n") };
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

test("root aggregate build retains dependency order without package forwarding aliases", () => {
  const result = aggregateFixture("build");
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.calls, ["contracts", "shared", "indexer", "client", "admin"]);
});

test("root aggregate tests retain every package and parallel-stage boundaries", () => {
  const result = aggregateFixture("test");
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.calls.slice(0, 2), ["tools", "contracts"]);
  assert.deepEqual(result.calls.slice(2, 4).sort(), ["docs", "shared"]);
  assert.equal(result.calls[4], "indexer");
  assert.deepEqual(result.calls.slice(5).sort(), ["admin", "agent", "client"]);
});

test("root aggregate tests stop before downstream stages when a parallel member fails", () => {
  const result = aggregateFixture("test", "shared");
  assert.notEqual(result.status, 0);
  assert.ok(result.calls.includes("shared"), `${result.stderr}\n${JSON.stringify(result.calls)}`);
  for (const downstream of ["indexer", "client", "admin", "agent"]) {
    assert.ok(!result.calls.includes(downstream), `${downstream} must not run after a failing stage`);
  }
});
