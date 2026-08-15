#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseBaseArgs, resolveGitBase, runGit } from "../lib/git-guardrails.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "../..");
const datedReportPattern = /^\.plans\/(?:[^/]+\/)*reports\/(?:[^/]+\/)*[^/]*\d{4}-\d{2}-\d{2}.*\.md$/;
const liveReportPattern = /^\.plans\/(active|backlog|ideas)\/([^/]+)\/reports\/(.+)$/;
const archivedReportPattern = /^\.plans\/archive\/([^/]+)\/reports\/(.+)$/;

function statusDetails(statusToken) {
  const status = statusToken[0];
  const similarityMatch = /^(?:R|C)(\d+)$/.exec(statusToken);
  return {
    status,
    ...(similarityMatch ? { similarity: Number(similarityMatch[1]) } : {}),
  };
}

export function parseNameStatus(output) {
  if (output.includes("\0")) {
    const fields = output.split("\0");
    const entries = [];
    for (let index = 0; index < fields.length && fields[index]; ) {
      const statusField = fields[index++];
      const [statusToken, inlinePath] = statusField.split("\t", 2);
      const details = statusDetails(statusToken);
      const { status } = details;
      if (status === "R" || status === "C") {
        const oldPath = inlinePath ?? fields[index++];
        entries.push({ ...details, oldPath, path: fields[index++] });
      } else {
        entries.push({ ...details, path: inlinePath ?? fields[index++] });
      }
    }
    return entries;
  }
  const entries = [];
  for (const line of output.split(/\r?\n/)) {
    if (!line) continue;
    const fields = line.split("\t");
    const details = statusDetails(fields[0]);
    const { status } = details;
    if ((status === "R" || status === "C") && fields.length >= 3) {
      entries.push({ ...details, oldPath: fields[1], path: fields[2] });
    } else if (fields.length >= 2) {
      entries.push({ ...details, path: fields[1] });
    }
  }
  return entries;
}

function isCanonicalArchiveMove(entry) {
  if (entry.status !== "R" || entry.similarity !== 100 || !entry.oldPath || !entry.path) {
    return false;
  }
  const source = liveReportPattern.exec(entry.oldPath);
  const destination = archivedReportPattern.exec(entry.path);
  return Boolean(
    source &&
      destination &&
      source[2] === destination[1] &&
      source[3] === destination[2],
  );
}

export function immutableReportViolations(entries) {
  const failures = [];
  for (const entry of entries) {
    if (entry.status === "A" || entry.status === "C") continue;
    const historicalPath = entry.oldPath ?? entry.path;
    if (isCanonicalArchiveMove(entry)) continue;
    if (datedReportPattern.test(historicalPath)) {
      failures.push(`${entry.status}: ${historicalPath}`);
    }
  }
  return failures;
}

function main() {
  try {
    const args = parseBaseArgs(process.argv.slice(2));
    const base = resolveGitBase({
      repoRoot,
      explicitBase: args.base,
      environmentVariables: ["PLAN_REPORTS_BASE_REF", "GUIDANCE_BASE_REF"],
    });
    const entries = [
      ...(base
        ? parseNameStatus(
            runGit(repoRoot, [
              "diff",
              "--name-status",
              "-z",
              "--find-renames",
              `${base}...HEAD`,
              "--",
              ".plans",
            ]).stdout,
          )
        : []),
      ...parseNameStatus(
        runGit(repoRoot, ["diff", "--name-status", "-z", "--find-renames", "HEAD", "--", ".plans"])
          .stdout,
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
