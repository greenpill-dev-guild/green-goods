#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(new URL("../..", import.meta.url).pathname);
const NEW_FILE_MAX_LINES = 350;
const MODIFIED_FILE_MAX_LINES = 500;
const ZERO_SHA = "0000000000000000000000000000000000000000";

const FROZEN_ALLOWLIST = {
  "packages/admin/src/components/Assessment/CreateAssessmentSteps/StrategyKernelStep.tsx": 542,
  "packages/admin/src/components/Garden/CreateGardenSteps/DetailsStep.tsx": 503,
  "packages/admin/src/components/Layout/CommandPalette.tsx": 559,
  "packages/admin/src/views/Garden/CreateAssessment.tsx": 580,
  "packages/admin/src/views/Garden/SubmitWork.tsx": 513,
  "packages/admin/src/views/Hub/index.tsx": 591,
  "packages/agent/src/services/db.ts": 553,
  "packages/client/src/components/Dialogs/ConvictionDrawer.tsx": 538,
  "packages/client/src/views/Garden/index.tsx": 601,
  "packages/client/src/views/Garden/Media.tsx": 534,
  "packages/client/src/views/Home/Garden/Work.tsx": 646,
  "packages/client/src/views/Home/WorkDashboard/index.tsx": 503,
  "packages/contracts/src/modules/Gardens.sol": 845,
  "packages/contracts/src/modules/Hats.sol": 851,
  "packages/contracts/src/modules/Octant.sol": 769,
  "packages/contracts/src/resolvers/Yield.sol": 841,
  "packages/contracts/src/tokens/Garden.sol": 527,
  "packages/shared/src/components/Toast/toast.service.tsx": 664,
  "packages/shared/src/hooks/work/useWorkApproval.ts": 535,
  "packages/shared/src/hooks/work/useWorkMutation.ts": 612,
  "packages/shared/src/index.ts": 1024,
  "packages/shared/src/modules/app/posthog.ts": 528,
  "packages/shared/src/modules/data/eas.ts": 618,
  "packages/shared/src/modules/data/marketplace.ts": 550,
  "packages/shared/src/modules/job-queue/db.ts": 540,
  "packages/shared/src/modules/job-queue/index.ts": 544,
  "packages/shared/src/providers/Auth.tsx": 633,
  "packages/shared/src/types/domain.ts": 553,
  "packages/shared/src/utils/errors/contract-errors.ts": 605,
  "packages/shared/src/utils/time.ts": 576,
  "packages/shared/src/workflows/authMachine.ts": 722,
};

function runGit(args, { allowFailure = false } = {}) {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    if (allowFailure) {
      return "";
    }

    const stderr = error.stderr?.toString().trim();
    if (stderr) {
      console.error(stderr);
    }
    process.exit(2);
  }
}

function parseArgs(argv) {
  const args = { base: process.env.SOURCE_STRUCTURE_BASE_REF || "" };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--base") {
      args.base = argv[index + 1] || "";
      index += 1;
    }
  }

  return args;
}

function listFromGit(args, options) {
  const output = runGit(args, options);
  if (!output) {
    return [];
  }

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function countLines(text) {
  if (text.length === 0) {
    return 0;
  }

  const newlineCount = (text.match(/\n/g) || []).length;
  return text.endsWith("\n") ? newlineCount : newlineCount + 1;
}

function isPackageSourcePath(filePath) {
  return /^packages\/[^/]+\/src\//.test(filePath);
}

function isGeneratedOrVendoredPath(filePath) {
  return /(^|\/)(node_modules|generated|lib|vendor)(\/|$)/.test(filePath);
}

function isTestOrStoryPath(filePath) {
  return (
    /(^|\/)(__tests__|test|tests)(\/|$)/.test(filePath) ||
    /\.(test|spec|stories)\.(js|jsx|ts|tsx)$/.test(filePath)
  );
}

function isRelevantSourceFile(filePath) {
  if (!isPackageSourcePath(filePath)) {
    return false;
  }

  if (!/\.(ts|tsx|sol)$/.test(filePath) || /\.d\.ts$/.test(filePath)) {
    return false;
  }

  if (isGeneratedOrVendoredPath(filePath)) {
    return false;
  }

  if (isTestOrStoryPath(filePath)) {
    return false;
  }

  return true;
}

function isDisallowedJavaScriptSourceFile(filePath) {
  if (!isPackageSourcePath(filePath)) {
    return false;
  }

  if (!/\.(js|jsx)$/.test(filePath)) {
    return false;
  }

  if (isGeneratedOrVendoredPath(filePath)) {
    return false;
  }

  if (isTestOrStoryPath(filePath)) {
    return false;
  }

  return true;
}

function resolveChangedFiles(baseRef) {
  const changed = new Set();
  const added = new Set();

  if (baseRef && baseRef !== ZERO_SHA) {
    const mergeBase = runGit(["merge-base", "HEAD", baseRef], { allowFailure: true });
    const diffBase = mergeBase || baseRef;

    for (const filePath of listFromGit(["diff", "--name-only", "--diff-filter=AM", `${diffBase}...HEAD`])) {
      changed.add(filePath);
    }

    for (const filePath of listFromGit(["diff", "--name-only", "--diff-filter=A", `${diffBase}...HEAD`])) {
      added.add(filePath);
    }
  } else {
    for (const filePath of listFromGit(["diff", "--name-only", "--diff-filter=AM", "HEAD"])) {
      changed.add(filePath);
    }

    for (const filePath of listFromGit(["diff", "--name-only", "--diff-filter=A", "HEAD"])) {
      added.add(filePath);
    }

    for (const filePath of listFromGit(["ls-files", "--others", "--exclude-standard"])) {
      changed.add(filePath);
      added.add(filePath);
    }
  }

  return {
    changed: Array.from(changed).sort(),
    added,
  };
}

function readLineCount(filePath) {
  const absolutePath = resolve(repoRoot, filePath);
  const fileContents = readFileSync(absolutePath, "utf8");
  return countLines(fileContents);
}

function printFailure(messageLines) {
  console.error("❌ check-source-structure found file-length violations:");
  for (const line of messageLines) {
    console.error(line);
  }
  console.error("");
  console.error(
    "Remediation: split responsibilities into smaller modules, extract helpers/components, or reduce the touched file back under its frozen ceiling before merge.",
  );
  console.error(
    "Wave 1 does not raise allowlist ceilings in the same change. If a ceiling is wrong after a shrink, lower the allowlist to the new line count instead.",
  );
  process.exit(1);
}

function printDisallowedJavaScriptFailure(filePaths) {
  console.error("❌ check-source-structure found JavaScript in production package source:");
  for (const filePath of filePaths) {
    console.error(`- ${filePath}`);
  }
  console.error("");
  console.error(
    "Remediation: use .ts or .tsx for production package source. Keep JavaScript limited to tool-required config/scripts, generated/vendor files, or explicit test/story surfaces.",
  );
  process.exit(1);
}

const { base } = parseArgs(process.argv.slice(2));
const { changed, added } = resolveChangedFiles(base);
const disallowedJavaScriptFiles = changed
  .filter(isDisallowedJavaScriptSourceFile)
  .filter((filePath) => existsSync(resolve(repoRoot, filePath)));
const relevantFiles = changed.filter(isRelevantSourceFile).filter((filePath) => existsSync(resolve(repoRoot, filePath)));

if (disallowedJavaScriptFiles.length > 0) {
  printDisallowedJavaScriptFailure(disallowedJavaScriptFiles);
}

if (relevantFiles.length === 0) {
  console.log("✅ check-source-structure: no changed non-test source files in scope.");
  process.exit(0);
}

const failures = [];
let allowlistedChecks = 0;

for (const filePath of relevantFiles) {
  const lineCount = readLineCount(filePath);
  const frozenCeiling = FROZEN_ALLOWLIST[filePath];

  if (frozenCeiling !== undefined) {
    allowlistedChecks += 1;

    if (lineCount > frozenCeiling) {
      failures.push(
        `- ${filePath}: ${lineCount} lines, above frozen ceiling ${frozenCeiling}. Reduce this file back to ${frozenCeiling} lines or below before merge; Wave 1 does not allow this file to grow.`,
      );
    }
    continue;
  }

  if (added.has(filePath) && lineCount > NEW_FILE_MAX_LINES) {
    failures.push(
      `- ${filePath}: new file at ${lineCount} lines (limit ${NEW_FILE_MAX_LINES}). Split the new implementation into smaller files; new files do not get Wave 1 allowlist entries.`,
    );
    continue;
  }

  if (lineCount > MODIFIED_FILE_MAX_LINES) {
    failures.push(
      `- ${filePath}: modified file at ${lineCount} lines (limit ${MODIFIED_FILE_MAX_LINES}). Extract helpers, subcomponents, or shared modules before merge instead of widening the cap.`,
    );
  }
}

if (failures.length > 0) {
  printFailure(failures);
}

console.log(
  `✅ check-source-structure: checked ${relevantFiles.length} changed non-test source file(s); ${allowlistedChecks} oversized baseline file(s) stayed within frozen ceilings.`,
);
