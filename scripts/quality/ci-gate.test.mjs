import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { expectedWorkflowNames, latestRunsByName, runGate } from "./ci-gate.mjs";

const silentLogger = {
  log() {},
  error() {},
};

const ciGateWorkflow = readFileSync(
  resolve(import.meta.dirname, "../../.github/workflows/ci-gate.yml"),
  "utf8",
);
const supplyChainWorkflow = readFileSync(
  resolve(import.meta.dirname, "../../.github/workflows/supply-chain-guardrails.yml"),
  "utf8",
);

function workflowRun(name, { id, status = "completed", conclusion = "success" } = {}) {
  return {
    id,
    name,
    status,
    conclusion: status === "completed" ? conclusion : null,
    html_url: `https://example.test/runs/${id}`,
  };
}

function gateFixture(snapshots) {
  let runRequests = 0;
  let waits = 0;

  return {
    dependencies: {
      loadChangedFiles: async () => ["fixture.txt"],
      selectWorkflows: () => ["Alpha", "Beta"],
      loadWorkflowRuns: async () => {
        const snapshot = snapshots[Math.min(runRequests, snapshots.length - 1)];
        runRequests += 1;
        return new Map(snapshot.map((run) => [run.name, run]));
      },
      wait: async () => {
        waits += 1;
      },
      logger: silentLogger,
    },
    calls() {
      return { runRequests, waits };
    },
  };
}

const gateOptions = {
  token: "test-token",
  repository: "greenpill-dev-guild/green-goods",
  pullNumber: 123,
  headSha: "abc123",
  maxAttempts: 3,
  intervalMs: 0,
};

test("package changes require every package and supply-chain workflow", () => {
  assert.deepEqual(expectedWorkflowNames(["package.json"]), [
    "Admin",
    "Agent",
    "Client",
    "Contracts",
    "Design",
    "Docs",
    "Indexer",
    "Shared",
    "Supply Chain Guardrails",
  ]);
});

test("guidance-consumer source changes also require supply-chain guardrails", () => {
  assert.deepEqual(expectedWorkflowNames(["packages/agent/src/index.ts"]), [
    "Agent",
    "Supply Chain Guardrails",
  ]);
});

test("raw contract source stays on contract, ontology, and global guardrail workflows", () => {
  assert.deepEqual(expectedWorkflowNames(["packages/contracts/src/Gardens.sol"]), [
    "Contracts",
    "Ontology",
    "Supply Chain Guardrails",
  ]);
});

test("ABI and deployment artifacts fan out to actual contract consumers", () => {
  assert.deepEqual(expectedWorkflowNames(["packages/contracts/abis/GardenAccount.json"]), [
    "Admin",
    "Client",
    "Contracts",
    "Indexer",
    "Shared",
    "Supply Chain Guardrails",
  ]);
  assert.deepEqual(expectedWorkflowNames(["packages/contracts/deployments/42161-latest.json"]), [
    "Admin",
    "Client",
    "Contracts",
    "Indexer",
    "Ontology",
    "Shared",
    "Supply Chain Guardrails",
  ]);
});

test("contract naming helper changes require contracts CI", () => {
  assert.deepEqual(expectedWorkflowNames(["scripts/lib/git-guardrails.mjs"]), [
    "Contracts",
    "Supply Chain Guardrails",
  ]);
});

test("ontology-scoped changes require the ontology workflow", () => {
  assert.deepEqual(expectedWorkflowNames(["packages/shared/src/ontology/green-goods-ontology.json"]), [
    "Admin",
    "Agent",
    "Client",
    "Design",
    "Ontology",
    "Shared",
    "Supply Chain Guardrails",
  ]);
  assert.deepEqual(expectedWorkflowNames(["docs/docs/reference/glossary-community.md"]), [
    "Docs",
    "Ontology",
    "Supply Chain Guardrails",
  ]);
  assert.deepEqual(expectedWorkflowNames(["packages/indexer/schema.graphql"]), [
    "Indexer",
    "Ontology",
  ]);
  assert.deepEqual(expectedWorkflowNames(["scripts/data/ontology-drift-baseline.json"]), [
    "Ontology",
    "Supply Chain Guardrails",
  ]);
  assert.deepEqual(expectedWorkflowNames([".plans/active/commitment-pooling/contract-spec.md"]), [
    "Ontology",
    "Supply Chain Guardrails",
  ]);
  assert.deepEqual(
    expectedWorkflowNames([".plans/active/commitment-pooling/standing-commitments-spec.md"]),
    ["Ontology", "Supply Chain Guardrails"],
  );
  assert.deepEqual(expectedWorkflowNames([".plans/active/commitment-pooling/settlement-spec.md"]), [
    "Ontology",
    "Supply Chain Guardrails",
  ]);
  assert.deepEqual(expectedWorkflowNames([".plans/active/commitment-credit-follow-on/spec.md"]), [
    "Ontology",
    "Supply Chain Guardrails",
  ]);
  assert.deepEqual(expectedWorkflowNames(["packages/contracts/script/DeployBadgeSchema.s.sol"]), [
    "Contracts",
    "Ontology",
    "Supply Chain Guardrails",
  ]);
});

test("docs-only changes require docs and guidance-consumer checks", () => {
  assert.deepEqual(expectedWorkflowNames(["docs/docs/intro.md"]), [
    "Docs",
    "Supply Chain Guardrails",
  ]);
});

test("ordinary source keeps global formatting ownership and live package routing", () => {
  assert.deepEqual(expectedWorkflowNames(["packages/client/src/views/Home/Garden/Work.tsx"]), [
    "Client",
    "Design",
    "Ontology",
    "Supply Chain Guardrails",
  ]);
  assert.deepEqual(expectedWorkflowNames(["packages/shared/src/index.ts"]), [
    "Admin",
    "Agent",
    "Client",
    "Design",
    "Ontology",
    "Shared",
    "Supply Chain Guardrails",
  ]);
});

test("workflow changes require their workflow and supply-chain checks", () => {
  assert.deepEqual(expectedWorkflowNames([".github/workflows/docs.yml"]), [
    "Docs",
    "Supply Chain Guardrails",
  ]);
});

test("package and toolchain changes match every live workflow trigger", () => {
  assert.deepEqual(expectedWorkflowNames(["packages/client/package.json"]), [
    "Client",
    "Supply Chain Guardrails",
  ]);
  assert.deepEqual(expectedWorkflowNames(["biome.json"]), [
    "Admin",
    "Agent",
    "Client",
    "Shared",
    "Supply Chain Guardrails",
  ]);
  assert.deepEqual(expectedWorkflowNames([".github/actions/setup-js/action.yml"]), [
    "Admin",
    "Agent",
    "Client",
    "Contracts",
    "Design",
    "Docs",
    "Indexer",
    "Shared",
    "Supply Chain Guardrails",
  ]);
});

test("specialized workflow inputs stay synchronized with live path filters", () => {
  assert.deepEqual(expectedWorkflowNames(["scripts/ops/upload-sourcemaps.js"]), [
    "Admin",
    "Client",
    "Supply Chain Guardrails",
  ]);
  assert.deepEqual(expectedWorkflowNames(["vercel.json"]), [
    "Design",
    "Supply Chain Guardrails",
  ]);
  assert.deepEqual(expectedWorkflowNames([".npmrc"]), ["Supply Chain Guardrails"]);
  assert.deepEqual(expectedWorkflowNames([".mise.toml"]), ["Supply Chain Guardrails"]);
  assert.match(supplyChainWorkflow, /- ["']\.mise\.toml["']/);
});

test("CI Gate script changes require supply-chain guardrails", () => {
  assert.deepEqual(expectedWorkflowNames(["scripts/quality/ci-gate.mjs"]), [
    "Supply Chain Guardrails",
  ]);
});

test("test-quality wrapper changes require the supply-chain workflow that runs it", () => {
  assert.deepEqual(expectedWorkflowNames(["scripts/quality/check-test-quality.sh"]), [
    "Supply Chain Guardrails",
  ]);
});

test("source-structure changes require every workflow that runs the check", () => {
  assert.deepEqual(expectedWorkflowNames(["scripts/quality/check-source-structure.js"]), [
    "Admin",
    "Agent",
    "Client",
    "Contracts",
    "Indexer",
    "Shared",
    "Supply Chain Guardrails",
  ]);
});

test("CI Gate pins Node and runs every standard-library validation fixture", () => {
  assert.match(
    ciGateWorkflow,
    /uses:\s*actions\/setup-node@820762786026740c76f36085b0efc47a31fe5020/,
  );
  assert.match(ciGateWorkflow, /node-version:\s*["']22\.22\.1["']/);
  assert.match(
    ciGateWorkflow,
    /node --test scripts\/quality\/select-validation\.test\.mjs scripts\/dev\/ci-local\.test\.mjs scripts\/quality\/ci-gate\.test\.mjs/,
  );
});

test("direct CLI execution preserves required-input failure behavior", () => {
  const result = spawnSync(process.execPath, [resolve(import.meta.dirname, "ci-gate.mjs")], {
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_TOKEN: "",
      REPO: "",
      PR_NUMBER: "",
      HEAD_SHA: "",
    },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /::error::GITHUB_TOKEN, REPO, PR_NUMBER, and HEAD_SHA are required/);
});

test("a completed failure fails immediately while another workflow is pending", async () => {
  const fixture = gateFixture([
    [
      workflowRun("Alpha", { id: 2, conclusion: "failure" }),
      workflowRun("Beta", { id: 3, status: "in_progress" }),
    ],
  ]);

  await assert.rejects(
    runGate(gateOptions, fixture.dependencies),
    /1 expected workflow\(s\) did not succeed/,
  );
  assert.deepEqual(fixture.calls(), { runRequests: 1, waits: 0 });
});

test("all completed successes pass the gate", async () => {
  const fixture = gateFixture([
    [workflowRun("Alpha", { id: 2 }), workflowRun("Beta", { id: 3 })],
  ]);

  await runGate(gateOptions, fixture.dependencies);
  assert.deepEqual(fixture.calls(), { runRequests: 1, waits: 0 });
});

test("a missing workflow may register on a later poll", async () => {
  const fixture = gateFixture([
    [workflowRun("Alpha", { id: 2 })],
    [workflowRun("Alpha", { id: 2 }), workflowRun("Beta", { id: 3 })],
  ]);

  await runGate(gateOptions, fixture.dependencies);
  assert.deepEqual(fixture.calls(), { runRequests: 2, waits: 1 });
});

test("a workflow that never registers keeps missing-workflow protection strict", async () => {
  const fixture = gateFixture([
    [workflowRun("Alpha", { id: 2 })],
  ]);

  await assert.rejects(
    runGate({ ...gateOptions, maxAttempts: 2 }, fixture.dependencies),
    /timed out before every expected workflow registered and completed/,
  );
  assert.deepEqual(fixture.calls(), { runRequests: 2, waits: 1 });
});

for (const conclusion of ["cancelled", "timed_out", "action_required", "skipped"]) {
  test(`a ${conclusion} workflow is a terminal non-success`, async () => {
    const fixture = gateFixture([
      [
        workflowRun("Alpha", { id: 2, conclusion }),
        workflowRun("Beta", { id: 3 }),
      ],
    ]);

    await assert.rejects(
      runGate(gateOptions, fixture.dependencies),
      /1 expected workflow\(s\) did not succeed/,
    );
    assert.deepEqual(fixture.calls(), { runRequests: 1, waits: 0 });
  });
}

test("the newest workflow run wins regardless of API ordering", () => {
  const olderSuccess = workflowRun("Alpha", { id: 10 });
  const newerFailure = workflowRun("Alpha", { id: 20, conclusion: "failure" });

  assert.equal(latestRunsByName([newerFailure, olderSuccess]).get("Alpha"), newerFailure);
  assert.equal(latestRunsByName([olderSuccess, newerFailure]).get("Alpha"), newerFailure);
});
