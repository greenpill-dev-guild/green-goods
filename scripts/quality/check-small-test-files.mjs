#!/usr/bin/env node
// A new test file with three cases or fewer needs a stated reason (testing.md § Test budget): add
// cases to the file that already covers the subject, and open a new file only for a new subject or
// a different environment.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseBaseArgs, resolveGitBase, runGit } from "../lib/git-guardrails.mjs";
import { blankNonCode } from "./shared-mutation-surface.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "../..");
const testPath = /\.test\.[cm]?[jt]sx?$/;
const allowance = /TEST-QUALITY:\s*allow-small-test-file\s+-\s+\S/;
export const MINIMUM_NEW_FILE_CASES = 4;

// `it(`/`test(` with modifiers, but not a method such as `pattern.test(`.
const CASE_CALL = /(?<![.\w$])(?:it|test)(?:\s*\.\s*(?:only|skip|todo|concurrent|sequential|fails))*\s*(?:\(|\.\s*(?:skipIf|runIf)\s*\()/g;
const TABLE_CALL = /(?<![.\w$])(?:it|test|describe)(?:\s*\.\s*(?:only|skip|concurrent|sequential|fails))*\s*\.\s*(?:each|for)\s*(\(|`)/g;

// Rows of the inline array literal that opens at `start`, or undefined when there is none.
function inlineRows(code, start) {
  let index = start;
  while (/\s/.test(code[index] ?? "")) index += 1;
  if (code[index] !== "[") return undefined;
  let depth = 0;
  let rows = 0;
  let sawValue = false;
  for (; index < code.length; index += 1) {
    const char = code[index];
    if ("[({".includes(char)) {
      depth += 1;
      if (depth > 1) sawValue = true;
      continue;
    }
    if ("])}".includes(char)) {
      depth -= 1;
      if (depth === 0) return rows + (sawValue ? 1 : 0);
      continue;
    }
    if (depth === 1 && char === ",") {
      if (sawValue) rows += 1;
      sawValue = false;
    } else if (depth >= 1 && !/\s/.test(char)) {
      sawValue = true;
    }
  }
  return undefined;
}

/**
 * The cases a test file declares: one per `it`/`test` call, and one per row of an `.each`/`.for`
 * table. A table whose rows are not written inline counts as the minimum, since its size is unknown.
 */
export function countTestCases(source) {
  const code = blankNonCode(source);
  let cases = [...code.matchAll(CASE_CALL)].length;
  for (const match of code.matchAll(TABLE_CALL)) {
    const opener = match.index + match[0].length;
    if (match[1] === "`") {
      const end = code.indexOf("`", opener);
      const body = code.slice(opener, end === -1 ? code.length : end);
      cases += body.split("\n").filter((line) => line.includes("${")).length;
    } else {
      cases += inlineRows(code, opener) ?? MINIMUM_NEW_FILE_CASES;
    }
  }
  return cases;
}

export function hasSmallTestFileAllowance(source) {
  return allowance.test(source);
}

/** The new test files among `files` that declare too few cases and give no reason. */
export function smallNewTestFiles(files, readSource) {
  return files
    .filter((file) => testPath.test(file))
    .flatMap((file) => {
      const source = readSource(file);
      const cases = countTestCases(source);
      return cases < MINIMUM_NEW_FILE_CASES && !hasSmallTestFileAllowance(source) ? [{ file, cases }] : [];
    });
}

function namesFrom(output) {
  return output.split(/\r?\n/).filter(Boolean);
}

function main() {
  try {
    const args = parseBaseArgs(process.argv.slice(2));
    const base = resolveGitBase({ repoRoot, explicitBase: args.base });
    const added = new Set([
      ...(base ? namesFrom(runGit(repoRoot, ["diff", "--name-only", "--diff-filter=A", `${base}...HEAD`]).stdout) : []),
      ...namesFrom(runGit(repoRoot, ["diff", "--name-only", "--diff-filter=A", "HEAD"]).stdout),
      ...namesFrom(runGit(repoRoot, ["ls-files", "--others", "--exclude-standard"]).stdout),
    ]);
    const candidates = [...added].filter((file) => testPath.test(file) && existsSync(path.join(repoRoot, file))).sort();
    const failures = smallNewTestFiles(candidates, (file) => readFileSync(path.join(repoRoot, file), "utf8"));
    if (failures.length > 0) {
      console.error(
        `A new test file needs at least ${MINIMUM_NEW_FILE_CASES} cases, or a TEST-QUALITY: allow-small-test-file - reason comment ` +
          "saying why its cases cannot join the file that already covers the subject:",
      );
      for (const { file, cases } of failures) console.error(`- ${file} (${cases} case${cases === 1 ? "" : "s"})`);
      process.exit(1);
    }
    console.log(`New test files: ${candidates.length}, none too small without a reason.`);
  } catch (error) {
    console.error(`Small test file check could not run: ${error.message}`);
    process.exit(2);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) main();
