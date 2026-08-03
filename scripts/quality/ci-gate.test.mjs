import assert from "node:assert/strict";
import test from "node:test";

import { expectedWorkflowNames } from "./ci-gate.mjs";

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

test("isolated agent changes require only agent and shared workflows", () => {
  assert.deepEqual(expectedWorkflowNames(["packages/agent/src/index.ts"]), ["Agent", "Shared"]);
});

test("contract source changes include every contract consumer", () => {
  assert.deepEqual(expectedWorkflowNames(["packages/contracts/src/Gardens.sol"]), [
    "Admin",
    "Client",
    "Contracts",
    "Indexer",
    "Ontology",
    "Shared",
  ]);
});

test("ontology-scoped changes require the ontology workflow", () => {
  assert.deepEqual(expectedWorkflowNames(["packages/shared/src/ontology/green-goods-ontology.json"]), [
    "Admin",
    "Agent",
    "Client",
    "Design",
    "Ontology",
  ]);
  assert.deepEqual(expectedWorkflowNames(["docs/docs/reference/glossary-community.md"]), ["Docs", "Ontology"]);
  assert.deepEqual(expectedWorkflowNames(["packages/indexer/schema.graphql"]), ["Indexer", "Ontology"]);
  assert.deepEqual(expectedWorkflowNames(["scripts/data/ontology-drift-baseline.json"]), ["Ontology"]);
  assert.deepEqual(expectedWorkflowNames([".plans/active/commitment-pooling/contract-spec.md"]), ["Ontology"]);
  assert.deepEqual(
    expectedWorkflowNames([".plans/active/commitment-pooling/standing-commitments-spec.md"]),
    ["Ontology"]
  );
  assert.deepEqual(expectedWorkflowNames([".plans/active/commitment-pooling/settlement-spec.md"]), ["Ontology"]);
  assert.deepEqual(expectedWorkflowNames(["packages/contracts/script/DeployBadgeSchema.s.sol"]), [
    "Contracts",
    "Ontology",
  ]);
});

test("docs-only changes require docs and no unrelated workflow", () => {
  assert.deepEqual(expectedWorkflowNames(["docs/docs/intro.md"]), ["Docs"]);
});

test("workflow changes require their workflow plus shared and supply-chain checks", () => {
  assert.deepEqual(expectedWorkflowNames([".github/workflows/docs.yml"]), [
    "Docs",
    "Shared",
    "Supply Chain Guardrails",
  ]);
});

test("CI Gate script changes require the shared workflow", () => {
  assert.deepEqual(expectedWorkflowNames(["scripts/quality/ci-gate.mjs"]), ["Shared"]);
});

test("source-structure changes require every workflow that runs the check", () => {
  assert.deepEqual(expectedWorkflowNames(["scripts/quality/check-source-structure.js"]), [
    "Admin",
    "Agent",
    "Client",
    "Contracts",
    "Indexer",
    "Shared",
  ]);
});
