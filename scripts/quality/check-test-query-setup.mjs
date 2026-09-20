#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseBaseArgs, resolveGitBase, runGit } from "../lib/git-guardrails.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "../..");
const testPath = /^packages\/(?:shared|client|admin)\/.*\.test\.[jt]sx?$/;
const duplicateSetup = /\b(?:function\s+createWrapper\s*\(|(?:const|let)\s+createWrapper\s*=|new\s+QueryClient\s*\()/;
const allowance = /TEST-QUALITY:\s*allow-local-query-setup\s+-\s+\S/;

export function addedQuerySetupFromDiff(diff) {
  const added = [];
  let file = "";
  let lineNumber = 0;
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith("+++ b/")) {
      file = line.slice(6);
      continue;
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      lineNumber = Number(hunk[1]);
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      if (testPath.test(file) && duplicateSetup.test(line.slice(1))) {
        added.push({ file, line: lineNumber });
      }
      lineNumber++;
    } else if (line.startsWith(" ")) {
      lineNumber++;
    }
  }
  return added;
}

export function newQuerySetupFromSource(source, file) {
  if (!testPath.test(file)) return [];
  return source.split(/\r?\n/).flatMap((line, index) =>
    duplicateSetup.test(line) ? [{ file, line: index + 1 }] : []
  );
}

export function hasQuerySetupAllowance(source, line) {
  return source
    .split(/\r?\n/)
    .slice(Math.max(0, line - 3), line)
    .some((entry) => allowance.test(entry));
}

function main() {
  try {
    const args = parseBaseArgs(process.argv.slice(2));
    const base = resolveGitBase({ repoRoot, explicitBase: args.base });
    const committed = base
      ? runGit(repoRoot, ["diff", "--unified=0", "--no-color", `${base}...HEAD`, "--", "packages/shared", "packages/client", "packages/admin"]).stdout
      : "";
    const working = runGit(repoRoot, ["diff", "--unified=0", "--no-color", "HEAD", "--", "packages/shared", "packages/client", "packages/admin"]).stdout;
    const untracked = runGit(repoRoot, ["ls-files", "--others", "--exclude-standard", "--", "packages/shared", "packages/client", "packages/admin"]).stdout
      .split(/\r?\n/)
      .filter((file) => testPath.test(file));
    const candidates = [
      ...addedQuerySetupFromDiff(committed),
      ...addedQuerySetupFromDiff(working),
      ...untracked.flatMap((file) => newQuerySetupFromSource(readFileSync(path.join(repoRoot, file), "utf8"), file)),
    ];
    const unique = [...new Map(candidates.map((item) => [`${item.file}:${item.line}`, item])).values()];
    const failures = unique.filter(({ file, line }) =>
      !hasQuerySetupAllowance(readFileSync(path.join(repoRoot, file), "utf8"), line)
    );
    if (failures.length > 0) {
      console.error("New local query setup needs a shared helper or a nearby TEST-QUALITY: allow-local-query-setup - reason comment:");
      for (const { file, line } of failures) console.error(`- ${file}:${line}`);
      process.exit(1);
    }
    console.log(`Test query setup: ${unique.length} new declaration(s), all justified.`);
  } catch (error) {
    console.error(`Test query setup check could not run: ${error.message}`);
    process.exit(2);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) main();
