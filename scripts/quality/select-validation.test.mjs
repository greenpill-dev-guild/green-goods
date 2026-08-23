import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildReceiptInputs,
  detectCliToolchain,
  loadPolicy,
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

test("test-only shared changes stay in Shared and select the direct typecheck", () => {
  const changedPath = "packages/shared/src/__tests__/components/FormWizard.test.tsx";
  const plan = selectValidation({
    intent: "checkpoint",
    checkpointScope: "lane",
    changedPaths: [changedPath],
  });

  assert.deepEqual(plan.surfaces, ["shared"]);
  assert.deepEqual(ids(plan), [
    "format",
    "lint",
    "shared-test-typecheck",
    "shared-test",
  ]);
  assert.equal(
    plan.checks.find((check) => check.id === "shared-test").command,
    "bun run test src/__tests__/components/FormWizard.test.tsx",
  );
  assert.equal(
    plan.checks.find((check) => check.id === "lint").command,
    `bunx @biomejs/biome lint --no-errors-on-unmatched '${changedPath}'`,
  );
  assert.ok(!ids(plan).includes("client-test"));
  assert.ok(!ids(plan).includes("ontology"));
  assert.deepEqual(
    selectExpectedWorkflows({ changedPaths: [changedPath], intent: "merge", ci: true }),
    ["Shared", "Supply Chain Guardrails"],
  );
});

test("story-only changes select story typing and quality without runtime or browser proof", () => {
  const changedPath = "packages/admin/src/components/Layout/AccountSurface.stories.tsx";
  const plan = selectValidation({ intent: "qa", changedPaths: [changedPath] });

  assert.deepEqual(plan.surfaces, ["admin"]);
  assert.deepEqual(plan.changes, [{ path: changedPath, kind: "story", surface: "admin" }]);
  assert.deepEqual(ids(plan), ["format", "lint", "admin-test-typecheck", "story-quality"]);
  assert.ok(!ids(plan).includes("admin-test"));
  assert.ok(!ids(plan).includes("browser-proof"));
  assert.deepEqual(
    selectExpectedWorkflows({ changedPaths: [changedPath], intent: "merge", ci: true }),
    ["Admin", "Design", "Supply Chain Guardrails"],
  );
});

test("Storybook configuration changes select a static build", () => {
  const changedPath = "packages/shared/.storybook/preview.ts";
  const plan = selectValidation({ intent: "qa", changedPaths: [changedPath] });

  assert.deepEqual(plan.changes, [
    { path: changedPath, kind: "storybook-config", surface: "shared" },
  ]);
  assert.deepEqual(ids(plan), [
    "format",
    "lint",
    "shared-test-typecheck",
    "story-quality",
    "storybook-build",
  ]);
  assert.equal(
    plan.checks.find((check) => check.id === "storybook-build").command,
    "bun run build-storybook",
  );
});

test("workspace package manifests stay on their owning surfaces", () => {
  const changedPaths = ["packages/admin/package.json", "packages/client/package.json"];
  const plan = selectValidation({ intent: "checkpoint", changedPaths });

  assert.deepEqual(plan.surfaces, ["client", "admin"]);
  assert.ok(ids(plan).includes("admin-test"));
  assert.ok(ids(plan).includes("client-test"));
  for (const unrelated of [
    "contracts-build",
    "contracts-test",
    "indexer-test",
    "docs-build",
    "agent-test",
  ]) {
    assert.ok(!ids(plan).includes(unrelated), unrelated);
  }
  assert.deepEqual(
    selectExpectedWorkflows({ changedPaths, intent: "merge", ci: true }),
    ["Admin", "Client", "Supply Chain Guardrails"],
  );
});

test("a lockfile-only change retains package validation and dependency integrity", () => {
  const plan = selectValidation({ intent: "checkpoint", changedPaths: ["bun.lock"] });

  assert.deepEqual(plan.surfaces, [
    "contracts",
    "shared",
    "indexer",
    "client",
    "admin",
    "agent",
    "docs",
  ]);
  assert.deepEqual(plan.changes, [{ path: "bun.lock", kind: "lockfile", surface: null }]);
  for (const checkId of [
    "contracts-build",
    "contracts-test",
    "shared-test",
    "indexer-test",
    "client-test",
    "admin-test",
    "agent-test",
    "docs-build",
    "supply-chain",
  ]) {
    assert.ok(ids(plan).includes(checkId), checkId);
  }
  assert.deepEqual(
    selectExpectedWorkflows({ changedPaths: ["bun.lock"], intent: "merge", ci: true }),
    [
      "Admin",
      "Agent",
      "Client",
      "Contracts",
      "Docs",
      "Indexer",
      "Shared",
      "Supply Chain Guardrails",
    ],
  );
});

test("recognized root tests select their durable acceptance commands", () => {
  for (const [changedPath, checkId, command] of [
    ["scripts/lib/env-schema.test.mjs", "env-schema-test", "bun run test:env-schema"],
    [
      "scripts/lib/dev-shared.test.mjs",
      "validation-system-test",
      "bun run test:validation-system",
    ],
    [
      "scripts/quality/select-validation.test.mjs",
      "validation-system-test",
      "bun run test:validation-system",
    ],
  ]) {
    for (const input of [
      { intent: "checkpoint" },
      { intent: "merge", ci: true },
    ]) {
      const plan = selectValidation({ ...input, changedPaths: [changedPath] });
      const check = plan.checks.find((candidate) => candidate.id === checkId);
      assert.equal(check?.command, command, `${input.intent}:${changedPath}`);
    }
  }
});

test("lane checkpoint scopes format and lint to explicitly supplied paths", () => {
  const plan = selectValidation({
    intent: "checkpoint",
    checkpointScope: "lane",
    changedPaths: ["packages/client/src/components/Panel.tsx"],
  });

  assert.equal(plan.requestedCheckpointScope, "lane");
  assert.equal(plan.checkpointScope, "lane");
  assert.equal(
    plan.checks.find((check) => check.id === "format").command,
    "bunx @biomejs/biome format --no-errors-on-unmatched 'packages/client/src/components/Panel.tsx'",
  );
  assert.equal(
    plan.checks.find((check) => check.id === "lint").command,
    "bun --bun run oxlint 'packages/client/src/components/Panel.tsx' --deny-warnings",
  );
});

test("workspace checkpoint keeps repository-wide format and lint commands", () => {
  const plan = selectValidation({
    intent: "checkpoint",
    checkpointScope: "workspace",
    changedPaths: ["packages/client/src/components/Panel.tsx"],
  });

  assert.equal(plan.checkpointScope, "workspace");
  assert.equal(plan.checks.find((check) => check.id === "format").command, "bun run format:check");
  assert.equal(plan.checks.find((check) => check.id === "lint").command, "bun run lint");
});

test("lane lint preserves workspace ownership instead of widening Oxlint to scripts", () => {
  const plan = selectValidation({
    intent: "checkpoint",
    checkpointScope: "lane",
    changedPaths: ["scripts/quality/select-validation.mjs"],
  });

  assert.equal(
    plan.checks.find((check) => check.id === "lint").command,
    "bunx @biomejs/biome lint --no-errors-on-unmatched 'scripts/quality/select-validation.mjs'",
  );
});

test("QA lint preserves workspace ownership instead of widening Oxlint to scripts", () => {
  const plan = selectValidation({
    intent: "qa",
    changedPaths: ["scripts/quality/select-validation.mjs"],
  });

  assert.equal(
    plan.checks.find((check) => check.id === "lint").command,
    "bunx @biomejs/biome lint --no-errors-on-unmatched 'scripts/quality/select-validation.mjs'",
  );
});

test("lane checkpoint requires explicit changed paths", () => {
  assert.throws(
    () => selectValidation({ intent: "checkpoint", checkpointScope: "lane" }),
    /lane checkpoint requires explicit changed paths/i,
  );
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
    "ontology",
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
  assert.equal(plan.budget.withinTarget, false);
  assert.equal(plan.budget.rule, "Budgets warn and profile; they never skip selected or mandatory checks.");
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

test("focused Solidity tests use the contracts match-path wrapper", () => {
  const plan = selectValidation({
    intent: "qa",
    changedPaths: ["packages/contracts/test/unit/Garden.t.sol"],
  });

  const contractsTest = plan.checks.find((check) => check.id === "contracts-test");
  assert.equal(contractsTest.command, "bun run test:match test/unit/Garden.t.sol");
  assert.deepEqual(contractsTest.focusedPaths, ["test/unit/Garden.t.sol"]);
});

test("multiple focused Solidity tests invoke the contracts wrapper once per path", () => {
  const plan = selectValidation({
    intent: "qa",
    changedPaths: [
      "packages/contracts/test/unit/Action.t.sol",
      "packages/contracts/test/unit/Garden.t.sol",
    ],
  });

  const contractsTest = plan.checks.find((check) => check.id === "contracts-test");
  assert.equal(
    contractsTest.command,
    "bun run test:match test/unit/Action.t.sol && bun run test:match test/unit/Garden.t.sol",
  );
  assert.deepEqual(contractsTest.focusedPaths, [
    "test/unit/Action.t.sol",
    "test/unit/Garden.t.sol",
  ]);
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
    "ontology",
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
    checkpointScope: "lane",
    changedPaths: ["docs/README.md"],
  });

  assert.equal(plan.requestedCheckpointScope, "lane");
  assert.equal(plan.checkpointScope, "workspace");
  assert.equal(plan.checks.find((check) => check.id === "format").command, "bun format");

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

test("strict intents preserve owning surface gates for test-only changes", () => {
  for (const [changedPath, surface] of [
    ["packages/admin/src/__tests__/components/CanvasLayout.test.tsx", "admin"],
    ["packages/shared/src/__tests__/components/FormWizard.test.tsx", "shared"],
  ]) {
    for (const intent of ["readiness", "push", "ship", "merge", "release"]) {
      const plan = selectValidation({
        intent,
        ci: intent === "merge",
        changedPaths: [changedPath],
      });

      for (const checkId of [`${surface}-test-typecheck`, `${surface}-test`, `${surface}-build`]) {
        assert.ok(ids(plan).includes(checkId), `${intent} must include ${checkId}`);
      }
      const packageTest = plan.checks.find((check) => check.id === `${surface}-test`);
      assert.equal(
        packageTest.command,
        "bun run test",
        `${intent} must run the full ${surface} suite`,
      );
      assert.deepEqual(
        packageTest.focusedPaths,
        [],
        `${intent} must not retain focused test paths`,
      );
    }
  }
});

test("lane checkpoint scope cannot downgrade push, ship, or release", () => {
  for (const intent of ["push", "ship", "release"]) {
    const plan = selectValidation({
      intent,
      checkpointScope: "lane",
      changedPaths: ["packages/client/src/components/Panel.tsx"],
    });

    assert.equal(plan.requestedCheckpointScope, "lane", intent);
    assert.equal(plan.checkpointScope, "workspace", intent);
    assert.equal(plan.checks.find((check) => check.id === "format").command, "bun format", intent);
    assert.ok(plan.checks.every((check) => check.mandatory), intent);
    assert.ok(ids(plan).includes("contracts-verify-fast"), intent);
    assert.ok(ids(plan).includes("docs-build"), intent);
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

test("deleted tests are not inferred as focused Vitest paths", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "validation-deleted-test-selector-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd: directory, stdio: "ignore" });
  git("init");
  git("config", "user.email", "validation@example.com");
  git("config", "user.name", "Validation Test");
  git("config", "commit.gpgsign", "false");
  const testDirectory = join(directory, "packages/shared/src/__tests__");
  const testPath = join(testDirectory, "removed.test.ts");
  mkdirSync(testDirectory, { recursive: true });
  writeFileSync(testPath, "export {};\n");
  git("add", ".");
  git("commit", "-m", "test: seed deleted fixture");

  rmSync(testPath);
  const gitInputs = resolveGitInputs(
    { changedPaths: [], base: "HEAD", head: "HEAD" },
    { cwd: directory },
  );
  assert.deepEqual(gitInputs.deletedPaths, [
    "packages/shared/src/__tests__/removed.test.ts",
  ]);

  const plan = selectValidation({ intent: "checkpoint", ...gitInputs });
  const sharedTest = plan.checks.find((check) => check.id === "shared-test");
  assert.deepEqual(sharedTest.focusedPaths, []);
  assert.equal(sharedTest.command, "bun run test");
});

test("lane fingerprint ignores an unrelated dirty plan while workspace fingerprint remains broad", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "validation-lane-selector-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd: directory, stdio: "ignore" });
  git("init");
  git("config", "user.email", "validation@example.com");
  git("config", "user.name", "Validation Test");
  git("config", "commit.gpgsign", "false");
  mkdirSync(join(directory, "packages/client/src"), { recursive: true });
  mkdirSync(join(directory, ".plans/active/unrelated"), { recursive: true });
  const sourcePath = join(directory, "packages/client/src/app.ts");
  const planPath = join(directory, ".plans/active/unrelated/plan.todo.md");
  writeFileSync(sourcePath, "export const value = 1;\n");
  writeFileSync(planPath, "# Baseline plan\n");
  git("add", ".");
  git("commit", "-m", "test: seed lane fixture");

  writeFileSync(sourcePath, "export const value = 2;\n");
  writeFileSync(planPath, "# Unrelated dirty plan\n");
  const options = {
    base: "HEAD",
    head: "HEAD",
    checkpointScope: "lane",
    changedPaths: ["packages/client/src/app.ts"],
  };
  const lane = resolveGitInputs(options, { cwd: directory });
  assert.deepEqual(lane.changedPaths, ["packages/client/src/app.ts"]);

  writeFileSync(planPath, "# Unrelated dirty plan changed again\n");
  const laneAfterPlanChange = resolveGitInputs(options, { cwd: directory });
  assert.equal(laneAfterPlanChange.workingCopyFingerprint, lane.workingCopyFingerprint);

  const workspace = resolveGitInputs(
    { ...options, checkpointScope: "workspace" },
    { cwd: directory },
  );
  writeFileSync(planPath, "# Third unrelated plan change\n");
  const workspaceAfterPlanChange = resolveGitInputs(
    { ...options, checkpointScope: "workspace" },
    { cwd: directory },
  );
  assert.notEqual(
    workspaceAfterPlanChange.workingCopyFingerprint,
    workspace.workingCopyFingerprint,
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

test("local ontology routing stays in parity with the Ontology workflow matcher", () => {
  const policy = loadPolicy();
  const localRule = policy.conditionalRules.find((rule) => rule.check === "ontology");
  assert.ok(localRule, "missing local ontology validation rule");

  const { check: _check, ...localMatcher } = localRule;
  assert.deepEqual(localMatcher, policy.workflowRules.Ontology);

  const probes = [
    ...localMatcher.exact,
    ...localMatcher.prefixes.map((prefix) => `${prefix}__ontology_probe__.ts`),
  ];
  for (const changedPath of probes) {
    const plan = selectValidation({ intent: "qa", changedPaths: [changedPath] });
    assert.ok(ids(plan).includes("ontology"), changedPath);
  }
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
      ["Design", "Shared", "Supply Chain Guardrails"],
    ],
    ["scripts/data/design-token-usage-baseline.tsv", ["Design"]],
    ["scripts/quality/check-story-quality.ts", ["Design", "Supply Chain Guardrails"]],
    ["vercel.json", ["Design", "Supply Chain Guardrails"]],
    ["packages/contracts/config/schemas.json", ["Contracts", "Ontology", "Supply Chain Guardrails"]],
    ["packages/client/src/views/Home/Garden/Assessment.tsx", ["Client", "Design", "Ontology", "Supply Chain Guardrails"]],
    ["packages/indexer/schema.graphql", ["Indexer", "Ontology"]],
    [
      "packages/indexer/src/handlers/commitment-pool-claims.ts",
      ["Indexer", "Ontology", "Supply Chain Guardrails"],
    ],
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
