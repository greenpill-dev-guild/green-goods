#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readlinkSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "../..");
const defaultPolicyPath = resolve(projectRoot, "scripts/data/validation-policy.json");

export function loadPolicy(policyPath = defaultPolicyPath) {
  const policy = JSON.parse(readFileSync(policyPath, "utf8"));
  validatePolicy(policy);
  return policy;
}

function validatePolicy(policy) {
  if (!Number.isInteger(policy.version) || policy.version < 1) {
    throw new Error("Validation policy must have a positive integer version");
  }
  if (!Array.isArray(policy.checks) || policy.checks.length === 0) {
    throw new Error("Validation policy must define checks");
  }

  const ids = new Set();
  for (const check of policy.checks) {
    if (!check.id || ids.has(check.id)) {
      throw new Error(`Validation policy contains an invalid or duplicate check id: ${check.id}`);
    }
    ids.add(check.id);
    for (const field of ["risk", "expectedSignal", "freshness", "stopRule"]) {
      if (!check[field]) throw new Error(`Validation check ${check.id} is missing ${field}`);
    }
    if (!Number.isFinite(check.budgetSeconds) || check.budgetSeconds <= 0) {
      throw new Error(`Validation check ${check.id} must have a positive budgetSeconds`);
    }
  }

  for (const rule of [...(policy.conditionalRules ?? []), ...(policy.criticalOverrides ?? [])]) {
    for (const id of rule.checks ?? [rule.check]) {
      if (!ids.has(id)) throw new Error(`Validation rule references unknown check ${id}`);
    }
  }
}

function normalizePath(path) {
  return String(path).replaceAll("\\", "/").replace(/^\.\//, "");
}

function normalizePaths(paths = []) {
  return [...new Set(paths.filter(Boolean).map(normalizePath))].sort();
}

const packageSurfaces = ["contracts", "shared", "indexer", "client", "admin", "agent"];
const allSurfaces = [...packageSurfaces, "docs"];

function owningSurface(path) {
  if (path.startsWith("docs/")) return "docs";
  return packageSurfaces.find((surface) => path.startsWith(`packages/${surface}/`)) ?? null;
}

function isTestPath(path) {
  return /(^|\/)(__tests__|test|tests)\//.test(path) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(path);
}

function isStorybookConfigPath(path) {
  return path.includes("/.storybook/");
}

function isStoryPath(path) {
  return (
    /\.stories?\.[cm]?[jt]sx?$/.test(path) ||
    isStorybookConfigPath(path) ||
    /(^|\/)storybook[^/]*\.[cm]?[jt]sx?$/i.test(path)
  );
}

function isValidationOnlyPath(path) {
  return isTestPath(path) || isStoryPath(path);
}

const directRootTestChecks = new Map([
  ["scripts/lib/env-schema.test.mjs", "env-schema-test"],
  ["scripts/lib/dev-shared.test.mjs", "validation-system-test"],
  ["scripts/quality/select-validation.test.mjs", "validation-system-test"],
  ["scripts/dev/ci-local.test.mjs", "validation-system-test"],
  ["scripts/dev/surface-leases.test.mjs", "validation-system-test"],
  ["scripts/quality/ci-gate.test.mjs", "validation-system-test"],
  ["scripts/quality/workflow-performance-parity.test.mjs", "validation-system-test"],
]);

function inferDirectRootTestChecks(paths) {
  return [...new Set(paths.map((path) => directRootTestChecks.get(path)).filter(Boolean))];
}

function classifyChangedPath(path) {
  if (path === "bun.lock" || path === "bun.lockb") return "lockfile";
  if (path === "package.json" || path.endsWith("/package.json")) return "package-manifest";
  if (isStorybookConfigPath(path)) return "storybook-config";
  if (isStoryPath(path)) return "story";
  if (isTestPath(path)) return "test";
  if (
    path.startsWith("packages/shared/src/") &&
    (path.endsWith("/index.ts") || path === "packages/shared/src/index.ts")
  ) {
    return "public-source";
  }
  if (/^packages\/[^/]+\/src\//.test(path)) return "runtime-source";
  if (["biome.json", ".env.schema", "tsconfig.json", "tsconfig.base.json"].includes(path)) {
    return "root-config";
  }
  return "other";
}

function inferChangedTestPaths(paths, deletedPaths = []) {
  const deleted = new Set(deletedPaths);
  const inferred = {};
  for (const path of paths) {
    if (!isTestPath(path) || deleted.has(path)) continue;
    const surface = owningSurface(path);
    if (!surface || surface === "docs") continue;
    const prefix = `packages/${surface}/`;
    (inferred[surface] ??= []).push(path.slice(prefix.length));
  }
  return inferred;
}

function mergeTestPaths(explicit, inferred) {
  const merged = {};
  for (const surface of new Set([...Object.keys(explicit), ...Object.keys(inferred)])) {
    merged[surface] = [...(explicit[surface] ?? []), ...(inferred[surface] ?? [])];
  }
  return normalizeTestPaths(merged);
}

function checkpointScopes(requestedScope, intent, changedPaths, cancelled) {
  const requested = requestedScope ?? "workspace";
  if (!["lane", "workspace"].includes(requested)) {
    throw new Error(`Unknown checkpoint scope: ${requested}`);
  }
  const effective = intent === "checkpoint" ? requested : "workspace";
  if (effective === "lane" && changedPaths.length === 0 && cancelled !== true) {
    throw new Error("Lane checkpoint requires explicit changed paths");
  }
  return { requested, effective };
}

function groupMatches(path, rule) {
  const exactMatch = rule.exact?.includes(path) ?? false;
  const excluded =
    !exactMatch &&
    ((rule.excludeValidationOnlyFrom?.includes(owningSurface(path)) &&
      isValidationOnlyPath(path)) ||
      (rule.excludeTests === true && isTestPath(path)) ||
      (rule.excludeExact?.includes(path) ?? false) ||
      (rule.excludePrefixes?.some((prefix) => path.startsWith(prefix)) ?? false) ||
      (rule.excludeContains?.some((part) => path.includes(part)) ?? false));
  if (excluded) return false;
  const groups = [];
  if (rule.exact?.length) groups.push(exactMatch);
  if (rule.prefixes?.length) groups.push(rule.prefixes.some((prefix) => path.startsWith(prefix)));
  if (rule.contains?.length) groups.push(rule.contains.some((part) => path.includes(part)));
  if (rule.extensions?.length) groups.push(rule.extensions.some((extension) => path.endsWith(extension)));
  if (groups.length === 0) return false;
  return rule.match === "all" ? groups.every(Boolean) : groups.some(Boolean);
}

function ruleMatches(paths, rule) {
  return paths.some((path) => groupMatches(path, rule));
}

function maxRisk(policy, risks) {
  const order = policy.riskOrder;
  return risks.reduce((current, candidate) => {
    if (!order.includes(candidate)) throw new Error(`Unknown validation risk: ${candidate}`);
    return order.indexOf(candidate) > order.indexOf(current) ? candidate : current;
  }, "routine");
}

function effectiveIntent(policy, requestedIntent, ci) {
  if (!policy.intentOrder.includes(requestedIntent)) {
    throw new Error(`Unknown validation intent: ${requestedIntent}`);
  }
  if (ci && !["merge", "release"].includes(requestedIntent)) return "merge";
  return requestedIntent;
}

function impactedSurfaces(policy, paths, fullRepository) {
  if (fullRepository) return new Set(allSurfaces);
  if (paths.length === 0) return new Set();

  const surfaces = new Set();
  for (const path of paths) {
    if (path === "bun.lock" || path === "bun.lockb") {
      allSurfaces.forEach((surface) => surfaces.add(surface));
      continue;
    }
    for (const rule of policy.surfaceRules ?? []) {
      if (!groupMatches(path, rule)) continue;
      const owner = owningSurface(path);
      if (
        isValidationOnlyPath(path) &&
        owner &&
        rule.surface !== "all" &&
        rule.surface !== owner
      ) {
        continue;
      }
      if (rule.surface === "all") allSurfaces.forEach((surface) => surfaces.add(surface));
      else surfaces.add(rule.surface);
    }
  }
  return new Set(allSurfaces.filter((surface) => surfaces.has(surface)));
}

function addSurfaceChecks(select, surface, { includeBuilds, intent }) {
  const checks = {
    contracts: ["contracts-build", "contracts-test"],
    shared: ["shared-typecheck", "shared-test"],
    indexer: ["indexer-test"],
    client: ["client-test"],
    admin: ["admin-test"],
    agent: ["agent-typecheck", "agent-test"],
    docs: intent === "qa" ? ["docs-build"] : ["docs-test", "docs-build"],
  };
  const builds = {
    shared: "shared-build",
    indexer: "indexer-build",
    client: "client-build",
    admin: "admin-build",
    agent: "agent-build",
  };

  for (const id of checks[surface] ?? []) select(id, `surface:${surface}`);
  if (includeBuilds && builds[surface]) select(builds[surface], `surface:${surface}:build`);
}

function addValidationOnlyChecks(select, surface, paths) {
  const testTypechecks = {
    shared: "shared-test-typecheck",
    client: "client-test-typecheck",
    admin: "admin-test-typecheck",
    agent: "agent-test-typecheck",
  };
  if (testTypechecks[surface]) select(testTypechecks[surface], `validation-only:${surface}:types`);
  if (paths.some(isTestPath)) select(`${surface}-test`, `validation-only:${surface}:tests`);
  if (paths.some(isStoryPath)) select("story-quality", `validation-only:${surface}:stories`);
  if (paths.some(isStorybookConfigPath)) {
    select("storybook-build", `validation-only:${surface}:storybook-config`);
  }
}

function isUiBuildImpact(paths, surface) {
  const prefix = `packages/${surface}/src/`;
  return paths.some(
    (path) =>
      (path.startsWith(prefix) &&
        /(^|\/)(app|index|main|route|router|routes)(\.[^/]+)?$/i.test(path)) ||
      path === `packages/${surface}/package.json` ||
      path.startsWith(`packages/${surface}/vite.config.`),
  );
}

function normalizeTestPaths(testPaths = {}) {
  const result = {};
  for (const [surface, paths] of Object.entries(testPaths)) {
    result[surface] = normalizePaths(paths).map((path) => {
      if (path.startsWith("-") || !/^[A-Za-z0-9_./@+-]+$/.test(path)) {
        throw new Error(`Unsafe focused test path: ${path}`);
      }
      return path;
    });
  }
  return result;
}

export function selectValidation(input = {}, options = {}) {
  const policy = options.policy ?? loadPolicy(options.policyPath);
  const requestedIntent = input.intent ?? "checkpoint";
  const ci = input.ci === true;
  const intent = effectiveIntent(policy, requestedIntent, ci);
  const changedPaths = normalizePaths(input.changedPaths);
  const deletedPaths = normalizePaths(input.deletedPaths);
  const checkpointScope = checkpointScopes(
    input.checkpointScope,
    intent,
    changedPaths,
    input.cancelled,
  );
  const testPaths = mergeTestPaths(
    normalizeTestPaths(input.testPaths),
    inferChangedTestPaths(changedPaths, deletedPaths),
  );
  const requestedChecks = normalizePaths(input.checkIds);
  const baseRisk = input.risk ?? "routine";

  const planIdentity = {
    policyVersion: policy.version,
    requestedIntent,
    effectiveIntent: intent,
    requestedCheckpointScope: checkpointScope.requested,
    checkpointScope: checkpointScope.effective,
    ci,
    base: input.base ?? null,
    head: input.head ?? null,
    workingCopyFingerprint: input.workingCopyFingerprint ?? null,
    changedPaths,
    deletedPaths,
    changes: changedPaths.map((path) => ({
      path,
      kind: classifyChangedPath(path),
      surface: owningSurface(path),
    })),
    testPaths,
    requestedChecks,
  };

  if (input.cancelled === true) {
    return {
      ...planIdentity,
      status: "cancelled",
      stopReason: "user-cancelled",
      risk: maxRisk(policy, [baseRisk]),
      surfaces: [],
      checks: [],
      environment: normalizeEnvironment(input.environment),
      environmentBlockers: [],
      budget: summarizeBudget(intent, []),
      receiptPolicy: {
        cacheReuseAllowed: true,
        optInRequired: true,
        failuresCacheable: false,
        note: "Only opt-in exact-fingerprint passing receipts may be reused.",
      },
    };
  }

  const hardRules = (policy.criticalOverrides ?? []).filter((rule) => ruleMatches(changedPaths, rule));
  const pathRiskRules = (policy.riskRules ?? []).filter((rule) => ruleMatches(changedPaths, rule));
  const risk = maxRisk(policy, [
    baseRisk,
    ...pathRiskRules.map((rule) => rule.risk),
    ...hardRules.map((rule) => rule.risk),
  ]);
  const localMerge = intent === "merge" && !ci;
  const strictIntent = ["readiness", "push", "ship", "release"].includes(intent);
  const fullRepository =
    ["readiness", "release"].includes(intent) ||
    ((["push", "ship"].includes(intent) || localMerge) && changedPaths.length === 0);
  const strictScope = strictIntent || fullRepository;
  const surfaces = impactedSurfaces(policy, changedPaths, fullRepository);
  const selected = new Set();
  const selectionReasons = new Map();
  const select = (id, reason) => {
    selected.add(id);
    const reasons = selectionReasons.get(id) ?? new Set();
    reasons.add(reason);
    selectionReasons.set(id, reasons);
  };
  const evidenceOnly = ["diagnose", "review"].includes(intent);
  const hasAutomaticScope = changedPaths.length > 0 || fullRepository;

  const knownCheckIds = new Set(policy.checks.map((check) => check.id));
  for (const id of requestedChecks) {
    if (!knownCheckIds.has(id)) throw new Error(`Unknown requested validation check: ${id}`);
    select(id, "explicit-request");
  }

  if (!evidenceOnly && hasAutomaticScope) select("format", "automatic-hygiene");
  if (
    intent === "qa" &&
    changedPaths.some((path) => [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"].some((extension) => path.endsWith(extension)))
  ) {
    select("lint", "automatic-hygiene");
  }
  if (
    hasAutomaticScope &&
    ["checkpoint", "readiness", "push", "ship", "merge", "release"].includes(intent)
  ) {
    select("lint", "automatic-hygiene");
  }
  if (!evidenceOnly) {
    for (const checkId of inferDirectRootTestChecks(changedPaths)) {
      select(checkId, `direct-root-test:${checkId}`);
    }
  }

  const includeBuilds = ["readiness", "push", "ship", "merge", "release"].includes(intent);
  if (evidenceOnly) {
    for (const surface of Object.keys(testPaths)) {
      const testId = `${surface}-test`;
      if (!knownCheckIds.has(testId)) throw new Error(`Unknown focused-test surface: ${surface}`);
      select(testId, `focused-test:${surface}`);
    }
  } else {
    for (const surface of surfaces) {
      const surfacePaths = changedPaths.filter((path) => owningSurface(path) === surface);
      const validationOnly =
        surfacePaths.length > 0 && surfacePaths.every((path) => isValidationOnlyPath(path));
      if (includeBuilds) {
        addSurfaceChecks(select, surface, { includeBuilds, intent });
        if (
          surfacePaths.some(isValidationOnlyPath) ||
          surfacePaths.includes(`packages/${surface}/package.json`)
        ) {
          addValidationOnlyChecks(select, surface, surfacePaths);
        }
      } else if (validationOnly) {
        addValidationOnlyChecks(select, surface, surfacePaths);
      } else {
        addSurfaceChecks(select, surface, { includeBuilds, intent });
        if (
          surfacePaths.some(isValidationOnlyPath) ||
          surfacePaths.includes(`packages/${surface}/package.json`)
        ) {
          addValidationOnlyChecks(select, surface, surfacePaths);
        }
      }
      if (
        intent === "qa" &&
        ["client", "admin"].includes(surface) &&
        isUiBuildImpact(changedPaths, surface)
      ) {
        select(`${surface}-build`, `qa-build-impact:${surface}`);
      }
      if (
        intent === "qa" &&
        surface === "agent" &&
        changedPaths.some((path) => path.startsWith("packages/agent/src/"))
      ) {
        select("agent-build", "qa-build-impact:agent");
      }
    }
  }

  if (strictScope) {
    if (fullRepository || surfaces.has("contracts")) {
      select("abi-artifacts", "strict-intent:contracts");
      select("contracts-verify-fast", "strict-intent:contracts");
    }
    for (const [surface, id] of [
      ["shared", "shared-test-typecheck"],
      ["client", "client-test-typecheck"],
      ["admin", "admin-test-typecheck"],
      ["agent", "agent-test-typecheck"],
    ]) {
      if (surfaces.has(surface)) select(id, `strict-intent:${surface}:test-types`);
    }
  }
  for (const rule of evidenceOnly ? [] : (policy.conditionalRules ?? [])) {
    const matchingPaths = changedPaths.filter((path) => {
      if (!groupMatches(path, rule)) return false;
      if (rule.exact?.includes(path)) return true;
      if (rule.check === "browser-proof" && isValidationOnlyPath(path)) return false;
      if (rule.check === "ontology" && isValidationOnlyPath(path)) return false;
      if (
        ["source-structure", "design-guardrails"].includes(rule.check) &&
        isValidationOnlyPath(path)
      ) {
        return false;
      }
      return true;
    });
    if (matchingPaths.length === 0) continue;
    if (intent === "qa" && !["browser-proof", "ontology"].includes(rule.check)) continue;
    select(rule.check, `conditional:${rule.check}`);
  }

  const mandatory = new Set();
  for (const rule of evidenceOnly ? [] : hardRules) {
    for (const id of rule.checks) {
      select(id, "critical-override");
      mandatory.add(id);
    }
  }
  if (["readiness", "push", "ship", "merge", "release"].includes(intent)) {
    for (const id of selected) mandatory.add(id);
  }

  const environment = normalizeEnvironment(input.environment);
  let checks = policy.checks
    .filter((check) => selected.has(check.id))
    .map((check) =>
      ({
        ...materializeCheck(check, environment, mandatory.has(check.id), testPaths, {
          intent,
          ci,
          changedPaths,
          checkpointScope: checkpointScope.effective,
        }),
        selectedBy: [...(selectionReasons.get(check.id) ?? [])],
      }),
    );
  const toolchainBlockers = compareToolchain(policy.toolchain, environment.toolchain, checks);
  if (toolchainBlockers.length > 0) {
    const capabilities = toolchainBlockers.map((blocker) => blocker.capability);
    checks = checks.map((check) => ({
      ...check,
      state: "blocked",
      blockedBy: [...new Set([...check.blockedBy, ...capabilities])],
    }));
  }
  const blockedChecks = checks.filter((check) => check.state === "blocked");
  const budget = summarizeBudget(intent, checks);

  return {
    ...planIdentity,
    status: blockedChecks.length > 0 || toolchainBlockers.length > 0 ? "blocked" : "ready",
    stopReason:
      blockedChecks.length > 0 || toolchainBlockers.length > 0
        ? "required-environment-unavailable"
        : null,
    risk,
    surfaces: [...surfaces],
    environment,
    environmentBlockers: toolchainBlockers,
    checks,
    budget,
    receiptPolicy: {
      cacheReuseAllowed: true,
      optInRequired: true,
      failuresCacheable: false,
      note: "Only opt-in exact-fingerprint passing receipts may be reused.",
    },
  };
}

function normalizeEnvironment(environment = {}) {
  return {
    profile: environment.profile ?? "unspecified",
    toolchain: { ...(environment.toolchain ?? {}) },
    capabilities: { ...(environment.capabilities ?? {}) },
  };
}

function compareToolchain(expected, actual, checks) {
  const blockers = [];
  if (checks.length === 0 || Object.keys(actual).length === 0) return blockers;
  const requiredTools = new Set(["node"]);
  if (checks.some((check) => check.command?.includes("bun"))) requiredTools.add("bun");
  if (checks.some((check) => check.capabilities?.includes("foundry"))) requiredTools.add("foundry");
  for (const tool of requiredTools) {
    const expectedVersion = expected[tool];
    const actualVersion = actual[tool];
    if (!actualVersion) {
      blockers.push({ capability: `toolchain.${tool}`, expected: expectedVersion, actual: null });
    } else if (actualVersion !== expectedVersion) {
      blockers.push({ capability: `toolchain.${tool}`, expected: expectedVersion, actual: actualVersion });
    }
  }
  return blockers;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

function materializeCheck(check, environment, mandatory, testPaths, context) {
  const blockedBy = (check.capabilities ?? []).filter(
    (capability) => environment.capabilities[capability] === false,
  );
  const surface = check.id.endsWith("-test") ? check.id.slice(0, -5) : null;
  const focusedPaths =
    surface && ["diagnose", "review", "qa", "checkpoint"].includes(context.intent)
      ? testPaths[surface] ?? []
      : [];
  let command = check.command;
  if (focusedPaths.length > 0) {
    command =
      check.id === "contracts-test"
        ? focusedPaths.map((path) => `bun run test:match ${path}`).join(" && ")
        : `${check.command} ${focusedPaths.join(" ")}`;
  }
  const laneCheckpoint =
    context.intent === "checkpoint" && context.checkpointScope === "lane";
  if (
    check.id === "format" &&
    !context.ci &&
    ["push", "ship", "merge", "release"].includes(context.intent)
  ) {
    command = "bun format";
  }
  if (
    check.id === "format" &&
    (["diagnose", "review", "qa"].includes(context.intent) || laneCheckpoint) &&
    context.changedPaths.length > 0
  ) {
    // Biome exits non-zero when every supplied path is one it does not handle,
    // which a Markdown-only or Solidity-only change always is. Without this the
    // scoped format check fails and fail-fast stops the rest of the plan.
    command = `bunx @biomejs/biome format --no-errors-on-unmatched ${context.changedPaths.map(shellQuote).join(" ")}`;
  }
  if (check.id === "lint" && (context.intent === "qa" || laneCheckpoint)) {
    const lintablePrefixes = [
      "packages/client/src/",
      "packages/admin/src/",
      "packages/shared/src/",
      "packages/indexer/src/",
      "packages/agent/src/",
      "packages/contracts/script/",
    ];
    const sourcePaths = context.changedPaths.filter((path) =>
      [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"].some(
        (extension) => path.endsWith(extension),
      ) &&
      lintablePrefixes.some((prefix) => path.startsWith(prefix)) &&
      !isValidationOnlyPath(path),
    );
    command =
      sourcePaths.length > 0
        ? `bun --bun run oxlint ${sourcePaths.map(shellQuote).join(" ")} --deny-warnings`
        : `bunx @biomejs/biome lint --no-errors-on-unmatched ${context.changedPaths.map(shellQuote).join(" ")}`;
  }
  let budgetSeconds = focusedPaths.length > 0 ? Math.min(check.budgetSeconds, 60) : check.budgetSeconds;
  if (
    check.id === "format" &&
    (["diagnose", "review", "qa"].includes(context.intent) || laneCheckpoint)
  ) {
    budgetSeconds = Math.min(budgetSeconds, 10);
  }
  if (check.id === "lint" && (context.intent === "qa" || laneCheckpoint)) {
    budgetSeconds = Math.min(budgetSeconds, 15);
  }
  return {
    ...check,
    command,
    focusedPaths,
    budgetSeconds,
    mandatory,
    state: blockedBy.length > 0 ? "blocked" : "pending",
    blockedBy,
  };
}

function summarizeBudget(intent, checks) {
  const targetSeconds = { qa: 90, checkpoint: 180, push: 180 }[intent] ?? null;
  const automatedSeconds = checks
    .filter((check) => !check.manual)
    .reduce((total, check) => total + check.budgetSeconds, 0);
  const manualSeconds = checks
    .filter((check) => check.manual)
    .reduce((total, check) => total + check.budgetSeconds, 0);
  return {
    targetSeconds,
    automatedSeconds,
    manualSeconds,
    withinTarget: targetSeconds === null ? null : automatedSeconds <= targetSeconds,
    mandatoryChecksMayExceedTarget: checks.some((check) => check.mandatory) &&
      targetSeconds !== null &&
      automatedSeconds > targetSeconds,
    rule: "Budgets warn and profile; they never skip selected or mandatory checks.",
  };
}

export function selectExpectedWorkflows(input = {}, options = {}) {
  const policy = options.policy ?? loadPolicy(options.policyPath);
  if (input.cancelled === true) return [];
  effectiveIntent(policy, input.intent ?? "merge", input.ci === true);
  const paths = normalizePaths(input.changedPaths);
  return Object.entries(policy.workflowRules ?? {})
    .filter(([name, rule]) =>
      paths.some((path) => {
        if (!groupMatches(path, rule)) return false;
        if (rule.exact?.includes(path)) return true;
        if (!isValidationOnlyPath(path)) return true;
        if (name === "Supply Chain Guardrails") return true;
        if (name === "Design" && isStoryPath(path)) return true;
        return name.toLowerCase() === owningSurface(path);
      }),
    )
    .map(([name]) => name)
    .sort();
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)]),
    );
  }
  return value;
}

export function buildReceiptInputs(plan, check) {
  const inputs = {
    policyVersion: plan.policyVersion,
    requestedIntent: plan.requestedIntent,
    effectiveIntent: plan.effectiveIntent,
    requestedCheckpointScope: plan.requestedCheckpointScope,
    checkpointScope: plan.checkpointScope,
    risk: plan.risk,
    base: plan.base,
    head: plan.head,
    workingCopyFingerprint: plan.workingCopyFingerprint,
    changedPaths: [...plan.changedPaths],
    testPaths: plan.testPaths,
    requestedChecks: [...plan.requestedChecks],
    checkId: check.id,
    command: check.command,
    cwd: check.cwd ?? ".",
    environment: plan.environment,
    freshness: check.freshness,
    cacheReuse: {
      allowed: true,
      optInRequired: true,
      failuresCacheable: false,
    },
  };
  const fingerprint = fingerprintReceiptInputs(inputs);
  return { ...inputs, fingerprint };
}

export function fingerprintReceiptInputs(receiptInputs) {
  const { fingerprint: _ignored, ...inputs } = receiptInputs;
  return createHash("sha256").update(JSON.stringify(stableValue(inputs))).digest("hex");
}

export function parseCliArgs(argv) {
  const options = {
    intent: "checkpoint",
    checkpointScope: "workspace",
    changedPaths: [],
    capabilities: {},
    testPaths: {},
    checkIds: [],
    json: false,
    ci: false,
    cancelled: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[++index];
      if (!value) throw new Error(`${arg} requires a value`);
      return value;
    };
    switch (arg) {
      case "--intent":
        options.intent = next();
        break;
      case "--checkpoint-scope":
        options.checkpointScope = next();
        break;
      case "--base":
        options.base = next();
        break;
      case "--head":
        options.head = next();
        break;
      case "--changed":
        options.changedPaths.push(...next().split(",").filter(Boolean));
        break;
      case "--changed-file":
        options.changedPaths.push(
          ...readFileSync(resolve(process.cwd(), next()), "utf8").split(/\r?\n/).filter(Boolean),
        );
        break;
      case "--risk":
        options.risk = next();
        break;
      case "--test-path": {
        const value = next();
        const separator = value.indexOf(":");
        if (separator < 1) throw new Error("--test-path must use surface:path");
        const surface = value.slice(0, separator);
        const path = value.slice(separator + 1);
        (options.testPaths[surface] ??= []).push(path);
        break;
      }
      case "--check":
        options.checkIds.push(next());
        break;
      case "--environment":
        options.environmentProfile = next();
        break;
      case "--capability": {
        const [name, rawValue] = next().split("=", 2);
        if (!name || !["true", "false"].includes(rawValue)) {
          throw new Error("--capability must use name=true or name=false");
        }
        options.capabilities[name] = rawValue === "true";
        break;
      }
      case "--ci":
        options.ci = true;
        break;
      case "--cancelled":
        options.cancelled = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (
    options.intent === "checkpoint" &&
    options.checkpointScope === "lane" &&
    options.changedPaths.length === 0 &&
    !options.cancelled
  ) {
    throw new Error("Lane checkpoint requires --changed or --changed-file");
  }
  return options;
}

function gitOutput(args, cwd = projectRoot) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function gitRawOutput(args, cwd = projectRoot) {
  return execFileSync("git", args, { cwd });
}

function lines(value) {
  return value.split(/\r?\n/).filter(Boolean);
}

function workingCopyFingerprint(cwd, committedPatch, stagedPatch, unstagedPatch, untrackedPaths) {
  const hash = createHash("sha256");
  hash.update("validation-working-copy-v1\0");
  for (const [label, patch] of [
    ["committed", committedPatch],
    ["staged", stagedPatch],
    ["unstaged", unstagedPatch],
  ]) {
    hash.update(`${label}\0`);
    hash.update(patch);
    hash.update("\0");
  }
  for (const path of [...untrackedPaths].sort()) {
    hash.update(`untracked\0${path}\0`);
    const absolutePath = resolve(cwd, path);
    if (absolutePath !== cwd && !absolutePath.startsWith(`${cwd}${sep}`)) {
      throw new Error(`Untracked path escaped repository root: ${path}`);
    }
    const stat = lstatSync(absolutePath);
    if (stat.isSymbolicLink()) hash.update(`symlink:${readlinkSync(absolutePath)}`);
    else if (stat.isFile()) hash.update(readFileSync(absolutePath));
    else hash.update(`unsupported:${stat.mode}`);
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function resolveGitInputs(options, { cwd = projectRoot } = {}) {
  const base = options.base ?? "origin/develop";
  const head = options.head ?? "HEAD";
  const resolvedBase = gitOutput(["rev-parse", base], cwd);
  const resolvedHead = gitOutput(["rev-parse", head], cwd);
  const explicitPaths = normalizePaths(options.changedPaths);
  const laneCheckpoint =
    (options.intent ?? "checkpoint") === "checkpoint" &&
    options.checkpointScope === "lane" &&
    options.ci !== true;
  if (laneCheckpoint && explicitPaths.length === 0) {
    throw new Error("Lane checkpoint requires explicit changed paths");
  }
  const pathspec = laneCheckpoint ? ["--", ...explicitPaths] : [];
  const committedPatch = gitRawOutput(
    ["diff", "--binary", `${resolvedBase}...${resolvedHead}`, ...pathspec],
    cwd,
  );
  const stagedPatch = gitRawOutput(["diff", "--cached", "--binary", ...pathspec], cwd);
  const unstagedPatch = gitRawOutput(["diff", "--binary", ...pathspec], cwd);
  const committedPaths = lines(
    gitOutput(["diff", "--name-only", `${resolvedBase}...${resolvedHead}`], cwd),
  );
  const stagedPaths = lines(gitOutput(["diff", "--cached", "--name-only"], cwd));
  const unstagedPaths = lines(gitOutput(["diff", "--name-only"], cwd));
  const untrackedPaths = lines(gitOutput(["ls-files", "--others", "--exclude-standard"], cwd));
  const deletedPaths = normalizePaths([
    ...lines(
      gitOutput(
        ["diff", "--name-only", "--diff-filter=D", `${resolvedBase}...${resolvedHead}`],
        cwd,
      ),
    ),
    ...lines(gitOutput(["diff", "--cached", "--name-only", "--diff-filter=D"], cwd)),
    ...lines(gitOutput(["diff", "--name-only", "--diff-filter=D"], cwd)),
  ]).filter((path) => !existsSync(resolve(cwd, path)));
  const changedPaths =
    explicitPaths.length > 0
      ? explicitPaths
      : normalizePaths([...committedPaths, ...stagedPaths, ...unstagedPaths, ...untrackedPaths]);
  const fingerprintUntrackedPaths = laneCheckpoint
    ? untrackedPaths.filter((path) =>
        explicitPaths.some(
          (explicitPath) => path === explicitPath || path.startsWith(`${explicitPath}/`),
        ),
      )
    : untrackedPaths;
  return {
    base: resolvedBase,
    head: resolvedHead,
    changedPaths,
    deletedPaths,
    workingCopyFingerprint: workingCopyFingerprint(
      cwd,
      committedPatch,
      stagedPatch,
      unstagedPatch,
      fingerprintUntrackedPaths,
    ),
  };
}

export function detectCliToolchain(options = {}) {
  const execute = options.execFileSync ?? execFileSync;
  const version = (command, args) => {
    try {
      return String(
        execute(command, args, {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }),
      ).trim();
    } catch {
      return null;
    }
  };
  const bunOutput = version("bun", ["--version"]);
  const foundryOutput = version("forge", ["--version"]);
  const foundryVersion = foundryOutput?.match(/\d+\.\d+\.\d+/)?.[0] ?? null;
  return {
    node: options.nodeVersion ?? process.versions.node,
    ...(bunOutput ? { bun: bunOutput } : {}),
    ...(foundryVersion ? { foundry: foundryVersion } : {}),
  };
}

function showHelp() {
  console.log(`Usage: node scripts/quality/select-validation.mjs [options]

Scope: readiness and release always cover the full repository. Push, ship, and local merge use
changed-path scope, falling back to the full repository only when no changed paths are found.
CI-authoritative merge remains changed-path scoped.

Options:
  --intent <intent>       diagnose|qa|review|checkpoint|readiness|push|ship|merge|release
  --checkpoint-scope <s>  lane|workspace; lane requires explicit changed paths
  --base <revision>       Base revision (default: origin/develop)
  --head <revision>       Head revision (default: HEAD)
  --changed <paths>       Comma-separated changed paths; repeatable
  --changed-file <file>   Read changed paths from a newline-delimited file
  --risk <risk>           routine|sensitive|critical (paths can only escalate it)
  --test-path <pkg:path>  Use a focused package-relative test path; repeatable
  --check <check-id>      Add an explicit acceptance check; repeatable
  --environment <name>    Environment profile label
  --capability k=true     Record an available/unavailable environment capability
  --ci                    Make merge intent authoritative while preserving CI path scope
  --cancelled             Emit a terminal cancelled plan
  --json                  Emit JSON (default output is a readable summary)
  --help, -h              Show this help`);
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.help) {
    showHelp();
    return;
  }
  const git = options.cancelled
    ? { base: options.base ?? null, head: options.head ?? null, changedPaths: options.changedPaths }
    : resolveGitInputs(options);
  const plan = selectValidation({
    intent: options.intent,
    checkpointScope: options.checkpointScope,
    risk: options.risk,
    testPaths: options.testPaths,
    checkIds: options.checkIds,
    ci: options.ci,
    cancelled: options.cancelled,
    ...git,
    environment: {
      profile: options.environmentProfile,
      toolchain: detectCliToolchain(),
      capabilities: options.capabilities,
    },
  });
  if (options.json) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  console.log(
    `Validation plan: ${plan.status} · ${plan.effectiveIntent} · ${plan.risk} · ${plan.changedPaths.length} changed path(s)`,
  );
  for (const check of plan.checks) {
    const suffix = check.blockedBy.length > 0 ? ` (blocked: ${check.blockedBy.join(", ")})` : "";
    console.log(`- ${check.id}: ${check.state}${suffix}`);
  }
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
