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

test("guidance-consumer source changes also require supply-chain guardrails", () => {
  assert.deepEqual(expectedWorkflowNames(["packages/agent/src/index.ts"]), [
    "Agent",
    "Shared",
    "Supply Chain Guardrails",
  ]);
});

test("contract source changes include every contract consumer", () => {
  assert.deepEqual(expectedWorkflowNames(["packages/contracts/src/Gardens.sol"]), [
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
    "Shared",
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

test("workflow changes require their workflow plus shared and supply-chain checks", () => {
  assert.deepEqual(expectedWorkflowNames([".github/workflows/docs.yml"]), [
    "Docs",
    "Shared",
    "Supply Chain Guardrails",
  ]);
});

test("CI Gate script changes require shared and supply-chain workflows", () => {
  assert.deepEqual(expectedWorkflowNames(["scripts/quality/ci-gate.mjs"]), [
    "Shared",
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
