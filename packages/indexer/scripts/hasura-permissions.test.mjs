import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  parseTableList,
  planPublicAggregationPermission,
  requiredAggregateRootsPresent,
} from "./hasura-permissions.mjs";

async function fixture(name) {
  const source = await readFile(
    new URL(`./fixtures/hasura-permissions/${name}.json`, import.meta.url),
    "utf8"
  );
  return JSON.parse(source);
}

function actionIds(plan) {
  return plan.actions.map(({ kind, table }) => `${kind}:${table}`);
}

describe("Hasura public aggregation permission planner", () => {
  it("recognizes complete permissions without widening their existing shape", async () => {
    const { metadata, requiredTables } = await fixture("complete");
    const plan = planPublicAggregationPermission(metadata, requiredTables);

    assert.deepEqual(plan.actions, []);
    assert.deepEqual(plan.satisfied, ["CommitmentPool", "Disbursement"]);
    assert.deepEqual(plan.kept, []);
    assert.deepEqual(plan.malformed, []);
  });

  it("tracks missing tables and creates only missing public permissions", async () => {
    const { metadata, requiredTables } = await fixture("missing");
    const plan = planPublicAggregationPermission(metadata, requiredTables);

    assert.deepEqual(actionIds(plan), [
      "track:CommitmentPool",
      "create:CommitmentPool",
      "create:Disbursement",
    ]);
    assert.equal(plan.actions[0].request.type, "pg_track_table");
  });

  it("replaces exactly the planner-owned unrestricted shape in one bulk request", async () => {
    const { metadata, requiredTables } = await fixture("replaceable-unrestricted");
    const plan = planPublicAggregationPermission(metadata, requiredTables);

    assert.deepEqual(actionIds(plan), ["replace:CommitmentPool"]);
    assert.equal(plan.actions[0].request.type, "bulk");
    assert.deepEqual(
      plan.actions[0].request.args.map(({ type }) => type),
      ["pg_drop_select_permission", "pg_create_select_permission"]
    );
  });

  it("preserves allowlists, filters, and limits with named reasons", async () => {
    const { metadata, requiredTables } = await fixture("restricted-preserve");
    const plan = planPublicAggregationPermission(metadata, requiredTables);

    assert.deepEqual(plan.actions, []);
    assert.deepEqual(
      plan.kept.map(({ table, reason }) => `${table}:${reason}`),
      ["Allowlist:column-allowlist", "Filtered:row-filter", "Limited:extra-options"]
    );
  });

  it("continues planning valid tables while reporting malformed metadata", async () => {
    const { metadata, requiredTables } = await fixture("partial-malformed");
    const plan = planPublicAggregationPermission(metadata, requiredTables);

    assert.deepEqual(actionIds(plan), ["create:Good"]);
    assert.deepEqual(plan.malformed, [
      { table: "Broken", reason: "select_permissions must be an array" },
    ]);
  });

  it("makes retry work a subset of the original plan and becomes idempotent", async () => {
    const retry = await fixture("retry");
    const original = planPublicAggregationPermission(retry.initialMetadata, retry.requiredTables);
    const remainder = planPublicAggregationPermission(
      retry.afterPartialMetadata,
      retry.requiredTables
    );
    const complete = planPublicAggregationPermission(retry.completeMetadata, retry.requiredTables);

    assert.ok(actionIds(remainder).every((id) => actionIds(original).includes(id)));
    assert.deepEqual(actionIds(remainder), ["create:C"]);
    assert.deepEqual(complete.actions, []);
    assert.deepEqual(complete.satisfied, ["A", "B", "C"]);
  });
});

describe("Hasura permission parsing helpers", () => {
  it("parses run_sql table results and rejects malformed payloads", () => {
    assert.deepEqual(
      parseTableList({ result: [["tablename"], ["CommitmentPool"], ["envio_chains"]] }),
      ["CommitmentPool", "envio_chains"]
    );
    assert.throws(() => parseTableList({ result: "nope" }), /result must be an array/);
  });

  it("requires every aggregate root in an introspection response", () => {
    const schema = {
      data: {
        __schema: {
          queryType: {
            fields: [{ name: "CommitmentPool_aggregate" }, { name: "Disbursement_aggregate" }],
          },
        },
      },
    };

    assert.equal(
      requiredAggregateRootsPresent(schema, ["CommitmentPool", "Disbursement"]),
      true
    );
    assert.equal(
      requiredAggregateRootsPresent(schema, ["CommitmentPool", "Missing"]),
      false
    );
  });
});

describe("Hasura permission shell boundary", () => {
  it("keeps policy in the planner and the shell below its size cap", async () => {
    const shell = await readFile(new URL("./track-hasura-tables.sh", import.meta.url), "utf8");

    assert.ok(shell.trimEnd().split("\n").length <= 120);
    assert.doesNotMatch(shell, /allow_aggregations|pg_create_select_permission|pg_drop_select_permission/);
    assert.match(shell, /node "\$PLANNER" plan/);
    assert.match(shell, /node "\$PLANNER" requests/);
  });
});
