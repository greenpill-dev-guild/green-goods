import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildReceiptInputs,
  detectCliToolchain,
  resolveGitInputs,
  selectExpectedWorkflows,
  selectValidation,
} from "./select-validation.mjs";

function ids(plan) {
  return plan.checks.map((check) => check.id);
}

test("the durable Bun caller re-enters the selector under real Node", () => {
  const packageJson = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  );

  assert.equal(
    packageJson.scripts["validation:plan"],
    "node scripts/dev/node-cli.js scripts/quality/select-validation.mjs",
  );
});

test("docs-only QA stays on the docs surface", () => {
  const plan = selectValidation({
    intent: "qa",
    changedPaths: ["docs/docs/builders/getting-started.mdx"],
  });

  assert.equal(plan.status, "ready");
  assert.deepEqual(ids(plan), ["format", "docs-build"]);
  assert.equal(
    plan.checks[0].command,
    "bunx @biomejs/biome format --no-errors-on-unmatched 'docs/docs/builders/getting-started.mdx'",
  );
  assert.equal(plan.budget.withinTarget, true);
});

// Regression: Biome exits non-zero when it handles none of the supplied paths.
// A Markdown-, Solidity-, or YAML-only change is exactly that case, so without
// the flag the scoped format check failed and fail-fast killed the whole plan
// on the most common lightweight edit in this repository.
test("scoped format tolerates paths Biome does not handle", () => {
  for (const changedPath of [
    "docs/docs/reference/glossary-community.md",
    "packages/contracts/src/Garden.sol",
    ".github/workflows/client.yml",
  ]) {
    for (const intent of ["diagnose", "review", "qa"]) {
      const plan = selectValidation({ intent, changedPaths: [changedPath] });
      const format = plan.checks.find((check) => check.id === "format");
      if (!format) continue;
      assert.match(
        format.command,
        /--no-errors-on-unmatched/,
        `${intent} on ${changedPath} must not fail on an unmatched path`,
      );
    }
  }
});

test("a clean checkpoint is an explicit no-op", () => {
  const plan = selectValidation({ intent: "checkpoint", changedPaths: [] });
  assert.deepEqual(plan.surfaces, []);
  assert.deepEqual(plan.checks, []);
  assert.equal(plan.budget.automatedSeconds, 0);
});

test("validation tooling paths escalate to sensitive risk", () => {
  const plan = selectValidation({
    intent: "diagnose",
    changedPaths: ["scripts/dev/ci-local.js"],
  });
  assert.equal(plan.risk, "sensitive");
  assert.deepEqual(plan.checks, []);
});

test("isolated client behavior accepts focused proof without forcing a package build", () => {
  const plan = selectValidation({
    intent: "qa",
    changedPaths: ["packages/client/src/views/Home/Garden/Work.tsx"],
    testPaths: { client: ["src/views/Home/Garden/Work.test.tsx"] },
  });

  assert.deepEqual(ids(plan), [
    "format",
    "lint",
    "client-test",
    "browser-proof",
  ]);
  assert.equal(
    plan.checks.find((check) => check.id === "client-test").command,
    "bun run test src/views/Home/Garden/Work.test.tsx",
  );
  assert.equal(
    plan.checks.find((check) => check.id === "lint").command,
    "bun --bun run oxlint 'packages/client/src/views/Home/Garden/Work.tsx' --deny-warnings",
  );
  assert.equal(plan.budget.targetSeconds, 90);
  assert.equal(plan.budget.withinTarget, true);
  assert.equal(plan.checks.at(-1).state, "pending");
});

test("routing changes add the package build in QA", () => {
  const plan = selectValidation({
    intent: "qa",
    changedPaths: ["packages/client/src/router.tsx"],
    testPaths: { client: ["src/router.test.tsx"] },
  });

  assert.ok(ids(plan).includes("client-build"));
  assert.ok(ids(plan).includes("lint"));
});

test("critical contract paths cannot be downgraded by QA intent", () => {
  const plan = selectValidation({
    intent: "qa",
    risk: "routine",
    changedPaths: ["packages/contracts/src/Garden.sol"],
  });

  assert.equal(plan.risk, "critical");
  assert.deepEqual(ids(plan), [
    "format",
    "abi-artifacts",
    "contracts-build",
    "contracts-test",
    "contracts-verify-fast",
    "ontology",
  ]);
  assert.ok(plan.checks.filter((check) => check.mandatory).length >= 3);
});

test("mutation-rich shared hooks retain the critical override", () => {
  for (const changedPath of [
    "packages/shared/src/hooks/garden/useCreateGarden.ts",
    "packages/shared/src/hooks/assessment/useAssessment.ts",
    "packages/shared/src/modules/work/submit.ts",
    "packages/shared/src/workflows/approve.ts",
  ]) {
    const plan = selectValidation({ intent: "qa", changedPaths: [changedPath] });
    assert.equal(plan.risk, "critical", changedPath);
    assert.ok(plan.checks.find((check) => check.id === "shared-test")?.mandatory, changedPath);
    assert.ok(plan.checks.find((check) => check.id === "client-test")?.mandatory, changedPath);
  }
});

test("shared public API changes include direct consumers", () => {
  const plan = selectValidation({
    intent: "checkpoint",
    changedPaths: ["packages/shared/src/index.ts"],
  });

  assert.deepEqual(ids(plan), [
    "format",
    "lint",
    "shared-typecheck",
    "shared-test",
    "client-test",
    "admin-test",
    "agent-typecheck",
    "agent-test",
    "source-structure",
    "design-guardrails",
  ]);
});

test("CI owns merge intent and cannot be downgraded", () => {
  const plan = selectValidation({
    intent: "qa",
    ci: true,
    changedPaths: ["packages/agent/src/index.ts"],
  });

  assert.equal(plan.requestedIntent, "qa");
  assert.equal(plan.effectiveIntent, "merge");
  assert.ok(ids(plan).includes("agent-build"));
});

test("diagnose and review classify critical risk without inventing broad proof", () => {
  for (const intent of ["diagnose", "review"]) {
    const unrequested = selectValidation({
      intent,
      changedPaths: ["packages/contracts/src/Garden.sol"],
    });
    assert.equal(unrequested.risk, "critical");
    assert.deepEqual(unrequested.checks, []);

    const requested = selectValidation({
      intent,
      changedPaths: ["packages/shared/src/hooks/garden/useCreateGarden.ts"],
      testPaths: { shared: ["src/hooks/garden/useCreateGarden.test.ts"] },
    });
    assert.deepEqual(ids(requested), ["shared-test"]);
    assert.equal(
      requested.checks[0].command,
      "bun run test src/hooks/garden/useCreateGarden.test.ts",
    );
  }
});

test("missing required environment capability is explicitly blocked", () => {
  const plan = selectValidation({
    intent: "qa",
    changedPaths: ["packages/contracts/src/Garden.sol"],
    environment: { capabilities: { dependencies: true, foundry: false } },
  });

  assert.equal(plan.status, "blocked");
  const blocked = plan.checks.filter((check) => check.state === "blocked");
  assert.ok(blocked.length > 0);
  assert.ok(blocked.every((check) => check.blockedBy.includes("foundry")));
});

test("exact toolchain parity is enforced only for tools selected checks need", () => {
  const matching = selectValidation({
    intent: "qa",
    changedPaths: ["docs/docs/builders/getting-started.mdx"],
    environment: {
      profile: "local",
      toolchain: { node: "22.22.1", bun: "1.3.14" },
      capabilities: { dependencies: true },
    },
  });
  assert.equal(matching.status, "ready");

  const mismatched = selectValidation({
    intent: "qa",
    changedPaths: ["docs/docs/builders/getting-started.mdx"],
    environment: {
      profile: "local",
      toolchain: { node: "24.19.0" },
      capabilities: { dependencies: true },
    },
  });
  assert.equal(mismatched.status, "blocked");
  assert.deepEqual(
    mismatched.environmentBlockers.map((entry) => entry.capability),
    ["toolchain.node", "toolchain.bun"],
  );
  assert.ok(mismatched.checks.every((check) => check.state === "blocked"));
});

test("direct CLI toolchain detection blocks a stale Bun plan", () => {
  const toolchain = detectCliToolchain({
    nodeVersion: "22.22.1",
    execFileSync(command) {
      if (command === "bun") return "1.3.10\n";
      if (command === "forge") return "forge Version: 1.7.1-stable\n";
      throw new Error(`unexpected command: ${command}`);
    },
  });
  const plan = selectValidation({
    intent: "qa",
    changedPaths: ["docs/docs/builders/getting-started.mdx"],
    environment: { toolchain, capabilities: { dependencies: true } },
  });

  assert.equal(plan.status, "blocked");
  assert.deepEqual(plan.environmentBlockers, [
    { capability: "toolchain.bun", expected: "1.3.14", actual: "1.3.10" },
  ]);
});

test("cancellation is terminal and selects no checks", () => {
  const plan = selectValidation({
    intent: "ship",
    cancelled: true,
    changedPaths: ["packages/contracts/src/Garden.sol"],
  });

  assert.equal(plan.status, "cancelled");
  assert.deepEqual(plan.checks, []);
  assert.equal(plan.stopReason, "user-cancelled");
  assert.equal(plan.budget.automatedSeconds, 0);
});

test("ship remains strict and includes the complete build surface", () => {
  const plan = selectValidation({
    intent: "ship",
    changedPaths: ["docs/README.md"],
  });

  for (const checkId of [
    "contracts-test",
    "shared-test",
    "indexer-test",
    "client-build",
    "admin-build",
    "agent-build",
    "docs-build",
    "contracts-verify-fast",
  ]) {
    assert.ok(ids(plan).includes(checkId), checkId);
    assert.equal(plan.checks.find((check) => check.id === checkId).mandatory, true, checkId);
  }
});

test("readiness is strict, mandatory, and non-mutating while local ship formats", () => {
  const readiness = selectValidation({
    intent: "readiness",
    changedPaths: ["packages/client/src/index.ts"],
  });
  assert.equal(
    readiness.checks.find((check) => check.id === "format").command,
    "bun run format:check",
  );
  assert.ok(readiness.checks.every((check) => check.mandatory));
  for (const checkId of [
    "contracts-build",
    "contracts-test",
    "shared-test",
    "shared-build",
    "indexer-test",
    "indexer-build",
    "client-test",
    "client-build",
    "admin-test",
    "admin-build",
    "agent-test",
    "agent-build",
    "docs-test",
    "docs-build",
    "contracts-verify-fast",
  ]) {
    assert.ok(ids(readiness).includes(checkId), checkId);
  }

  const ship = selectValidation({ intent: "ship", changedPaths: [] });
  assert.equal(ship.checks.find((check) => check.id === "format").command, "bun format");
  const merge = selectValidation({
    intent: "merge",
    ci: true,
    changedPaths: ["package.json"],
  });
  assert.equal(
    merge.checks.find((check) => check.id === "format").command,
    "bun run format:check",
  );
});

test("ordinary source checkpoints do not invent the full supply-chain suite", () => {
  for (const changedPath of [
    "packages/client/src/components/Panel.tsx",
    "packages/shared/src/components/Button.tsx",
  ]) {
    const plan = selectValidation({ intent: "checkpoint", changedPaths: [changedPath] });
    assert.ok(ids(plan).includes("format"), changedPath);
    assert.ok(ids(plan).includes("lint"), changedPath);
    assert.ok(!ids(plan).includes("supply-chain"), changedPath);
  }
});

test("receipt inputs authorize only opt-in passing reuse", () => {
  const plan = selectValidation({
    intent: "checkpoint",
    base: "base-sha",
    head: "head-sha",
    changedPaths: ["packages/agent/src/index.ts"],
    environment: {
      profile: "local",
      toolchain: { node: "22.22.1", bun: "1.3.14" },
      capabilities: { dependencies: true },
    },
  });
  const receipt = buildReceiptInputs(plan, plan.checks[0]);

  assert.deepEqual(receipt.changedPaths, ["packages/agent/src/index.ts"]);
  assert.equal(receipt.base, "base-sha");
  assert.equal(receipt.head, "head-sha");
  assert.equal(receipt.checkId, "format");
  assert.equal(receipt.cacheReuse.allowed, true);
  assert.equal(receipt.cacheReuse.optInRequired, true);
  assert.equal(receipt.cacheReuse.failuresCacheable, false);
  assert.match(receipt.fingerprint, /^[a-f0-9]{64}$/);
});

test("git inputs include dirty and untracked paths and fingerprint their content", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "validation-selector-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd: directory, stdio: "ignore" });
  git("init");
  git("config", "user.email", "validation@example.com");
  git("config", "user.name", "Validation Test");
  git("config", "commit.gpgsign", "false");
  mkdirSync(join(directory, "packages/client/src"), { recursive: true });
  writeFileSync(join(directory, "packages/client/src/app.ts"), "export const value = 1;\n");
  git("add", ".");
  git("commit", "-m", "test: seed fixture");

  const clean = resolveGitInputs({ changedPaths: [], base: "HEAD", head: "HEAD" }, { cwd: directory });
  assert.deepEqual(clean.changedPaths, []);

  writeFileSync(join(directory, "packages/client/src/app.ts"), "export const value = 2;\n");
  mkdirSync(join(directory, "docs"));
  writeFileSync(join(directory, "docs/new.md"), "new\n");
  const dirty = resolveGitInputs({ changedPaths: [], base: "HEAD", head: "HEAD" }, { cwd: directory });
  assert.deepEqual(dirty.changedPaths, ["docs/new.md", "packages/client/src/app.ts"]);
  assert.notEqual(dirty.workingCopyFingerprint, clean.workingCopyFingerprint);

  writeFileSync(join(directory, "docs/new.md"), "changed again\n");
  const changedAgain = resolveGitInputs(
    { changedPaths: [], base: "HEAD", head: "HEAD" },
    { cwd: directory },
  );
  assert.notEqual(changedAgain.workingCopyFingerprint, dirty.workingCopyFingerprint);

  writeFileSync(join(directory, "packages/client/src/app.ts"), "export const value = 2;\n   \n");
  const trailingWhitespace = resolveGitInputs(
    { changedPaths: [], base: "HEAD", head: "HEAD" },
    { cwd: directory },
  );
  writeFileSync(join(directory, "packages/client/src/app.ts"), "export const value = 2;\n      \n");
  const changedTrailingWhitespace = resolveGitInputs(
    { changedPaths: [], base: "HEAD", head: "HEAD" },
    { cwd: directory },
  );
  assert.notEqual(
    changedTrailingWhitespace.workingCopyFingerprint,
    trailingWhitespace.workingCopyFingerprint,
  );
});

test("workflow mapping follows observable contract artifacts", () => {
  assert.deepEqual(
    selectExpectedWorkflows({
      changedPaths: ["packages/contracts/src/Garden.sol"],
      intent: "merge",
      ci: true,
    }),
    ["Contracts", "Ontology", "Supply Chain Guardrails"],
  );

  assert.deepEqual(
    selectExpectedWorkflows({
      changedPaths: ["packages/contracts/abis/GardenAccount.json"],
      intent: "merge",
      ci: true,
    }),
    [
      "Admin",
      "Client",
      "Contracts",
      "Indexer",
      "Shared",
      "Supply Chain Guardrails",
    ],
  );
});

test("workflow mapping includes global formatting ownership for ordinary source", () => {
  assert.deepEqual(
    selectExpectedWorkflows({
      changedPaths: ["packages/client/src/views/Home/Garden/Work.tsx"],
      intent: "merge",
      ci: true,
    }),
    ["Client", "Design", "Ontology", "Supply Chain Guardrails"],
  );
  assert.deepEqual(
    selectExpectedWorkflows({
      changedPaths: ["packages/shared/src/index.ts"],
      intent: "merge",
      ci: true,
    }),
    ["Admin", "Agent", "Client", "Design", "Ontology", "Shared", "Supply Chain Guardrails"],
  );
  assert.deepEqual(
    selectExpectedWorkflows({
      changedPaths: ["docs/docs/builders/getting-started.mdx"],
      intent: "merge",
      ci: true,
    }),
    ["Docs", "Supply Chain Guardrails"],
  );
});

test("shared JS setup changes select every dependent workflow", () => {
  assert.deepEqual(
    selectExpectedWorkflows({
      changedPaths: [".github/actions/setup-js/action.yml"],
      intent: "merge",
      ci: true,
    }),
    [
      "Admin",
      "Agent",
      "Client",
      "Contracts",
      "Design",
      "Docs",
      "Indexer",
      "Shared",
      "Supply Chain Guardrails",
    ],
  );
});

test("workflow mapping preserves exact live and intended trigger parity", () => {
  const cases = [
    ["scripts/ops/upload-sourcemaps.js", ["Admin", "Client", "Supply Chain Guardrails"]],
    ["scripts/lib/env-schema.mjs", ["Admin", "Client", "Supply Chain Guardrails"]],
    ["scripts/lib/env-schema.test.mjs", ["Admin", "Client", "Supply Chain Guardrails"]],
    ["scripts/lib/env-parity.mjs", ["Admin", "Client", "Supply Chain Guardrails"]],
    ["scripts/lib/env-parity.d.mts", ["Admin", "Client"]],
    ["scripts/dev/env-check.js", ["Admin", "Client", "Supply Chain Guardrails"]],
    [
      "scripts/quality/check-source-structure.js",
      ["Admin", "Agent", "Client", "Contracts", "Indexer", "Shared", "Supply Chain Guardrails"],
    ],
    ["scripts/lib/git-guardrails.mjs", ["Contracts", "Supply Chain Guardrails"]],
    ["docs/docs/builders/testing/storybook.mdx", ["Design", "Docs", "Supply Chain Guardrails"]],
    ["packages/client/DESIGN-pwa.md", ["Client", "Design", "Supply Chain Guardrails"]],
    [
      "packages/shared/.storybook/preview.ts",
      ["Admin", "Agent", "Client", "Design", "Shared", "Supply Chain Guardrails"],
    ],
    ["scripts/data/design-token-usage-baseline.tsv", ["Design"]],
    ["scripts/quality/check-story-quality.ts", ["Design", "Supply Chain Guardrails"]],
    ["vercel.json", ["Design", "Supply Chain Guardrails"]],
    ["packages/contracts/config/schemas.json", ["Contracts", "Ontology", "Supply Chain Guardrails"]],
    ["packages/client/src/views/Home/Garden/Assessment.tsx", ["Client", "Design", "Ontology", "Supply Chain Guardrails"]],
    ["packages/indexer/schema.graphql", ["Indexer", "Ontology"]],
    ["docs/docs/reference/ontology.generated.mdx", ["Docs", "Ontology", "Supply Chain Guardrails"]],
    ["scripts/quality/ontology-render.mjs", ["Ontology", "Supply Chain Guardrails"]],
    ["scripts/data/ontology-drift-baseline.json", ["Ontology", "Supply Chain Guardrails"]],
    [".plans/active/commitment-pooling/contract-spec.md", ["Ontology", "Supply Chain Guardrails"]],
    ["docs/docs/builders/architecture/erd.mdx", ["Docs", "Ontology", "Supply Chain Guardrails"]],
    ["packages/contracts/script/DeployBadgeSchema.s.sol", ["Contracts", "Ontology", "Supply Chain Guardrails"]],
    ["bunfig.toml", ["Supply Chain Guardrails"]],
    [".npmrc", ["Supply Chain Guardrails"]],
    [".mise.toml", ["Supply Chain Guardrails"]],
    ["biome.json", ["Admin", "Agent", "Client", "Shared", "Supply Chain Guardrails"]],
  ];

  for (const [changedPath, expected] of cases) {
    assert.deepEqual(
      selectExpectedWorkflows({ changedPaths: [changedPath], intent: "merge", ci: true }),
      expected,
      changedPath,
    );
  }
});
