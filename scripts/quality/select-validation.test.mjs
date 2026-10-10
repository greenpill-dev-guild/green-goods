import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { clearRepositoryLocalGitVariables, fixtureGitEnvironment } from "../lib/dev-shared.js";
import {
  detectCliCapabilities,
  buildReceiptInputs,
  detectCliToolchain,
  loadPolicy,
  resolveComparisonBase,
  resolveGitInputs,
  selectExpectedWorkflows,
  selectValidation,
  SHARED_CRITICAL_RULE_ID,
} from "./select-validation.mjs";
import { analyzeSharedMutationSurface, mutationPathsAmong } from "./shared-mutation-surface.mjs";

function ids(plan) {
  return plan.checks.map((check) => check.id);
}

function turboTestCommand(surface, intent = "push") {
  const binary = surface === "docs" ? "../node_modules/.bin/turbo" : "../../node_modules/.bin/turbo";
  // The strict gates skip Turbo's cache, so a package suite there always runs.
  const force = ["readiness", "ship", "merge"].includes(intent) ? " --force" : "";
  return `node ${binary} run test --filter=@green-goods/${surface} --output-logs=new-only${force}`;
}

test("hook and doctor edits select their behavioral proof", () => {
  const cases = [
    ["review-guardrails-test", [
      ".claude/scripts/task-completion-gate.sh", ".claude/scripts/teammate-idle-gate.sh",
      ".codex/hooks/pre_tool_policy.sh", ".claude/settings.json", ".codex/hooks.json",
      "scripts/harness/command-policy.mjs", "scripts/harness/agent-hooks.test.mjs",
    ]],
    ["validation-system-test", [
      "scripts/dev/doctor.js", "scripts/lib/dev-shared.js", "scripts/dev/package-commands.mjs",
      "scripts/dev/package-commands.test.mjs", "scripts/dev/test-lease.mjs", "turbo.json",
      // Each implementation file behind a validation-system-test suite selects that suite.
      "scripts/data/validation-policy.json", "scripts/quality/select-validation.mjs",
      "scripts/quality/shared-mutation-surface.mjs", "scripts/dev/ci-local.js",
      "scripts/quality/ci-gate.mjs", "scripts/quality/check-source-structure.js",
      "scripts/quality/check-staged-modules.mjs", "scripts/quality/check-commit-identity.mjs",
      "scripts/dev/surface-leases.mjs", "scripts/dev/stack.js", "scripts/dev/smoke-full.js",
      "scripts/lib/dev-modes.mjs", "scripts/lib/setup-env.mjs", "scripts/lib/command-runner.mjs",
      "scripts/dev/test.js", "scripts/dev/test-e2e.js", "scripts/dev/browser.js",
      "scripts/lib/vitest-shared-graph.mjs", "scripts/quality/check-shared-graph-tests.mjs",
      "scripts/quality/check-small-test-files.mjs", "scripts/quality/check-test-utils-barrel.mjs",
    ]],
  ];
  for (const intent of ["qa", "review", "push"]) {
    for (const [checkId, paths] of cases) {
      for (const changedPath of paths) {
        const plan = selectValidation({ intent, changedPaths: [changedPath] });
        assert.ok(ids(plan).includes(checkId), `${intent}: ${changedPath}`);
      }
    }
  }
  // The Shared Vitest config reads this helper to decide which tests share a module graph. Review
  // selects no package suite, so the Shared suite runs for it in qa and push.
  for (const intent of ["qa", "push"]) {
    const plan = selectValidation({ intent, changedPaths: ["scripts/lib/vitest-shared-graph.mjs"] });
    assert.ok(ids(plan).includes("shared-test"), `${intent}: scripts/lib/vitest-shared-graph.mjs`);
  }
  // shared.yml runs for it too, so CI Gate must expect that workflow.
  assert.deepEqual(
    selectExpectedWorkflows({ changedPaths: ["scripts/lib/vitest-shared-graph.mjs"], intent: "merge", ci: true }),
    ["Shared", "Supply Chain Guardrails"],
  );
});

// A hook's GIT_DIR outranks `cwd`, so without this the selector under test reads the repository
// being pushed instead of the fixture a test just built.
clearRepositoryLocalGitVariables();

function fixtureGit(directory) {
  const env = fixtureGitEnvironment();
  return (...args) => execFileSync("git", args, { cwd: directory, env, stdio: "ignore" });
}

test("the durable Bun caller re-enters the selector under real Node", () => {
  const packageJson = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  );

  assert.equal(
    packageJson.scripts.check,
    "node scripts/dev/ci-local.js",
  );
});

test("CLI help describes strict path scope and full-scope fallbacks", () => {
  const output = execFileSync(
    process.execPath,
    [fileURLToPath(new URL("./select-validation.mjs", import.meta.url)), "--help"],
    { encoding: "utf8" },
  );

  assert.match(output, /readiness and release always cover the full repository/i);
  assert.match(output, /Push uses the live PR base/i);
  assert.match(output, /empty push is a no-op/i);
  assert.match(output, /Ship and local merge use\nchanged-path scope/i);
  assert.match(output, /CI-authoritative\s+merge remains changed-path scoped/i);
});

test("docs-only QA stays on the docs surface", () => {
  const plan = selectValidation({
    intent: "qa",
    changedPaths: ["docs/docs/builders/getting-started.mdx"],
  });

  assert.equal(plan.status, "ready");
  assert.deepEqual(ids(plan), ["format", "docs-authority", "docs-build"]);
  assert.equal(
    plan.checks[0].command,
    "bunx @biomejs/biome format --no-errors-on-unmatched 'docs/docs/builders/getting-started.mdx'",
  );
  assert.equal(plan.budget.withinTarget, true);
});

test("skill and documented skill-inventory changes select direct guidance contracts", () => {
  for (const changedPath of [
    ".claude/skills/module-seams-review/SKILL.md",
    "scripts/quality/check-skill-behavior-contracts.mjs",
    "AGENTS.md",
  ]) {
    const plan = selectValidation({ intent: "qa", changedPaths: [changedPath] });
    const guidance = plan.checks.find((check) => check.id === "agent-guidance");

    assert.ok(guidance, changedPath);
    assert.equal(
      guidance.command,
      "node scripts/quality/check-codex-docs.js && node scripts/quality/check-skill-behavior-contracts.mjs && node scripts/quality/check-guidance-links.mjs",
    );
    assert.ok(guidance.selectedBy.includes("conditional:agent-guidance"), changedPath);
  }
});

test("agent-tool changes select their direct tests for QA and review", () => {
  for (const intent of ["qa", "review"]) {
    const plan = selectValidation({
      intent,
      changedPaths: ["scripts/agents/qa-workbook-build.ts"],
    });

    const agentTools = plan.checks.find((check) => check.id === "agent-tools-test");
    assert.ok(agentTools, intent);
    assert.equal(agentTools.command, "bun --bun x vitest run --dir scripts/agents");
    assert.ok(agentTools.selectedBy.includes("conditional:agent-tools-test"), intent);
  }
});

test("architecture evidence reviews select only the three safe guidance checks", () => {
  const probes = [
    ".claude/skills/plan/SKILL.md",
    ".claude/skills/review/SKILL.md",
    ".claude/skills/audit/SKILL.md",
    ".claude/skills/module-seams-review/SKILL.md",
    ".claude/context/codebase-architecture.md",
    "scripts/data/module-seam-registry.json",
    "scripts/quality/check-direct-tested-seams.mjs",
  ];

  for (const changedPath of probes) {
    const plan = selectValidation({ intent: "review", changedPaths: [changedPath] });
    assert.deepEqual(
      [...ids(plan)].sort(),
      ["agent-guidance", "test-quality", "validation-system-test"],
      changedPath,
    );
    assert.deepEqual(plan.surfaces, [], changedPath);
  }
});

test("architecture ship intent retains mandatory repository gates", () => {
  const plan = selectValidation({
    intent: "ship",
    changedPaths: [
      ".claude/context/codebase-architecture.md",
      "scripts/data/module-seam-registry.json",
      "scripts/quality/check-direct-tested-seams.mjs",
    ],
  });

  for (const checkId of [
    "format",
    "lint",
    "agent-guidance",
    "test-quality",
    "validation-system-test",
    "supply-chain",
  ]) {
    const check = plan.checks.find((candidate) => candidate.id === checkId);
    assert.ok(check, checkId);
    assert.equal(check.mandatory, true, checkId);
  }
});

// Regression: Biome exits non-zero when it handles none of the supplied paths.
// A Markdown-, Solidity-, or YAML-only change is exactly that case, so without
// the flag the scoped format check failed and fail-fast killed the whole plan
// on the most common lightweight edit in this repository.
test("scoped format tolerates paths Biome does not handle", () => {
  for (const changedPath of [
    "docs/docs/reference/glossary.generated.mdx",
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
    ["Admin", "Client", "Docs", "Supply Chain Guardrails"],
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

test("client changes select the staged Card Endow boundary", () => {
  const plan = selectValidation({
    intent: "qa",
    changedPaths: ["packages/client/src/views/Public/Vaults.tsx"],
  });

  assert.ok(ids(plan).includes("staged-modules"));
});

test("recognized root tests select their durable acceptance commands", () => {
  for (const [changedPath, checkId, command] of [
    ["scripts/lib/env-schema.test.mjs", "env-schema-test", "node scripts/dev/node-cli.js node --test scripts/lib/env-schema.test.mjs"],
    [
      "scripts/lib/dev-shared.test.mjs",
      "validation-system-test",
      loadPolicy().checks.find((check) => check.id === "validation-system-test").command,
    ],
    [
      "scripts/quality/select-validation.test.mjs",
      "validation-system-test",
      loadPolicy().checks.find((check) => check.id === "validation-system-test").command,
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
  assert.equal(plan.checks.find((check) => check.id === "format").command, "bunx @biomejs/biome format .");
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
  // Evidence intents select only the direct suite for the changed tooling, nothing broader.
  assert.deepEqual(ids(plan), ["validation-system-test"]);
});

test("work inspection adds qualified browser proof without forcing a package build", () => {
  const plan = selectValidation({
    intent: "qa",
    changedPaths: ["packages/client/src/views/Home/Garden/Work.tsx"],
    testPaths: { client: ["src/views/Home/Garden/Work.test.tsx"] },
  });

  assert.deepEqual(ids(plan), [
    "format",
    "lint",
    "client-test",
    "staged-modules",
    "ontology",
    "browser-work-exploration",
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
  // The qualified browser journey adds a measured cost; QA warns without dropping proof.
  assert.equal(plan.budget.withinTarget, false);
  assert.ok(plan.budget.estimatedWallSeconds > plan.budget.targetSeconds);
  assert.equal(plan.budget.rule, "Budgets warn and profile; they never skip selected or mandatory checks.");
  assert.equal(plan.checks.at(-1).state, "pending");
});

test("QA app UI changes require rendered browser proof for readiness", () => {
  const plan = selectValidation({
    intent: "readiness",
    changedPaths: ["packages/qa/index.html"],
  });
  const browserProof = plan.checks.find((check) => check.id === "browser-proof");

  assert.ok(browserProof);
  assert.ok(browserProof.selectedBy.includes("conditional:browser-proof"));
  assert.equal(browserProof.manual, true);
  assert.equal(plan.budget.manualSeconds, 90);
});

test("browser proof is advisory in every intent and never blocks a plan", () => {
  const changedPath = "packages/client/src/routes/SessionGate.tsx";
  const input = {
    changedPaths: [changedPath],
    testPaths: { client: ["src/__tests__/routes/SessionGate.test.tsx"] },
    environment: { capabilities: { dependencies: true, authenticatedBrave: false } },
  };
  const push = selectValidation({ intent: "push", ...input });
  const browserProof = push.checks.find((check) => check.id === "browser-proof");

  assert.equal(push.status, "ready");
  assert.equal(browserProof?.state, "advisory");
  assert.equal(browserProof?.advisory, true);
  assert.deepEqual(browserProof?.blockedBy, ["authenticatedBrave"]);
  assert.equal(browserProof?.mandatory, true);
  assert.ok(browserProof?.selectedBy.includes("conditional:browser-proof"));

  const missingAutomatedCapability = selectValidation({
    intent: "push",
    ...input,
    environment: { capabilities: { dependencies: false, authenticatedBrave: false } },
  });
  assert.equal(missingAutomatedCapability.status, "blocked");
  assert.equal(missingAutomatedCapability.checks.find((check) => check.id === "format")?.state, "blocked");
  assert.equal(
    missingAutomatedCapability.checks.find((check) => check.id === "browser-proof")?.state,
    "advisory",
  );

  for (const intent of ["readiness", "ship", "merge", "release"]) {
    const strict = selectValidation({ intent, ...input });
    assert.equal(strict.status, "ready", intent);
    assert.equal(strict.checks.find((check) => check.id === "browser-proof")?.state, "advisory", intent);
  }

  const ciPush = selectValidation({ intent: "push", ci: true, ...input });
  assert.equal(ciPush.status, "ready");
  assert.equal(ciPush.checks.find((check) => check.id === "browser-proof")?.advisory, true);

  const critical = selectValidation({
    intent: "push",
    ...input,
    changedPaths: [changedPath, "packages/shared/src/providers/Work.tsx"],
  });
  assert.equal(critical.risk, "critical");
  assert.equal(critical.status, "ready");
  assert.equal(critical.checks.find((check) => check.id === "browser-proof")?.advisory, true);

  const toolchainMismatch = selectValidation({
    intent: "push",
    ...input,
    environment: {
      toolchain: { node: "24.20.0" },
      capabilities: { dependencies: true, authenticatedBrave: false },
    },
  });
  assert.equal(toolchainMismatch.status, "blocked");
  assert.equal(toolchainMismatch.checks.find((check) => check.id === "format")?.state, "blocked");
  assert.equal(toolchainMismatch.checks.find((check) => check.id === "browser-proof")?.state, "advisory");
});

test("browser proof is selected for the authenticated surface class only", () => {
  for (const ordinaryUiPath of [
    "packages/client/src/components/Panel.tsx",
    "packages/client/src/views/Home/Garden/Work.tsx",
    "packages/client/src/index.css",
    "packages/admin/src/views/Garden/SubmitWork.tsx",
    "packages/shared/src/components/Button/Button.tsx",
  ]) {
    const plan = selectValidation({ intent: "readiness", changedPaths: [ordinaryUiPath] });
    assert.ok(
      !ids(plan).includes("browser-proof"),
      `${ordinaryUiPath} renders under mock auth or Storybook and must not select browser proof`,
    );
  }
  // One path per class named in AGENTS.md § Browser Evidence rule 2. A release that changes
  // any of these must attest the proof, so a gap here is a gap in the release gate.
  for (const authenticatedPath of [
    "packages/shared/src/providers/Auth.tsx",
    "packages/shared/src/modules/auth/session.ts",
    "packages/shared/src/modules/wallet/send-flow.ts",
    "packages/shared/src/modules/transactions/passkey-sender.ts",
    "packages/shared/src/modules/job-queue/index.ts",
    "packages/shared/src/modules/work/passkey-submission.ts",
    "packages/shared/src/modules/work/wallet-submission/submit-work.ts",
    "packages/shared/src/modules/offline-content/index.ts",
    "packages/shared/src/modules/profile-avatar/index.ts",
    "packages/shared/src/hooks/auth/index.ts",
    "packages/shared/src/hooks/offline/index.ts",
    "packages/shared/src/hooks/profile/index.ts",
    "packages/shared/src/hooks/app/useOffline.ts",
    "packages/shared/src/workflows/auth-passkey-adapters.ts",
    "packages/client/src/routes/WalletRuntimeProviders.tsx",
    "packages/client/src/sw/sw.ts",
    "packages/client/src/views/Login/Login.tsx",
    "packages/client/src/views/Profile/InstallCta.tsx",
    "packages/client/src/views/Home/WalletSheet/index.tsx",
    "packages/client/src/components/Pwa/sheetStyles.ts",
    "packages/client/src/config/pwaManifest.ts",
    "packages/client/src/PwaApp.tsx",
    "packages/client/src/bootstrapPwa.tsx",
    "packages/client/src/main.tsx",
    "packages/client/src/router.tsx",
    "packages/client/src/App.tsx",
  ]) {
    const plan = selectValidation({ intent: "readiness", changedPaths: [authenticatedPath] });
    const browserProof = plan.checks.find((check) => check.id === "browser-proof");
    assert.ok(browserProof, `${authenticatedPath} needs authenticated proof`);
    assert.ok(browserProof.selectedBy.includes("conditional:browser-proof"));
    assert.equal(browserProof.state, "advisory");
  }
  for (const validationOnlyPath of [
    "packages/client/src/__tests__/routes/SessionGate.test.tsx",
    "packages/shared/src/modules/work/__tests__/submit.test.ts",
    "packages/client/src/views/Profile/Profile.stories.tsx",
  ]) {
    const plan = selectValidation({ intent: "readiness", changedPaths: [validationOnlyPath] });
    assert.ok(!ids(plan).includes("browser-proof"), validationOnlyPath);
  }
});

test("a focused push plan runs even when its static estimate exceeds the budget", () => {
  const changedPaths = [
    "packages/client/src/components/Panel.tsx",
    "packages/shared/src/components/Button/Button.tsx",
    "packages/admin/src/components/AdminCard.tsx",
  ];
  const focused = selectValidation({
    intent: "push",
    changedPaths,
    testPaths: {
      client: ["src/components/Panel.test.tsx"],
      shared: ["src/components/Button/Button.test.tsx"],
      admin: ["src/components/AdminCard.test.tsx"],
    },
  });
  assert.equal(focused.budget.enforced, true);
  assert.ok(
    focused.budget.estimatedWallSeconds > focused.budget.hardLimitSeconds,
    "fixture must exceed the routine limit",
  );
  assert.equal(focused.status, "ready");
  assert.equal(focused.stopReason, null);

  const unfocused = selectValidation({
    intent: "push",
    changedPaths,
    testPaths: {
      client: ["src/components/Panel.test.tsx"],
      admin: ["src/components/AdminCard.test.tsx"],
    },
    checkIds: ["shared-test"],
  });
  assert.ok(unfocused.budget.estimatedWallSeconds > unfocused.budget.hardLimitSeconds);
  assert.equal(unfocused.status, "needs-focus");
  assert.equal(unfocused.stopReason, "local-budget-exceeded");
});

test("QA locale changes require catalog tests and rendered browser proof", () => {
  for (const locale of ["en", "es", "pt"]) {
    const plan = selectValidation({
      intent: "merge",
      ci: true,
      changedPaths: [`packages/qa/locales/${locale}.json`],
    });
    const browserProof = plan.checks.find((check) => check.id === "browser-proof");
    const agentTools = plan.checks.find((check) => check.id === "agent-tools-test");

    assert.ok(browserProof, `${locale} must select browser proof`);
    assert.ok(agentTools, `${locale} must select QA catalog tests`);
    assert.ok(browserProof.selectedBy.includes("conditional:browser-proof"));
    assert.ok(agentTools.selectedBy.includes("conditional:agent-tools-test"));
  }
});

test("QA catalog changes require catalog tests and rendered browser proof", () => {
  const plan = selectValidation({
    intent: "merge",
    ci: true,
    changedPaths: ["scripts/data/qa-test-catalog.json"],
  });
  const browserProof = plan.checks.find((check) => check.id === "browser-proof");
  const agentTools = plan.checks.find((check) => check.id === "agent-tools-test");

  assert.ok(browserProof, "the catalog must select browser proof");
  assert.ok(agentTools, "the catalog must select QA catalog tests");
  assert.ok(browserProof.selectedBy.includes("conditional:browser-proof"));
  assert.ok(agentTools.selectedBy.includes("conditional:agent-tools-test"));
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

test("routine push uses focused owner proof inside the hard 90-second limit", () => {
  const changedPath = "packages/shared/src/utils/calendar-date.ts";
  const plan = selectValidation({
    intent: "push",
    changedPaths: [changedPath],
    testPaths: { shared: ["src/__tests__/utils/calendar-date.test.ts"] },
  });

  assert.equal(plan.status, "ready");
  assert.deepEqual(ids(plan), ["format", "lint", "shared-test", "docs-authority", "source-structure"]);
  assert.equal(
    plan.checks.find((check) => check.id === "format").command,
    `bunx @biomejs/biome format --no-errors-on-unmatched '${changedPath}'`,
  );
  assert.equal(
    plan.checks.find((check) => check.id === "lint").command,
    `bun --bun run oxlint '${changedPath}' --deny-warnings`,
  );
  assert.equal(
    plan.checks.find((check) => check.id === "shared-test").command,
    "bun run test src/__tests__/utils/calendar-date.test.ts",
  );
  assert.equal(plan.budget.hardLimitSeconds, 90);
  assert.equal(plan.budget.enforced, true);
  assert.ok(plan.budget.estimatedWallSeconds <= 90);
  for (const broadCheck of [
    "shared-typecheck",
    "shared-build",
    "client-test",
    "admin-test",
    "agent-test",
    "ontology",
  ]) {
    assert.ok(!ids(plan).includes(broadCheck), broadCheck);
  }
});

test("push judges source structure against the plan's comparison base", () => {
  const plan = selectValidation({
    intent: "push",
    base: "base-sha",
    changedPaths: ["packages/shared/src/utils/calendar-date.ts"],
    testPaths: { shared: ["src/__tests__/utils/calendar-date.test.ts"] },
  });

  assert.equal(
    plan.checks.find((check) => check.id === "source-structure").command,
    "node scripts/quality/check-source-structure.js --base 'base-sha'",
  );
});

test("routine push without focused behavior proof stops before execution", () => {
  const plan = selectValidation({
    intent: "push",
    changedPaths: ["packages/shared/src/utils/calendar-date.ts"],
  });

  assert.equal(plan.status, "needs-focus");
  assert.equal(plan.stopReason, "focused-proof-required");
  assert.equal(plan.budget.hardLimitSeconds, 90);
  assert.match(plan.remediation, /--test-path shared:/);
});

test("sensitive push uses the hard 180-second limit when direct proof is present", () => {
  const plan = selectValidation({
    intent: "push",
    changedPaths: ["scripts/dev/ci-local.js", "scripts/dev/ci-local.test.mjs"],
  });

  assert.equal(plan.risk, "sensitive");
  assert.equal(plan.status, "ready");
  assert.equal(plan.budget.hardLimitSeconds, 180);
  assert.equal(plan.budget.enforced, true);
  assert.ok(ids(plan).includes("validation-system-test"));
});

test("critical push keeps mandatory checks uncapped", () => {
  const plan = selectValidation({
    intent: "push",
    changedPaths: ["packages/shared/src/hooks/work/useWorkMutation.ts"],
    testPaths: { shared: ["src/hooks/work/useWorkMutation.test.ts"] },
  });

  assert.equal(plan.risk, "critical");
  assert.equal(plan.status, "ready");
  assert.equal(plan.budget.hardLimitSeconds, null);
  assert.equal(plan.budget.enforced, false);
  // A rerun of the same critical push may reuse exact passes; the strict gates never do.
  assert.equal(plan.receiptPolicy.reuseAllowed, true);
  for (const checkId of [
    "shared-typecheck",
    "shared-test",
    "client-test",
    "admin-test",
    "agent-test",
  ]) {
    assert.equal(plan.checks.find((check) => check.id === checkId)?.mandatory, true, checkId);
  }
});

test("narrow Shared utilities keep consumer CI but skip unrelated Design and Ontology", () => {
  assert.deepEqual(
    selectExpectedWorkflows({
      changedPaths: ["packages/shared/src/utils/calendar-date.ts"],
      intent: "merge",
      ci: true,
    }),
    ["Admin", "Agent", "Client", "Shared", "Supply Chain Guardrails"],
  );
});

test("Design and Ontology CI retain their owning Shared paths", () => {
  const componentWorkflows = selectExpectedWorkflows({
    changedPaths: ["packages/shared/src/components/Button/Button.tsx"],
    intent: "merge",
    ci: true,
  });
  assert.ok(componentWorkflows.includes("Design"));
  assert.ok(!componentWorkflows.includes("Ontology"));

  const ontologyWorkflows = selectExpectedWorkflows({
    changedPaths: ["packages/shared/src/ontology/green-goods-ontology.json"],
    intent: "merge",
    ci: true,
  });
  assert.ok(ontologyWorkflows.includes("Ontology"));
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
  ]);
  assert.ok(plan.checks.filter((check) => check.mandatory).length >= 3);
});

test("focused Solidity tests use the contracts match-path wrapper", () => {
  const plan = selectValidation({
    intent: "qa",
    changedPaths: ["packages/contracts/test/unit/Garden.t.sol"],
  });

  const contractsTest = plan.checks.find((check) => check.id === "contracts-test");
  assert.equal(contractsTest.command, "bun run test --suite solidity --profile match test/unit/Garden.t.sol");
  assert.deepEqual(contractsTest.focusedPaths, ["test/unit/Garden.t.sol"]);
});

test("focused indexer proof selects the handler scope accepted by its package wrapper", () => {
  const plan = selectValidation({
    intent: "push",
    changedPaths: ["packages/indexer/test/hypercerts.test.ts"],
  });
  const check = plan.checks.find((candidate) => candidate.id === "indexer-test");
  assert.equal(check?.command, "bun run test --scope handlers test/hypercerts.test.ts");
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
    "bun run test --suite solidity --profile match test/unit/Action.t.sol && bun run test --suite solidity --profile match test/unit/Garden.t.sol",
  );
  assert.deepEqual(contractsTest.focusedPaths, [
    "test/unit/Action.t.sol",
    "test/unit/Garden.t.sol",
  ]);
});

test("mutation-rich shared hooks retain the critical override", () => {
  for (const changedPath of [
    "packages/shared/src/hooks/garden/useCreateGardenWorkflow.ts",
    "packages/shared/src/hooks/assessment/useCreateAssessmentWorkflow.ts",
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
  ]);
  for (const surface of ["shared", "client", "admin", "agent"]) {
    assert.equal(
      plan.checks.find((check) => check.id === `${surface}-test`)?.command,
      turboTestCommand(surface),
      surface,
    );
  }
});

test("declared shared subpath barrels classify as public source", () => {
  const changedPath = "packages/shared/src/commitment-pooling/index.ts";
  const plan = selectValidation({
    intent: "checkpoint",
    changedPaths: [changedPath],
  });

  assert.deepEqual(plan.changes, [
    {
      path: changedPath,
      kind: "public-source",
      surface: "shared",
    },
  ]);
});

test("eligible local package tests route through Turbo with package-relative binaries", () => {
  for (const [intent, changedPaths, expectedSurfaces] of [
    ["checkpoint", ["packages/client/src/components/Panel.tsx"], ["client"]],
    ["readiness", ["docs/README.md"], ["shared", "client", "admin", "agent", "indexer", "docs"]],
    ["ship", ["packages/agent/src/index.ts"], ["agent"]],
    ["merge", ["packages/indexer/src/EventHandlers.ts"], ["indexer"]],
  ]) {
    const plan = selectValidation({ intent, changedPaths });
    for (const surface of expectedSurfaces) {
      assert.equal(
        plan.checks.find((check) => check.id === `${surface}-test`)?.command,
        turboTestCommand(surface, intent),
        `${intent}:${surface}`,
      );
    }
    assert.equal(
      plan.checks.find((check) => check.id === "contracts-test")?.command,
      intent === "readiness" ? "bun run test" : undefined,
      `${intent}:contracts`,
    );
  }
});

test("focused, CI, and release package tests keep their package scripts", () => {
  const focused = selectValidation({
    intent: "checkpoint",
    changedPaths: ["packages/client/src/components/Panel.tsx"],
    testPaths: { client: ["src/components/Panel.test.tsx"] },
  });
  assert.equal(
    focused.checks.find((check) => check.id === "client-test")?.command,
    "bun run test src/components/Panel.test.tsx",
  );

  const ci = selectValidation({
    intent: "merge",
    ci: true,
    changedPaths: ["packages/admin/src/views/Garden/SubmitWork.tsx"],
  });
  assert.equal(ci.checks.find((check) => check.id === "admin-test")?.command, "bun run test");

  const release = selectValidation({ intent: "release", changedPaths: ["docs/README.md"] });
  for (const surface of ["shared", "client", "admin", "agent", "indexer", "contracts", "docs"]) {
    assert.equal(
      release.checks.find((check) => check.id === `${surface}-test`)?.command,
      "bun run test",
      surface,
    );
  }
});

test("Turbo consumer inputs ignore shared specs without hiding shared test utilities", () => {
  const turbo = JSON.parse(readFileSync(new URL("../../turbo.json", import.meta.url), "utf8"));
  const sharedInputs = turbo.tasks["@green-goods/shared#test"].inputs;
  assert.ok(!sharedInputs.includes("../contracts/.generated/**"));
  assert.ok(sharedInputs.includes("../client/src/**"));
  assert.ok(sharedInputs.includes("../admin/src/**"));

  for (const surface of ["shared", "client", "admin", "agent", "indexer"]) {
    const inputs = turbo.tasks[`@green-goods/${surface}#test`].inputs;
    assert.ok(inputs.includes("../../scripts/dev/node-cli.js"), `${surface}:node-cli`);
    assert.ok(inputs.includes("../../scripts/lib/dev-shared.js"), `${surface}:dev-shared`);
  }

  for (const surface of ["client", "admin", "agent"]) {
    const inputs = turbo.tasks[`@green-goods/${surface}#test`].inputs;
    assert.ok(inputs.includes("../shared/src/**"), surface);
    assert.ok(inputs.includes("!../shared/src/**/*.test.*"), surface);
    assert.ok(inputs.includes("!../shared/src/**/*.spec.*"), surface);
    assert.ok(inputs.includes("!../shared/src/**/*.stories.*"), surface);
    assert.ok(
      inputs.every(
        (input) =>
          !input.startsWith("!") ||
          !["__tests__", "__mocks__", "setupTests", "/testing/"].some((segment) =>
            input.includes(segment),
          ),
      ),
      `${surface} must not exclude shared test utilities by directory or setup name`,
    );
  }
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
      changedPaths: ["packages/shared/src/hooks/garden/useCreateGardenWorkflow.ts"],
      testPaths: { shared: ["src/hooks/garden/useCreateGardenWorkflow.test.ts"] },
    });
    assert.equal(requested.risk, "critical");
    assert.deepEqual(ids(requested), ["shared-test"]);
    assert.equal(
      requested.checks[0].command,
      "bun run test src/hooks/garden/useCreateGardenWorkflow.test.ts",
    );
  }
});

test("missing required environment capability is explicitly blocked", () => {
  const plan = selectValidation({
    intent: "qa",
    changedPaths: ["packages/contracts/src/Garden.sol"],
    environment: {
      capabilities: { dependencies: true, foundry: true, contractSubmodules: false },
    },
  });

  assert.equal(plan.status, "blocked");
  const blocked = plan.checks.filter((check) => check.state === "blocked");
  assert.ok(blocked.length > 0);
  assert.ok(blocked.every((check) => check.blockedBy.includes("contractSubmodules")));
});

test("CLI capability detection reports pinned submodule readiness", () => {
  const calls = [];
  const capabilities = detectCliCapabilities({
    cwd: "/workspace",
    inspectPinnedSubmodules(options) {
      calls.push(options);
      return { ready: false };
    },
  });

  assert.deepEqual(calls, [{ cwd: "/workspace" }]);
  assert.deepEqual(capabilities, { contractSubmodules: false, playwrightChromium: false });
});

test("conditional validation rules honor their declared intents", () => {
  const policy = structuredClone(loadPolicy());
  policy.conditionalRules.push({
    check: "indexer-test",
    exact: ["docs/strict-indexer-probe.md"],
    intents: ["ship"],
  });

  const checkpoint = selectValidation(
    { intent: "checkpoint", changedPaths: ["docs/strict-indexer-probe.md"] },
    { policy },
  );
  assert.ok(!ids(checkpoint).includes("indexer-test"));

  const ship = selectValidation(
    { intent: "ship", changedPaths: ["docs/strict-indexer-probe.md"] },
    { policy },
  );
  assert.ok(ids(ship).includes("indexer-test"));
});

test("strict indexer contract changes select the real event integration", () => {
  const probes = [
    "packages/indexer/config.yaml",
    "packages/indexer/schema.graphql",
    "packages/indexer/test/helpers/local-contract-events.ts",
    "packages/contracts/abis/SettlementModule.json",
    "packages/contracts/deployments/42161-latest.json",
    "packages/indexer/src/handlers/settlement.ts",
  ];

  for (const changedPath of probes) {
    for (const intent of ["ship", "merge", "readiness", "release"]) {
      const plan = selectValidation({ intent, changedPaths: [changedPath] });
      const integration = plan.checks.find((check) => check.id === "indexer-contract-events");
      assert.ok(integration, `${intent}: ${changedPath}`);
      assert.equal(integration.command, "bun run test --scope contract-events");
      assert.equal(integration.cwd, "packages/indexer");
      assert.equal(integration.budgetSeconds, 480);
      assert.deepEqual(integration.capabilities, [
        "dependencies",
        "indexerCodegen",
        "foundry",
        "contractSubmodules",
        "docker",
        "arbitrumFork",
      ]);
    }

    for (const intent of ["qa", "checkpoint"]) {
      const plan = selectValidation({ intent, changedPaths: [changedPath] });
      assert.ok(!ids(plan).includes("indexer-contract-events"), `${intent}: ${changedPath}`);
    }
  }
});

test("exact toolchain parity is enforced only for tools selected checks need", () => {
  const matching = selectValidation({
    intent: "qa",
    changedPaths: ["docs/docs/builders/getting-started.mdx"],
    environment: {
      profile: "local",
      toolchain: { node: "22.22.1", bun: "1.4.2" },
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
    { capability: "toolchain.bun", expected: "1.4.2", actual: "1.3.10" },
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

test("ship scopes docs-only work to the exact impacted strict surface", () => {
  const plan = selectValidation({
    intent: "ship",
    checkpointScope: "lane",
    changedPaths: ["docs/README.md"],
  });

  assert.equal(plan.requestedCheckpointScope, "lane");
  assert.equal(plan.checkpointScope, "workspace");
  assert.deepEqual(plan.surfaces, ["docs"]);
  assert.deepEqual(ids(plan), ["format", "lint", "docs-authority", "docs-test", "docs-build"]);
  assert.equal(
    plan.checks.find((check) => check.id === "format").command,
    "bunx @biomejs/biome format .",
  );
  assert.ok(plan.checks.every((check) => check.mandatory));
});

test("push requires focused client proof while ship retains the full local surface", () => {
  const changedPath = "packages/client/src/components/Panel.tsx";
  const push = selectValidation({
    intent: "push",
    checkpointScope: "lane",
    changedPaths: [changedPath],
  });
  assert.equal(push.status, "needs-focus");
  assert.deepEqual(ids(push), [
    "format",
    "lint",
    "docs-authority",
    "staged-modules",
    "source-structure",
  ]);

  const focusedPush = selectValidation({
    intent: "push",
    changedPaths: [changedPath],
    testPaths: { client: ["src/components/Panel.test.tsx"] },
  });
  assert.equal(focusedPush.status, "ready");
  assert.deepEqual(ids(focusedPush), [
    "format",
    "lint",
    "client-test",
    "docs-authority",
    "staged-modules",
    "source-structure",
  ]);

  const ship = selectValidation({
    intent: "ship",
    checkpointScope: "lane",
    changedPaths: [changedPath],
  });
  const shipExpected = [
    "format",
    "lint",
    "client-test-typecheck",
    "client-test",
    "client-build",
    "staged-modules",
    "source-structure",
    "design-guardrails",
  ];
  assert.deepEqual(ids(ship), shipExpected);
  assert.equal(
    ship.checks.find((check) => check.id === "format").command,
    "bunx @biomejs/biome format .",
  );
  assert.ok(ship.checks.every((check) => check.mandatory));
});

test("push keeps test-only proof focused while strict intents preserve owning gates", () => {
  for (const [changedPath, surface] of [
    ["packages/admin/src/__tests__/components/CanvasLayout.test.tsx", "admin"],
    ["packages/shared/src/__tests__/components/FormWizard.test.tsx", "shared"],
  ]) {
    const push = selectValidation({ intent: "push", changedPaths: [changedPath] });
    assert.deepEqual(ids(push), [
      "format",
      "lint",
      "test-quality",
      `${surface}-test`,
      "docs-authority",
    ]);
    assert.equal(
      push.checks.find((check) => check.id === `${surface}-test`)?.command,
      `bun run test ${changedPath.slice(`packages/${surface}/`.length)}`,
    );

    for (const intent of ["ship", "merge"]) {
      const plan = selectValidation({
        intent,
        changedPaths: [changedPath],
      });

      assert.deepEqual(ids(plan), [
        "format",
        "lint",
        ...(surface === "shared" ? ["shared-typecheck"] : []),
        `${surface}-test-typecheck`,
        `${surface}-test`,
        `${surface}-build`,
      ]);
      const packageTest = plan.checks.find((check) => check.id === `${surface}-test`);
      assert.equal(
        packageTest.command,
        turboTestCommand(surface, intent),
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

test("scoped admin ship selects exactly the accepted seven checks", () => {
  const plan = selectValidation({
    intent: "ship",
    changedPaths: ["packages/admin/src/views/Garden/SubmitWork.tsx"],
  });

  assert.deepEqual(plan.surfaces, ["admin"]);
  assert.deepEqual(ids(plan), [
    "format",
    "lint",
    "admin-test-typecheck",
    "admin-test",
    "admin-build",
    "source-structure",
    "design-guardrails",
  ]);
  assert.ok(plan.checks.every((check) => check.mandatory));
});

test("critical Work path packages/shared/src/modules/work/submit.ts retains its push override", () => {
  for (const changedPath of [
    "packages/shared/src/modules/work/submit.ts",
    "packages/shared/src/hooks/work/useWorkMutation.ts",
    "packages/shared/src/providers/Work.tsx",
  ]) {
    const plan = selectValidation({
      intent: "push",
      changedPaths: [changedPath],
    });

    assert.equal(plan.risk, "critical", changedPath);
    assert.deepEqual(plan.surfaces, ["shared", "client", "admin", "agent"], changedPath);
    // Providers shape the authenticated session and work submission is the offline upload
    // path, so both carry the advisory browser-proof reminder; the work hook does not.
    const advisoryProof = ["packages/shared/src/providers/", "packages/shared/src/modules/work/"].some(
      (prefix) => changedPath.startsWith(prefix),
    )
      ? ["browser-proof"]
      : [];
    // useWorkMutation is fingerprinted by a certified seam, so test-quality guards the registry.
    const seamProof = changedPath.endsWith("hooks/work/useWorkMutation.ts") ? ["test-quality"] : [];
    assert.deepEqual(
      ids(plan),
      [
        "format",
        "lint",
        ...seamProof,
        "shared-typecheck",
        "shared-test-typecheck",
        "shared-test",
        "shared-build",
        "client-test-typecheck",
        "client-test",
        "client-build",
        "admin-test-typecheck",
        "admin-test",
        "admin-build",
        "agent-typecheck",
        "agent-test-typecheck",
        "agent-test",
        "agent-build",
        "docs-authority",
        "source-structure",
        ...advisoryProof,
      ],
      changedPath,
    );
    for (const checkId of [
      "shared-typecheck",
      "shared-test",
      "client-test",
      "admin-test",
      "agent-test",
    ]) {
      assert.equal(
        plan.checks.find((check) => check.id === checkId)?.mandatory,
        true,
        `${changedPath}:${checkId}`,
      );
    }
    for (const surface of ["shared", "client", "admin", "agent"]) {
      assert.equal(
        plan.checks.find((check) => check.id === `${surface}-test`)?.command,
        turboTestCommand(surface),
        `${changedPath}:${surface}`,
      );
    }
    assert.ok(!ids(plan).includes("contracts-verify-fast"), changedPath);
  }
});

test("contract artifacts select contract strict checks and impacted consumers", () => {
  const plan = selectValidation({
    intent: "ship",
    changedPaths: ["packages/contracts/abis/GardenAccount.json"],
  });

  assert.deepEqual(plan.surfaces, ["contracts", "shared", "indexer", "client", "admin"]);
  assert.deepEqual(ids(plan), [
    "format",
    "lint",
    "abi-artifacts",
    "shared-typecheck",
    "shared-test-typecheck",
    "shared-test",
    "shared-build",
    "client-test-typecheck",
    "client-test",
    "client-build",
    "admin-test-typecheck",
    "admin-test",
    "admin-build",
    "indexer-test",
    "indexer-build",
    "indexer-contract-events",
    "contracts-build",
    "contracts-test",
    "contracts-verify-fast",
  ]);
  assert.ok(plan.checks.every((check) => check.mandatory));
  assert.equal(plan.checks.find((check) => check.id === "contracts-test").command, "bun run test");
});

test("local merge and merge --ci select identical checks while preserving CI package scripts", () => {
  const changedPaths = ["packages/admin/src/views/Garden/SubmitWork.tsx"];
  const local = selectValidation({ intent: "merge", changedPaths });
  const ci = selectValidation({ intent: "merge", ci: true, changedPaths });
  const emptyCi = selectValidation({ intent: "merge", ci: true, changedPaths: [] });
  const expected = [
    "format",
    "lint",
    "admin-test",
    "admin-build",
    "source-structure",
    "design-guardrails",
  ];

  assert.deepEqual(ids(local), expected);
  assert.deepEqual(ids(ci), expected);
  assert.deepEqual(ids(local), ids(ci));
  assert.equal(local.checks.find((check) => check.id === "format").command, "bunx @biomejs/biome format .");
  assert.equal(ci.checks.find((check) => check.id === "format").command, "bunx @biomejs/biome format .");
  assert.equal(
    local.checks.find((check) => check.id === "admin-test").command,
    turboTestCommand("admin", "merge"),
  );
  assert.equal(ci.checks.find((check) => check.id === "admin-test").command, "bun run test");
  assert.deepEqual(
    local.checks.filter((check) => !["format", "admin-test"].includes(check.id)),
    ci.checks.filter((check) => !["format", "admin-test"].includes(check.id)),
  );
  assert.ok(local.checks.every((check) => check.mandatory));
  assert.ok(ci.checks.every((check) => check.mandatory));
  assert.deepEqual(emptyCi.surfaces, []);
  assert.deepEqual(emptyCi.checks, []);
});

test("strict test typechecks follow only impacted typed surfaces", () => {
  for (const [changedPath, expected] of [
    ["packages/client/src/components/Panel.tsx", ["client-test-typecheck"]],
    ["packages/admin/src/views/Garden/SubmitWork.tsx", ["admin-test-typecheck"]],
    ["packages/agent/src/index.ts", ["agent-test-typecheck"]],
    ["docs/README.md", []],
  ]) {
    const plan = selectValidation({ intent: "ship", changedPaths: [changedPath] });
    assert.deepEqual(
      ids(plan).filter((id) => id.endsWith("-test-typecheck")),
      expected,
      changedPath,
    );
  }
});

test("readiness and release remain full scope while empty ship falls back to full scope", () => {
  const fullStrictChecks = [
    "format",
    "lint",
    "abi-artifacts",
    "shared-typecheck",
    "shared-test-typecheck",
    "shared-test",
    "shared-build",
    "client-test-typecheck",
    "client-test",
    "client-build",
    "admin-test-typecheck",
    "admin-test",
    "admin-build",
    "agent-typecheck",
    "agent-test-typecheck",
    "agent-test",
    "agent-build",
    "indexer-test",
    "indexer-build",
    "contracts-build",
    "contracts-test",
    "contracts-verify-fast",
    "docs-authority",
    "docs-test",
    "docs-build",
  ];
  const allSurfaceNames = [
    "contracts",
    "shared",
    "indexer",
    "client",
    "admin",
    "agent",
    "docs",
  ];

  for (const intent of ["readiness", "release"]) {
    const plan = selectValidation({ intent, changedPaths: ["docs/README.md"] });
    assert.deepEqual(plan.surfaces, allSurfaceNames, intent);
    assert.deepEqual(ids(plan), fullStrictChecks, intent);
    assert.ok(plan.checks.every((check) => check.mandatory), intent);
    for (const surface of ["shared", "client", "admin", "agent", "indexer", "contracts", "docs"]) {
      const expected =
        intent === "readiness" && surface !== "contracts"
          ? turboTestCommand(surface, intent)
          : "bun run test";
      assert.equal(
        plan.checks.find((check) => check.id === `${surface}-test`)?.command,
        expected,
        `${intent}:${surface}`,
      );
    }
  }

  const emptyPush = selectValidation({ intent: "push", changedPaths: [] });
  assert.deepEqual(emptyPush.surfaces, []);
  assert.deepEqual(emptyPush.checks, []);

  for (const intent of ["ship", "merge"]) {
    const plan = selectValidation({ intent, changedPaths: [] });
    assert.deepEqual(plan.surfaces, allSurfaceNames, intent);
    assert.deepEqual(ids(plan), fullStrictChecks, intent);
    assert.equal(
      plan.checks.find((check) => check.id === "format").command,
      "bunx @biomejs/biome format .",
      intent,
    );
    for (const surface of ["shared", "client", "admin", "agent", "indexer", "docs"]) {
      assert.equal(
        plan.checks.find((check) => check.id === `${surface}-test`)?.command,
        turboTestCommand(surface, intent),
        `${intent}:${surface}`,
      );
    }
    assert.equal(plan.checks.find((check) => check.id === "contracts-test")?.command, "bun run test");
    assert.ok(plan.checks.every((check) => check.mandatory), intent);
  }
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
      toolchain: { node: "22.22.1", bun: "1.4.2" },
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

test("receipt inputs fingerprint the materialized Turbo command", () => {
  const plan = selectValidation({
    intent: "checkpoint",
    base: "base-sha",
    head: "head-sha",
    changedPaths: ["packages/client/src/components/Panel.tsx"],
  });
  const clientTest = plan.checks.find((check) => check.id === "client-test");
  const receipt = buildReceiptInputs(plan, clientTest);

  assert.equal(receipt.command, turboTestCommand("client"));
  assert.match(receipt.fingerprint, /^[a-f0-9]{64}$/);
});

test("publication base resolution uses the live PR base and otherwise origin/develop", () => {
  const liveBase = resolveComparisonBase(
    { intent: "push" },
    {
      environment: {},
      execFileSync(command, args) {
        assert.equal(command, "gh");
        assert.deepEqual(args, [
          "pr",
          "view",
          "--json",
          "baseRefName,headRefName",
          "--jq",
          '"\\(.baseRefName)\\t\\(.headRefName)"',
        ]);
        return "release/1.4\tfeature/example\n";
      },
    },
  );
  assert.equal(liveBase, "origin/release/1.4");

  const fallback = resolveComparisonBase(
    { intent: "push" },
    {
      environment: {},
      execFileSync() {
        throw new Error("no live PR");
      },
    },
  );
  assert.equal(fallback, "origin/develop");
  assert.equal(
    resolveComparisonBase({ intent: "push" }, { environment: { GITHUB_BASE_REF: "staging" } }),
    "origin/staging",
  );

  // A develop-to-main promotion is judged against develop, in CI and through a live PR.
  assert.equal(
    resolveComparisonBase(
      { intent: "push" },
      { environment: { GITHUB_BASE_REF: "main", GITHUB_HEAD_REF: "release/october-2-0-0" } },
    ),
    "origin/develop",
  );
  assert.equal(
    resolveComparisonBase(
      { intent: "push" },
      { environment: { GITHUB_BASE_REF: "main", GITHUB_HEAD_REF: "fix/hotfix" } },
    ),
    "origin/main",
  );
  assert.equal(
    resolveComparisonBase(
      { intent: "release" },
      { environment: {}, execFileSync: () => "main\trelease/october-2-0-0\n" },
    ),
    "origin/develop",
  );
});

test("git inputs include dirty and untracked paths and fingerprint their content", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "validation-selector-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const git = fixtureGit(directory);
  git("init");
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

test("hook and readiness receipts expire when implementations or registrations change", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "hook-receipts-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const git = fixtureGit(directory);
  git("init");
  const paths = [
    ".claude/settings.json", ".codex/hooks.json", ".codex/hooks/pre_tool_policy.sh",
    ".claude/scripts/task-completion-gate.sh", ".claude/scripts/teammate-idle-gate.sh",
    "scripts/harness/command-policy.mjs", "scripts/harness/agent-hooks.test.mjs",
    "scripts/dev/doctor.js", "scripts/lib/dev-shared.js", "scripts/lib/dev-shared.test.mjs",
    "scripts/data/validation-policy.json",
  ];
  for (const file of paths) {
    mkdirSync(join(directory, file, ".."), { recursive: true });
    writeFileSync(join(directory, file), "initial\n");
  }
  git("add", ".");
  git("commit", "-m", "test: seed hook receipt fixture");
  const receipt = (checkId, file) => {
    const inputs = resolveGitInputs({ base: "HEAD", head: "HEAD", changedPaths: [file] }, { cwd: directory });
    const plan = selectValidation({ intent: "qa", ...inputs });
    return buildReceiptInputs(plan, plan.checks.find((check) => check.id === checkId)).fingerprint;
  };
  for (const [checkId, file] of [["review-guardrails-test", paths[0]], ["validation-system-test", "scripts/dev/doctor.js"]]) {
    for (const dependency of paths) {
      const before = receipt(checkId, file);
      writeFileSync(join(directory, dependency), `changed for ${checkId}\n`);
      assert.notEqual(receipt(checkId, file), before, dependency);
    }
  }
});

test("git inputs fingerprint committed patches larger than Node's default buffer", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "validation-large-diff-selector-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const git = fixtureGit(directory);
  git("init");
  mkdirSync(join(directory, "packages/client/src"), { recursive: true });
  const sourcePath = join(directory, "packages/client/src/large-fixture.ts");
  writeFileSync(sourcePath, "export const baseline = true;\n");
  git("add", ".");
  git("commit", "-m", "test: seed large diff fixture");

  writeFileSync(sourcePath, `export const payload = "${"x".repeat(1_100_000)}";\n`);
  git("add", ".");
  git("commit", "-m", "test: add large diff fixture");

  const inputs = resolveGitInputs(
    { changedPaths: [], base: "HEAD~1", head: "HEAD" },
    { cwd: directory },
  );
  assert.deepEqual(inputs.changedPaths, ["packages/client/src/large-fixture.ts"]);
  assert.match(inputs.workingCopyFingerprint, /^[a-f0-9]{64}$/);
});

test("deleted tests are not inferred as focused Vitest paths", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "validation-deleted-test-selector-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const git = fixtureGit(directory);
  git("init");
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

  const plan = selectValidation({
    intent: "checkpoint",
    checkpointScope: "lane",
    ...gitInputs,
  });
  const sharedTest = plan.checks.find((check) => check.id === "shared-test");
  assert.deepEqual(sharedTest.focusedPaths, []);
  assert.equal(sharedTest.command, turboTestCommand("shared"));
  for (const checkId of ["format", "lint"]) {
    const check = plan.checks.find((candidate) => candidate.id === checkId);
    assert.ok(check, checkId);
    assert.doesNotMatch(check.command, /removed\.test\.ts/, checkId);
  }
});

test("lane fingerprint ignores an unrelated dirty plan while workspace fingerprint remains broad", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "validation-lane-selector-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const git = fixtureGit(directory);
  git("init");
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
    ["Contracts", "Supply Chain Guardrails"],
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

// The `paths` a workflow's push or pull_request trigger lists, in order, negations included.
function workflowTriggerPaths(text, event) {
  const paths = [];
  let inOn = false;
  let inEvent = false;
  let inPaths = false;
  for (const line of text.split("\n")) {
    if (/^\S/.test(line)) inOn = /^on:\s*$/.test(line);
    if (!inOn) continue;
    const trigger = line.match(/^ {2}([a-z_]+):/);
    if (trigger) {
      inEvent = trigger[1] === event;
      inPaths = false;
    } else if (inEvent && /^ {4}paths:\s*$/.test(line)) {
      inPaths = true;
    } else if (inEvent && inPaths) {
      const entry = line.match(/^ {6}- ["']?([^"']+?)["']?\s*$/);
      if (entry) paths.push(entry[1]);
      else if (/^ {4}\S/.test(line)) inPaths = false;
    }
  }
  return paths;
}

// GitHub path filters: `**` crosses directories, `*` does not, and a later `!` pattern excludes.
function filterGlob(pattern) {
  const source = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, "\u0000")
    .replace(/\*\*/g, "\u0001")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/\u0000/g, "(?:.*/)?")
    .replace(/\u0001/g, ".*");
  return new RegExp(`^${source}$`);
}

function filterRuns(patterns, path) {
  let runs = false;
  for (const pattern of patterns) {
    if (pattern.startsWith("!")) {
      if (filterGlob(pattern.slice(1)).test(path)) runs = false;
    } else if (filterGlob(pattern).test(path)) runs = true;
  }
  return runs;
}

test("CI Gate expects exactly the workflows whose path filters start", () => {
  const policy = loadPolicy();
  const workflowsDirectory = join(repositoryRoot, ".github/workflows");
  const problems = [];
  const probeFor = (pattern) => pattern.replace(/\*\*/g, "probe/probe").replace(/\*/g, "probe");
  for (const file of readdirSync(workflowsDirectory).filter((name) => name.endsWith(".yml")).sort()) {
    const text = readFileSync(join(workflowsDirectory, file), "utf8");
    const name = text.match(/^name:\s*["']?(.+?)["']?\s*$/m)?.[1];
    const rule = policy.workflowRules[name];
    if (!rule) continue;
    const push = workflowTriggerPaths(text, "push");
    const pullRequest = workflowTriggerPaths(text, "pull_request");
    assert.deepEqual(push, pullRequest, `${file}: push and pull_request paths differ`);
    const expects = (path) =>
      selectExpectedWorkflows({ changedPaths: [path], intent: "merge", ci: true }).includes(name);
    // A path that starts the workflow but that CI Gate does not expect is a failure nothing blocks.
    for (const pattern of pullRequest.filter((entry) => !entry.startsWith("!"))) {
      const probe = probeFor(pattern);
      if (filterRuns(pullRequest, probe) && !expects(probe)) {
        problems.push(`${file}: ${pattern} starts ${name}, but CI Gate does not expect it`);
      }
    }
    // A path CI Gate expects that does not start the workflow leaves the gate waiting until it times out.
    // A prefix that names a file stem (packages/client/DESIGN) is probed like the filter that shares it.
    const prefixProbe = (prefix) => {
      const shared = prefix.endsWith("/")
        ? undefined
        : pullRequest.find((entry) => !entry.startsWith("!") && entry.startsWith(prefix));
      return shared ? probeFor(shared) : `${prefix}probe.ts`;
    };
    // Shared test support that a consumer's tests import reaches that consumer's workflow too.
    const support = policy.sharedConsumerTestSupport;
    const supportProbes = support?.surfaces.includes(name.toLowerCase())
      ? [...support.exact, ...support.prefixes.map((prefix) => `${prefix}probe.ts`)]
      : [];
    for (const probe of [
      ...(rule.exact ?? []),
      ...(rule.prefixes ?? []).map(prefixProbe),
      ...(rule.extensions ?? []).map((extension) => `probe/probe${extension}`),
      ...supportProbes,
    ]) {
      if (expects(probe) && !filterRuns(pullRequest, probe)) {
        problems.push(`${file}: CI Gate expects ${name} for ${probe}, which does not start it`);
      }
    }
    // Shared also decides inside the run which jobs to start; that detector lists the same paths.
    const detector = text.match(/const exact = new Set\(\[([\s\S]*?)\]\);[\s\S]*?const prefixes = \[([\s\S]*?)\];/);
    if (detector) {
      const quoted = (block) => [...block.matchAll(/"([^"]+)"/g)].map((match) => match[1]).sort();
      const [exact, prefixes] = [quoted(detector[1]), quoted(detector[2])];
      if (JSON.stringify(exact) !== JSON.stringify([...(rule.exact ?? [])].sort())) {
        problems.push(`${file}: its detector's exact paths differ from workflowRules.${name}`);
      }
      if (JSON.stringify(prefixes) !== JSON.stringify([...(rule.prefixes ?? [])].sort())) {
        problems.push(`${file}: its detector's prefixes differ from workflowRules.${name}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test("Shared test support that Client and Admin tests import reaches their suites and workflows", () => {
  const consumerWorkflows = (changedPath) =>
    selectExpectedWorkflows({ changedPaths: [changedPath], intent: "merge", ci: true }).filter((name) =>
      ["Admin", "Agent", "Client"].includes(name),
    );
  for (const changedPath of [
    "packages/shared/src/__tests__/test-utils/render-helpers.tsx",
    "packages/shared/src/__tests__/setupTests.base.ts",
    "packages/shared/src/__tests__/setupTests.core.ts",
  ]) {
    const checkpoint = ids(selectValidation({ intent: "checkpoint", changedPaths: [changedPath] }));
    for (const checkId of [
      "shared-test",
      "client-test-typecheck",
      "client-test",
      "admin-test-typecheck",
      "admin-test",
    ]) {
      assert.ok(checkpoint.includes(checkId), `${changedPath}: ${checkId}`);
    }
    assert.ok(!checkpoint.includes("agent-test"), changedPath);
    assert.deepEqual(consumerWorkflows(changedPath), ["Admin", "Client"], changedPath);
  }
  // Shared's own tests stay Shared's.
  const ownTest = "packages/shared/src/__tests__/hooks/app/useTheme.test.ts";
  assert.ok(!ids(selectValidation({ intent: "checkpoint", changedPaths: [ownTest] })).includes("client-test"));
  assert.deepEqual(consumerWorkflows(ownTest), []);
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
    ["Admin", "Agent", "Client", "Shared", "Supply Chain Guardrails"],
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

test("banned vocabulary authority changes require both Design and Docs", () => {
  const workflows = selectExpectedWorkflows({
    changedPaths: ["scripts/data/banned-vocabulary.json"],
    intent: "merge",
    ci: true,
  });
  assert.ok(workflows.includes("Design"));
  assert.ok(workflows.includes("Docs"));
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
    ["docs/docs/builders/testing/index.mdx", ["Design", "Docs", "Supply Chain Guardrails"]],
    ["packages/client/DESIGN-pwa.md", ["Client", "Design", "Supply Chain Guardrails"]],
    [
      "packages/shared/.storybook/preview.ts",
      ["Design", "Shared", "Supply Chain Guardrails"],
    ],
    ["scripts/data/design-token-usage-baseline.tsv", ["Design"]],
    ["scripts/quality/check-story-quality.ts", ["Design", "Supply Chain Guardrails"]],
    ["vercel.json", ["Design", "Supply Chain Guardrails"]],
    ["packages/contracts/config/schemas.json", ["Contracts", "Docs", "Ontology", "Supply Chain Guardrails"]],
    ["packages/client/src/views/Home/Garden/Assessment.tsx", ["Client", "Design", "Ontology", "Supply Chain Guardrails"]],
    ["packages/indexer/schema.graphql", ["Docs", "Indexer", "Ontology"]],
    [
      "packages/indexer/src/handlers/commitment-pool-claims.ts",
      ["Indexer", "Supply Chain Guardrails"],
    ],
    ["docs/docs/reference/ontology.generated.mdx", ["Docs", "Ontology", "Supply Chain Guardrails"]],
    ["scripts/quality/ontology-render.mjs", ["Docs", "Ontology", "Supply Chain Guardrails"]],
    ["scripts/data/ontology-drift-baseline.json", ["Ontology", "Supply Chain Guardrails"]],
    [".plans/active/commitment-pooling/contract-spec.md", ["Ontology", "Supply Chain Guardrails"]],
    ["docs/docs/builders/architecture/data-model.mdx", ["Docs", "Ontology", "Supply Chain Guardrails"]],
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


test("contract script changes retain the full critical test gate despite inferred TypeScript paths", () => {
  const plan = selectValidation({
    intent: "qa",
    changedPaths: ["packages/contracts/script/release-operator.ts", "packages/contracts/script/release-operator.test.ts"],
  });
  const check = plan.checks.find((candidate) => candidate.id === "contracts-test");
  assert.equal(check.mandatory, true);
  assert.equal(check.command, "bun run test");
  assert.deepEqual(check.focusedPaths, []);
});

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

test("read-only Shared hooks are sensitive and keep direct proof, Shared types and consumer types", () => {
  for (const changedPath of [
    "packages/shared/src/hooks/garden/useFilteredGardens.ts",
    "packages/shared/src/hooks/blockchain/useEnsName.ts",
    "packages/shared/src/hooks/conviction/useConvictionProposalsForPool.ts",
  ]) {
    const unfocused = selectValidation({ intent: "push", changedPaths: [changedPath] });
    assert.equal(unfocused.risk, "sensitive", changedPath);
    assert.equal(unfocused.status, "needs-focus", changedPath);
    assert.equal(unfocused.stopReason, "focused-proof-required", changedPath);

    const focused = selectValidation({
      intent: "push",
      changedPaths: [changedPath],
      testPaths: { shared: ["src/__tests__/hooks/placeholder.test.ts"] },
    });
    assert.equal(focused.status, "ready", changedPath);
    for (const id of ["shared-test", "shared-typecheck", "client-typecheck", "admin-typecheck"]) {
      assert.ok(ids(focused).includes(id), `${changedPath}: ${id}`);
    }
    assert.ok(!ids(focused).includes("client-test"), changedPath);
  }
});

test("signing, sending, queue and session hooks stay critical", () => {
  for (const changedPath of [
    "packages/shared/src/hooks/work/useWorkApprovals.ts",
    "packages/shared/src/hooks/blockchain/useTransactionSender.ts",
    "packages/shared/src/hooks/blockchain/useContractTxSender.ts",
    "packages/shared/src/hooks/cookie-jar/useCookieJarDeposit.ts",
    "packages/shared/src/hooks/garden/useJoinGarden.ts",
    "packages/shared/src/modules/transactions/wallet-sender.ts",
    "packages/shared/src/hooks/client-ui/auth/useLoginScreenController.ts",
  ]) {
    const plan = selectValidation({ intent: "push", changedPaths: [changedPath] });
    assert.equal(plan.risk, "critical", changedPath);
    assert.ok(plan.checks.find((check) => check.id === "shared-test")?.mandatory, changedPath);
  }
  const routine = selectValidation({
    intent: "push",
    changedPaths: ["packages/shared/src/hooks/app/useLoadingWithMinDuration.ts"],
  });
  assert.equal(routine.risk, "routine");
  assert.equal(routine.status, "needs-focus");
});

function mutationFixture(t, files) {
  const root = mkdtempSync(join(tmpdir(), "shared-mutation-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [path, source] of Object.entries(files)) {
    const absolute = join(root, "packages/shared/src", path);
    mkdirSync(join(absolute, ".."), { recursive: true });
    writeFileSync(absolute, source);
  }
  return root;
}

test("a new hook that reaches a signing or sending primitive defaults to critical", (t) => {
  const { sharedMutationPrimitives: primitives } = loadPolicy();
  const root = mutationFixture(t, {
    "hooks/blockchain/useTransactionSender.ts": [
      'import { useWriteContract } from "wagmi";',
      "export function useTransactionSender() {",
      "  const { writeContractAsync } = useWriteContract();",
      "  return writeContractAsync;",
      "}",
    ].join("\n"),
    "hooks/blockchain/index.ts": 'export { useTransactionSender as useSender } from "./useTransactionSender";\n',
    "hooks/tips/useSendTip.ts": [
      'import { useSender } from "../blockchain";',
      "export function useSendTip() {",
      "  const send = useSender();",
      "  return (amount: bigint) => send({ amount });",
      "}",
    ].join("\n"),
    "hooks/tips/useTipReceipt.ts": [
      'import * as core from "@wagmi/core";',
      "export async function sendTipReceipt(config: unknown) {",
      "  return core.sendTransaction(config as never, { to: \"0x0\" } as never);",
      "}",
    ].join("\n"),
    "hooks/tips/useLazyTip.ts": [
      "export async function sendLazyTip(sender: { sendContractCall?: (call: unknown) => Promise<void> }) {",
      "  await sender.sendContractCall?.({});",
      "}",
    ].join("\n"),
    "hooks/tips/useLeaveTips.ts": [
      'import { useAuth } from "../auth";',
      "export function useLeaveTips() {",
      "  const { signOut } = useAuth();",
      "  return signOut;",
      "}",
    ].join("\n"),
    "hooks/auth/index.ts": "export function useAuth() { return {} as { signOut: () => void }; }\n",
    "hooks/tips/useTipTotals.ts": [
      'import { useReadContract } from "wagmi";',
      "// Reads only: a comment saying writeContract( or sendTransaction( is not a call.",
      "export function useTipTotals() {",
      '  const label = "sendContractCall(";',
      "  return useReadContract({ functionName: label });",
      "}",
    ].join("\n"),
  });
  const newHooks = [
    "packages/shared/src/hooks/tips/useSendTip.ts",
    "packages/shared/src/hooks/tips/useTipReceipt.ts",
    "packages/shared/src/hooks/tips/useLazyTip.ts",
    "packages/shared/src/hooks/tips/useLeaveTips.ts",
  ];
  const readOnly = "packages/shared/src/hooks/tips/useTipTotals.ts";
  const mutationPaths = mutationPathsAmong([...newHooks, readOnly], { root, primitives });
  assert.deepEqual(mutationPaths, [...newHooks].sort());

  for (const changedPath of newHooks) {
    const plan = selectValidation({ intent: "push", changedPaths: [changedPath], mutationPaths });
    assert.equal(plan.risk, "critical", changedPath);
    const sharedTest = plan.checks.find((check) => check.id === "shared-test");
    assert.ok(sharedTest?.mandatory, changedPath);
    assert.ok(sharedTest.selectedBy.includes("critical-content"), changedPath);
  }
  const readPlan = selectValidation({ intent: "push", changedPaths: [readOnly], mutationPaths });
  assert.notEqual(readPlan.risk, "critical");
});

test("account-abstraction signing keeps aliased callers critical without escalating operation readers", (t) => {
  const { sharedMutationPrimitives: primitives } = loadPolicy();
  const root = mutationFixture(t, {
    "modules/reporting/activation.ts": [
      "export async function activate(account: { signUserOperation: (operation: unknown) => Promise<string> }) {",
      "  return account.signUserOperation({});",
      "}",
      "export function activationStatus() { return \"pending\"; }",
    ].join("\n"),
    "hooks/reporting/useActivation.ts": [
      'import { activate as submit } from "../../modules/reporting/activation";',
      "export const useActivation = (account: never) => submit(account);",
    ].join("\n"),
    "hooks/reporting/useActivationStatus.ts": [
      'import { activationStatus } from "../../modules/reporting/activation";',
      "export const useActivationStatus = () => activationStatus();",
    ].join("\n"),
  });
  const signing = [
    "packages/shared/src/modules/reporting/activation.ts",
    "packages/shared/src/hooks/reporting/useActivation.ts",
  ];
  const reader = "packages/shared/src/hooks/reporting/useActivationStatus.ts";
  const mutationPaths = mutationPathsAmong([...signing, reader], { root, primitives });
  assert.deepEqual(mutationPaths, [...signing].sort());
  for (const changedPath of signing) {
    const plan = selectValidation({ intent: "push", changedPaths: [changedPath], mutationPaths });
    assert.equal(plan.risk, "critical", changedPath);
    assert.ok(plan.checks.find((check) => check.id === "shared-test")?.mandatory, changedPath);
  }
  assert.notEqual(selectValidation({ intent: "push", changedPaths: [reader], mutationPaths }).risk, "critical");
});

test("mutation capability that travels by reference keeps a new file critical, in hooks and beyond", (t) => {
  const { sharedMutationPrimitives: primitives } = loadPolicy();
  const root = mutationFixture(t, {
    // The auth hub forwards its actions under their own names, so a reader that never touches one
    // stays out of the critical tier.
    "hooks/auth/index.ts": [
      'import { useAuthContext } from "./context";',
      "export function useAuth() {",
      "  const auth = useAuthContext();",
      "  return { isAuthenticated: auth.isAuthenticated, signOut: auth.signOut };",
      "}",
    ].join("\n"),
    "hooks/auth/context.ts": "export function useAuthContext() { return {} as { isAuthenticated: boolean; signOut: () => void }; }\n",
    "hooks/tips/useAliasedSend.ts": [
      'import { writeContract } from "@wagmi/core";',
      "const submit = writeContract;",
      "export const send = () => submit({} as never, {} as never);",
    ].join("\n"),
    "hooks/tips/useCallbackSend.ts": [
      'import { writeContract } from "@wagmi/core";',
      "export const useCallbackSend = () => ({ mutationFn: writeContract });",
    ].join("\n"),
    "hooks/tips/useTipButton.ts": [
      'import { useCallbackSend } from "./useCallbackSend";',
      "export function useTipButton() {",
      "  const { mutationFn } = useCallbackSend();",
      "  return () => mutationFn({} as never, {} as never);",
      "}",
    ].join("\n"),
    "hooks/tips/useForwardedSignOut.ts": [
      'import { useAuth } from "../auth";',
      "export function useForwardedSignOut() {",
      "  const auth = useAuth();",
      "  return { onLeave: auth.signOut };",
      "}",
    ].join("\n"),
    "hooks/tips/useLeaveButton.ts": [
      'import { useForwardedSignOut } from "./useForwardedSignOut";',
      "export function useLeaveButton() {",
      "  const { onLeave } = useForwardedSignOut();",
      "  return onLeave;",
      "}",
    ].join("\n"),
    "hooks/tips/useNamespaceCallback.ts": [
      'import * as core from "@wagmi/core";',
      "export const useNamespaceCallback = () => ({ run: core.sendTransaction });",
    ].join("\n"),
    "hooks/tips/useNamespaceAlias.ts": [
      'import * as core from "@wagmi/core";',
      "const { writeContract: write } = core;",
      "export const useNamespaceAlias = () => write;",
    ].join("\n"),
    "modules/tips/send.ts": [
      'import { sendTransaction as transfer } from "@wagmi/core";',
      "const go = transfer;",
      "export async function sendTip() {",
      "  return go({} as never, {} as never);",
      "}",
    ].join("\n"),
    "utils/tips/leave.ts": [
      "export function leaveHandler(auth: { signOut: () => void }) {",
      "  return auth.signOut;",
      "}",
    ].join("\n"),
    "components/tips/SignOutButton.tsx": [
      "export function SignOutButton({ auth }: { auth: { signOut: () => void } }) {",
      "  return <button type=\"button\" onClick={auth.signOut} />;",
      "}",
    ].join("\n"),
    "hooks/tips/useReadsAuth.ts": [
      'import { useAuth } from "../auth";',
      "export function useReadsAuth() {",
      "  const auth = useAuth();",
      "  return auth.isAuthenticated;",
      "}",
    ].join("\n"),
    "modules/tips/format.ts": [
      'import { formatEther } from "viem";',
      "const format = formatEther;",
      "export const formatTip = (value: bigint) => format(value);",
    ].join("\n"),
  });
  const escaping = [
    "packages/shared/src/hooks/tips/useAliasedSend.ts",
    "packages/shared/src/hooks/tips/useCallbackSend.ts",
    "packages/shared/src/hooks/tips/useTipButton.ts",
    "packages/shared/src/hooks/tips/useForwardedSignOut.ts",
    "packages/shared/src/hooks/tips/useLeaveButton.ts",
    "packages/shared/src/hooks/tips/useNamespaceCallback.ts",
    "packages/shared/src/hooks/tips/useNamespaceAlias.ts",
    "packages/shared/src/modules/tips/send.ts",
    "packages/shared/src/utils/tips/leave.ts",
    "packages/shared/src/components/tips/SignOutButton.tsx",
  ];
  const readers = [
    "packages/shared/src/hooks/tips/useReadsAuth.ts",
    "packages/shared/src/modules/tips/format.ts",
  ];
  assert.deepEqual(mutationPathsAmong([...escaping, ...readers], { root, primitives }), [...escaping].sort());
  for (const changedPath of escaping) {
    const plan = selectValidation({ intent: "push", changedPaths: [changedPath], mutationPaths: escaping });
    assert.equal(plan.risk, "critical", changedPath);
  }
});

test("an import the analyzer cannot read keeps a new file critical instead of hiding its primitive", (t) => {
  const { sharedMutationPrimitives: primitives } = loadPolicy();
  const root = mutationFixture(t, {
    "hooks/blockchain/useSender.ts": [
      'import { useWriteContract } from "wagmi";',
      "export function useSender() {",
      "  const { writeContractAsync } = useWriteContract();",
      "  return writeContractAsync;",
      "}",
    ].join("\n"),
    "hooks/blockchain/index.ts": 'export { useSender } from "./useSender";\n',
    "index.ts": 'export { useSender } from "./hooks/blockchain";\n',
    "utils/time.ts": "export const formatTime = (value: number) => new Date(value).toISOString();\n",
    "i18n/en.json": '{ "title": "Tips" }\n',
    // Shared reached through its own package exports, its @shared/ alias, or an export it lacks.
    "hooks/tips/useSelfImport.ts": [
      'import { useSender } from "@green-goods/shared/hooks/blockchain";',
      "export const useSelfImport = () => useSender();",
    ].join("\n"),
    "hooks/tips/useSelfRoot.ts": [
      'import { useSender } from "@green-goods/shared";',
      "export const useSelfRoot = () => useSender();",
    ].join("\n"),
    "hooks/tips/useUnexported.ts": [
      'import { useSender } from "@green-goods/shared/hooks/secret";',
      "export const useUnexported = () => useSender();",
    ].join("\n"),
    "hooks/tips/useAliasImport.ts": [
      'import { useSender } from "@shared/hooks/blockchain";',
      "export const useAliasImport = () => useSender();",
    ].join("\n"),
    // An entry point the primitive list does not name, a file that is not there, a computed import.
    "modules/tips/actions.ts": [
      'import { writeContract } from "wagmi/actions";',
      "export const run = () => writeContract({} as never, {} as never);",
    ].join("\n"),
    "modules/tips/missing.ts": [
      'import { mystery } from "./not-here";',
      "export const run = () => mystery();",
    ].join("\n"),
    "modules/tips/lazy.ts": "export const load = (name: string) => import(`./plugins/${name}`);\n",
    // A primitive module whose namespace escapes whole or is read by a computed key, and a default
    // import of one.
    "utils/tips/escape.ts": [
      'import * as core from "@wagmi/core";',
      "export const library = core;",
    ].join("\n"),
    "utils/tips/computed.ts": [
      'import * as core from "@wagmi/core";',
      "export const pick = (name: string) => (core as Record<string, unknown>)[name];",
    ].join("\n"),
    "utils/tips/defaultCore.ts": [
      'import wagmiCore from "@wagmi/core";',
      "export const send = () => wagmiCore.writeContract({} as never, {} as never);",
    ].join("\n"),
    // Readers stay routine: data, a chain constant, a read-only Shared leaf, a namespace read.
    "modules/tips/copy.ts": [
      'import messages from "../../i18n/en.json";',
      "export const label = () => messages.title;",
    ].join("\n"),
    "modules/tips/chains.ts": [
      'import { sepolia } from "viem/chains";',
      "export const chain = () => sepolia;",
    ].join("\n"),
    "modules/tips/readSelf.ts": [
      'import { formatTime } from "@green-goods/shared/utils/time";',
      "export const stamp = () => formatTime(0);",
    ].join("\n"),
    "utils/tips/readCore.ts": [
      'import * as core from "@wagmi/core";',
      "export const read = (config: never) => core.readContract(config, {} as never);",
    ].join("\n"),
  });
  writeFileSync(
    join(root, "packages/shared/package.json"),
    JSON.stringify({
      exports: {
        ".": "./src/index.ts",
        "./hooks/blockchain": "./src/hooks/blockchain/index.ts",
        "./utils/time": "./src/utils/time.ts",
      },
    }),
  );
  const critical = [
    "packages/shared/src/hooks/tips/useSelfImport.ts",
    "packages/shared/src/hooks/tips/useSelfRoot.ts",
    "packages/shared/src/hooks/tips/useUnexported.ts",
    "packages/shared/src/hooks/tips/useAliasImport.ts",
    "packages/shared/src/modules/tips/actions.ts",
    "packages/shared/src/modules/tips/missing.ts",
    "packages/shared/src/modules/tips/lazy.ts",
    "packages/shared/src/utils/tips/escape.ts",
    "packages/shared/src/utils/tips/computed.ts",
    "packages/shared/src/utils/tips/defaultCore.ts",
  ];
  const readers = [
    "packages/shared/src/modules/tips/copy.ts",
    "packages/shared/src/modules/tips/chains.ts",
    "packages/shared/src/modules/tips/readSelf.ts",
    "packages/shared/src/utils/tips/readCore.ts",
  ];
  assert.deepEqual(mutationPathsAmong([...critical, ...readers], { root, primitives }), [...critical].sort());
});

test("every Shared file that signs, sends, moves funds or changes auth, session or queue state is critical by policy", () => {
  const policy = loadPolicy();
  const { invoking } = analyzeSharedMutationSurface({
    root: repositoryRoot,
    primitives: policy.sharedMutationPrimitives,
  });
  const unclassified = [...invoking]
    .filter(([file]) => selectValidation({ intent: "push", changedPaths: [file] }, { policy }).risk !== "critical")
    .map(([file, reasons]) => `${file} (${reasons.join("; ")})`);
  assert.deepEqual(
    unclassified,
    [],
    "Add each file to the shared critical override's exact list in scripts/data/validation-policy.json",
  );
  const listed = policy.criticalOverrides.find((rule) => rule.id === SHARED_CRITICAL_RULE_ID);
  const stale = listed.exact.filter((file) => !invoking.has(file));
  assert.deepEqual(stale, [], "Remove exact entries that no longer sign, send or change auth, session or queue state");
});

test("receipt reuse follows the intent: readiness, ship, merge and release never reuse at any risk", () => {
  const byRisk = {
    routine: "docs/docs/builders/quality/test-cases.mdx",
    sensitive: "packages/agent/src/services/analytics.ts",
    critical: "packages/shared/src/hooks/work/useWorkMutation.ts",
  };
  const reuse = (intent, changedPath) => {
    const plan = selectValidation({ intent, changedPaths: [changedPath] });
    return [plan.risk, plan.receiptPolicy.reuseAllowed];
  };
  for (const [risk, changedPath] of Object.entries(byRisk)) {
    for (const intent of ["readiness", "ship", "merge", "release"]) {
      assert.deepEqual(reuse(intent, changedPath), [risk, false], `${intent}: ${changedPath}`);
    }
    // An ordinary push may reuse an exact pass at every risk, which is what keeps the pre-push
    // hook after a passing manual run to seconds.
    assert.deepEqual(reuse("push", changedPath), [risk, true], `push: ${changedPath}`);
  }
  // Lighter intents reuse too, except that a critical plan reuses only in push.
  assert.deepEqual(reuse("checkpoint", byRisk.routine), ["routine", true]);
  assert.deepEqual(reuse("checkpoint", byRisk.critical), ["critical", false]);
  assert.equal(selectValidation({ intent: "release", cancelled: true }).receiptPolicy.reuseAllowed, false);
});

test("measured budgets keep routine and sensitive push decisions", () => {
  const cases = [
    [{ changedPaths: ["packages/shared/src/hooks/app/useLoadingWithMinDuration.ts"] }, "routine", "needs-focus"],
    [
      {
        changedPaths: ["packages/shared/src/hooks/app/useLoadingWithMinDuration.ts"],
        testPaths: { shared: ["src/__tests__/hooks/app/useLoadingWithMinDuration.test.ts"] },
      },
      "routine",
      "ready",
    ],
    // A deleted test leaves its suite unfocused: name the surviving proof, unless the whole suite
    // is cheaper than a focused run.
    [{ changedPaths: ["packages/admin/src/__tests__/components/AdminDialog.test.tsx"], deletedPaths: ["packages/admin/src/__tests__/components/AdminDialog.test.tsx"] }, "routine", "needs-focus"],
    [{ changedPaths: ["packages/agent/src/__tests__/analytics.test.ts"], deletedPaths: ["packages/agent/src/__tests__/analytics.test.ts"] }, "sensitive", "ready"],
    [{ changedPaths: ["docs/scripts/docs-audit.test.mjs"] }, "routine", "ready"],
    [{ changedPaths: ["packages/agent/src/services/analytics.ts"] }, "sensitive", "needs-focus"],
  ];
  for (const [input, risk, status] of cases) {
    const plan = selectValidation({ intent: "push", ...input });
    assert.equal(plan.risk, risk, input.changedPaths[0]);
    assert.equal(plan.status, status, input.changedPaths[0]);
    if (status === "needs-focus") assert.equal(plan.stopReason, "focused-proof-required", input.changedPaths[0]);
  }

  const critical = selectValidation({
    intent: "push",
    changedPaths: ["packages/shared/src/hooks/work/useWorkApprovals.ts"],
  });
  const summed = critical.checks.reduce((total, check) => total + check.budgetSeconds, 0);
  assert.equal(critical.budget.estimatedWallSeconds, summed);
  assert.ok(summed < 300, `the critical estimate follows measured budgets, got ${summed}s`);
});

test("only a test file becomes a focused run; helpers and notes under a test directory do not", () => {
  const packageTest = (plan, surface) => plan.checks.find((check) => check.id === `${surface}-test`);
  const push = (changedPaths, testPaths = {}) => selectValidation({ intent: "push", changedPaths, testPaths });

  // A runner handed a README finds no tests and fails, so notes select no test run in any intent.
  const notes = "packages/agent/src/__tests__/reporting/driver/README.md";
  for (const intent of ["push", "checkpoint", "qa"]) {
    const plan = selectValidation({ intent, changedPaths: [notes] });
    assert.equal(packageTest(plan, "agent"), undefined, intent);
    assert.equal(plan.status, "ready", intent);
  }
  // Removing or renaming notes asks for no test either, even beside a suite too dear to run whole.
  const oldNotes = "packages/shared/src/__tests__/NOTES.md";
  for (const changedPaths of [[oldNotes], [oldNotes, "packages/shared/src/__tests__/README.md"]]) {
    const plan = selectValidation({ intent: "push", changedPaths, deletedPaths: [oldNotes] });
    assert.equal(plan.status, "ready", changedPaths.join(" + "));
    assert.equal(packageTest(plan, "shared"), undefined, changedPaths.join(" + "));
  }

  // A helper is never the focus. A suite as cheap as a focused run runs whole.
  const helper = "packages/agent/src/__tests__/reporting/driver/server.ts";
  const whole = packageTest(push([helper]), "agent");
  assert.deepEqual(whole.focusedPaths, []);
  assert.equal(whole.command, turboTestCommand("agent"));
  // Changed beside a test, the test alone is the focus.
  const sqliteTest = "src/__tests__/reporting/driver.sqlite.test.ts";
  assert.deepEqual(packageTest(push([helper, `packages/agent/${sqliteTest}`]), "agent").focusedPaths, [sqliteTest]);

  // A dearer suite asks for the test that exercises the helper, whatever the runner.
  for (const [path, surface, proof] of [
    ["packages/shared/src/__tests__/test-utils/query-client.ts", "shared", "src/__tests__/hooks/garden/useFilteredGardens.test.ts"],
    ["packages/client/src/__tests__/test-utils.tsx", "client", "src/__tests__/routes/SessionGate.test.tsx"],
    ["packages/contracts/test/helpers/DeploymentBase.sol", "contracts", "test/unit/Garden.t.sol"],
    ["packages/indexer/test/helpers/events.ts", "indexer", "test/garden.test.ts"],
  ]) {
    const alone = push([path]);
    assert.equal(alone.status, "needs-focus", path);
    assert.equal(alone.stopReason, "focused-proof-required", path);
    assert.ok(alone.remediation.includes(`--test-path ${surface}:`), path);
    const named = push([path], { [surface]: [proof] });
    assert.equal(named.status, "ready", path);
    assert.deepEqual(packageTest(named, surface).focusedPaths, [proof], path);
  }

  // The indexer's entry test is named test.ts, and a checkpoint runs a helper's suite whole.
  assert.deepEqual(packageTest(push(["packages/indexer/test/test.ts"]), "indexer").focusedPaths, ["test/test.ts"]);
  const checkpoint = selectValidation({
    intent: "checkpoint",
    changedPaths: ["packages/shared/src/__tests__/test-utils/query-client.ts"],
  });
  assert.equal(checkpoint.status, "ready");
  assert.equal(packageTest(checkpoint, "shared").command, turboTestCommand("shared", "checkpoint"));
});

test("the push gate routes test quality and generated or audited docs to the paths that break them", () => {
  const push = (changedPath) => ids(selectValidation({ intent: "push", changedPaths: [changedPath] }));
  for (const changedPath of [
    "packages/shared/src/__tests__/hooks/garden/useFilteredGardens.test.ts",
    "packages/shared/src/__tests__/test-utils/query-client.ts",
    "packages/shared/src/__mocks__/eas-sdk.ts",
    "packages/contracts/test/unit/CreditRegistry.t.sol",
    "packages/indexer/test/credit-registry.test.ts",
    "scripts/quality/select-validation.test.mjs",
    "tests/specs/admin.smoke.spec.ts",
    // test-quality checks which project each Shared test file lands in.
    "packages/shared/vitest.config.ts",
    "scripts/lib/vitest-shared-graph.mjs",
    "scripts/quality/check-shared-graph-tests.mjs",
    "scripts/quality/check-small-test-files.mjs",
    "scripts/quality/check-test-utils-barrel.mjs",
  ]) {
    assert.ok(push(changedPath).includes("test-quality"), changedPath);
  }
  assert.ok(!push("packages/shared/src/hooks/app/useLoadingWithMinDuration.ts").includes("test-quality"));

  for (const changedPath of ["docs/docs/community/green-goods-claims.generated.mdx", "scripts/docs/renderers.mjs", ".github/workflows/shared.yml"]) {
    const selected = push(changedPath);
    assert.ok(selected.includes("docs-generated"), changedPath);
    assert.ok(selected.includes("docs-authority"), changedPath);
  }
  // The authority audit scans every script, config and guide outside Plan Hubs for retired
  // command callers, so ordinary tooling selects it; plan history never does.
  assert.ok(push("scripts/lib/dev-shared.js").includes("docs-authority"));
  assert.ok(!push(".plans/active/test-budget-and-ci-speed/plan.todo.md").includes("docs-authority"));
});

test("every docs generator input selects docs-generated, and the policy lists nothing else", async () => {
  const { projectionSourcePaths } = await import("../docs/generate.mjs");
  const sources = projectionSourcePaths(repositoryRoot);
  const unrouted = sources.filter(
    (source) => !ids(selectValidation({ intent: "push", changedPaths: [source] })).includes("docs-generated"),
  );
  assert.deepEqual(unrouted, [], "Add each generator source to the docs-generated rule in scripts/data/validation-policy.json");

  const rule = loadPolicy().conditionalRules.find(
    (entry) => entry.check === "docs-generated" && entry.exact?.includes("scripts/data/validation-policy.json"),
  );
  assert.deepEqual(rule.exact.filter((path) => !sources.includes(path)), [], "Remove exact entries the generator no longer reads");
});

test("every file a certified seam fingerprints selects test-quality", () => {
  const registry = JSON.parse(readFileSync(new URL("../data/module-seam-registry.json", import.meta.url), "utf8"));
  const fingerprinted = new Set();
  for (const entry of registry.entries) {
    const proof = entry.proof ?? {};
    for (const path of [entry.modulePath, ...(entry.compositionRoots ?? []), ...(entry.directConsumers ?? []), ...(proof.direct ?? []), ...(proof.conformance ?? []), ...(proof.integration ?? [])]) {
      if (path) fingerprinted.add(path);
    }
    // The fingerprint also covers the manifest that declares the seam's public export.
    fingerprinted.add(`packages/${entry.owner}/package.json`);
  }
  const unrouted = [...fingerprinted].filter(
    (path) => !ids(selectValidation({ intent: "push", changedPaths: [path] })).includes("test-quality"),
  );
  assert.deepEqual(unrouted, [], "Add each fingerprinted seam file to the test-quality rule in scripts/data/validation-policy.json");
});

test("every dated plan report selects immutable-plan-reports in the push gate", async () => {
  // CI's Guidance integrity job rejects an edit, deletion or rename of a dated report. The push gate
  // must run the same check, or an appended section passes locally and fails after the push.
  const { isDatedPlanReport } = await import("./check-immutable-plan-reports.mjs");
  const push = (changedPath) => ids(selectValidation({ intent: "push", changedPaths: [changedPath] }));
  const tracked = execFileSync("git", ["ls-files", ".plans"], { cwd: repositoryRoot, encoding: "utf8" })
    .split("\n")
    .filter(isDatedPlanReport);
  assert.ok(tracked.length > 0, "the repository keeps dated plan reports");
  const shapes = [
    ".plans/active/example-hub/reports/2026-09-28-snapshot-08-follow-up.md",
    ".plans/backlog/example-hub/reports/review-2026-08-10.md",
    ".plans/archive/example-hub/reports/nested/audit-2026-08-09.md",
    ".plans/ideas/example-hub/reports/2026-01-02.md",
  ];
  for (const path of shapes) assert.ok(isDatedPlanReport(path), `the check classifies ${path}`);
  const unrouted = [...tracked, ...shapes].filter((path) => !push(path).includes("immutable-plan-reports"));
  assert.deepEqual(unrouted, [], "Route each dated report to immutable-plan-reports in scripts/data/validation-policy.json");

  // The check's own code runs it; a hub's living files and other scripts do not.
  assert.ok(push("scripts/quality/check-immutable-plan-reports.mjs").includes("immutable-plan-reports"));
  for (const path of [
    ".plans/active/test-budget-and-ci-speed/plan.todo.md",
    ".plans/active/test-budget-and-ci-speed/status.json",
    "scripts/quality/select-validation.mjs",
  ]) {
    assert.ok(!push(path).includes("immutable-plan-reports"), path);
  }
});

test("qualified browser checks follow their sources, block on missing Chromium and retain critical overrides", () => {
  for (const [id, changedPath] of [
    ['browser-passkey', 'packages/shared/src/workflows/authServices.ts'],
    ['browser-work-exploration', 'packages/client/src/views/Home/Garden/Work.tsx'],
    ['browser-pwa-preview', 'packages/client/src/sw/sw.ts'],
  ]) {
    const plan = selectValidation({ intent: 'qa', changedPaths: [changedPath], environment: { capabilities: { playwrightChromium: false } } });
    const check = plan.checks.find(item => item.id === id);
    assert.ok(check, `${id} selected for ${changedPath}`);
    assert.ok(check.blockedBy.includes('playwrightChromium'));
    assert.ok(!ids(selectValidation({ intent: 'qa', changedPaths: ['docs/README.md'] })).includes(id));
    if (id === 'browser-passkey') assert.ok(plan.checks.some(item => item.mandatory && item.id === 'shared-test'));
  }
});

test("browser entrypoint and lifecycle edits trigger the required Client workflow", () => {
  for (const changedPath of ["scripts/dev/browser.js", "scripts/dev/test-e2e.js", "scripts/dev/node-cli.js", "scripts/lib/command-runner.mjs", "scripts/lib/dev-shared.js"]) {
    assert.ok(selectExpectedWorkflows({ intent: "merge", ci: true, changedPaths: [changedPath] }).includes("Client"), changedPath);
  }
});

test("browser proof fingerprints change with fixture, profile, toolchain and replay seed", () => {
  const plan = selectValidation({ intent: 'qa', changedPaths: ['tests/specs/client.exploration.spec.ts'], workingCopyFingerprint: 'source-and-fixture-a' });
  const check = plan.checks.find(item => item.id === 'browser-work-exploration');
  assert.ok(check);
  const original = buildReceiptInputs(plan, check, { environment: 'seed-17' }).fingerprint;
  for (const changed of [
    { ...plan, workingCopyFingerprint: 'source-and-fixture-b' },
    { ...plan, environment: { ...plan.environment, profile: 'production' } },
    { ...plan, environment: { ...plan.environment, toolchain: { playwright: 'different-revision' } } },
  ]) assert.notEqual(buildReceiptInputs(changed, check, { environment: 'seed-17' }).fingerprint, original);
  assert.notEqual(buildReceiptInputs(plan, check, { environment: 'seed-42' }).fingerprint, original);
});
