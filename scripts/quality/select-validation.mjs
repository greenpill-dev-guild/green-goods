#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
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

function groupMatches(path, rule) {
  const groups = [];
  if (rule.exact?.length) groups.push(rule.exact.includes(path));
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
  const all = ["contracts", "shared", "indexer", "client", "admin", "agent", "docs"];
  if (fullRepository) return new Set(all);
  if (paths.length === 0) return new Set();

  const surfaces = new Set();
  for (const rule of policy.surfaceRules ?? []) {
    if (!ruleMatches(paths, rule)) continue;
    if (rule.surface === "all") all.forEach((surface) => surfaces.add(surface));
    else surfaces.add(rule.surface);
  }
  return surfaces;
}

function addSurfaceChecks(ids, surface, { includeBuilds, intent }) {
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

  for (const id of checks[surface] ?? []) ids.add(id);
  if (includeBuilds && builds[surface]) ids.add(builds[surface]);
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
  const testPaths = normalizeTestPaths(input.testPaths);
  const requestedChecks = normalizePaths(input.checkIds);
  const baseRisk = input.risk ?? "routine";

  const planIdentity = {
    policyVersion: policy.version,
    requestedIntent,
    effectiveIntent: intent,
    ci,
    base: input.base ?? null,
    head: input.head ?? null,
    workingCopyFingerprint: input.workingCopyFingerprint ?? null,
    changedPaths,
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
  const fullRepository =
    ["readiness", "push", "ship", "release"].includes(intent) ||
    (intent === "merge" && !ci);
  const surfaces = impactedSurfaces(policy, changedPaths, fullRepository);
  const selected = new Set();
  const evidenceOnly = ["diagnose", "review"].includes(intent);
  const hasAutomaticScope = changedPaths.length > 0 || fullRepository;

  const knownCheckIds = new Set(policy.checks.map((check) => check.id));
  for (const id of requestedChecks) {
    if (!knownCheckIds.has(id)) throw new Error(`Unknown requested validation check: ${id}`);
    selected.add(id);
  }

  if (!evidenceOnly && hasAutomaticScope) selected.add("format");
  if (
    intent === "qa" &&
    changedPaths.some((path) => [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"].some((extension) => path.endsWith(extension)))
  ) {
    selected.add("lint");
  }
  if (
    hasAutomaticScope &&
    ["checkpoint", "readiness", "push", "ship", "merge", "release"].includes(intent)
  ) {
    selected.add("lint");
  }

  const includeBuilds = ["readiness", "push", "ship", "merge", "release"].includes(intent);
  if (evidenceOnly) {
    for (const surface of Object.keys(testPaths)) {
      const testId = `${surface}-test`;
      if (!knownCheckIds.has(testId)) throw new Error(`Unknown focused-test surface: ${surface}`);
      selected.add(testId);
    }
  } else {
    for (const surface of surfaces) {
      addSurfaceChecks(selected, surface, { includeBuilds, intent });
      if (
        intent === "qa" &&
        ["client", "admin"].includes(surface) &&
        isUiBuildImpact(changedPaths, surface)
      ) {
        selected.add(`${surface}-build`);
      }
      if (
        intent === "qa" &&
        surface === "agent" &&
        changedPaths.some((path) => path.startsWith("packages/agent/src/"))
      ) {
        selected.add("agent-build");
      }
    }
  }

  if (["readiness", "push", "ship", "release"].includes(intent)) {
    selected.add("abi-artifacts");
    selected.add("contracts-verify-fast");
  }
  for (const rule of evidenceOnly ? [] : (policy.conditionalRules ?? [])) {
    if (!ruleMatches(changedPaths, rule)) continue;
    if (intent === "qa" && !["browser-proof", "ontology"].includes(rule.check)) continue;
    selected.add(rule.check);
  }

  const mandatory = new Set();
  for (const rule of evidenceOnly ? [] : hardRules) {
    for (const id of rule.checks) {
      selected.add(id);
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
      materializeCheck(check, environment, mandatory.has(check.id), testPaths, {
        intent,
        ci,
        changedPaths,
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
  const focusedPaths = surface ? testPaths[surface] ?? [] : [];
  let command =
    focusedPaths.length > 0 ? `${check.command} ${focusedPaths.join(" ")}` : check.command;
  if (
    check.id === "format" &&
    !context.ci &&
    ["push", "ship", "release"].includes(context.intent)
  ) {
    command = "bun format";
  }
  if (
    check.id === "format" &&
    ["diagnose", "review", "qa"].includes(context.intent) &&
    context.changedPaths.length > 0
  ) {
    command = `bunx @biomejs/biome format ${context.changedPaths.map(shellQuote).join(" ")}`;
  }
  if (check.id === "lint" && context.intent === "qa") {
    const sourcePaths = context.changedPaths.filter((path) =>
      [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"].some((extension) =>
        path.endsWith(extension),
      ),
    );
    command = `bun --bun run oxlint ${sourcePaths.map(shellQuote).join(" ")} --deny-warnings`;
  }
  let budgetSeconds = focusedPaths.length > 0 ? Math.min(check.budgetSeconds, 60) : check.budgetSeconds;
  if (check.id === "format" && ["diagnose", "review", "qa"].includes(context.intent)) {
    budgetSeconds = Math.min(budgetSeconds, 10);
  }
  if (check.id === "lint" && context.intent === "qa") budgetSeconds = Math.min(budgetSeconds, 15);
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
    .filter(([, rule]) => ruleMatches(paths, rule))
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
  const committedPatch = gitRawOutput(
    ["diff", "--binary", `${resolvedBase}...${resolvedHead}`],
    cwd,
  );
  const stagedPatch = gitRawOutput(["diff", "--cached", "--binary"], cwd);
  const unstagedPatch = gitRawOutput(["diff", "--binary"], cwd);
  const committedPaths = lines(
    gitOutput(["diff", "--name-only", `${resolvedBase}...${resolvedHead}`], cwd),
  );
  const stagedPaths = lines(gitOutput(["diff", "--cached", "--name-only"], cwd));
  const unstagedPaths = lines(gitOutput(["diff", "--name-only"], cwd));
  const untrackedPaths = lines(gitOutput(["ls-files", "--others", "--exclude-standard"], cwd));
  const changedPaths =
    options.changedPaths.length > 0
      ? normalizePaths(options.changedPaths)
      : normalizePaths([...committedPaths, ...stagedPaths, ...unstagedPaths, ...untrackedPaths]);
  return {
    base: resolvedBase,
    head: resolvedHead,
    changedPaths,
    workingCopyFingerprint: workingCopyFingerprint(
      cwd,
      committedPatch,
      stagedPatch,
      unstagedPatch,
      untrackedPaths,
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

Options:
  --intent <intent>       diagnose|qa|review|checkpoint|readiness|push|ship|merge|release
  --base <revision>       Base revision (default: origin/develop)
  --head <revision>       Head revision (default: HEAD)
  --changed <paths>       Comma-separated changed paths; repeatable
  --changed-file <file>   Read changed paths from a newline-delimited file
  --risk <risk>           routine|sensitive|critical (paths can only escalate it)
  --test-path <pkg:path>  Use a focused package-relative test path; repeatable
  --check <check-id>      Add an explicit acceptance check; repeatable
  --environment <name>    Environment profile label
  --capability k=true     Record an available/unavailable environment capability
  --ci                    Make merge intent authoritative
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
