#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { STAGED_MARKER, STAGED_MODULES } from "./check-staged-modules.mjs";

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
const STRUCTURE_BASELINE_PATH = "scripts/data/source-structure-baseline.json";

const ALLOWED_TOP_LEVEL_DIRECTORIES = {
  admin: new Set(["components", "routes", "styles", "views"]),
  agent: new Set(["api", "handlers", "platforms", "runtime", "services"]),
  client: new Set(["components", "config", "content", "routes", "styles", "views"]),
  contracts: new Set([
    "accounts",
    "interfaces",
    "libraries",
    "markets",
    "mocks",
    "modules",
    "registries",
    "resolvers",
    "strategies",
    "tokens",
  ]),
  indexer: new Set(["handlers"]),
  shared: new Set([
    "__mocks__",
    "admin",
    "commitment-pooling",
    "components",
    "config",
    "hooks",
    "i18n",
    "lib",
    "modules",
    "ontology",
    "profile-avatar",
    "providers",
    "public-contracts",
    "stores",
    "styles",
    "types",
    "utils",
    "workflows",
  ]),
};

const ALLOWED_ROOT_SOURCE_FILES = {
  admin: new Set(["App.tsx", "main.tsx", "router.tsx"]),
  agent: new Set(["config.ts", "i18n.ts", "index.ts", "types.ts"]),
  client: new Set(["App.tsx", "main.tsx", "router.tsx"]),
  contracts: new Set(["CommonErrors.sol", "Schemas.sol"]),
  indexer: new Set(["EventHandlers.ts"]),
  shared: new Set(["index.ts"]),
};

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
  "packages/admin/src/components/Assessment/CreateAssessmentSteps/StrategyKernelStep.tsx": 545,
  "packages/admin/src/components/Garden/GardenSettingsEditor.tsx": 626,
  "packages/admin/src/views/Garden/HypercertDetail.tsx": 501,
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
  "packages/client/src/components/Public/VaultCardWalletManage.tsx": 695,
  "packages/client/src/components/Public/VaultCheckoutDialog.tsx": 1174,
  "packages/client/src/components/Public/VaultManagePositionsPanel.tsx": 928,
  "packages/client/src/components/Public/atoms/EditorialAtoms.tsx": 565,
  "packages/client/src/views/Garden/Media.tsx": 828,
  "packages/client/src/views/Profile/ENSSection.tsx": 651,
  "packages/client/src/views/Public/Fund.tsx": 775,
  "packages/client/src/views/Public/Impact.tsx": 630,
  "packages/client/src/views/Public/Vaults.tsx": 705,
  "packages/contracts/src/modules/Gardens.sol": 914,
  "packages/contracts/src/modules/Hats.sol": 851,
  "packages/contracts/src/modules/Octant.sol": 769,
  "packages/contracts/src/resolvers/Yield.sol": 899,
  "packages/contracts/src/tokens/Garden.sol": 502,
  "packages/shared/src/components/Canvas/NavigationBar.tsx": 577,
  "packages/shared/src/components/Toast/toast.service.tsx": 799,
  "packages/shared/src/hooks/app/useServiceWorkerUpdate.ts": 581,
  "packages/shared/src/hooks/cookie-jar/useCampaignCookieJar.ts": 727,
  "packages/shared/src/hooks/index.ts": 604,
  "packages/shared/src/hooks/work/useWorkMutation.ts": 528,
  "packages/shared/src/index.ts": 1418,
  "packages/shared/src/modules/app/analytics-events.ts": 520,
  "packages/shared/src/modules/app/posthog.ts": 577,
  "packages/shared/src/modules/data/marketplace.ts": 550,
  "packages/shared/src/modules/job-queue/db.ts": 540,
  "packages/shared/src/providers/Auth.tsx": 739,
  "packages/shared/src/public-contracts/index.ts": 582,
  "packages/shared/src/types/domain.ts": 614,
  "packages/shared/src/utils/action/translations.ts": 564,
  "packages/shared/src/utils/cookie-jar-campaign.ts": 501,
  "packages/shared/src/utils/errors/contract-errors.ts": 823,
  "packages/shared/src/utils/time.ts": 536,
  "packages/shared/src/workflows/authMachine.ts": 724,
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

function isStructurePolicyFile(filePath) {
  if (!isPackageSourcePath(filePath)) return false;
  if (!/\.(ts|tsx|sol)$/.test(filePath) || /\.d\.ts$/.test(filePath)) return false;
  if (isGeneratedOrVendoredPath(filePath) || isTestOrStoryPath(filePath)) return false;
  return true;
}

function packageSourceParts(filePath) {
  const match = filePath.match(/^packages\/([^/]+)\/src\/(.+)$/);
  if (!match) return null;
  return { packageName: match[1], sourcePath: match[2], parts: match[2].split("/") };
}

function readSource(root, filePath) {
  return readFileSync(resolve(root, filePath), "utf8");
}

function sourceImportSpecifiers(source) {
  const matches = source.matchAll(
    /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*|\brequire\s*\(\s*)["']([^"']+)["']/g,
  );
  return [...matches].map((match) => match[1]);
}

function sharedExportMatches(exportKey, requestedKey) {
  if (!exportKey.includes("*")) return exportKey === requestedKey;
  const [prefix, suffix] = exportKey.split("*");
  return requestedKey.startsWith(prefix) && requestedKey.endsWith(suffix);
}

function isDeclaredSharedSpecifier(specifier, sharedExportKeys) {
  if (specifier === "@green-goods/shared") return sharedExportKeys.has(".");
  if (!specifier.startsWith("@green-goods/shared/")) return true;
  if (specifier.startsWith("@green-goods/shared/src/")) return false;
  const requestedKey = `./${specifier.slice("@green-goods/shared/".length)}`;
  return [...sharedExportKeys].some((exportKey) => sharedExportMatches(exportKey, requestedKey));
}

function primaryValueExport(source) {
  const match = source.match(
    /\bexport\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/,
  );
  return match?.[1] ?? null;
}

function exportedValueNames(source) {
  const names = new Set();
  for (const match of source.matchAll(
    /\bexport\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g,
  )) {
    names.add(match[1]);
  }
  const defaultIdentifier = source.match(/\bexport\s+default\s+([A-Za-z_$][\w$]*)\s*;?/);
  if (defaultIdentifier) names.add(defaultIdentifier[1]);
  for (const block of source.matchAll(/\bexport\s*{([^}]+)}/g)) {
    for (const item of block[1].split(",")) {
      const match = item.trim().match(/(?:^|\bas\s+)([A-Za-z_$][\w$]*)$/);
      if (match) names.add(match[1]);
    }
  }
  return [...names];
}

function exportedNames(source) {
  const matches = source.matchAll(
    /\bexport\s+(?:declare\s+)?(?:async\s+)?(?:const|let|var|function|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g,
  );
  return [...matches].map((match) => match[1]);
}

function hookDefinitions(source) {
  const names = new Set();
  for (const match of source.matchAll(
    /\b(?:export\s+)?(?:async\s+)?function\s+(use[A-Z][A-Za-z0-9_$]*)\b/g,
  )) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(
    /\b(?:export\s+)?(?:const|let|var)\s+(use[A-Z][A-Za-z0-9_$]*)\b/g,
  )) {
    names.add(match[1]);
  }
  return [...names].sort();
}

function isMarkedStagedModule(root, filePath, stagedModulePaths) {
  return (
    stagedModulePaths.has(filePath) &&
    existsSync(resolve(root, filePath)) &&
    readSource(root, filePath).includes(STAGED_MARKER)
  );
}

function namingViolation(root, filePath) {
  if (!filePath.startsWith("packages/client/src/")) return null;
  const sourceParts = packageSourceParts(filePath);
  if (
    sourceParts?.parts.length === 1 &&
    ALLOWED_ROOT_SOURCE_FILES.client.has(sourceParts.parts[0])
  ) {
    return null;
  }
  const filename = basename(filePath);
  const stem = filename.replace(/\.(tsx|ts)$/, "");
  if (stem === "index" || /\.d\.ts$/.test(filename)) return null;
  if (stem.includes("-")) {
    return {
      id: `naming:${filePath}:no-hyphens`,
      rule: "naming",
      path: filePath,
      baselineEligible: true,
      message: `${filePath}: client source filenames cannot contain hyphens`,
    };
  }

  const name = stem.split(".")[0];
  const source = readSource(root, filePath);
  const primaryExport = filename.endsWith(".tsx") ? primaryValueExport(source) : null;
  const componentFile =
    filename.endsWith(".tsx") &&
    (exportedValueNames(source).some(
      (exportName) => /^[A-Z]/.test(exportName) && !/^[A-Z0-9_]+$/.test(exportName),
    ) || /\bexport\s+default\s+(?:async\s+)?(?:function\s*\(|\(?[^=]*\)?\s*=>)/.test(source));
  const validName = componentFile ? /^[A-Z][A-Za-z0-9]*$/.test(name) : /^[a-z][A-Za-z0-9]*$/.test(name);
  if (validName) return null;
  const expected = componentFile ? "PascalCase" : "camelCase";
  return {
    id: `naming:${filePath}:${expected}`,
    rule: "naming",
    path: filePath,
    baselineEligible: true,
    message: `${filePath}: primary export ${primaryExport ?? "is a module"}; filename must use ${expected}`,
  };
}

export function collectStructureViolations({
  root,
  filePaths,
  changedFilePaths = filePaths,
  consumerFilePaths = filePaths,
  stagedModulePaths = [],
  sharedExportKeys = new Set(["."]),
}) {
  const violations = [];
  const staged = new Set(stagedModulePaths);
  const policyFiles = filePaths.filter(isStructurePolicyFile).filter((filePath) =>
    existsSync(resolve(root, filePath)),
  );

  for (const filePath of policyFiles) {
    const sourceParts = packageSourceParts(filePath);
    if (!sourceParts) continue;
    const { packageName, parts } = sourceParts;
    const allowedDirectories = ALLOWED_TOP_LEVEL_DIRECTORIES[packageName];
    const allowedRootFiles = ALLOWED_ROOT_SOURCE_FILES[packageName];
    if (allowedDirectories && allowedRootFiles) {
      if (parts.length === 1 && !allowedRootFiles.has(parts[0])) {
        violations.push({
          id: `placement:${filePath}:root-file`,
          rule: "placement",
          path: filePath,
          baselineEligible: true,
          message: `${filePath}: loose package-root source is not declared`,
        });
      } else if (parts.length > 1 && !allowedDirectories.has(parts[0])) {
        violations.push({
          id: `placement:${filePath}:top-level-directory`,
          rule: "placement",
          path: filePath,
          baselineEligible: true,
          message: `${filePath}: top-level source directory ${parts[0]} is not declared for ${packageName}`,
        });
      }
    }

    const markedStaged = isMarkedStagedModule(root, filePath, staged);
    if (!markedStaged) {
      const violation = namingViolation(root, filePath);
      if (violation) violations.push(violation);
    }

    const source = readSource(root, filePath);
    if (packageName !== "shared") {
      for (const hookName of hookDefinitions(source)) {
        violations.push({
          id: `hook-location:${filePath}:${hookName}`,
          rule: "hook-location",
          path: filePath,
          baselineEligible: true,
          message: `${filePath}: ${hookName} is defined outside packages/shared`,
        });
      }
    }

    for (const specifier of sourceImportSpecifiers(source)) {
      if (!isDeclaredSharedSpecifier(specifier, sharedExportKeys)) {
        violations.push({
          id: `shared-import:${filePath}:${specifier}`,
          rule: "shared-import",
          path: filePath,
          baselineEligible: true,
          message: `${filePath}: ${specifier} is not a declared @green-goods/shared export`,
        });
      }
    }
  }

  const consumers = consumerFilePaths
    .filter((filePath) => /\.(js|jsx|ts|tsx)$/.test(filePath))
    .filter((filePath) => !isGeneratedOrVendoredPath(filePath) && !isTestOrStoryPath(filePath))
    .filter((filePath) => existsSync(resolve(root, filePath)))
    .map((filePath) => ({ filePath, source: readSource(root, filePath) }));

  for (const filePath of changedFilePaths.filter(isStructurePolicyFile)) {
    if (!existsSync(resolve(root, filePath))) continue;
    if (basename(filePath).startsWith("index.")) continue;
    if (isMarkedStagedModule(root, filePath, staged)) continue;
    const source = readSource(root, filePath);
    for (const exportName of exportedNames(source)) {
      const word = new RegExp(`\\b${exportName.replace(/[$]/g, "\\$")}\\b`);
      const hasConsumer = consumers.some(
        (consumer) => consumer.filePath !== filePath && word.test(consumer.source),
      );
      if (hasConsumer) continue;
      violations.push({
        id: `dead-export:${filePath}:${exportName}`,
        rule: "dead-export",
        path: filePath,
        baselineEligible: false,
        message: `${filePath}: exported ${exportName} has no production consumer`,
      });
    }
  }

  return violations.sort((left, right) => left.id.localeCompare(right.id));
}

export function reconcileStructureBaseline(violations, baselineIds) {
  const currentBaselineIds = new Set(
    violations.filter((violation) => violation.baselineEligible).map((violation) => violation.id),
  );
  return {
    newViolations: violations.filter(
      (violation) => !violation.baselineEligible || !baselineIds.has(violation.id),
    ),
    staleBaselineIds: [...baselineIds]
      .filter((baselineId) => !currentBaselineIds.has(baselineId))
      .sort(),
  };
}

export function findStructureBaselineGrowth(baselineIds, previousBaselineIds) {
  if (previousBaselineIds === null) return [];
  return [...baselineIds].filter((baselineId) => !previousBaselineIds.has(baselineId)).sort();
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

function resolveAllFiles() {
  return [...new Set([
    ...listFromGit(["ls-files"]),
    ...listFromGit(["ls-files", "--others", "--exclude-standard"]),
  ])].sort();
}

function parseStructureBaseline(source) {
  const parsed = JSON.parse(source);
  if (parsed.version !== 1 || !Array.isArray(parsed.violations)) {
    throw new Error(`${STRUCTURE_BASELINE_PATH}: expected version 1 with a violations array`);
  }
  if (parsed.violations.some((violation) => typeof violation !== "string")) {
    throw new Error(`${STRUCTURE_BASELINE_PATH}: every violation ID must be a string`);
  }
  const unique = new Set(parsed.violations);
  if (unique.size !== parsed.violations.length) {
    throw new Error(`${STRUCTURE_BASELINE_PATH}: duplicate violation IDs are not allowed`);
  }
  return unique;
}

function loadStructureBaseline() {
  const absolutePath = resolve(repoRoot, STRUCTURE_BASELINE_PATH);
  if (!existsSync(absolutePath)) return new Set();
  return parseStructureBaseline(readFileSync(absolutePath, "utf8"));
}

function loadPreviousStructureBaseline(baseRef) {
  const ref =
    baseRef && baseRef !== ZERO_SHA
      ? runGit(["merge-base", "HEAD", baseRef], { allowFailure: true }) || baseRef
      : "HEAD";
  const source = runGit(["show", `${ref}:${STRUCTURE_BASELINE_PATH}`], { allowFailure: true });
  return source ? parseStructureBaseline(source) : null;
}

function loadSharedExportKeys() {
  const packageJson = JSON.parse(readFileSync(resolve(repoRoot, "packages/shared/package.json"), "utf8"));
  return new Set(Object.keys(packageJson.exports ?? {}));
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

function printPolicyFailure(newViolations, staleBaselineIds, grownBaselineIds) {
  console.error("❌ check-source-structure found source-policy drift:");
  for (const violation of newViolations) {
    console.error(`- [${violation.rule}] ${violation.message}`);
    console.error(`  baseline id: ${violation.id}`);
  }
  for (const baselineId of staleBaselineIds) {
    console.error(`- [stale-baseline] ${baselineId}`);
  }
  for (const baselineId of grownBaselineIds) {
    console.error(`- [baseline-growth] ${baselineId}`);
  }
  console.error("");
  console.error(
    "Remediation: fix new violations. When a known violation is removed, delete its exact ID from scripts/data/source-structure-baseline.json in the same change.",
  );
  console.error(
    "Do not add baseline entries for new work. The baseline records pre-enforcement debt and may only shrink.",
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

function run() {
  const { base } = parseArgs(process.argv.slice(2));
  const { changed, added } = resolveChangedFiles(base);
  const allFiles = resolveAllFiles();
  const disallowedJavaScriptFiles = changed
    .filter(isDisallowedJavaScriptSourceFile)
    .filter((filePath) => existsSync(resolve(repoRoot, filePath)));
  const relevantFiles = changed
    .filter(isRelevantSourceFile)
    .filter((filePath) => existsSync(resolve(repoRoot, filePath)));

  if (disallowedJavaScriptFiles.length > 0) {
    printDisallowedJavaScriptFailure(disallowedJavaScriptFiles);
  }

  let baselineIds;
  try {
    baselineIds = loadStructureBaseline();
  } catch (error) {
    console.error(`❌ check-source-structure could not load its baseline: ${error.message}`);
    process.exit(2);
  }
  const policyViolations = collectStructureViolations({
    root: repoRoot,
    filePaths: allFiles,
    changedFilePaths: changed,
    consumerFilePaths: allFiles,
    stagedModulePaths: STAGED_MODULES,
    sharedExportKeys: loadSharedExportKeys(),
  });
  const { newViolations, staleBaselineIds } = reconcileStructureBaseline(
    policyViolations,
    baselineIds,
  );
  const grownBaselineIds = findStructureBaselineGrowth(
    baselineIds,
    loadPreviousStructureBaseline(base),
  );
  if (newViolations.length > 0 || staleBaselineIds.length > 0 || grownBaselineIds.length > 0) {
    printPolicyFailure(newViolations, staleBaselineIds, grownBaselineIds);
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
    `✅ check-source-structure: ${policyViolations.length} known policy violation(s) matched the shrinking baseline; checked ${relevantFiles.length} changed non-test source file(s); ${allowlistedChecks} oversized baseline file(s) stayed within frozen ceilings.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run();
}
