import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { expectedWorkflowNames, latestRunsByName, runGate } from "./ci-gate.mjs";
import { loadPolicy, SHARED_CRITICAL_RULE_ID } from "./select-validation.mjs";

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

test("raw contract source stays on contract and global guardrail workflows", () => {
  assert.deepEqual(expectedWorkflowNames(["packages/contracts/src/Gardens.sol"]), [
    "Contracts",
    "Supply Chain Guardrails",
  ]);
  assert.deepEqual(expectedWorkflowNames(["packages/contracts/src/Schemas.sol"]), [
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
    "Docs",
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
    "Docs",
    "Ontology",
    "Shared",
    "Supply Chain Guardrails",
  ]);
  assert.deepEqual(expectedWorkflowNames(["docs/docs/reference/glossary.generated.mdx"]), [
    "Docs",
    "Ontology",
    "Supply Chain Guardrails",
  ]);
  assert.deepEqual(expectedWorkflowNames(["packages/indexer/schema.graphql"]), [
    "Docs",
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
  assert.deepEqual(expectedWorkflowNames([".plans/backlog/commitment-credit-follow-on/spec.md"]), [
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
    "Docs",
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
    /uses:\s*actions\/setup-node@[a-f0-9]{40}\b/,
  );
  assert.match(ciGateWorkflow, /node-version:\s*["']22\.22\.1["']/);
  assert.match(
    ciGateWorkflow,
    /node --test scripts\/quality\/select-validation\.test\.mjs scripts\/dev\/ci-local\.test\.mjs scripts\/dev\/surface-leases\.test\.mjs scripts\/quality\/ci-gate\.test\.mjs scripts\/quality\/check-react-patterns\.test\.mjs/,
  );
});

const dependabotContext = { repository: gateOptions.repository, pullRequest: { user: { login: "dependabot[bot]" }, head: { repo: { full_name: gateOptions.repository } } } };

test("same-repository Dependabot PRs require sync independently of changed paths", () => {
  for (const files of [["package.json"], ["bun.lock"], [".github/workflows/client.yml"], ["docs/generated.mdx"], ["unrecognized.txt"]]) {
    assert(expectedWorkflowNames(files, dependabotContext).includes("Dependabot Sync"));
    assert(!expectedWorkflowNames(files).includes("Dependabot Sync"));
    assert(!expectedWorkflowNames(files, { ...dependabotContext, pullRequest: { ...dependabotContext.pullRequest, head: { repo: { full_name: "fork/example" } } } }).includes("Dependabot Sync"));
  }
});

test("Dependabot cannot pass with missing, failed, cancelled, skipped or pending sync", async () => {
  for (const conclusion of [undefined, "failure", "cancelled", "skipped", "pending"]) {
    const runs = conclusion === undefined ? [] : [workflowRun("Dependabot Sync", { id: 42, conclusion, status: conclusion === "pending" ? "in_progress" : "completed" })];
    await assert.rejects(runGate({ ...gateOptions, ...dependabotContext, maxAttempts: 1 }, {
      loadChangedFiles: async () => ["unrecognized.txt"],
      loadWorkflowRuns: async () => new Map(runs.map(run => [run.name, run])),
      logger: silentLogger,
    }), /did not succeed|timed out/);
  }
});

test("the no-repair job must succeed even when repair artifacts have been deleted", async () => {
  const dependencies = {
    loadChangedFiles: async () => ["unrecognized.txt"],
    loadWorkflowRuns: async () => new Map([["Dependabot Sync", workflowRun("Dependabot Sync", { id: 42 })]]),
    logger: silentLogger,
  };
  const job = { name: "Synchronized dependency files", status: "completed", conclusion: "success" };
  for (const jobs of [[], ...["skipped", "cancelled", "failure"].map(conclusion => [{ ...job, conclusion }]), [{ ...job, status: "in_progress", conclusion: null }]]) {
    await assert.rejects(runGate({ ...gateOptions, ...dependabotContext }, { ...dependencies, loadWorkflowJobs: async () => jobs }), /Dependabot Sync required job Synchronized dependency files/);
  }
  await runGate({ ...gateOptions, ...dependabotContext }, { ...dependencies, loadWorkflowJobs: async () => [job] });
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

test("Shared requires both successful shard jobs even when its workflow reports success", async () => {
  const jobs = [
    { name: "Test (1/2)", status: "completed", conclusion: "success" },
    { name: "Test (2/2)", status: "completed", conclusion: "success" },
  ];
  const dependencies = {
    loadChangedFiles: async () => ["packages/shared/src/index.ts"],
    selectWorkflows: () => ["Shared"],
    loadWorkflowRuns: async () => new Map([["Shared", workflowRun("Shared", { id: 42 })]]),
    loadWorkflowJobs: async () => jobs,
    logger: silentLogger,
  };

  await runGate(gateOptions, dependencies);
  await assert.rejects(
    runGate(gateOptions, { ...dependencies, loadWorkflowJobs: async () => jobs.slice(0, 1) }),
    /Shared.*Test \(2\/2\)/,
  );
  await assert.rejects(
    runGate(gateOptions, { ...dependencies, loadWorkflowJobs: async () => [jobs[0], { ...jobs[1], conclusion: "failure" }] }),
    /Shared.*Test \(2\/2\)/,
  );
});

for (const [workflow, jobName] of [["Client", "Playwright Client CI"], ["Admin", "Playwright Admin CI"]]) {
  test(`${workflow} requires its browser job despite a successful workflow`, async () => {
    const dependencies = {
      loadChangedFiles: async () => ["fixture.txt"],
      selectWorkflows: () => [workflow],
      loadWorkflowRuns: async (_token, _repo, sha) => {
        assert.equal(sha, gateOptions.headSha);
        return new Map([[workflow, workflowRun(workflow, { id: 42 })]]);
      },
      logger: silentLogger,
    };
    const job = { name: jobName, status: "completed", conclusion: "success" };
    await runGate(gateOptions, { ...dependencies, loadWorkflowJobs: async () => [job] });
    for (const jobs of [[], ...["skipped", "cancelled", "failure"].map(conclusion => [{ ...job, conclusion }]), [{ ...job, status: "in_progress", conclusion: null }]]) {
      await assert.rejects(runGate(gateOptions, { ...dependencies, loadWorkflowJobs: async () => jobs }), new RegExp(`${workflow} required job ${jobName}`));
    }
  });
}

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

test("every Shared critical override path fans out to the consumer workflows CI owns", () => {
  // The local critical push proves owner typecheck and focused suite plus consumer typechecks;
  // CI must therefore run the whole consumer suites and builds for every such path (D15).
  const policy = loadPolicy();
  const rules = policy.criticalOverrides.filter(
    (rule) => rule.id === SHARED_CRITICAL_RULE_ID || rule.id === "reporting-permission-payloads",
  );
  const samples = rules.flatMap((rule) => [
    ...(rule.exact ?? []),
    ...(rule.prefixes ?? []).map((prefix) => (prefix.endsWith("/") ? `${prefix}index.ts` : prefix)),
  ]);
  assert.ok(samples.length > 100, "the Shared critical override lists its paths");
  for (const path of samples) {
    const workflows = expectedWorkflowNames([path]);
    for (const name of ["Shared", "Client", "Admin", "Agent"]) {
      assert.ok(workflows.includes(name), `${path} must trigger ${name}`);
    }
  }
});
