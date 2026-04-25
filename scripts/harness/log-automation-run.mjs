#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const args = process.argv.slice(2);

function readFlag(name, { multiple = false } = {}) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === `--${name}`) {
      values.push(args[index + 1]);
      index += 1;
    }
  }
  return multiple ? values : values.at(-1);
}

function parseNumber(value) {
  if (value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

function parseBoolean(value) {
  if (value === undefined) return null;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Invalid boolean value "${value}". Use true or false.`);
}

function usage() {
  return [
    "Usage:",
    "  node scripts/log-automation-run.mjs \\",
    "    --feature <slug> \\",
    "    --loop <id> \\",
    "    --metric-name <name> \\",
    "    --metric-before <value> \\",
    "    --metric-after <value> \\",
    "    --decision keep|revert|bail|blocked \\",
    "    [--surface <absolute-or-repo-path>]... \\",
    "    [--tests-passed true|false] \\",
    "    [--warning-count-before <n>] \\",
    "    [--warning-count-after <n>] \\",
    "    [--duration-seconds <n>] \\",
    "    [--revert-reason <text>] \\",
    "    [--notes <text>] \\",
    "    [--dry-run]",
  ].join("\n");
}

try {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usage());
    process.exit(0);
  }

  const featureSlug = readFlag("feature");
  const loop = readFlag("loop");
  const metricName = readFlag("metric-name");
  const decision = readFlag("decision");

  if (!featureSlug || !loop || !metricName || !decision) {
    throw new Error("Missing required flags.\n\n" + usage());
  }

  const allowedDecisions = new Set(["keep", "revert", "bail", "blocked"]);
  if (!allowedDecisions.has(decision)) {
    throw new Error(`Invalid decision "${decision}". Use one of: ${Array.from(allowedDecisions).join(", ")}`);
  }

  const timestamp = new Date().toISOString();
  const filenameTimestamp = timestamp.replaceAll(":", "-").replaceAll(".", "-");

  const payload = {
    timestamp,
    feature_slug: featureSlug,
    loop,
    surface: readFlag("surface", { multiple: true }),
    metric_name: metricName,
    metric_before: parseNumber(readFlag("metric-before")),
    metric_after: parseNumber(readFlag("metric-after")),
    tests_passed: parseBoolean(readFlag("tests-passed")),
    warning_count_before: parseNumber(readFlag("warning-count-before")),
    warning_count_after: parseNumber(readFlag("warning-count-after")),
    decision,
    revert_reason: readFlag("revert-reason") ?? null,
    duration_seconds: parseNumber(readFlag("duration-seconds")),
    notes: readFlag("notes") ?? "",
  };

  if (args.includes("--dry-run")) {
    console.log(JSON.stringify(payload, null, 2));
    process.exit(0);
  }

  const outputPath = resolve(
    process.cwd(),
    ".plans",
    "_automation",
    "runs",
    `${filenameTimestamp}-${loop}.jsonl`
  );

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(payload)}\n`, "utf8");
  console.log(outputPath);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
