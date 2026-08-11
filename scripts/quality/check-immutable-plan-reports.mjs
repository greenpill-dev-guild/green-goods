#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "../..");
const datedReportPattern = /^\.plans\/(?:[^/]+\/)+reports\/.+\d{4}-\d{2}-\d{2}.*\.md$/;

function runGit(args, { allowFailure = false } = {}) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
  }
  return result;
}

export function parseNameStatus(output) {
  const entries = [];
  for (const line of output.split(/\r?\n/)) {
    if (!line) continue;
    const fields = line.split("\t");
    const status = fields[0][0];
    if ((status === "R" || status === "C") && fields.length >= 3) {
      entries.push({ status, oldPath: fields[1], path: fields[2] });
    } else if (fields.length >= 2) {
      entries.push({ status, path: fields[1] });
    }
  }
  return entries;
}

export function immutableReportViolations(entries) {
  const failures = [];
  for (const entry of entries) {
    if (entry.status === "A" || entry.status === "C") continue;
    const historicalPath = entry.oldPath ?? entry.path;
    if (datedReportPattern.test(historicalPath)) {
      failures.push(`${entry.status}: ${historicalPath}`);
    }
  }
  return failures;
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
  const candidate = explicitBase || process.env.PLAN_REPORTS_BASE_REF || process.env.GUIDANCE_BASE_REF;
  if (candidate) return candidate;
  if (runGit(["rev-parse", "--verify", "--quiet", "origin/develop"], { allowFailure: true }).status === 0) {
    return "origin/develop";
  }
  throw new Error("no base ref supplied and origin/develop is unavailable");
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const base = resolveBase(args.base);
    if (runGit(["rev-parse", "--verify", "--quiet", `${base}^{commit}`], { allowFailure: true }).status !== 0) {
      throw new Error(`base ref does not resolve to a commit: ${base}`);
    }
    const entries = [
      ...parseNameStatus(
        runGit(["diff", "--name-status", "--find-renames", `${base}...HEAD`, "--", ".plans"])
          .stdout,
      ),
      ...parseNameStatus(
        runGit(["diff", "--name-status", "--find-renames", "HEAD", "--", ".plans"]).stdout,
      ),
    ];
    const failures = immutableReportViolations(entries);
    if (failures.length > 0) {
      console.error(`check-immutable-plan-reports: ${failures.length} immutable report change(s):`);
      for (const failure of failures) console.error(`- ${failure}`);
      console.error("Restore the historical report and add a new correction or closure artifact.");
      process.exit(1);
    }
    console.log("check-immutable-plan-reports: existing dated reports are unchanged.");
  } catch (error) {
    console.error(`check-immutable-plan-reports: ${error.message}`);
    process.exit(2);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) main();
