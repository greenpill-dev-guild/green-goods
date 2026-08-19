#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(new URL("../..", import.meta.url).pathname);
const NEW_FILE_MAX_LINES = 350;
const MODIFIED_FILE_MAX_LINES = 500;
// Declaration-only Solidity interfaces (src/interfaces/I*.sol with no function
// bodies) carry no implementation complexity: their length is a direct projection
// of a contract's frozen ABI surface, and Solidity's qualified-access rules
// (`IExample.Member` never resolves through inheritance) mean splitting one
// rewrites every consumer of every type, error, and event it declares —
// measured at 1,347 references across 50 files for ICommitmentPoolingModule.
// They get a wide cap instead of a split demand; anything past it is a sign the
// underlying contract surface itself needs decomposition. Decision: PR #694.
const DECLARATION_ONLY_INTERFACE_MAX_LINES = 1200;
const ZERO_SHA = "0000000000000000000000000000000000000000";

/**
 * True for Solidity files under an interfaces/ directory whose top-level
 * declarations are exclusively `interface` blocks (no contract/library/function
 * bodies — `;`-terminated members only).
 */
function isDeclarationOnlySolidityInterface(filePath) {
  if (!/packages\/[^/]+\/src\/interfaces\/I[A-Za-z0-9]*\.sol$/.test(filePath)) return false;
  const absolutePath = resolve(repoRoot, filePath);
  if (!existsSync(absolutePath)) return false;
  const source = readFileSync(absolutePath, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  const declarations = [...source.matchAll(/^\s*(abstract\s+contract|contract|library|interface)\b/gm)];
  if (declarations.length === 0 || declarations.some(([, kind]) => kind !== "interface")) return false;
  // A function body inside an interface file (even a free function) disqualifies it.
  return !/\bfunction\b[^;{]*\{/.test(source);
}

// Frozen ceilings for files that were already above MODIFIED_FILE_MAX_LINES when
// the gate was adopted. An entry may never grow; touching a file above its ceiling
// fails until it is brought back down. When a file shrinks, lower its entry to the
// new count. When a file drops below MODIFIED_FILE_MAX_LINES, delete its entry so
// the normal cap governs it again.
//
// Re-baselined 2026-07-30: the original ceilings were captured months before the
// check was wired into CI, and 17 entries had drifted above them in the meantime —
// which meant the next edit to any of those files owed an unrelated shrink before it
// could merge. Ceilings now reflect measured reality, and every oversized file is
// listed (the previous list covered 32 of 63, so 31 oversized files had no ceiling
// at all and would have tripped the blanket cap on first touch).
const FROZEN_ALLOWLIST = {
  "packages/admin/src/components/Action/ActionTranslationEditor.tsx": 746,
  "packages/admin/src/components/Assessment/CreateAssessmentSteps/StrategyKernelStep.tsx": 546,
  "packages/admin/src/components/Garden/GardenSettingsEditor.tsx": 630,
  "packages/admin/src/components/Layout/CanvasLayout.tsx": 741,
  "packages/admin/src/views/Actions/ActionDetail.tsx": 545,
  "packages/admin/src/views/Actions/EditAction.tsx": 532,
  "packages/admin/src/views/Community/components/CommunityTab.tsx": 830,
  "packages/admin/src/views/Garden/HypercertDetail.tsx": 501,
  "packages/admin/src/views/Garden/SubmitWork.tsx": 1170,
  "packages/agent/src/handlers/index.ts": 508,
  "packages/agent/src/platforms/telegram.ts": 590,
  "packages/agent/src/services/blockchain.ts": 627,
  "packages/client/src/components/Dialogs/ConvictionDrawer.tsx": 569,
  "packages/client/src/components/Errors/AppErrorBoundary.tsx": 529,
  "packages/client/src/components/Errors/RouteErrorBoundary.tsx": 541,
  "packages/client/src/components/Public/PublicCookieJarCard.tsx": 797,
  "packages/client/src/components/Public/PublicEndowmentPanel.tsx": 726,
  "packages/client/src/components/Public/PublicFundingCard.tsx": 1015,
  "packages/client/src/components/Public/VaultCardEndowFlow.tsx": 1509,
  "packages/client/src/components/Public/VaultCardPaymentPanel.tsx": 709,
  "packages/client/src/components/Public/VaultCardWalletManage.tsx": 726,
  "packages/client/src/components/Public/VaultCheckoutDialog.tsx": 1174,
  "packages/client/src/components/Public/VaultManagePositionsPanel.tsx": 928,
  "packages/client/src/components/Public/atoms/EditorialAtoms.tsx": 565,
  "packages/client/src/components/Public/vaultCheckoutShell.tsx": 530,
  "packages/client/src/views/Garden/Media.tsx": 828,
  "packages/client/src/views/Garden/index.tsx": 821,
  "packages/client/src/views/Home/Garden/Work.tsx": 668,
  "packages/client/src/views/Login/index.tsx": 641,
  "packages/client/src/views/Profile/ENSSection.tsx": 651,
  "packages/client/src/views/Public/Fund.tsx": 776,
  "packages/client/src/views/Public/Impact.tsx": 638,
  "packages/client/src/views/Public/Vaults.tsx": 706,
  "packages/contracts/src/modules/Gardens.sol": 914,
  "packages/contracts/src/modules/Hats.sol": 851,
  "packages/contracts/src/modules/Octant.sol": 769,
  "packages/contracts/src/resolvers/Yield.sol": 899,
  "packages/contracts/src/tokens/Garden.sol": 527,
  "packages/shared/src/components/Canvas/NavigationBar.tsx": 579,
  "packages/shared/src/components/Toast/toast.service.tsx": 870,
  "packages/shared/src/hooks/app/useServiceWorkerUpdate.ts": 581,
  "packages/shared/src/hooks/cookie-jar/useCampaignCookieJar.ts": 731,
  "packages/shared/src/hooks/index.ts": 604,
  "packages/shared/src/hooks/work/useWorkApproval.ts": 544,
  "packages/shared/src/hooks/work/useWorkMutation.ts": 721,
  "packages/shared/src/index.ts": 1431,
  "packages/shared/src/modules/app/analytics-events.ts": 520,
  "packages/shared/src/modules/app/posthog.ts": 579,
  "packages/shared/src/modules/data/eas.ts": 618,
  "packages/shared/src/modules/data/marketplace.ts": 550,
  "packages/shared/src/modules/job-queue/db.ts": 540,
  "packages/shared/src/modules/job-queue/index.ts": 545,
  "packages/shared/src/modules/vault-crowdfunding.ts": 1646,
  "packages/shared/src/providers/Auth.tsx": 739,
  "packages/shared/src/public-contracts/index.ts": 698,
  "packages/shared/src/types/domain.ts": 614,
  "packages/shared/src/utils/action/translations.ts": 564,
  "packages/shared/src/utils/cookie-jar-campaign.ts": 501,
  "packages/shared/src/utils/errors/contract-errors.ts": 823,
  "packages/shared/src/utils/time.ts": 576,
  "packages/shared/src/workflows/authMachine.ts": 724,
  "packages/shared/src/workflows/authServices.ts": 814,
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
    "Do not raise an allowlist ceiling to make a change fit. If a ceiling is wrong after a shrink, lower it to the new line count instead.",
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
        `- ${filePath}: ${lineCount} lines, above frozen ceiling ${frozenCeiling}. Reduce this file back to ${frozenCeiling} lines or below before merge; an allowlisted file may not grow.`,
      );
    }
    continue;
  }

  if (isDeclarationOnlySolidityInterface(filePath)) {
    if (lineCount > DECLARATION_ONLY_INTERFACE_MAX_LINES) {
      failures.push(
        `- ${filePath}: declaration-only interface at ${lineCount} lines (limit ${DECLARATION_ONLY_INTERFACE_MAX_LINES}). A surface this wide needs the underlying contract decomposed, not a wider cap.`,
      );
    }
    continue;
  }

  if (added.has(filePath) && lineCount > NEW_FILE_MAX_LINES) {
    failures.push(
      `- ${filePath}: new file at ${lineCount} lines (limit ${NEW_FILE_MAX_LINES}). Split the new implementation into smaller files; new files do not get allowlist entries.`,
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
