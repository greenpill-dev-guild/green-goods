#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DEFAULT_OPTIONS = {
  source: "default",
  schema: "public",
  role: "public",
};

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function targetFor(table, options) {
  return {
    source: options.source,
    table: { schema: options.schema, name: table },
    role: options.role,
  };
}

function aggregationPermission() {
  return { columns: "*", filter: {}, allow_aggregations: true };
}

function createRequest(table, options) {
  return {
    type: "pg_create_select_permission",
    args: { ...targetFor(table, options), permission: aggregationPermission() },
  };
}

function action(kind, table, request) {
  return { kind, table, request };
}

function tableKey(table) {
  return `${table.schema}.${table.name}`;
}

function permissionDisposition(permission) {
  if (!isObject(permission)) return { kind: "malformed", reason: "permission must be an object" };
  if (permission.allow_aggregations === true) return { kind: "satisfied" };
  if (!("columns" in permission)) return { kind: "malformed", reason: "permission.columns is missing" };
  if (!("filter" in permission) || !isObject(permission.filter)) {
    return { kind: "malformed", reason: "permission.filter must be an object" };
  }
  if (permission.columns !== "*") return { kind: "kept", reason: "column-allowlist" };
  if (Object.keys(permission.filter).length > 0) return { kind: "kept", reason: "row-filter" };

  const extraKeys = Object.keys(permission).filter(
    (key) => !["columns", "filter", "allow_aggregations"].includes(key)
  );
  if (extraKeys.length > 0) return { kind: "kept", reason: "extra-options" };
  if (
    "allow_aggregations" in permission &&
    permission.allow_aggregations !== false &&
    permission.allow_aggregations !== undefined
  ) {
    return { kind: "malformed", reason: "allow_aggregations must be boolean" };
  }
  return { kind: "replace" };
}

export function planPublicAggregationPermission(metadata, requiredTables, opts = {}) {
  const options = { ...DEFAULT_OPTIONS, ...opts };
  const plan = { actions: [], kept: [], satisfied: [], malformed: [] };
  const tables = Array.isArray(requiredTables) ? [...new Set(requiredTables)] : [];
  const document = metadata?.metadata ?? metadata;

  if (
    !Array.isArray(requiredTables) ||
    !tables.every((table) => typeof table === "string" && table.length > 0)
  ) {
    plan.malformed.push({ table: "<requiredTables>", reason: "table names must be strings" });
    return plan;
  }
  if (!isObject(document) || !Array.isArray(document.sources)) {
    plan.malformed.push({ table: "<metadata>", reason: "metadata.sources must be an array" });
    return plan;
  }

  const sources = document.sources.filter((source) => source?.name === options.source);
  if (sources.length !== 1 || !Array.isArray(sources[0]?.tables)) {
    plan.malformed.push({
      table: "<metadata>",
      reason:
        sources.length !== 1
          ? `expected one ${options.source} source`
          : `${options.source}.tables must be an array`,
    });
    return plan;
  }

  const trackedByKey = new Map();
  for (const tracked of sources[0].tables) {
    if (
      !isObject(tracked?.table) ||
      typeof tracked.table.schema !== "string" ||
      typeof tracked.table.name !== "string"
    ) {
      continue;
    }
    const key = tableKey(tracked.table);
    const matches = trackedByKey.get(key) ?? [];
    matches.push(tracked);
    trackedByKey.set(key, matches);
  }

  for (const table of tables) {
    const target = { schema: options.schema, name: table };
    const matches = trackedByKey.get(tableKey(target)) ?? [];
    if (matches.length === 0) {
      plan.actions.push(
        action("track", table, {
          type: "pg_track_table",
          args: { source: options.source, table: target },
        }),
        action("create", table, createRequest(table, options))
      );
      continue;
    }
    if (matches.length > 1) {
      plan.malformed.push({ table, reason: "table is tracked more than once" });
      continue;
    }

    const tracked = matches[0];
    if (tracked.select_permissions === undefined) {
      plan.actions.push(action("create", table, createRequest(table, options)));
      continue;
    }
    if (!Array.isArray(tracked.select_permissions)) {
      plan.malformed.push({ table, reason: "select_permissions must be an array" });
      continue;
    }
    const malformedEntries = tracked.select_permissions.filter(
      (entry) => !isObject(entry) || typeof entry.role !== "string"
    );
    const permissions = tracked.select_permissions.filter((entry) => entry?.role === options.role);
    if (permissions.length === 0) {
      if (malformedEntries.length > 0) {
        plan.malformed.push({ table, reason: "select_permissions contains a malformed entry" });
      } else {
        plan.actions.push(action("create", table, createRequest(table, options)));
      }
      continue;
    }
    if (permissions.length > 1) {
      plan.malformed.push({ table, reason: `${options.role} permission is duplicated` });
      continue;
    }

    const disposition = permissionDisposition(permissions[0].permission);
    if (disposition.kind === "satisfied") {
      plan.satisfied.push(table);
    } else if (disposition.kind === "kept") {
      plan.kept.push({ table, reason: disposition.reason });
    } else if (disposition.kind === "malformed") {
      plan.malformed.push({ table, reason: disposition.reason });
    } else {
      const targetArgs = targetFor(table, options);
      plan.actions.push(
        action("replace", table, {
          type: "bulk",
          args: [
            { type: "pg_drop_select_permission", args: targetArgs },
            createRequest(table, options),
          ],
        })
      );
    }
  }

  return plan;
}

export function parseTableList(payload) {
  const document = typeof payload === "string" ? JSON.parse(payload) : payload;
  if (!Array.isArray(document?.result)) throw new TypeError("run_sql result must be an array");

  const rows = document.result.slice(1);
  if (!rows.every((row) => Array.isArray(row) && typeof row[0] === "string")) {
    throw new TypeError("run_sql table rows must contain string names");
  }
  return [...new Set(rows.map((row) => row[0]))];
}

export function requiredAggregateRootsPresent(schema, requiredTables, opts = {}) {
  let document;
  try {
    document = typeof schema === "string" ? JSON.parse(schema) : schema;
  } catch {
    return false;
  }
  const fields = document?.data?.__schema?.queryType?.fields;
  if (!Array.isArray(fields)) return false;
  const names = new Set(fields.map((field) => field?.name).filter(Boolean));
  const suffix = opts.aggregateRootSuffix ?? "_aggregate";
  return requiredTables.every((table) => names.has(`${table}${suffix}`));
}

async function stdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function requiredTablesFromEnvironment() {
  const encoded = process.env.HASURA_REQUIRED_TABLES_JSON;
  if (!encoded) throw new Error("HASURA_REQUIRED_TABLES_JSON is required");
  const tables = JSON.parse(encoded);
  if (!Array.isArray(tables)) throw new TypeError("required tables must be an array");
  return tables;
}

async function main() {
  const command = process.argv[2];
  const input = await stdin();
  if (command === "parse-tables") {
    process.stdout.write(JSON.stringify(parseTableList(input)));
    return;
  }
  if (command === "roots-present") {
    process.exitCode = requiredAggregateRootsPresent(input, requiredTablesFromEnvironment()) ? 0 : 1;
    return;
  }
  if (command === "plan") {
    const plan = planPublicAggregationPermission(
      JSON.parse(input),
      requiredTablesFromEnvironment()
    );
    process.stdout.write(JSON.stringify(plan));
    return;
  }
  if (command === "requests") {
    const plan = JSON.parse(input);
    process.stdout.write(plan.actions.map(({ request }) => JSON.stringify(request)).join("\n"));
    return;
  }
  if (command === "counts") {
    const plan = JSON.parse(input);
    process.stdout.write(
      [plan.actions.length, plan.kept.length, plan.satisfied.length, plan.malformed.length].join(" ")
    );
    return;
  }
  throw new Error(`Unknown command: ${command ?? "<missing>"}`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`hasura-permissions: ${error.message}\n`);
    process.exitCode = 1;
  });
}
