#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const WORK_BRANCH_TYPES = [
  "feature",
  "fix",
  "refactor",
  "docs",
  "chore",
  "test",
  "perf",
  "ci",
  "release",
  "research",
];

const WORK_BRANCH_PATTERN = new RegExp(
  `^(${WORK_BRANCH_TYPES.join("|")})/[a-z0-9]+(-[a-z0-9]+)*$`,
);
const AGENT_IDENTITY_PATTERN = /(^|[-/])(codex|claude)([-/]|$)/i;
const LINEAR_ID_PATTERN = /(^|[-/])(prd|resr|com|grow|mar)-[0-9]+([-/]|$)/i;
const LANE_ONLY_DESCRIPTIONS = new Set(["ui", "state-api", "contracts", "qa-pass-1", "qa-pass-2"]);

export function workBranchNameErrors(branch) {
  if (typeof branch !== "string" || !WORK_BRANCH_PATTERN.test(branch)) {
    return [
      `Branch must match <type>/<concrete-kebab-case-work-description>; allowed types: ${WORK_BRANCH_TYPES.join(", ")}.`,
    ];
  }

  const errors = [];
  const description = branch.slice(branch.indexOf("/") + 1);
  if (AGENT_IDENTITY_PATTERN.test(branch)) {
    errors.push("Branch must not encode a Codex or Claude identity.");
  }
  if (LINEAR_ID_PATTERN.test(branch)) {
    errors.push("Branch must not encode a Linear issue identifier.");
  }
  if (LANE_ONLY_DESCRIPTIONS.has(description)) {
    errors.push("Branch description must name concrete work, not only an orchestration lane.");
  }
  return errors;
}

export function isWorkBranchName(branch) {
  return workBranchNameErrors(branch).length === 0;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const branch = process.argv[2];
  if (!branch) {
    console.error("Usage: branch-name-policy.mjs <branch-name>");
    process.exit(1);
  }

  const errors = workBranchNameErrors(branch);
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(error);
    }
    process.exit(1);
  }

  console.log(branch);
}
