#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseBaseArgs, resolveGitBase, runGit } from "../lib/git-guardrails.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "../..");
const acceptedPatterns = [
  /^test(?!Fuzz_|Integration_|Upgrade_|E2E_|Revert_)[A-Z][A-Za-z0-9]*_[a-z][A-Za-z0-9_]*$/,
  /^testFuzz_[A-Z][A-Za-z0-9]*_[a-z][A-Za-z0-9_]*$/,
  /^testIntegration_[A-Z][A-Za-z0-9]*_[a-z][A-Za-z0-9_]*$/,
  /^testUpgrade_[A-Z][A-Za-z0-9]*_[a-z][A-Za-z0-9_]*$/,
  /^testE2E_[A-Z][A-Za-z0-9]*_[a-z][A-Za-z0-9_]*$/,
  /^invariant_[A-Z][A-Za-z0-9]*_[a-z][A-Za-z0-9_]*$/,
];

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
    } else if (!line.startsWith("-") && !line.startsWith("\\")) {
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

function main() {
  try {
    const args = parseBaseArgs(process.argv.slice(2));
    const base = resolveGitBase({
      repoRoot,
      explicitBase: args.base,
      environmentVariables: ["SOLIDITY_TEST_BASE_REF", "SOURCE_STRUCTURE_BASE_REF"],
    });
    const committedDiff = base
      ? runGit(repoRoot, [
          "diff",
          "--unified=0",
          "--no-color",
          `${base}...HEAD`,
          "--",
          "packages/contracts/test",
        ]).stdout
      : "";
    const workingDiff = runGit(repoRoot, [
      "diff",
      "--unified=0",
      "--no-color",
      "HEAD",
      "--",
      "packages/contracts/test",
    ]).stdout;
    const untrackedFiles = runGit(repoRoot, [
      "ls-files",
      "--others",
      "--exclude-standard",
      "--",
      "packages/contracts/test",
    ]).stdout
      .split(/\r?\n/)
      .filter((file) => file.endsWith(".sol"));
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
