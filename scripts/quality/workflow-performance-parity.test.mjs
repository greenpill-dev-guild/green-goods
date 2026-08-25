import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

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

function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

test("shared JS setup pins the toolchain and installs from the frozen lockfile", () => {
  const action = read(".github/actions/setup-js/action.yml");

  assert.match(action, /node-version:\s*["']22\.22\.1["']/);
  assert.match(action, /bun-version:\s*["']1\.3\.14["']/);
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
      new RegExp(`working-directory: packages/${packageName}\\n\\s+run: bun run typecheck:tests`),
      `${file} must typecheck ${packageName} tests and stories`,
    );
  }
});

test("client and admin production builds follow their full consumer project graphs", () => {
  for (const packageName of ["client", "admin"]) {
    const packageJson = JSON.parse(read(`packages/${packageName}/package.json`));
    const solution = JSON.parse(read(`packages/${packageName}/tsconfig.json`));
    const references = solution.references.map(({ path }) => path);

    assert.deepEqual(references, [
      "./tsconfig.app.json",
      "./tsconfig.node.json",
      "./tsconfig.test.json",
    ]);
    assert.match(packageJson.scripts["typecheck:full"], /tsc -b(?:\s|$)/);
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
});

test("Client CI keeps staged modules isolated", () => {
  const source = read(".github/workflows/client.yml");
  for (const event of ["push", "pull_request"]) {
    const trigger = workflowEventBlock(source, event);
    assert.match(trigger, /scripts\/quality\/check-staged-modules\.mjs/);
    assert.match(trigger, /scripts\/quality\/check-staged-modules\.test\.mjs/);
  }
  assert.match(source, /name: Check staged client modules\n\s+run: bun run check:staged-modules/);
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
  assert.match(source, /package:\s*shared\s*\n\s*script:\s*coverage/);
  assert.match(source, /package:\s*client\s*\n\s*script:\s*coverage/);
  assert.match(source, /package:\s*admin\s*\n\s*script:\s*test:coverage/);
  assert.match(source, /uses:\s*\.\/\.github\/actions\/setup-js/);
  assert.match(source, /run:\s*bun run \$\{\{ matrix\.script \}\}/);
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
