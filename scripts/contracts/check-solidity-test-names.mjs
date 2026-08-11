#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "../..");
const acceptedPatterns = [
  /^test(?!Fuzz_|Integration_|Upgrade_|E2E_)[A-Z][A-Za-z0-9]*_[a-z][A-Za-z0-9_]*$/,
  /^testFuzz_[A-Z][A-Za-z0-9]*_[a-z][A-Za-z0-9_]*$/,
  /^testIntegration_[A-Z][A-Za-z0-9]*_[a-z][A-Za-z0-9_]*$/,
  /^testUpgrade_[A-Z][A-Za-z0-9]*_[a-z][A-Za-z0-9_]*$/,
  /^testE2E_[A-Z][A-Za-z0-9]*_[a-z][A-Za-z0-9_]*$/,
  /^invariant_[A-Z][A-Za-z0-9]*_[a-z][A-Za-z0-9_]*$/,
];

function runGit(args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
  }
  return result;
}

export function isCanonicalSolidityTestName(name) {
  return acceptedPatterns.some((pattern) => pattern.test(name));
}

export function addedTestFunctionsFromDiff(diff) {
  const functions = [];
  let currentFile;
  let newLine = 0;
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith("+++ b/")) {
      currentFile = line.slice(6);
      continue;
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      newLine = Number(hunk[1]);
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      const match = line.slice(1).match(/^\s*function\s+((?:test|invariant)[A-Za-z0-9_]*)\s*\(/);
      if (match) functions.push({ file: currentFile, line: newLine, name: match[1] });
      newLine++;
    } else if (!line.startsWith("-")) {
      newLine++;
    }
  }
  return functions;
}

export function testFunctionsFromSource(source, file) {
  const functions = [];
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    const match = line.match(/^\s*function\s+((?:test|invariant)[A-Za-z0-9_]*)\s*\(/);
    if (match) functions.push({ file, line: index + 1, name: match[1] });
  }
  return functions;
}

function parseArgs(argv) {
  let base;
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === "--base") {
      if (!argv[index + 1]) throw new Error("--base requires a Git ref");
      base = argv[++index];
    } else {
      throw new Error(`unknown argument: ${argv[index]}`);
    }
  }
  return { base };
}

function resolveBase(explicitBase) {
  const candidate =
    explicitBase || process.env.SOLIDITY_TEST_BASE_REF || process.env.SOURCE_STRUCTURE_BASE_REF;
  if (candidate) return candidate;
  const fallback = runGit(["rev-parse", "--verify", "--quiet", "origin/develop"], {
    allowFailure: true,
  });
  if (fallback.status !== 0) throw new Error("no base ref supplied and origin/develop is unavailable");
  return "origin/develop";
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const base = resolveBase(args.base);
    if (runGit(["rev-parse", "--verify", "--quiet", `${base}^{commit}`], { allowFailure: true }).status !== 0) {
      throw new Error(`base ref does not resolve to a commit: ${base}`);
    }
    const committedDiff = runGit([
      "diff",
      "--unified=0",
      "--no-color",
      `${base}...HEAD`,
      "--",
      "packages/contracts/test",
    ]).stdout;
    const workingDiff = runGit([
      "diff",
      "--unified=0",
      "--no-color",
      "HEAD",
      "--",
      "packages/contracts/test",
    ]).stdout;
    const untrackedFiles = runGit([
      "ls-files",
      "--others",
      "--exclude-standard",
      "--",
      "packages/contracts/test",
    ]).stdout
      .split(/\r?\n/)
      .filter(Boolean);
    const untracked = untrackedFiles.flatMap((file) =>
      testFunctionsFromSource(fs.readFileSync(path.join(repoRoot, file), "utf8"), file),
    );
    const added = [
      ...new Map(
        [
          ...addedTestFunctionsFromDiff(committedDiff),
          ...addedTestFunctionsFromDiff(workingDiff),
          ...untracked,
        ].map((entry) => [`${entry.file}:${entry.line}:${entry.name}`, entry]),
      ).values(),
    ];
    const failures = added.filter((entry) => !isCanonicalSolidityTestName(entry.name));
    if (failures.length > 0) {
      console.error(`check-solidity-test-names: ${failures.length} new test name violation(s):`);
      for (const failure of failures) {
        console.error(`- ${failure.file}:${failure.line}: ${failure.name}`);
      }
      console.error(
        "Use test[Subject]_[scenario], testFuzz_/testIntegration_/testUpgrade_/testE2E_[Subject]_[scenario], or invariant_[Subject]_[property].",
      );
      process.exit(1);
    }
    console.log(
      `check-solidity-test-names: ${added.length} added or renamed Solidity test function(s) follow the canonical format.`,
    );
  } catch (error) {
    console.error(`check-solidity-test-names: ${error.message}`);
    process.exit(2);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) main();
