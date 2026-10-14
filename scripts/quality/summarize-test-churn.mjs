#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function category(path) {
  if (/(?:^|\/)(?:__tests__|test|tests)\//.test(path) || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path)) {
    return "test";
  }
  if (
    (/^packages\/[^/]+\//.test(path) || /^scripts\//.test(path) || /^docs\/src\//.test(path)) &&
    /\.(?:[cm]?[jt]sx?|sol|json|graphql)$/.test(path) &&
    !/\.(?:stories|story)\.[cm]?[jt]sx?$/.test(path) &&
    !path.includes("/__mocks__/")
  ) {
    return "source";
  }
  return "other";
}

export function summarizeTestChurn(numstat, nameStatus) {
  const result = {
    source: { added: 0, deleted: 0, filesAdded: 0, filesDeleted: 0 },
    test: { added: 0, deleted: 0, filesAdded: 0, filesDeleted: 0 },
    other: { filesAdded: 0, filesDeleted: 0 },
  };

  for (const row of numstat.split("\0").filter(Boolean)) {
    const firstTab = row.indexOf("\t");
    const secondTab = row.indexOf("\t", firstTab + 1);
    if (firstTab < 0 || secondTab < 0) throw new Error("Malformed Git numstat row");
    const bucket = category(row.slice(secondTab + 1));
    if (bucket === "other") continue;
    const added = row.slice(0, firstTab);
    const deleted = row.slice(firstTab + 1, secondTab);
    if (/^\d+$/.test(added)) result[bucket].added += Number(added);
    if (/^\d+$/.test(deleted)) result[bucket].deleted += Number(deleted);
  }

  const statuses = nameStatus.split("\0").filter(Boolean);
  if (statuses.length % 2 !== 0) throw new Error("Malformed Git name-status output");
  for (let index = 0; index < statuses.length; index += 2) {
    const status = statuses[index];
    const bucket = category(statuses[index + 1]);
    if (status === "A") result[bucket].filesAdded += 1;
    if (status === "D") result[bucket].filesDeleted += 1;
  }
  return result;
}

export function formatTestChurnSummary(result) {
  const sourceLines = result.source.added + result.source.deleted;
  const testLines = result.test.added + result.test.deleted;
  const ratio = sourceLines === 0
    ? `n/a (no source lines changed; ${testLines} test lines changed)`
    : `${(testLines / sourceLines).toFixed(2)} (${testLines} test / ${sourceLines} source)`;
  return [
    "### Test/source change summary",
    "",
    "Changed lines are additions plus deletions in package and script code. This is an informational diff measure.",
    "",
    "| Category | Lines added | Lines deleted | Files added | Files deleted |",
    "|---|---:|---:|---:|---:|",
    `| Source | ${result.source.added} | ${result.source.deleted} | ${result.source.filesAdded} | ${result.source.filesDeleted} |`,
    `| Test | ${result.test.added} | ${result.test.deleted} | ${result.test.filesAdded} | ${result.test.filesDeleted} |`,
    `| Other files | — | — | ${result.other.filesAdded} | ${result.other.filesDeleted} |`,
    "",
    `Test/source changed-line ratio: ${ratio}.`,
    "",
  ].join("\n");
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!["--base", "--head", "--summary"].includes(key) || !value) {
      throw new Error(`Expected --base, --head, or --summary with a value; received ${key ?? "nothing"}`);
    }
    options[key.slice(2)] = value;
  }
  if (!options.base || !options.head) throw new Error("--base and --head are required");
  return options;
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const base = /^0{40}$/.test(options.base)
    ? git(["rev-list", "--max-parents=0", options.head]).trim().split(/\r?\n/)[0]
    : options.base;
  const result = summarizeTestChurn(
    git(["diff", "--numstat", "--no-renames", "--no-ext-diff", "-z", base, options.head]),
    git(["diff", "--name-status", "--no-renames", "--no-ext-diff", "-z", base, options.head]),
  );
  const summary = formatTestChurnSummary(result);
  if (options.summary) appendFileSync(resolve(options.summary), summary);
  else process.stdout.write(summary);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
