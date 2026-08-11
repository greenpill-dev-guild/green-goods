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
  let hunk = [];
  let inHunk = false;
  const flushHunk = () => {
    if (!currentFile || hunk.length === 0) return;
    const source = hunk.map((entry) => entry.text).join("\n");
    for (const match of source.matchAll(/\bfunction\s+((?:test|invariant)[A-Za-z0-9_]*)\s*\(/g)) {
      const startIndex = source.slice(0, match.index).split("\n").length - 1;
      const endIndex = startIndex + match[0].split("\n").length - 1;
      if (!hunk.slice(startIndex, endIndex + 1).some((entry) => entry.added)) continue;
      const nameOffset = match[0].indexOf(match[1]);
      const nameIndex = startIndex + match[0].slice(0, nameOffset).split("\n").length - 1;
      functions.push({ file: currentFile, line: hunk[nameIndex].line, name: match[1] });
    }
    hunk = [];
  };
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith("+++ b/")) {
      flushHunk();
      currentFile = line.slice(6);
      inHunk = false;
      continue;
    }
    const hunkHeader = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkHeader) {
      flushHunk();
      newLine = Number(hunkHeader[1]);
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    if (line.startsWith("+") && !line.startsWith("+++")) {
      hunk.push({ text: line.slice(1), line: newLine, added: true });
      newLine++;
    } else if (!line.startsWith("-") && !line.startsWith("\\")) {
      hunk.push({ text: line.startsWith(" ") ? line.slice(1) : line, line: newLine, added: false });
      newLine++;
    }
  }
  flushHunk();
  return [...new Map(functions.map((entry) => [`${entry.file}:${entry.line}:${entry.name}`, entry])).values()];
}

export function testFunctionsFromSource(source, file) {
  const functions = [];
  for (const match of source.matchAll(/\bfunction\s+((?:test|invariant)[A-Za-z0-9_]*)\s*\(/g)) {
    const nameOffset = match[0].indexOf(match[1]);
    const line = source.slice(0, match.index + nameOffset).split(/\r?\n/).length;
    functions.push({ file, line, name: match[1] });
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
          "--unified=3",
          "--no-color",
          `${base}...HEAD`,
          "--",
          "packages/contracts/test",
        ]).stdout
      : "";
    const workingDiff = runGit(repoRoot, [
      "diff",
      "--unified=3",
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
